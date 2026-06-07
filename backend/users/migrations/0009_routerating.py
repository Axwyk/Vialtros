from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_notification_model_and_dropped_off'),
    ]

    operations = [
        migrations.CreateModel(
            name='RouteRating',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stars', models.PositiveSmallIntegerField()),
                ('comment', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('route', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ratings', to='users.route')),
                ('driver', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='route_ratings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('route', 'driver')},
            },
        ),
    ]
