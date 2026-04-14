from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_route_destination_lat_route_destination_lng_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='passenger',
            name='pickup_address',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='passenger',
            name='pickup_lat',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='passenger',
            name='pickup_lng',
            field=models.FloatField(blank=True, null=True),
        ),
    ]