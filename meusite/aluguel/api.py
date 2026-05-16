import json
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Count
from django.views.decorators.csrf import csrf_exempt
from .models import Sorvete, Reserva, ReservaProduto, Carrinho, Cliente
from decimal import Decimal

# --- API DE SABORES ---
def api_sabores(request):
    """Retorna todos os sabores ativos"""
    sabores = Sorvete.objects.filter(ativo=True)
    lista = [{
        "id": s.id,
        "nome": s.nome_sorvete,
        "preco": str(s.preco), # String para precisão no JS
        "imagem_url": s.imagem.url if s.imagem else ""
    } for s in sabores]
    return JsonResponse(lista, safe=False)

# --- API DE DISPONIBILIDADE ---
def api_disponibilidade(request):
    mes_ref = request.GET.get('mes')
    if not mes_ref:
        return JsonResponse({"ocupacao": {}, "total_carrinhos": 0})

    try:
        ano, mes = map(int, mes_ref.split('-'))
        total_carrinhos = Carrinho.objects.filter(status=True).count()

        contagem = (
            Reserva.objects.filter(data_evento__year=ano, data_evento__month=mes)
            .exclude(status='cancelado')
            .values('data_evento')
            .annotate(total=Count('id'))
        )

        # Criamos um dicionário: {"2026-05-15": 2, "2026-05-16": 1}
        dados_ocupacao = {
            item['data_evento'].strftime('%Y-%m-%d'): item['total'] 
            for item in contagem
        }

        return JsonResponse({
            "total_carrinhos": total_carrinhos,
            "ocupacao": dados_ocupacao
        })
    except ValueError:
        return JsonResponse({"erro": "Data inválida"}, status=400)
    
# --- API DE CRIAR RESERVA ---
@csrf_exempt
def api_criar_reserva(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # 1. Cria o Cliente (Email opcional tratado)
            email_input = data.get('email')
            cliente = Cliente.objects.create(
                nome_cliente=data.get('nome'),
                telefone=data.get('telefone'),
                endereco=data.get('endereco'),
                # Garante que string vazia vire NULL no banco
                email=email_input if email_input and email_input.strip() else None
            )

            # 2. PARTE 1: Criar a "Casca" da Reserva (Sem itens ainda)
            # Definimos valor_pedido=0 para o save() do model não tentar 
            # calcular o total_pedido() antes de termos o ID.
            reserva = Reserva(
                id_cliente=cliente,
                data_evento=data.get('data'),
                descricao=data.get('descricao'), # Nova observação do cliente
                status='pendente',
                valor_pedido=0 
            )
            reserva.save() # Aqui a reserva ganha a Primary Key (ID)

            # 3. PARTE 2: Vincular os Itens (Agora com a PK da reserva)
            sabores_selecionados = data.get('sabores', [])
            for item in sabores_selecionados:
                # Busca o sorvete pelo ID enviado pelo JS
                sorvete = Sorvete.objects.get(id=item['id'])
                
                ReservaProduto.objects.create(
                    id_reserva=reserva,
                    id_sorvete=sorvete,
                    quantidade_escolhida=item['qtd']
                )

            # 4. PARTE 3: Atualização do Valor Final
            # Agora que os itens existem, podemos pegar o total que veio do JS
            # ou forçar o Python a recalcular usando os itens que acabamos de criar.
            reserva.valor_pedido = data.get('total_valor', 0)
            reserva.save() # Salva novamente com o valor correto e itens vinculados

            return JsonResponse({
                'status': 'sucesso', 
                'whatsapp_url': reserva.gerar_link_whatsapp()
            }, status=201)

        except Sorvete.DoesNotExist:
            return JsonResponse({'status': 'erro', 'message': 'Um dos sabores selecionados não foi encontrado.'}, status=400)
        except Exception as e:
            return JsonResponse({'status': 'erro', 'message': str(e)}, status=400)
    
    return JsonResponse({'status': 'erro', 'message': 'Método não permitido'}, status=405)