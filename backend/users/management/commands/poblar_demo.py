from django.core.management.base import BaseCommand
from users.models import User, Driver, Passenger, Route, Tracking
import random

class Command(BaseCommand):
    help = 'Puebla la base de datos con datos de ejemplo'

    def handle(self, *args, **kwargs):
        # 1 admin
        admin, _ = User.objects.get_or_create(
            username='admin_demo',
            defaults={'email': 'admin@demo.com', 'role': 'admin', 'is_active': True}
        )
        if _:
            admin.set_password('admin1234')
            admin.save()
        self.stdout.write(self.style.SUCCESS('Admin: admin_demo / admin1234'))

        # 3 conductores
        drivers = []
        for i in range(1, 4):
            u, created = User.objects.get_or_create(
                username=f'conductor{i}',
                defaults={'email': f'conductor{i}@demo.com', 'role': 'driver', 'is_active': True}
            )
            if created:
                u.set_password('conductor1234')
                u.save()
            d, _ = Driver.objects.get_or_create(user=u, defaults={'license_number': f'B-{1000+i}'})
            drivers.append(d)
        self.stdout.write(self.style.SUCCESS('Conductores: conductor1-3 / conductor1234'))

        # 4 pasajeros
        passengers = []
        for i in range(1, 5):
            u, created = User.objects.get_or_create(
                username=f'pasajero{i}',
                defaults={'email': f'pasajero{i}@demo.com', 'role': 'user', 'is_active': True}
            )
            if created:
                u.set_password('pasajero1234')
                u.save()
            p, _ = Passenger.objects.get_or_create(user=u, defaults={'phone': f'600 00000{i}'})
            passengers.append(p)
        self.stdout.write(self.style.SUCCESS('Pasajeros: pasajero1-4 / pasajero1234'))

        # 3 rutas
        origenes = ['Calle Mayor 1', 'Plaza España 5', 'Av. Libertad 20']
        destinos = ['Polígono Norte', 'Centro Comercial Sur', 'Parque Empresarial Este']
        for i in range(3):
            route, _ = Route.objects.get_or_create(
                name=f'Ruta {i+1}',
                defaults={
                    'origin': origenes[i],
                    'destination': destinos[i],
                    'driver': drivers[i],
                }
            )
            # Asignar 1-2 pasajeros por ruta
            route.passengers.add(*passengers[i:i+2])
        self.stdout.write(self.style.SUCCESS('Rutas creadas'))

        # Trackings (1 por ruta, con pasajero)
        for route in Route.objects.all():
            passenger = route.passengers.first()
            if passenger:
                Tracking.objects.get_or_create(
                    route=route,
                    passenger=passenger,
                    defaults={
                        'latitude': round(random.uniform(40.0, 41.0), 6),
                        'longitude': round(random.uniform(-4.0, -3.0), 6),
                        'status': 'not_picked',
                    }
                )
        self.stdout.write(self.style.SUCCESS('Trackings creados'))

        self.stdout.write(self.style.SUCCESS('\n¡Base de datos de demo lista!'))
