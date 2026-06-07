import secrets

from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
class User(AbstractUser):
	ROLE_CHOICES = (
		('admin', 'Admin'),
		('driver', 'Driver'),
		('user', 'User'),
	)
	role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
	phone_number = models.CharField(max_length=20, blank=True, default='')

class Driver(models.Model):
	user = models.OneToOneField('User', on_delete=models.CASCADE)
	license_number = models.CharField(max_length=50)

class Passenger(models.Model):
	user = models.OneToOneField('User', on_delete=models.CASCADE)
	phone = models.CharField(max_length=20)
	pickup_address = models.CharField(max_length=255, blank=True, default='')
	pickup_lat = models.FloatField(null=True, blank=True)
	pickup_lng = models.FloatField(null=True, blank=True)

class Route(models.Model):
	STATUS_PENDING = 'pending'
	STATUS_COMPLETED = 'completed'
	STATUS_CHOICES = [
		('pending', 'Pendiente'),
		('completed', 'Completada'),
	]

	name = models.CharField(max_length=100)
	origin = models.CharField(max_length=255)
	destination = models.CharField(max_length=255)
	origin_lat = models.FloatField(null=True, blank=True)
	origin_lng = models.FloatField(null=True, blank=True)
	destination_lat = models.FloatField(null=True, blank=True)
	destination_lng = models.FloatField(null=True, blank=True)
	driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True)
	passengers = models.ManyToManyField(Passenger, blank=True)
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
	completed_at = models.DateTimeField(null=True, blank=True)

class PickupStatus(models.TextChoices):
	PICKED = 'picked', 'Recogido'
	NOT_PICKED = 'not_picked', 'No recogido'
	DROPPED_OFF = 'dropped_off', 'Dejado en parada'

class Tracking(models.Model):
	route = models.ForeignKey(Route, on_delete=models.CASCADE)
	passenger = models.ForeignKey(Passenger, on_delete=models.CASCADE, null=True, blank=True)
	status = models.CharField(max_length=20, choices=PickupStatus.choices, default=PickupStatus.NOT_PICKED)
	latitude = models.FloatField()
	longitude = models.FloatField()
	speed_kmh = models.FloatField(null=True, blank=True)
	timestamp = models.DateTimeField(default=timezone.now, db_index=True)

	class Meta:
		indexes = [
			models.Index(fields=['route', '-timestamp']),
		]


class NotificationType(models.TextChoices):
	ROUTE_STARTED = 'route_started', 'Ruta iniciada'
	STUDENT_PICKED_UP = 'student_picked_up', 'Estudiante recogido'
	STUDENT_DROPPED_OFF = 'student_dropped_off', 'Estudiante dejado en parada'
	APPROACHING_STOP = 'approaching_stop', 'Bus aproximandose a parada'
	APPROACHING_DESTINATION = 'approaching_destination', 'Bus aproximandose al destino'
	DRIVER_NEAR_STOP = 'driver_near_stop', 'Conductor proximo a parada'
	DRIVER_NEAR_DESTINATION = 'driver_near_destination', 'Conductor proximo al destino final'
	MESSAGE_FROM_USER = 'message_from_user', 'Mensaje de padre de familia'


class Notification(models.Model):
	user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='notifications')
	type = models.CharField(max_length=50, choices=NotificationType.choices)
	title = models.CharField(max_length=200)
	message = models.TextField()
	route = models.ForeignKey('Route', on_delete=models.CASCADE, null=True, blank=True)
	read = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)
	metadata = models.JSONField(default=dict, blank=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['user', 'read', 'created_at']),
		]


class RouteRating(models.Model):
	"""Calificacion del conductor al finalizar una ruta."""
	route = models.ForeignKey('Route', on_delete=models.CASCADE, related_name='ratings')
	driver = models.ForeignKey('User', on_delete=models.CASCADE, related_name='route_ratings')
	stars = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
	comment = models.TextField(blank=True, default='')
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']
		unique_together = [('route', 'driver')]

	def __str__(self):
		return f"Ruta {self.route_id} — {self.stars}★ por {self.driver}"


class PasswordResetToken(models.Model):
	user = models.ForeignKey('User', on_delete=models.CASCADE)
	token = models.CharField(max_length=64, unique=True)
	created_at = models.DateTimeField(auto_now_add=True)
	used = models.BooleanField(default=False)

	def save(self, *args, **kwargs):
		if not self.token:
			self.token = secrets.token_urlsafe(32)
		super().save(*args, **kwargs)

	def is_valid(self):
		age = timezone.now() - self.created_at
		return not self.used and age.total_seconds() < 3600
