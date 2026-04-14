"""
Management command to geocode all routes that have text origin/destination
but missing coordinates. Uses Nominatim + Valhalla locate for precision.
"""
import time
import json
import unicodedata
import re
import urllib.request
import urllib.parse
import urllib.error
import ssl

from django.core.management.base import BaseCommand
from users.models import Route

NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
VALHALLA_BASE = 'https://valhalla1.openstreetmap.de'
BVA_VIEWBOX = '-77.18,3.72,-76.85,4.02'
BVA_CITY_SUFFIX = ', Buenaventura, Colombia'

# Known places in Buenaventura (same as frontend routing.js)
KNOWN_PLACES = {
    'pueblo nuevo': [3.88982, -77.07077],
    'barrio pueblo nuevo': [3.88982, -77.07077],
    'seminario san buenaventura': [3.90188, -77.02293],
    'seminario': [3.90188, -77.02293],
    'seminario diocesan san buenaventura': [3.90188, -77.02293],
    'termarit': [3.87851, -77.01242],
    'institucion educativa termarit': [3.87851, -77.01242],
    'ie termarit': [3.87851, -77.01242],
    'terminal maritimo termarit': [3.87851, -77.01242],
    'centro buenaventura': [3.87712, -77.02986],
    'centro, buenaventura': [3.87712, -77.02986],
    'centro': [3.87712, -77.02986],
    'centro de buenaventura': [3.87712, -77.02986],
    'bellavista': [3.88291, -77.04041],
    'barrio bellavista': [3.88291, -77.04041],
    'cascajal': [3.88563, -77.03138],
    'isla cascajal': [3.88563, -77.03138],
    'localidad isla cascajal': [3.88563, -77.03138],
    'san luis': [3.87913, -77.03527],
    'barrio san luis': [3.87913, -77.03527],
    'normal superior juan ladrilleros': [3.87829, -77.01886],
    'escuela normal superior juan ladrilleros': [3.87829, -77.01886],
    'institucion educativa normal superior juan ladrilleros': [3.87829, -77.01886],
    'normal juan ladrilleros': [3.87829, -77.01886],
    'juan ladrilleros': [3.87829, -77.01886],
    'normal superior': [3.87829, -77.01886],
    'pascual de andagoya': [3.88129, -77.05968],
    'institucion educativa pascual de andagoya': [3.88129, -77.05968],
    'colegio pascual de andagoya': [3.88129, -77.05968],
    'pascual': [3.88129, -77.05968],
    'terminal': [3.89015, -77.07366],
    'terminal de transporte': [3.89015, -77.07366],
    'terminal de transportes': [3.89015, -77.07366],
    'terminal de buenaventura': [3.89015, -77.07366],
}

# Buenaventura urban bounds
MIN_LAT, MAX_LAT = 3.84, 3.93
MIN_LNG, MAX_LNG = -77.09, -76.99


def normalize_name(value):
    text = unicodedata.normalize('NFD', str(value or ''))
    text = re.sub(r'[\u0300-\u036f]', '', text)
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def is_within_buenaventura(lat, lng):
    return MIN_LAT <= lat <= MAX_LAT and MIN_LNG <= lng <= MAX_LNG


def http_get_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Vialtros/1.0'})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
        return json.loads(resp.read().decode())


def http_post_json(url, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={'Content-Type': 'application/json', 'User-Agent': 'Vialtros/1.0'},
        method='POST',
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
        return json.loads(resp.read().decode())


def resolve_known_place(address):
    normalized = normalize_name(address)
    if not normalized:
        return None
    # Exact match
    if normalized in KNOWN_PLACES:
        return KNOWN_PLACES[normalized]
    # Substring match
    for alias, coords in KNOWN_PLACES.items():
        if normalized in alias or alias in normalized:
            return coords
    return None


def nominatim_search(query, bounded=False):
    params = {
        'q': query,
        'format': 'json',
        'limit': '1',
        'accept-language': 'es',
        'countrycodes': 'co',
        'viewbox': BVA_VIEWBOX,
    }
    if bounded:
        params['bounded'] = '1'
    url = f"{NOMINATIM_BASE}/search?{urllib.parse.urlencode(params)}"
    data = http_get_json(url)
    if not isinstance(data, list) or len(data) == 0:
        return None
    lat = float(data[0]['lat'])
    lng = float(data[0]['lon'])
    if is_within_buenaventura(lat, lng):
        return [lat, lng]
    return None


def valhalla_locate(coords):
    body = {
        'locations': [{'lat': coords[0], 'lon': coords[1]}],
        'costing': 'auto',
        'costing_options': {
            'auto': {
                'use_highways': 1,
                'use_living_streets': 0,
                'use_ferry': 0,
            }
        },
        'verbose': False,
    }
    data = http_post_json(f"{VALHALLA_BASE}/locate", body)
    if not isinstance(data, list) or len(data) == 0:
        return None
    result = data[0]
    edges = result.get('edges', [])
    if not edges:
        return None
    edge = edges[0]
    lat = edge.get('correlated_lat')
    lng = edge.get('correlated_lon')
    if lat is not None and lng is not None:
        return [lat, lng]
    return None


def geocode_address(address):
    """Geocode an address string to [lat, lng], same logic as frontend."""
    if not address or not address.strip():
        return None

    clean = address.strip()

    # 1. Known places
    known = resolve_known_place(clean)
    if known:
        snapped = valhalla_locate(known)
        return snapped or known

    # 2. Nominatim: with city suffix, bounded
    with_city = clean if 'buenaventura' in clean.lower() else f"{clean}{BVA_CITY_SUFFIX}"

    result = nominatim_search(with_city, bounded=True)
    if not result:
        time.sleep(1.1)  # Nominatim rate limit
        result = nominatim_search(with_city, bounded=False)
    if not result:
        time.sleep(1.1)
        result = nominatim_search(clean, bounded=False)

    if result:
        snapped = valhalla_locate(result)
        return snapped or result

    return None


class Command(BaseCommand):
    help = 'Geocode all routes: resolve origin/destination text to coordinates'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force', action='store_true',
            help='Re-geocode even routes that already have coordinates',
        )

    def handle(self, *args, **options):
        force = options['force']
        routes = Route.objects.all().order_by('id')
        total = routes.count()
        updated = 0
        failed = []

        self.stdout.write(f"Processing {total} routes...")

        for route in routes:
            needs_origin = force or route.origin_lat is None or route.origin_lng is None
            needs_dest = force or route.destination_lat is None or route.destination_lng is None

            if not needs_origin and not needs_dest:
                self.stdout.write(f"  [{route.id}] {route.name}: already has coordinates, skipping")
                continue

            changed = False

            if needs_origin and route.origin:
                self.stdout.write(f"  [{route.id}] Geocoding origin: '{route.origin}'...")
                try:
                    coords = geocode_address(route.origin)
                    if coords:
                        route.origin_lat = coords[0]
                        route.origin_lng = coords[1]
                        changed = True
                        self.stdout.write(self.style.SUCCESS(
                            f"    -> [{coords[0]:.6f}, {coords[1]:.6f}]"
                        ))
                    else:
                        failed.append(f"Route {route.id} origin: '{route.origin}'")
                        self.stdout.write(self.style.WARNING("    -> Could not geocode"))
                except Exception as e:
                    failed.append(f"Route {route.id} origin: '{route.origin}' ({e})")
                    self.stdout.write(self.style.ERROR(f"    -> Error: {e}"))
                time.sleep(1.1)  # Nominatim rate limit

            if needs_dest and route.destination:
                self.stdout.write(f"  [{route.id}] Geocoding destination: '{route.destination}'...")
                try:
                    coords = geocode_address(route.destination)
                    if coords:
                        route.destination_lat = coords[0]
                        route.destination_lng = coords[1]
                        changed = True
                        self.stdout.write(self.style.SUCCESS(
                            f"    -> [{coords[0]:.6f}, {coords[1]:.6f}]"
                        ))
                    else:
                        failed.append(f"Route {route.id} destination: '{route.destination}'")
                        self.stdout.write(self.style.WARNING("    -> Could not geocode"))
                except Exception as e:
                    failed.append(f"Route {route.id} destination: '{route.destination}' ({e})")
                    self.stdout.write(self.style.ERROR(f"    -> Error: {e}"))
                time.sleep(1.1)

            if changed:
                route.save(update_fields=[
                    'origin_lat', 'origin_lng',
                    'destination_lat', 'destination_lng',
                ])
                updated += 1

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f"Done: {updated}/{total} routes updated"))
        if failed:
            self.stdout.write(self.style.WARNING(f"Failed to geocode {len(failed)} addresses:"))
            for f in failed:
                self.stdout.write(f"  - {f}")
