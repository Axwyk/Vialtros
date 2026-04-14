from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Driver, Passenger, Route, Tracking, User


@override_settings(TRACKING_INGEST_TOKEN='gps-demo-token')
class TrackingIngestTests(APITestCase):
	def setUp(self):
		self.driver_user = User.objects.create_user(
			username='driver_ingest',
			password='secreto123',
			role='driver',
		)
		self.driver = Driver.objects.create(user=self.driver_user, license_number='DRV-001')
		self.route = Route.objects.create(
			name='Ruta GPS',
			origin='Centro',
			destination='Terminal',
			driver=self.driver,
		)

	def test_ingest_allows_service_token_without_passenger(self):
		timestamp = timezone.now().replace(microsecond=0)

		response = self.client.post(
			'/api/tracking/ingest/',
			{
				'route': self.route.id,
				'latitude': 3.8891,
				'longitude': -77.0284,
				'status': 'picked',
				'timestamp': timestamp.isoformat(),
				'speed_kmh': 31.4,
				'source': 'gps-device-001',
			},
			format='json',
			HTTP_X_TRACKING_TOKEN='gps-demo-token',
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(Tracking.objects.count(), 1)

		tracking = Tracking.objects.get()
		self.assertIsNone(tracking.passenger)
		self.assertEqual(tracking.route_id, self.route.id)
		self.assertEqual(tracking.speed_kmh, 31.4)
		self.assertEqual(response.data['route'], self.route.id)
		self.assertEqual(response.data['source'], 'gps-device-001')
		self.assertEqual(response.data['speed_kmh'], 31.4)
		self.assertTrue(response.data['timestamp'].startswith(timestamp.isoformat().replace('+00:00', '')))

	def test_ingest_rejects_invalid_service_token(self):
		response = self.client.post(
			'/api/tracking/ingest/',
			{
				'route': self.route.id,
				'latitude': 3.8891,
				'longitude': -77.0284,
			},
			format='json',
			HTTP_X_TRACKING_TOKEN='token-invalido',
		)

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(Tracking.objects.count(), 0)

	@override_settings(DEBUG=True, TRACKING_INGEST_TOKEN='')
	def test_ingest_allows_local_dev_token_in_debug(self):
		response = self.client.post(
			'/api/tracking/ingest/',
			{
				'route': self.route.id,
				'latitude': 3.8891,
				'longitude': -77.0284,
			},
			format='json',
			HTTP_X_TRACKING_TOKEN='local-dev-access',
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(Tracking.objects.count(), 1)


class RouteMonitoringSummaryTests(APITestCase):
	def setUp(self):
		self.admin_user = User.objects.create_user(
			username='admin_monitor',
			password='secreto123',
			role='admin',
		)
		self.driver_user = User.objects.create_user(
			username='driver_monitor',
			password='secreto123',
			role='driver',
		)
		self.driver = Driver.objects.create(user=self.driver_user, license_number='DRV-777')
		self.route_live = Route.objects.create(
			name='Ruta Centro',
			origin='Centro',
			destination='Colegio',
			driver=self.driver,
		)
		self.route_without_driver = Route.objects.create(
			name='Ruta Norte',
			origin='Terminal',
			destination='Campus',
		)
		self.route_stale = Route.objects.create(
			name='Ruta Sur',
			origin='Muelle',
			destination='Barrio Bellavista',
			driver=self.driver,
		)
		self.passenger_one = Passenger.objects.create(
			user=User.objects.create_user(username='student_one', password='secreto123', role='user'),
			phone='111',
		)
		self.passenger_two = Passenger.objects.create(
			user=User.objects.create_user(username='student_two', password='secreto123', role='user'),
			phone='222',
		)
		self.route_live.passengers.add(self.passenger_one, self.passenger_two)

		now = timezone.now()
		Tracking.objects.create(
			route=self.route_live,
			passenger=self.passenger_one,
			status='not_picked',
			latitude=3.8845,
			longitude=-77.0325,
			timestamp=now - timezone.timedelta(minutes=3),
		)
		Tracking.objects.create(
			route=self.route_live,
			passenger=self.passenger_one,
			status='picked',
			latitude=3.8905,
			longitude=-77.0260,
			timestamp=now - timezone.timedelta(minutes=1),
		)
		Tracking.objects.create(
			route=self.route_live,
			passenger=self.passenger_two,
			status='not_picked',
			latitude=3.8904,
			longitude=-77.0262,
			timestamp=now - timezone.timedelta(minutes=1),
		)
		Tracking.objects.create(
			route=self.route_stale,
			latitude=3.88,
			longitude=-77.03,
			timestamp=now - timezone.timedelta(minutes=12),
		)

		self.client.force_authenticate(user=self.admin_user)

	def test_monitoring_summary_returns_backend_progress_and_alerts(self):
		response = self.client.get('/api/routes/monitoring-summary/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['stats']['students_total'], 2)
		self.assertEqual(response.data['stats']['vehicles_active'], 1)

		route_live = next(item for item in response.data['routes'] if item['id'] == self.route_live.id)
		self.assertEqual(route_live['progress_percent'], 50)
		self.assertEqual(route_live['students_picked'], 1)
		self.assertEqual(route_live['state_label'], 'En seguimiento')

		route_without_driver = next(item for item in response.data['routes'] if item['id'] == self.route_without_driver.id)
		self.assertEqual(route_without_driver['state_label'], 'Sin conductor')

		alert_titles = [alert['title'] for alert in response.data['alerts']]
		self.assertIn('Rutas sin conductor', alert_titles)
		self.assertIn('Señal desactualizada', alert_titles)
		self.assertIn('Recogida al 50% o menos', alert_titles)

		stale_signal_alert = next(alert for alert in response.data['alerts'] if alert['title'] == 'Señal desactualizada')
		self.assertIn(self.route_stale.id, stale_signal_alert['route_ids'])
