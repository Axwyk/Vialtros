from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

# Create your models here.
# Roles
class User(AbstractUser):
	ROLE_CHOICES = (
		('admin', 'Admin'),
		('driver', 'Driver'),
		('user', 'User'),
	)
	role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')

class Driver(models.Model):
	user = models.OneToOneField('User', on_delete=models.CASCADE)
	license_number = models.CharField(max_length=50)

class Passenger(models.Model):
	user = models.OneToOneField('User', on_delete=models.CASCADE)
	phone = models.CharField(max_length=20)

class Route(models.Model):
	name = models.CharField(max_length=100)
	origin = models.CharField(max_length=255)
	destination = models.CharField(max_length=255)
	origin_lat = models.FloatField(null=True, blank=True)
	origin_lng = models.FloatField(null=True, blank=True)
	destination_lat = models.FloatField(null=True, blank=True)
	destination_lng = models.FloatField(null=True, blank=True)
	driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True)
	passengers = models.ManyToManyField(Passenger, blank=True)

class PickupStatus(models.TextChoices):
	PICKED = 'picked', 'Recogido'
	NOT_PICKED = 'not_picked', 'No recogido'

class Tracking(models.Model):
	route = models.ForeignKey(Route, on_delete=models.CASCADE)
	passenger = models.ForeignKey(Passenger, on_delete=models.CASCADE, null=True, blank=True)
	status = models.CharField(max_length=20, choices=PickupStatus.choices, default=PickupStatus.NOT_PICKED)
	latitude = models.FloatField()
	longitude = models.FloatField()
	speed_kmh = models.FloatField(null=True, blank=True)
	timestamp = models.DateTimeField(default=timezone.now)
