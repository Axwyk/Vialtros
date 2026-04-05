"""
ASGI config for core project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""


import os
from tracking.routing import application as channels_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Para HTTP y WebSocket
application = channels_application
