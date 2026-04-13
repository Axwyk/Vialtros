from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
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
                'users': User.objects.count(),
                'trackings': Tracking.objects.count(),
            })

        if user.role == 'driver':
            try:
                driver = Driver.objects.get(user=user)
            except Driver.DoesNotExist:
                return Response({'routes': 0, 'users': 0, 'trackings': 0})

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

        if ingest_meta.get('speed_kmh') is not None:
            response_payload['speed_kmh'] = ingest_meta['speed_kmh']
        if ingest_meta.get('source'):
            response_payload['source'] = ingest_meta['source']

        self._broadcast_tracking(response_payload)
        return Response(response_payload, status=status.HTTP_201_CREATED)

