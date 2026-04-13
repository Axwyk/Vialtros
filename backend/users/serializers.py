from rest_framework import serializers
from .models import User, Driver, Passenger, Route, Tracking, PickupStatus


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
        fields = ('id', 'user', 'user_detail', 'phone')


class RouteSerializer(serializers.ModelSerializer):
    driver_detail = DriverSerializer(source='driver', read_only=True)
    passenger_details = PassengerSerializer(source='passengers', many=True, read_only=True)
    passenger_count = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = ('id', 'name', 'origin', 'destination', 'driver', 'driver_detail',
                  'passengers', 'passenger_details', 'passenger_count')

    def get_passenger_count(self, obj):
        return obj.passengers.count()


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
        tracking = Tracking.objects.create(**validated_data)
        tracking._ingest_meta = {
            'speed_kmh': speed_kmh,
            'source': source,
        }
        return tracking
