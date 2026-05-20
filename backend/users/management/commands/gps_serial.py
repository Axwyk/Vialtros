import json
import time
from urllib import error, request

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Lee un GPS USB/serial (NMEA) y reenvía la posición al endpoint de ingesta.'

    def add_arguments(self, parser):
        parser.add_argument('--port', required=True,
                            help='Puerto serial, ej: COM3 (Windows) o /dev/ttyUSB0 (Linux)')
        parser.add_argument('--baud', type=int, default=9600,
                            help='Baudrate del GPS (default 9600)')
        parser.add_argument('--route', type=int, required=True,
                            help='ID de la ruta en Vialtros')
        parser.add_argument('--token', default='',
                            help='Token de ingesta. Si no se envía, usa TRACKING_INGEST_TOKEN del .env.')
        parser.add_argument('--ingest-url', default='http://localhost:8000/api/tracking/ingest/',
                            help='Endpoint de ingesta (default: localhost:8000)')
        parser.add_argument('--min-interval', type=float, default=3.0,
                            help='Segundos mínimos entre envíos consecutivos (default 3.0)')
        parser.add_argument('--source-name', default='gps-serial',
                            help='Nombre de la fuente guardado en tracking.source')
        parser.add_argument('--status', default='picked',
                            choices=['picked', 'not_picked'],
                            help='Estado de recogida a registrar (default: picked)')

    def handle(self, *args, **options):
        try:
            import serial
            import pynmea2
        except ImportError as exc:
            raise CommandError(
                'Instala las dependencias: pip install pyserial pynmea2'
            ) from exc

        token = (options['token'] or getattr(settings, 'TRACKING_INGEST_TOKEN', '')).strip()
        if not token:
            raise CommandError(
                'Falta token de ingesta. Usa --token o define TRACKING_INGEST_TOKEN en .env.'
            )

        port = options['port']
        baud = options['baud']
        route_id = options['route']
        ingest_url = options['ingest_url']
        min_interval = max(float(options['min_interval']), 1.0)
        source_name = options['source_name']
        status = options['status']

        self.stdout.write(self.style.SUCCESS(f'Abriendo puerto {port} a {baud} baudios...'))

        try:
            ser = serial.Serial(port, baud, timeout=5)
        except serial.SerialException as exc:
            raise CommandError(f'No se pudo abrir el puerto {port}: {exc}') from exc

        self.stdout.write(self.style.SUCCESS(
            f'Conectado a {port}. Leyendo sentencias NMEA... (Ctrl+C para detener)'
        ))

        last_sent = 0.0
        sent = 0

        try:
            while True:
                try:
                    raw = ser.readline()
                except serial.SerialException as exc:
                    raise CommandError(f'Error leyendo del puerto serial: {exc}') from exc

                line = raw.decode('ascii', errors='ignore').strip()
                if not line.startswith('$'):
                    continue

                try:
                    msg = pynmea2.parse(line)
                except pynmea2.ParseError:
                    continue

                # Solo RMC: contiene lat, lng, velocidad, rumbo y flag de validez
                if not hasattr(msg, 'latitude') or not hasattr(msg, 'status'):
                    continue

                if msg.status != 'A':
                    self.stdout.write('Sin fijacion GPS valida aun...')
                    continue

                lat = float(msg.latitude)
                lng = float(msg.longitude)

                # pynmea2 devuelve velocidad en nudos; convertir a km/h
                speed_raw = getattr(msg, 'spd_over_grnd', None)
                speed_kmh = round(float(speed_raw) * 1.852, 1) if speed_raw else 0.0

                now = time.time()
                if now - last_sent < min_interval:
                    continue

                payload = {
                    'route': route_id,
                    'latitude': lat,
                    'longitude': lng,
                    'speed_kmh': speed_kmh,
                    'status': status,
                    'source': source_name,
                }

                # Incluir timestamp del GPS si está disponible
                msg_datetime = getattr(msg, 'datetime', None)
                if msg_datetime:
                    try:
                        payload['timestamp'] = msg_datetime.isoformat()
                    except Exception:
                        pass

                try:
                    self._post_json(ingest_url, payload, headers={'X-Tracking-Token': token})
                    last_sent = now
                    sent += 1
                    self.stdout.write(
                        f'[{sent}] lat={lat:.6f}, lng={lng:.6f}, {speed_kmh} km/h'
                    )
                except CommandError as exc:
                    self.stdout.write(self.style.ERROR(str(exc)))

        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('\nLectura detenida manualmente.'))
        finally:
            ser.close()

        self.stdout.write(self.style.SUCCESS(f'Posiciones enviadas: {sent}'))

    def _post_json(self, url, payload, headers=None):
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
            with request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode('utf-8'))
        except error.HTTPError as exc:
            detail = exc.read().decode('utf-8', errors='ignore')
            raise CommandError(f'Ingesta fallida {exc.code}: {detail or exc.reason}') from exc
        except error.URLError as exc:
            raise CommandError(f'No se pudo conectar a la ingesta: {exc.reason}') from exc
