from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.contrib.auth import get_user_model
from .serializers import (
    UserSerializer, UserCreateSerializer,
    RouteSerializer, TrackingSerializer, TrackingIngestSerializer,
    DriverSerializer, PassengerSerializer,
)
from .models import Route, Tracking, Driver, Passenger
from .permissions import IsAdmin, IsDriver, IsPassenger

User = get_user_model()
LOCAL_DEV_INGEST_TOKEN = 'local-dev-access'
ADMIN_STALE_SIGNAL_MINUTES = 10
ADMIN_IDLE_SPEED_KMH = 3


def calculate_distance_km(start, end):
    if not start or not end:
        return 0

    delta_lat = end[0] - start[0]
    delta_lng = end[1] - start[1]
    return ((delta_lat * delta_lat) + (delta_lng * delta_lng)) ** 0.5 * 111


def estimate_speed_kmh(previous_tracking, latest_tracking):
    if not previous_tracking or not latest_tracking:
        return 0

    previous_time = previous_tracking.timestamp.timestamp()
    latest_time = latest_tracking.timestamp.timestamp()
    elapsed_hours = (latest_time - previous_time) / 3600
    if elapsed_hours <= 0:
        return 0

    distance_km = calculate_distance_km(
        (previous_tracking.latitude, previous_tracking.longitude),
        (latest_tracking.latitude, latest_tracking.longitude),
    )
    return max(0, round(distance_km / elapsed_hours))


def build_admin_monitoring_summary(routes):
    now = timezone.now()
    route_ids = [route.id for route in routes]
    trackings = list(
        Tracking.objects.filter(route_id__in=route_ids)
        .select_related('passenger')
        .order_by('route_id', 'passenger_id', 'timestamp', 'id')
    )

    route_trackings = {}
    latest_by_route = {}
    previous_by_route = {}
    latest_by_route_passenger = {}

    for tracking in trackings:
        route_id = tracking.route_id
        route_trackings.setdefault(route_id, []).append(tracking)

        if tracking.passenger_id is None:
            continue

        route_passenger_map = latest_by_route_passenger.setdefault(route_id, {})
        route_passenger_map[tracking.passenger_id] = tracking

    for route_id, route_entries in route_trackings.items():
        ordered_entries = sorted(route_entries, key=lambda item: (item.timestamp, item.id))
        latest_tracking = ordered_entries[-1]
        latest_by_route[route_id] = latest_tracking

        previous_tracking = next(
            (
                entry for entry in reversed(ordered_entries[:-1])
                if entry.timestamp < latest_tracking.timestamp
            ),
            None,
        )
        if previous_tracking is not None:
            previous_by_route[route_id] = previous_tracking

    route_summaries = []
    active_vehicles = []
    alerts = []
    routes_without_driver = 0
    routes_without_driver_ids = []
    stale_signal_routes = 0
    stale_signal_route_ids = []
    stopped_vehicle_routes = 0
    stopped_vehicle_route_ids = []
    delayed_pickup_routes = 0
    delayed_pickup_route_ids = []
    total_students = 0
    no_signal_route_ids = []

    for route in routes:
        total_passengers = route.passengers.count()
        total_students += total_passengers

        latest_tracking = latest_by_route.get(route.id)
        previous_tracking = previous_by_route.get(route.id)
        passenger_trackings = latest_by_route_passenger.get(route.id, {})
        picked_count = sum(1 for tracking in passenger_trackings.values() if tracking.status == 'picked')
        progress_percent = round((picked_count / total_passengers) * 100) if total_passengers > 0 else 0

        signal_age_minutes = None
        is_live = False
        speed_kmh = 0
        if latest_tracking is not None:
            signal_age_minutes = max(0, round((now - latest_tracking.timestamp).total_seconds() / 60))
            is_live = signal_age_minutes <= ADMIN_STALE_SIGNAL_MINUTES
            if latest_tracking.speed_kmh is not None:
                speed_kmh = max(0, round(latest_tracking.speed_kmh))
            else:
                speed_kmh = estimate_speed_kmh(previous_tracking, latest_tracking)

        has_stale_signal = signal_age_minutes is not None and signal_age_minutes > ADMIN_STALE_SIGNAL_MINUTES

        if route.driver_id is None:
            state_label = 'Sin conductor'
            routes_without_driver += 1
            routes_without_driver_ids.append(route.id)
        elif not latest_tracking:
            state_label = 'Sin señal'
            no_signal_route_ids.append(route.id)
        elif has_stale_signal:
            state_label = 'Señal desactualizada'
            stale_signal_routes += 1
            stale_signal_route_ids.append(route.id)
        elif speed_kmh <= ADMIN_IDLE_SPEED_KMH:
            state_label = 'Detenido'
            stopped_vehicle_routes += 1
            stopped_vehicle_route_ids.append(route.id)
        else:
            state_label = 'En seguimiento'

        route_summary = {
            'id': route.id,
            'name': route.name,
            'origin': route.origin,
            'destination': route.destination,
            'driver_name': route.driver.user.username if route.driver_id else 'Sin asignar',
            'progress_percent': progress_percent,
            'state_label': state_label,
            'is_live': is_live,
            'students_total': total_passengers,
            'students_picked': picked_count,
            'signal_age_minutes': signal_age_minutes,
        }
        route_summaries.append(route_summary)

        if latest_tracking and is_live:
            active_vehicles.append({
                'route_id': route.id,
                'route_name': route.name,
                'label': route.driver.license_number if route.driver_id else route.name,
                'latitude': latest_tracking.latitude,
                'longitude': latest_tracking.longitude,
                'speed_kmh': speed_kmh,
                'students_onboard': picked_count,
                'progress_percent': progress_percent,
                'status': 'En ruta' if speed_kmh > ADMIN_IDLE_SPEED_KMH else 'Detenido',
                'signal_age_minutes': signal_age_minutes,
            })

        if total_passengers > 0 and progress_percent <= 50 and is_live:
            delayed_pickup_routes += 1
            delayed_pickup_route_ids.append(route.id)

    if not active_vehicles:
        alerts.append({
            'id': 'without-active-vehicles',
            'tone': 'critical',
            'title': 'Sin vehiculos activos',
            'detail': 'No hay reportes de posicion vigentes en las rutas monitoreadas.',
            'route_ids': no_signal_route_ids or [route.id for route in routes],
        })

    if routes_without_driver:
        alerts.append({
            'id': 'routes-without-driver',
            'tone': 'warning',
            'title': 'Rutas sin conductor',
            'detail': f'{routes_without_driver} ruta(s) no tienen conductor asignado.',
            'route_ids': routes_without_driver_ids,
        })

    if stale_signal_routes:
        alerts.append({
            'id': 'stale-signal-routes',
            'tone': 'warning',
            'title': 'Señal desactualizada',
            'detail': f'{stale_signal_routes} ruta(s) superan {ADMIN_STALE_SIGNAL_MINUTES} minutos sin telemetria reciente.',
            'route_ids': stale_signal_route_ids,
        })

    if stopped_vehicle_routes:
        alerts.append({
            'id': 'stopped-vehicles',
            'tone': 'info',
            'title': 'Vehiculos detenidos',
            'detail': f'{stopped_vehicle_routes} vehiculo(s) activos aparecen con velocidad operativa baja.',
            'route_ids': stopped_vehicle_route_ids,
        })

    if delayed_pickup_routes:
        alerts.append({
            'id': 'low-pickup-progress',
            'tone': 'info',
            'title': 'Recogida al 50% o menos',
            'detail': f'{delayed_pickup_routes} ruta(s) activas presentan avance bajo frente a sus estudiantes asignados.',
            'route_ids': delayed_pickup_route_ids,
        })

    route_summaries.sort(key=lambda item: (not item['is_live'], -item['progress_percent'], item['name']))
    active_vehicles.sort(key=lambda item: (item['status'] != 'En ruta', -item['speed_kmh'], item['route_name']))

    return {
        'stats': {
            'routes_total': len(routes),
            'vehicles_registered': sum(1 for route in routes if route.driver_id),
            'vehicles_active': len(active_vehicles),
            'students_total': total_students,
        },
        'routes': route_summaries,
        'active_vehicles': active_vehicles,
        'alerts': alerts[:5],
    }


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('id')
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return UserCreateSerializer
        return UserSerializer

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def dashboard_stats(self, request):
        user = request.user

        if user.role == 'admin':
            return Response({
                'routes': Route.objects.count(),
                'vehicles': Driver.objects.count(),
                'users': User.objects.count(),
                'trackings': Tracking.objects.count(),
            })

        if user.role == 'driver':
            try:
                driver = Driver.objects.get(user=user)
            except Driver.DoesNotExist:
                return Response({'routes': 0, 'vehicles': 0, 'users': 0, 'trackings': 0})

            routes_qs = Route.objects.filter(driver=driver)
            passenger_count = Passenger.objects.filter(route__in=routes_qs).distinct().count()
            tracking_count = Tracking.objects.filter(route__in=routes_qs).count()

            return Response({
                'routes': routes_qs.count(),
                'users': passenger_count,
                'trackings': tracking_count,
            })

        if user.role == 'user':
            try:
                passenger = Passenger.objects.get(user=user)
            except Passenger.DoesNotExist:
                return Response({'routes': 0, 'users': 0, 'trackings': 0})

            routes_qs = Route.objects.filter(passengers=passenger)
            route = routes_qs.first()
            classmates_count = route.passengers.count() if route else 0

            return Response({
                'routes': routes_qs.count(),
                'users': classmates_count,
                'trackings': Tracking.objects.filter(passenger=passenger).count(),
            })

        return Response({'routes': 0, 'users': 0, 'trackings': 0})

    @action(detail=False, methods=['get'], permission_classes=[IsDriver])
    def assigned_users(self, request):
        try:
            driver = Driver.objects.get(user=request.user)
        except Driver.DoesNotExist:
            return Response({'detail': 'No es conductor'}, status=status.HTTP_403_FORBIDDEN)
        routes = Route.objects.filter(driver=driver)
        passengers = Passenger.objects.filter(route__in=routes).distinct()
        return Response(PassengerSerializer(passengers, many=True).data)

    @action(detail=False, methods=['get'], permission_classes=[IsDriver])
    def assigned_routes(self, request):
        try:
            driver = Driver.objects.get(user=request.user)
        except Driver.DoesNotExist:
            return Response({'detail': 'No es conductor'}, status=status.HTTP_403_FORBIDDEN)
        routes = Route.objects.filter(driver=driver).prefetch_related('passengers__user').order_by('id')
        return Response(RouteSerializer(routes, many=True).data)

    @action(detail=False, methods=['get'], permission_classes=[IsPassenger])
    def my_conductor(self, request):
        try:
            passenger = Passenger.objects.get(user=request.user)
        except Passenger.DoesNotExist:
            return Response({'detail': 'No es pasajero'}, status=status.HTTP_403_FORBIDDEN)
        routes = Route.objects.filter(passengers=passenger)
        if not routes.exists():
            return Response({'detail': 'No tiene ruta asignada'}, status=status.HTTP_404_NOT_FOUND)
        route = routes.first()
        return Response({
            'route': RouteSerializer(route).data,
            'driver': DriverSerializer(route.driver).data if route.driver else None,
        })


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.select_related('user').all().order_by('id')
    serializer_class = DriverSerializer
    permission_classes = [IsAdmin]


class PassengerViewSet(viewsets.ModelViewSet):
    queryset = Passenger.objects.select_related('user').all().order_by('id')
    serializer_class = PassengerSerializer
    permission_classes = [IsAdmin]


class RouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.select_related('driver').prefetch_related('passengers').all().order_by('id')
    serializer_class = RouteSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return Route.objects.select_related('driver__user').prefetch_related('passengers').all().order_by('id')

    @action(detail=False, methods=['get'], permission_classes=[IsAdmin], url_path='monitoring-summary')
    def monitoring_summary(self, request):
        routes = list(self.get_queryset())
        return Response(build_admin_monitoring_summary(routes))

    @action(detail=True, methods=['post'])
    def assign_driver(self, request, pk=None):
        route = self.get_object()
        driver_id = request.data.get('driver_id')
        try:
            driver = Driver.objects.get(id=driver_id)
        except Driver.DoesNotExist:
            return Response({'detail': 'Conductor no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        route.driver = driver
        route.save()
        return Response({'detail': 'Conductor asignado'})

    @action(detail=True, methods=['post'])
    def assign_passenger(self, request, pk=None):
        route = self.get_object()
        passenger_id = request.data.get('passenger_id')
        try:
            passenger = Passenger.objects.get(id=passenger_id)
        except Passenger.DoesNotExist:
            return Response({'detail': 'Pasajero no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        route.passengers.add(passenger)
        return Response({'detail': 'Pasajero asignado'})

    @action(detail=True, methods=['post'])
    def remove_passenger(self, request, pk=None):
        route = self.get_object()
        passenger_id = request.data.get('passenger_id')
        try:
            passenger = Passenger.objects.get(id=passenger_id)
        except Passenger.DoesNotExist:
            return Response({'detail': 'Pasajero no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        route.passengers.remove(passenger)
        return Response({'detail': 'Pasajero removido'})


class TrackingViewSet(viewsets.ModelViewSet):
    queryset = Tracking.objects.all()
    serializer_class = TrackingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _resolve_ingest_token(self, request):
        header_token = (request.headers.get('X-Tracking-Token') or '').strip()
        if header_token:
            return header_token

        auth_header = (request.headers.get('Authorization') or '').strip()
        if auth_header.lower().startswith('token '):
            return auth_header[6:].strip()

        return ''

    def _can_ingest_route(self, request, route):
        user = request.user
        if getattr(user, 'is_authenticated', False):
            if user.role == 'admin':
                return True
            if user.role == 'driver':
                try:
                    driver = Driver.objects.get(user=user)
                except Driver.DoesNotExist:
                    return False
                return route.driver_id == driver.id

        expected_token = getattr(settings, 'TRACKING_INGEST_TOKEN', '').strip()
        provided_token = self._resolve_ingest_token(request)

        if settings.DEBUG and provided_token == LOCAL_DEV_INGEST_TOKEN:
            return True

        return bool(expected_token and provided_token and provided_token == expected_token)

    def _broadcast_tracking(self, payload):
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        async_to_sync(channel_layer.group_send)(
            f"tracking_{payload['route']}",
            {
                'type': 'tracking_update',
                'data': {
                    'event': 'position_update',
                    'data': payload,
                },
            },
        )

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Tracking.objects.all()
        elif user.role == 'driver':
            try:
                driver = Driver.objects.get(user=user)
            except Driver.DoesNotExist:
                return Tracking.objects.none()
            return Tracking.objects.filter(route__in=Route.objects.filter(driver=driver))
        elif user.role == 'user':
            try:
                passenger = Passenger.objects.get(user=user)
            except Passenger.DoesNotExist:
                return Tracking.objects.none()
            return Tracking.objects.filter(passenger=passenger)

    @action(detail=True, methods=['post', 'put'], permission_classes=[IsDriver])
    def update_status(self, request, pk=None):
        tracking = self.get_object()
        new_status = request.data.get('status')
        if new_status not in ['picked', 'not_picked']:
            return Response({'detail': 'Estado inválido. Use "picked" o "not_picked".'}, status=status.HTTP_400_BAD_REQUEST)
        tracking.status = new_status
        tracking.save()
        serializer = self.get_serializer(tracking)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsDriver])
    def update_status_by_passenger(self, request):
        route_id = request.data.get('route_id')
        passenger_id = request.data.get('passenger_id')
        new_status = request.data.get('status')

        if new_status not in ['picked', 'not_picked']:
            return Response({'detail': 'Estado inválido. Use "picked" o "not_picked".'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            driver = Driver.objects.get(user=request.user)
        except Driver.DoesNotExist:
            return Response({'detail': 'No es conductor'}, status=status.HTTP_403_FORBIDDEN)

        try:
            route = Route.objects.get(id=route_id)
        except Route.DoesNotExist:
            return Response({'detail': 'Ruta no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        if route.driver != driver:
            return Response({'detail': 'No tienes permiso para actualizar esta ruta'}, status=status.HTTP_403_FORBIDDEN)

        try:
            passenger = Passenger.objects.get(id=passenger_id)
        except Passenger.DoesNotExist:
            return Response({'detail': 'Pasajero no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        tracking, created = Tracking.objects.get_or_create(
            route=route,
            passenger=passenger,
            defaults={
                'latitude': 0.0,
                'longitude': 0.0,
                'status': new_status,
            }
        )
        if not created:
            tracking.status = new_status
            tracking.save()

        serializer = self.get_serializer(tracking)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny], url_path='ingest')
    def ingest(self, request):
        serializer = TrackingIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        route = serializer.validated_data['route']
        if not self._can_ingest_route(request, route):
            return Response(
                {'detail': 'No autorizado para transmitir coordenadas a esta ruta.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        tracking = serializer.save()
        response_payload = TrackingSerializer(tracking).data
        ingest_meta = getattr(tracking, '_ingest_meta', {})

        if ingest_meta.get('source'):
            response_payload['source'] = ingest_meta['source']

        self._broadcast_tracking(response_payload)
        return Response(response_payload, status=status.HTTP_201_CREATED)

