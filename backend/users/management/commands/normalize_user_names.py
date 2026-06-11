from django.core.management.base import BaseCommand
from users.models import User
from users.utils import normalize_name


class Command(BaseCommand):
    help = "Normaliza first_name y last_name de todos los usuarios al formato Title Case."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Mostrar cambios sin aplicarlos.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        users = User.objects.exclude(first_name='', last_name='')
        changed = 0

        for user in users:
            new_first = normalize_name(user.first_name)
            new_last = normalize_name(user.last_name)

            if new_first != user.first_name or new_last != user.last_name:
                self.stdout.write(
                    f"  [{user.id}] {user.username}: "
                    f"'{user.first_name}' '{user.last_name}' "
                    f"-> '{new_first}' '{new_last}'"
                )
                if not dry_run:
                    user.first_name = new_first
                    user.last_name = new_last
                    user.save(update_fields=['first_name', 'last_name'])
                changed += 1

        label = "Se normalizarian" if dry_run else "Normalizados"
        self.stdout.write(self.style.SUCCESS(f"{label} {changed} usuarios."))
