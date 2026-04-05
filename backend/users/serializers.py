from rest_framework import serializers
from .models import User, Driver, Passenger, Route, Tracking


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
    passenger_count = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = ('id', 'name', 'origin', 'destination', 'driver', 'driver_detail',
                  'passengers', 'passenger_count')

    def get_passenger_count(self, obj):
        return obj.passengers.count()


class TrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tracking
        fields = '__all__'
