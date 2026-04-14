from rest_framework import serializers
from .models import User, Driver, Passenger, Route, Tracking, PickupStatus


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
        fields = ('id', 'username', 'email', 'role', 'is_active', 'is_staff')


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
                  'passengers', 'passenger_details', 'passenger_count', 'intermediate_stops')

    def get_passenger_count(self, obj):
        return obj.passengers.count()

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
