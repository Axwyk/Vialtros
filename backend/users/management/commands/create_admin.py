from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Create a superuser admin account for testing'

    def handle(self, *args, **options):
        username = 'admin'
        password = 'admin123'
        email = 'admin@vialtros.local'
        
        # Verificar si el usuario ya existe
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'Usuario "{username}" ya existe.')
            )
            return
        
        # Crear el usuario admin
        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            first_name='Admin',
            last_name='Vialtros'
        )
        
        # Asignar rol admin
        user.role = 'admin'
        user.save()
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Usuario admin creado exitosamente:\n'
                f'Usuario: {username}\n'
                f'Contraseña: {password}\n'
                f'Email: {email}'
            )
        )
