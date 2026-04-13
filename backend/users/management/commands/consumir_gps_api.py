import json
import time
from urllib import error, parse, request

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


def get_nested_value(payload, dotted_path):
    current = payload
    for part in dotted_path.split('.'):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


class Command(BaseCommand):
    help = 'Consume una API externa de GPS y reenvia la posicion al endpoint interno de ingesta.'

    def add_arguments(self, parser):
        parser.add_argument('--source-url', required=True, help='URL de la API externa que devuelve la posicion.')
        parser.add_argument('--route', type=int, required=True, help='ID de la ruta en Vialtros.')
        parser.add_argument('--poll', type=float, default=5.0, help='Segundos entre lecturas de la API.')
        parser.add_argument('--ingest-url', default='http://localhost:8000/api/tracking/ingest/', help='Endpoint de ingesta local.')
        parser.add_argument('--token', default='', help='Token de ingesta. Si no se envia, usa TRACKING_INGEST_TOKEN.')
        parser.add_argument('--lat-path', default='latitude', help='Ruta del campo latitud en la respuesta JSON.')
        parser.add_argument('--lng-path', default='longitude', help='Ruta del campo longitud en la respuesta JSON.')
        parser.add_argument('--speed-path', default='speed_kmh', help='Ruta del campo velocidad en la respuesta JSON.')
        parser.add_argument('--timestamp-path', default='timestamp', help='Ruta del campo timestamp en la respuesta JSON.')
        parser.add_argument('--source-name', default='gps-api', help='Nombre de la fuente que quedara guardada en tracking.source.')
        parser.add_argument('--status', default='picked', choices=['picked', 'not_picked'], help='Estado a registrar si la API no lo incluye.')
        parser.add_argument('--cycles', type=int, default=0, help='Cantidad de iteraciones. 0 = infinito.')

    def handle(self, *args, **options):
        token = (options['token'] or settings.TRACKING_INGEST_TOKEN).strip()
        if not token:
            raise CommandError('Falta token de ingesta. Usa --token o define TRACKING_INGEST_TOKEN.')

        poll_seconds = max(float(options['poll']), 1.0)
        source_url = options['source_url']
        ingest_url = options['ingest_url']
        route_id = options['route']
        cycles = max(int(options['cycles']), 0)

        sent = 0
        current_cycle = 0

        self.stdout.write(self.style.SUCCESS(f'Leyendo GPS externo desde {source_url}'))
        self.stdout.write(self.style.SUCCESS(f'Reenviando a {ingest_url} para la ruta {route_id}'))

        try:
            while True:
                if cycles and current_cycle >= cycles:
                    break

                source_payload = self.fetch_json(source_url)
                ingest_payload = {
                    'route': route_id,
                    'latitude': get_nested_value(source_payload, options['lat_path']),
                    'longitude': get_nested_value(source_payload, options['lng_path']),
                    'status': options['status'],
                    'source': options['source_name'],
                }

                speed = get_nested_value(source_payload, options['speed_path'])
                timestamp = get_nested_value(source_payload, options['timestamp_path'])

                if speed is not None:
                    ingest_payload['speed_kmh'] = speed
                if timestamp:
                    ingest_payload['timestamp'] = timestamp

                if ingest_payload['latitude'] is None or ingest_payload['longitude'] is None:
                    raise CommandError('La API externa no devolvio latitude/longitude segun las rutas configuradas.')

                response = self.post_json(
                    ingest_url,
                    ingest_payload,
                    headers={'X-Tracking-Token': token},
                )
                sent += 1
                current_cycle += 1

                self.stdout.write(
                    f'[{sent}] lat={response.get("latitude")}, lng={response.get("longitude")}, source={response.get("source", options["source_name"])}'
                )
                time.sleep(poll_seconds)
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('\nProductor detenido manualmente'))

        self.stdout.write(self.style.SUCCESS(f'Lecturas reenviadas: {sent}'))

    def fetch_json(self, url):
        req = request.Request(url, headers={'Accept': 'application/json'})
        try:
            with request.urlopen(req, timeout=15) as response:
                return json.loads(response.read().decode('utf-8'))
        except error.HTTPError as exc:
            raise CommandError(f'La API externa respondio {exc.code}: {exc.reason}') from exc
        except error.URLError as exc:
            raise CommandError(f'No se pudo leer la API externa: {exc.reason}') from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f'La API externa no devolvio JSON valido: {exc}') from exc

    def post_json(self, url, payload, headers=None):
        data = json.dumps(payload).encode('utf-8')
        req = request.Request(
            url,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                **(headers or {}),
            },
            method='POST',
        )
        try:
            with request.urlopen(req, timeout=15) as response:
                return json.loads(response.read().decode('utf-8'))
        except error.HTTPError as exc:
            detail = exc.read().decode('utf-8', errors='ignore')
            raise CommandError(f'La ingesta local fallo con {exc.code}: {detail or exc.reason}') from exc
        except error.URLError as exc:
            raise CommandError(f'No se pudo enviar a la ingesta local: {exc.reason}') from exc
