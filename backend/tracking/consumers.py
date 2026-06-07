import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

class TrackingConsumer(AsyncWebsocketConsumer):
    """
    Consumer para tracking en tiempo real.
    Cada cliente se suscribe a un grupo por ruta (route_id).
    """
    async def connect(self):
        self.route_id = self.scope['url_route']['kwargs']['route_id']
        self.group_name = f'tracking_{self.route_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        # Broadcast a todos los clientes del grupo
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'tracking_update',
                'data': data
            }
        )

    async def tracking_update(self, event):
        await self.send(text_data=json.dumps(event['data']))


class AdminMonitoringConsumer(AsyncWebsocketConsumer):
    """
    Consumer simple para panel de administracion: se subscribe al grupo 'monitoring'
    y reenvia los eventos a clientes admin conectados.
    """
    async def connect(self):
        user = self.scope.get('user')
        # Preferimos usuarios autenticados y staff/admin, pero para entornos
        # de prueba o cuando la sesión no está disponible permite conexión
        # en modo limitado en vez de cerrar la socket. Esto facilita que
        # el panel admin en frontend pueda conectarse incluso sin cookie
        # de sesión (ej. despliegues SPA separados). Si el usuario es
        # staff entonces se otorgan todos los permisos.
        is_authenticated = bool(user and getattr(user, 'is_authenticated', False))
        is_staff = bool(user and getattr(user, 'is_staff', False))

        self.limited_mode = False
        if not is_authenticated or not is_staff:
            # Allow connection but mark as limited (read-only, possibly filtered)
            self.limited_mode = True

        self.group_name = 'monitoring'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def monitoring_event(self, event):
        # event.payload expected
        payload = event.get('payload') or event.get('data') or {}
        # Si estamos en modo limitado, podemos filtrar o reducir la información
        if getattr(self, 'limited_mode', False):
            # En modo limitado solo enviamos la forma mínima: ruta, lat, lng, timestamp
            minimal = {}
            try:
                minimal = {
                    'route': payload.get('route'),
                    'latitude': payload.get('latitude') or payload.get('lat'),
                    'longitude': payload.get('longitude') or payload.get('lng'),
                    'timestamp': payload.get('timestamp') or payload.get('time') or None,
                    'event': payload.get('event') or 'position_update',
                }
            except Exception as e:
                logger.warning("AdminMonitoringConsumer: error procesando payload: %s", e)
                minimal = {}
            await self.send(text_data=json.dumps(minimal))
            return

        await self.send(text_data=json.dumps(payload))


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Consumer de notificaciones personalizadas por usuario.
    Cada usuario autenticado se suscribe a su grupo privado notifications_{user_id}.
    """
    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close()
            return
        self.user_id = user.pk
        self.group_name = f'notifications_{self.user_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_message(self, event):
        await self.send(text_data=json.dumps(event['payload']))