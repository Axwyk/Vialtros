from rest_framework import serializers
from .models import User, Driver, Passenger, Route, Tracking, PickupStatus, RouteRating


def build_route_intermediate_stops(passengers):
    stops = []
    for passenger in passengers:
        if passenger.pickup_lat is None or passenger.pickup_lng is None:
            continue

        label = passenger.user.username if getattr(passenger, 'user', None) else f'Parada {passenger.id}'
        stops.append({
            'id': passenger.id,
            'passenger_id': passenger.id,
            'label': label,
            'address': passenger.pickup_address or label,
            'latitude': passenger.pickup_lat,
            'longitude': passenger.pickup_lng,
        })

    return sorted(stops, key=lambda stop: (stop['label'].lower(), stop['passenger_id']))


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'role', 'is_active', 'is_staff')
        read_only_fields = ('is_active', 'is_staff')


class RouteRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteRating
        fields = ('id', 'route', 'driver', 'stars', 'comment', 'created_at')
        read_only_fields = ('id', 'driver', 'created_at')

    def validate_stars(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError("Las estrellas deben estar entre 1 y 5.")
        return value


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer para que el usuario actualice su propio perfil."""
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email', 'phone_number')


class UserBasicSerializer(serializers.ModelSerializer):
    """Datos mínimos de usuario para anidar en Driver/Passenger."""
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role')


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'is_active', 'password')

    def validate_role(self, value):
        """Validar que no se cree más de un administrador."""
        # En CREATE, no permitir crear otro admin si ya existe uno
        if self.instance is None and value == 'admin':
            admin_count = User.objects.filter(role='admin').count()
            if admin_count > 0:
                raise serializers.ValidationError(
                    'Solo puede haber un administrador en el sistema.'
                )
        return value

    def validate(self, data):
        """Validar cambios de rol en UPDATE."""
        # En UPDATE, proteger el único admin
        if self.instance is not None:
            new_role = data.get('role', self.instance.role)
            old_role = self.instance.role
            
            # Si intenta cambiar el rol del único admin
            if old_role == 'admin' and new_role != 'admin':
                admin_count = User.objects.filter(role='admin').count()
                if admin_count == 1:
                    raise serializers.ValidationError(
                        'No se puede cambiar el rol del único administrador del sistema.'
                    )
            
            # Si intenta asignar rol admin a otro usuario
            if new_role == 'admin' and old_role != 'admin':
                admin_count = User.objects.filter(role='admin').count()
                if admin_count > 0:
                    raise serializers.ValidationError(
                        'Solo puede haber un administrador en el sistema.'
                    )
        
        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class DriverSerializer(serializers.ModelSerializer):
    user_detail = UserBasicSerializer(source='user', read_only=True)

    class Meta:
        model = Driver
        fields = ('id', 'user', 'user_detail', 'license_number')


class PassengerSerializer(serializers.ModelSerializer):
    user_detail = UserBasicSerializer(source='user', read_only=True)

    class Meta:
        model = Passenger
        fields = ('id', 'user', 'user_detail', 'phone', 'pickup_address', 'pickup_lat', 'pickup_lng')


class RouteSerializer(serializers.ModelSerializer):
    driver_detail = DriverSerializer(source='driver', read_only=True)
    passenger_details = PassengerSerializer(source='passengers', many=True, read_only=True)
    passenger_count = serializers.SerializerMethodField()
    intermediate_stops = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = ('id', 'name', 'origin', 'destination',
                  'origin_lat', 'origin_lng', 'destination_lat', 'destination_lng',
                  'driver', 'driver_detail',
                  'passengers', 'passenger_details', 'passenger_count', 'intermediate_stops',
                  'status', 'completed_at')
        read_only_fields = ('status', 'completed_at')

    def get_passenger_count(self, obj):
        return len(obj.passengers.all())

    def get_intermediate_stops(self, obj):
        passengers = obj.passengers.all()
        return build_route_intermediate_stops(passengers)


class TrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tracking
        fields = '__all__'


class TrackingIngestSerializer(serializers.Serializer):
    route = serializers.PrimaryKeyRelatedField(queryset=Route.objects.all())
    passenger = serializers.PrimaryKeyRelatedField(
        queryset=Passenger.objects.all(),
        required=False,
        allow_null=True,
    )
    status = serializers.ChoiceField(choices=PickupStatus.choices, default=PickupStatus.NOT_PICKED)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    timestamp = serializers.DateTimeField(required=False)
    speed_kmh = serializers.FloatField(required=False, allow_null=True)
    source = serializers.CharField(required=False, allow_blank=True, max_length=64)

    def validate(self, attrs):
        route = attrs['route']
        passenger = attrs.get('passenger')

        if passenger and not route.passengers.filter(id=passenger.id).exists():
            raise serializers.ValidationError({
                'passenger': 'El pasajero no pertenece a la ruta indicada.',
            })

        return attrs

    def create(self, validated_data):
        speed_kmh = validated_data.pop('speed_kmh', None)
        source = validated_data.pop('source', '')
        tracking = Tracking.objects.create(speed_kmh=speed_kmh, **validated_data)
        tracking._ingest_meta = {
            'source': source,
        }
        return tracking
