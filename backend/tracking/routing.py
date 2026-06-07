from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from channels.auth import AuthMiddlewareStack
from tracking import consumers
from django.urls import re_path

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter([
            re_path(r"^ws/tracking/(?P<route_id>\d+)/$", consumers.TrackingConsumer.as_asgi()),
            re_path(r"^ws/monitoring/$", consumers.AdminMonitoringConsumer.as_asgi()),
            re_path(r"^ws/notifications/$", consumers.NotificationConsumer.as_asgi()),
        ])
    ),
})
