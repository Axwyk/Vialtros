from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Driver, Route, Tracking, User


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
