import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_routerating'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tracking',
            name='timestamp',
            field=models.DateTimeField(db_index=True, default=django.utils.timezone.now),
        ),
    ]
