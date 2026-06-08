import json
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Count
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import ensure_csrf_cookie
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

def api_auth_login(request):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    dados = json.loads(request.body)
    user = authenticate(
        request,
        username=dados.get('username'),
        password=dados.get('password')
    )

    if user is None:
        return JsonResponse({'erro': 'Usuário ou senha inválidos.'}, status=401)

    if not user.is_staff:
        return JsonResponse({'erro': 'Usuário sem permissão de administrador.'}, status=403)

    login(request, user)
    return JsonResponse({'success': True, 'usuario': user.username})


def api_auth_logout(request):
    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    logout(request)
    return JsonResponse({'success': True})


@ensure_csrf_cookie
def api_auth_check(request):
    if request.user.is_authenticated and request.user.is_staff:
        return JsonResponse({
            'authenticated': True,
            'usuario': request.user.username
        })

    return JsonResponse({'authenticated': False}, status=401)

def _admin_required(request):
    return request.user.is_authenticated and request.user.is_staff


def serializar_reserva(reserva):
    itens = reserva.itens.select_related('id_sorvete').all()

    sabores_txt = ', '.join(
        f"{item.quantidade_escolhida}x {item.id_sorvete.nome_sorvete}"
        for item in itens
        if item.id_sorvete
    )

    return {
        'id': reserva.id,
        'data': reserva.data_evento.strftime('%Y-%m-%d') if reserva.data_evento else '',
        'status': reserva.status,
        'cliente_id': reserva.id_cliente.id,
        'cliente_nome': reserva.id_cliente.nome_cliente,
        'cliente_telefone': reserva.id_cliente.telefone,
        'cliente_email': reserva.id_cliente.email or '',
        'cliente_endereco': reserva.id_cliente.endereco,
        'carrinho_id': reserva.id_carrinho.id if reserva.id_carrinho else None,
        'carrinho_nome': f"Carrinho {reserva.id_carrinho.id}" if reserva.id_carrinho else 'Não definido',
        'sabores': sabores_txt or 'Não informado',
        'observacoes': reserva.descricao or '',
        'subtotal': str(reserva.subtotal_sorvetes()),
        'taxa_aluguel': str(reserva.taxa_aluguel()),
        'total': str(reserva.total_pedido()),
    }


def api_reservas(request):
    if not _admin_required(request):
        return JsonResponse({'erro': 'Não autorizado.'}, status=401)

    if request.method == 'GET':
        reservas = (
            Reserva.objects
            .select_related('id_cliente', 'id_carrinho')
            .prefetch_related('itens__id_sorvete')
            .order_by('-data_evento', '-id')
        )
        return JsonResponse([serializar_reserva(r) for r in reservas], safe=False)

    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            cliente = Cliente.objects.create(
                nome_cliente=data.get('cliente_nome'),
                telefone=data.get('cliente_telefone', ''),
                email=data.get('cliente_email') or None,
                endereco=data.get('cliente_endereco', '')
            )

            carrinho = None
            carrinho_id = data.get('carrinho_id')
            if carrinho_id:
                carrinho = Carrinho.objects.filter(id=carrinho_id).first()

            reserva = Reserva.objects.create(
                id_cliente=cliente,
                id_carrinho=carrinho,
                data_evento=data.get('data'),
                descricao=data.get('observacoes', ''),
                status='pendente',
                valor_pedido=0
            )

            return JsonResponse(serializar_reserva(reserva), status=201)

        except Exception as e:
            return JsonResponse({'erro': str(e)}, status=400)

    return JsonResponse({'erro': 'Método não permitido.'}, status=405)


def api_reserva_detalhe(request, reserva_id):
    if not _admin_required(request):
        return JsonResponse({'erro': 'Não autorizado.'}, status=401)

    try:
        reserva = (
            Reserva.objects
            .select_related('id_cliente', 'id_carrinho')
            .prefetch_related('itens__id_sorvete')
            .get(id=reserva_id)
        )
    except Reserva.DoesNotExist:
        return JsonResponse({'erro': 'Reserva não encontrada.'}, status=404)

    if request.method == 'GET':
        return JsonResponse(serializar_reserva(reserva))

    return JsonResponse({'erro': 'Método não permitido.'}, status=405)


def api_reserva_status(request, reserva_id):
    if not _admin_required(request):
        return JsonResponse({'erro': 'Não autorizado.'}, status=401)

    if request.method != 'POST':
        return JsonResponse({'erro': 'Método não permitido.'}, status=405)

    try:
        data = json.loads(request.body)
        novo_status = data.get('status')

        if novo_status not in ['pendente', 'confirmado', 'cancelado']:
            return JsonResponse({'erro': 'Status inválido.'}, status=400)

        reserva = Reserva.objects.get(id=reserva_id)
        reserva.status = novo_status
        reserva.save()

        return JsonResponse(serializar_reserva(reserva))

    except Reserva.DoesNotExist:
        return JsonResponse({'erro': 'Reserva não encontrada.'}, status=404)
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)


def api_clientes(request):
    if not _admin_required(request):
        return JsonResponse({'erro': 'Não autorizado.'}, status=401)

    if request.method == 'GET':
        clientes = Cliente.objects.all().order_by('id')
        return JsonResponse([{
            'id': c.id,
            'nome_cliente': c.nome_cliente,
            'telefone': c.telefone,
            'email': c.email or '',
            'endereco': c.endereco,
        } for c in clientes], safe=False)

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            cliente = Cliente.objects.create(
                nome_cliente=data.get('nome_cliente'),
                telefone=data.get('telefone', ''),
                email=data.get('email') or None,
                endereco=data.get('endereco', '')
            )

            return JsonResponse({
                'id': cliente.id,
                'nome_cliente': cliente.nome_cliente,
                'telefone': cliente.telefone,
                'email': cliente.email or '',
                'endereco': cliente.endereco,
            }, status=201)

        except Exception as e:
            return JsonResponse({'erro': str(e)}, status=400)

    return JsonResponse({'erro': 'Método não permitido.'}, status=405)


def api_carrinhos(request):
    if not _admin_required(request):
        return JsonResponse({'erro': 'Não autorizado.'}, status=401)

    carrinhos = Carrinho.objects.all().order_by('id')

    return JsonResponse([{
        'id': c.id,
        'nome': f'Carrinho {c.id}',
        'preco_diaria': str(c.preco_diaria),
        'status': c.status,
    } for c in carrinhos], safe=False)
