from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_alter_tracking_passenger_alter_tracking_timestamp'),
    ]

    operations = [
        migrations.AddField(
            model_name='tracking',
            name='speed_kmh',
            field=models.FloatField(blank=True, null=True),
        ),
    ]