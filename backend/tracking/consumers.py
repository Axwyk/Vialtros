import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class TrackingConsumer(AsyncWebsocketConsumer):
    """
    Consumer de tracking en tiempo real.
    Cualquier cliente puede suscribirse a una ruta; no requiere autenticacion.
    """

    async def connect(self):
        self.route_id = self.scope["url_route"]["kwargs"].get("route_id", "?")
        self.group_name = f"tracking_{self.route_id}"
        client = self.scope.get("client", ("?", "?"))
        logger.debug(
            "[TrackingConsumer] connect — ruta=%s cliente=%s:%s",
            self.route_id, client[0], client[1],
        )

        if self.channel_layer is None:
            logger.error(
                "[TrackingConsumer] channel_layer es None. "
                "Verifica CHANNEL_LAYERS en settings.py."
            )
            await self.close(code=4500)
            return

        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.debug(
                "[TrackingConsumer] conexion aceptada — ruta=%s grupo=%s",
                self.route_id, self.group_name,
            )
        except Exception:
            logger.exception("[TrackingConsumer] error en connect()")
            await self.close(code=4500)

    async def disconnect(self, close_code):
        logger.debug(
            "[TrackingConsumer] disconnect — ruta=%s codigo=%s",
            getattr(self, "route_id", "?"), close_code,
        )
        if self.channel_layer is not None and hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception:
                logger.exception("[TrackingConsumer] error en disconnect()")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            logger.warning("[TrackingConsumer] mensaje no es JSON valido, ignorado")
            return

        try:
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "tracking_update", "data": data},
            )
        except Exception:
            logger.exception("[TrackingConsumer] error en receive()")

    async def tracking_update(self, event):
        try:
            await self.send(text_data=json.dumps(event["data"]))
        except Exception:
            logger.exception("[TrackingConsumer] error en tracking_update()")


class AdminMonitoringConsumer(AsyncWebsocketConsumer):
    """
    Consumer del panel de administracion.
    Se suscribe al grupo 'monitoring'. Staff ve todo; otros ven datos minimos.
    """

    async def connect(self):
        user = self.scope.get("user")
        is_authenticated = bool(user and getattr(user, "is_authenticated", False))
        is_staff = bool(user and getattr(user, "is_staff", False))
        self.limited_mode = not (is_authenticated and is_staff)
        self.group_name = "monitoring"

        logger.debug(
            "[AdminMonitoringConsumer] connect — usuario=%s autenticado=%s staff=%s limitado=%s",
            getattr(user, "username", "anonimo"),
            is_authenticated, is_staff, self.limited_mode,
        )

        if self.channel_layer is None:
            logger.error("[AdminMonitoringConsumer] channel_layer es None.")
            await self.close(code=4500)
            return

        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.debug("[AdminMonitoringConsumer] conexion aceptada")
        except Exception:
            logger.exception("[AdminMonitoringConsumer] error en connect()")
            await self.close(code=4500)

    async def disconnect(self, close_code):
        logger.debug("[AdminMonitoringConsumer] disconnect — codigo=%s", close_code)
        if self.channel_layer is not None and hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception:
                logger.exception("[AdminMonitoringConsumer] error en disconnect()")

    async def monitoring_event(self, event):
        payload = event.get("payload") or event.get("data") or {}
        try:
            if self.limited_mode:
                data = {
                    "route": payload.get("route"),
                    "latitude": payload.get("latitude") or payload.get("lat"),
                    "longitude": payload.get("longitude") or payload.get("lng"),
                    "timestamp": payload.get("timestamp") or payload.get("time"),
                    "event": payload.get("event") or "position_update",
                }
            else:
                data = payload
            await self.send(text_data=json.dumps(data))
        except Exception:
            logger.exception("[AdminMonitoringConsumer] error en monitoring_event()")


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Consumer de notificaciones personalizadas.
    Requiere usuario autenticado via JWT. Cierra la conexion si es anonimo.
    """

    async def connect(self):
        user = self.scope.get("user")
        is_authenticated = bool(user and getattr(user, "is_authenticated", False))

        logger.debug(
            "[NotificationConsumer] connect — usuario=%s autenticado=%s",
            getattr(user, "username", "anonimo"), is_authenticated,
        )

        if not is_authenticated:
            logger.warning(
                "[NotificationConsumer] conexion rechazada — usuario no autenticado"
            )
            await self.close(code=4401)
            return

        if self.channel_layer is None:
            logger.error("[NotificationConsumer] channel_layer es None.")
            await self.close(code=4500)
            return

        self.user_id = user.pk
        self.group_name = f"notifications_{self.user_id}"

        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.debug(
                "[NotificationConsumer] conexion aceptada — user_id=%s grupo=%s",
                self.user_id, self.group_name,
            )
        except Exception:
            logger.exception("[NotificationConsumer] error en connect()")
            await self.close(code=4500)

    async def disconnect(self, close_code):
        logger.debug(
            "[NotificationConsumer] disconnect — user_id=%s codigo=%s",
            getattr(self, "user_id", "?"), close_code,
        )
        if self.channel_layer is not None and hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception:
                logger.exception("[NotificationConsumer] error en disconnect()")

    async def notification_message(self, event):
        try:
            await self.send(text_data=json.dumps(event["payload"]))
        except Exception:
            logger.exception("[NotificationConsumer] error en notification_message()")
