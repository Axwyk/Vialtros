from django.shortcuts import render


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q

from .models import Route, Tracking


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def completed_trips_history(request):
    user = request.user

    
    routes_qs = Route.objects.filter(status="completed").order_by("-id")

    
    if hasattr(user, "role"):
        if user.role == "driver":
            routes_qs = routes_qs.filter(driver__user=user)
        elif user.role == "user":
            routes_qs = routes_qs.filter(passenger_details__user=user).distinct()

    data = [
        {
            "id": route.id,
            "name": route.name,
            "origin": route.origin,
            "destination": route.destination,
            "status": getattr(route, "status", None),
            "driver": getattr(getattr(route, "driver", None), "license_number", None),
            "passenger_count": getattr(route, "passenger_count", None)
                or (route.passenger_details.count() if hasattr(route, "passenger_details") else 0),
        }
        for route in routes_qs
    ]

    return Response(data)