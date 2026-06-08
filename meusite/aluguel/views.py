from django.shortcuts import render
from django.http import JsonResponse
from .models import Carrinho, Reserva
from django.views.decorators.csrf import ensure_csrf_cookie

def index(request):
    return render(request, 'aluguel/index.html')

def api_disponibilidade(request):
    mes_ano = request.GET.get('mes', None)
    
    # 1. Conta no banco de dados quantos carrinhos a empresa possui no total
    total_carrinhos = Carrinho.objects.count()
    
    # 2. Busca no banco de dados todas as reservas confirmadas para o mês solicitado
    reservas_do_mes = Reserva.objects.filter(data_evento__startswith=mes_ano)
    
    # 3. Calcula matematicamente a ocupação de cada dia com base nos aluguéis reais
    ocupacao = {}
    for reserva in reservas_do_mes:
        # Formata a data para o padrão 'YYYY-MM-DD' que o JavaScript espera
        data_str = reserva.data_evento.strftime('%Y-%m-%d')
        
        # Vai somando a quantidade de carrinhos alugados naquele dia específico
        ocupacao[data_str] = ocupacao.get(data_str, 0) + reserva.quantidade_carrinhos
        
    dados = {
        "total_carrinhos": total_carrinhos,
        "ocupacao": ocupacao
    }
    
    return JsonResponse(dados)

@ensure_csrf_cookie
def painel(request):
    return render(request, 'aluguel/painel.html')