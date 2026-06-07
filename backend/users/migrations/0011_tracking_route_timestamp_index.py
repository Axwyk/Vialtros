from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_tracking_timestamp_index'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='tracking',
            index=models.Index(fields=['route', '-timestamp'], name='tracking_route_timestamp_idx'),
        ),
    ]
