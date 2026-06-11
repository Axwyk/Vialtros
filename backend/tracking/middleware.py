import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)
User = get_user_model()


@database_sync_to_async
def _resolve_user(token_key):
    try:
        token = AccessToken(token_key)
        user = User.objects.get(pk=token["user_id"])
        logger.debug("[JwtAuthMiddleware] token valido — user_id=%s username=%s", user.pk, user.username)
        return user
    except Exception as exc:
        logger.warning("[JwtAuthMiddleware] token invalido — %s", exc)
        return AnonymousUser()


class JwtAuthMiddleware(BaseMiddleware):
    """Popula scope['user'] desde el query param ?token= (JWT)."""

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "websocket":
            query_string = scope.get("query_string", b"").decode()
            query_params = parse_qs(query_string)
            token_key = query_params.get("token", [None])[0]
            path = scope.get("path", "?")
            if token_key:
                scope["user"] = await _resolve_user(token_key)
            else:
                logger.debug("[JwtAuthMiddleware] sin token JWT en %s", path)
        return await super().__call__(scope, receive, send)
