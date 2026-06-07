from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_tracking_route_timestamp_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='route',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pendiente'), ('completed', 'Completada')],
                db_index=True,
                default='pending',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='route',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
