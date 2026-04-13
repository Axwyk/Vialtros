"""
Comando de gestión: transmitir_tracking
Emite coordenadas GPS simuladas al mapa en tiempo real conectándose
como cliente WebSocket al servidor Django Channels.

Uso:
    python manage.py transmitir_tracking --route <ID>
    python manage.py transmitir_tracking --route 3 --interval 2 --cycles 0
    python manage.py transmitir_tracking --route 3 --host localhost --port 8000
"""
import json
import math
import time

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

try:
    import websocket  # websocket-client
except ImportError:
    websocket = None


DEMO_ROUTE_SHORT = [
    (3.8806, -77.0319),
    (3.8822, -77.0338),
    (3.8841, -77.0361),
    (3.8863, -77.0389),
    (3.8877, -77.0407),
    (3.8896, -77.0427),
]


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


class Command(BaseCommand):
    help = "Transmite coordenadas de tracking por WebSocket para una ruta."

    def add_arguments(self, parser):
        parser.add_argument("--route", type=int, required=True, help="ID de la ruta")
        parser.add_argument(
            "--interval",
            type=float,
            default=2.0,
            help="Segundos entre puntos (default: 2.0)",
        )
        parser.add_argument(
            "--cycles",
            type=int,
            default=0,
            help="Cantidad de ciclos de la ruta. 0 = infinito",
        )
        parser.add_argument(
            "--status",
            type=str,
            choices=["picked", "not_picked"],
            default="picked",
            help="Estado del pasajero (default: picked)",
        )
        parser.add_argument(
            "--host",
            type=str,
            default="localhost",
            help="Host del servidor (default: localhost)",
        )
        parser.add_argument(
            "--port",
            type=int,
            default=8000,
            help="Puerto del servidor (default: 8000)",
        )

    def handle(self, *args, **options):
        if websocket is None:
            raise CommandError(
                "Falta el paquete 'websocket-client'.\n"
                "Instálalo con: pip install websocket-client"
            )

        route_id = options["route"]
        interval = max(float(options["interval"]), 0.0)
        cycles = max(int(options["cycles"]), 0)
        status = options["status"]
        host = options["host"]
        port = options["port"]

        ws_url = f"ws://{host}:{port}/ws/tracking/{route_id}/"

        self.stdout.write(f"Conectando a {ws_url} ...")

        try:
            ws = websocket.create_connection(ws_url, timeout=10)
        except Exception as exc:
            raise CommandError(
                f"No se pudo conectar al servidor WebSocket en {ws_url}\n"
                f"Asegúrate de que el servidor esté corriendo y de que el ASGI esté activo.\n"
                f"Error: {exc}"
            ) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"Conectado. Transmitiendo ruta {route_id} cada {interval}s"
            )
        )
        self.stdout.write(self.style.WARNING("Presiona Ctrl+C para detener la transmisión"))

        sent = 0
        cycle_idx = 0
        prev_point = None

        try:
            while True:
                if cycles and cycle_idx >= cycles:
                    break

                for lat, lng in DEMO_ROUTE_SHORT:
                    speed_kmh = 0.0
                    if prev_point is not None and interval > 0:
                        dist = haversine_km(prev_point[0], prev_point[1], lat, lng)
                        speed_kmh = round(dist / (interval / 3600), 1)
                    prev_point = (lat, lng)

                    payload = {
                        "route": route_id,
                        "latitude": lat,
                        "longitude": lng,
                        "speed_kmh": speed_kmh,
                        "status": status,
                        "timestamp": timezone.now().isoformat(),
                    }

                    ws.send(json.dumps(payload))
                    sent += 1
                    self.stdout.write(
                        f"[{sent}] lat={lat:.6f}, lng={lng:.6f}, speed={speed_kmh} km/h"
                    )

                    if interval > 0:
                        time.sleep(interval)

                cycle_idx += 1

        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("\nTransmisión detenida manualmente"))
        finally:
            ws.close()

        self.stdout.write(
            self.style.SUCCESS(f"Transmisión finalizada. Mensajes enviados: {sent}")
        )
