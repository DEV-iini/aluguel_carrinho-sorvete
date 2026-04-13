from django.urls import path
from . import views, api

urlpatterns = [
    # Rotas de Páginas (HTML)
    path('', views.nome, name='home'),
    path('reserva/', views.pagina_reserva, name='pagina_reserva'),

    # Rotas de Dados (APIs)
    path('api/sabores/', api.api_sabores, name='api_sabores'),
    path('api/disponibilidade/', api.api_disponibilidade, name='api_disponibilidade'),
    path('api/reservas/', api.api_criar_reserva, name='api_criar_reserva'),
]