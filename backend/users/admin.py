

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Driver, Passenger, Route, Tracking

@admin.register(User)
class UserAdmin(BaseUserAdmin):
	fieldsets = BaseUserAdmin.fieldsets + (
		('Información adicional', {'fields': ('role',)}),
	)
	add_fieldsets = BaseUserAdmin.add_fieldsets + (
		('Información adicional', {'fields': ('role',)}),
	)

admin.site.register(Driver)
admin.site.register(Passenger)
admin.site.register(Route)
admin.site.register(Tracking)

# Register your models here.
