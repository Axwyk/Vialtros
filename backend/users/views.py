from rest_framework import viewsets, permissions, status
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.contrib.auth import get_user_model
from .serializers import (
    UserSerializer, UserCreateSerializer,
    RouteSerializer, TrackingSerializer,
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

    @action(detail=False, methods=['get'], permission_classes=[IsDriver])
    def assigned_users(self, request):
        try:
            driver = Driver.objects.get(user=request.user)
        except Driver.DoesNotExist:
            return Response({'detail': 'No es conductor'}, status=status.HTTP_403_FORBIDDEN)
        routes = Route.objects.filter(driver=driver)
        passengers = Passenger.objects.filter(route__in=routes).distinct()
        return Response(PassengerSerializer(passengers, many=True).data)

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
        return Tracking.objects.none()

