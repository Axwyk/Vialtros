import json
from channels.generic.websocket import AsyncWebsocketConsumer

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