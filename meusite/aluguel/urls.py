from django.urls import path
from . import views  # Importa o views.py
from . import api    # Importa o api.py

urlpatterns = [
    # Página HTML (View tradicional)
    path('', views.index, name='index'),
    path('painel/', views.painel, name='painel'),

    # Rotas de Dados (Vêm do api.py)
    path('api/sabores/', api.api_sabores, name='api_sabores'),
    path('api/admin/sabores/', api.api_admin_sabores, name='api_admin_sabores'),
    path('api/admin/sabores/<int:sorvete_id>/', api.api_admin_sabor_detalhe, name='api_admin_sabor_detalhe'),


    path('api/disponibilidade/', api.api_disponibilidade, name='api_disponibilidade'),
    path('api/reserva/criar/', api.api_criar_reserva, name='api_criar_reserva'),

    path('api/auth/login/', api.api_auth_login, name='api_auth_login'),
    path('api/auth/logout/', api.api_auth_logout, name='api_auth_logout'),
    path('api/auth/check/', api.api_auth_check, name='api_auth_check'),

    path('api/reservas/', api.api_reservas, name='api_reservas'),
    path('api/reservas/<int:reserva_id>/', api.api_reserva_detalhe, name='api_reserva_detalhe'),
    path('api/reservas/<int:reserva_id>/status/', api.api_reserva_status, name='api_reserva_status'),

    path('api/clientes/', api.api_clientes, name='api_clientes'),

    path('api/carrinhos/', api.api_carrinhos, name='api_carrinhos'),


]