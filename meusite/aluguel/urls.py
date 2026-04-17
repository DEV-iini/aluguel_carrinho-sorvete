from django.urls import path
from . import views

urlpatterns = [
    # Rota da página principal
    path('', views.index, name='index'),

    # Rotas da API (chamadas pelo JavaScript)
    path('api/sabores/', views.listar_sabores, name='api_sabores'),
    path('api/disponibilidade/', views.api_disponibilidade, name='api_disponibilidade'),
    path('api/sabores-disponibilidade/', views.api_sabores_dia, name='api_sabores_dia'),
    path('api/reservas/', views.api_criar_reserva, name='api_criar_reserva'),
]