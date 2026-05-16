from django.urls import path
from . import views  # Importa o views.py
from . import api    # Importa o api.py

urlpatterns = [
    # Página HTML (View tradicional)
    path('', views.index, name='index'),

    # Rotas de Dados (Vêm do api.py)
    path('api/sabores/', api.api_sabores, name='api_sabores'),
    path('api/disponibilidade/', api.api_disponibilidade, name='api_disponibilidade'),
    path('api/reserva/criar/', api.api_criar_reserva, name='api_criar_reserva'),
]