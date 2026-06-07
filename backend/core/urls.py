"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import: from my_app import views
    2. Add a URL to urlpatterns: path('', views.home, name='home')

Class-based views
    1. Add an import: from other_app.views import Home
    2. Add a URL to urlpatterns: path('', Home.as_view(), name='home')

Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns: path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import redirect
from rest_framework import routers
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from users.views import (
    UserViewSet,
    DriverViewSet,
    PassengerViewSet,
    RouteViewSet,
    TrackingViewSet,
    NotificationViewSet,
    RouteRatingViewSet,
    ForgotPasswordView,
    ResetPasswordView,
)

def home(request):
    return redirect('/admin/')

router = routers.DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'drivers', DriverViewSet)
router.register(r'passengers', PassengerViewSet)
router.register(r'routes', RouteViewSet)
router.register(r'tracking', TrackingViewSet)
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'route-ratings', RouteRatingViewSet, basename='route-rating')

urlpatterns = [
    path('', home, name='home'),
    path('admin/', admin.site.urls),

    # API
    path('api/', include(router.urls)),

    # JWT
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Auth
    path(
        'api/auth/forgot-password/',
        ForgotPasswordView.as_view(),
        name='forgot_password'
    ),
    path(
        'api/auth/reset-password/',
        ResetPasswordView.as_view(),
        name='reset_password'
    ),
]

# Servir archivos estáticos en desarrollo
if settings.DEBUG:
    urlpatterns += static(
        settings.STATIC_URL,
        document_root=settings.STATIC_ROOT
    )

