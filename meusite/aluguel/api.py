import json
import re
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

        reservas = (
            Reserva.objects
            .filter(data_evento__year=ano, data_evento__month=mes)
            .filter(status='confirmado')
        )

        dados_ocupacao = {}

        for reserva in reservas:
            chave = reserva.data_evento.strftime('%Y-%m-%d')
            dados_ocupacao[chave] = dados_ocupacao.get(chave, 0) + quantidade_carrinhos_reserva(reserva)

        return JsonResponse({
            "total_carrinhos": total_carrinhos,
            "ocupacao": dados_ocupacao
        })
    except ValueError:
        return JsonResponse({"erro": "Data inválida"}, status=400)
    
# --- API DE CRIAR RESERVA ---
@csrf_exempt
@transaction.atomic
def api_criar_reserva(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            email_input = data.get('email')
            quantidade_carrinhos = max(1, int(data.get('quantidade_carrinhos') or 1))

            cliente = Cliente.objects.create(
                nome_cliente=data.get('nome'),
                telefone=data.get('telefone'),
                endereco=data.get('endereco'),
                email=email_input if email_input and email_input.strip() else None
            )

            observacao = data.get('descricao') or ''

            if quantidade_carrinhos > 1:
                observacao = (
                    f"{observacao}\n"
                    f"Quantidade de carrinhos solicitada: {quantidade_carrinhos}"
                ).strip()

            reserva = Reserva.objects.create(
                id_cliente=cliente,
                data_evento=data.get('data'),
                descricao=observacao,
                status='pendente',
                valor_pedido=0
            )

            for item in data.get('sabores', []):
                sorvete = Sorvete.objects.get(id=item['id'])
                ReservaProduto.objects.create(
                    id_reserva=reserva,
                    id_sorvete=sorvete,
                    quantidade_escolhida=item['qtd']
                )

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

def quantidade_carrinhos_reserva(reserva):
    texto = reserva.descricao or ''
    match = re.search(r'Quantidade de carrinhos(?: solicitada)?:\s*(\d+)', texto, re.IGNORECASE)

    if match:
        return max(1, int(match.group(1)))

    return 1


def serializar_reserva(reserva):
    itens = reserva.itens.select_related('id_sorvete').all()

    sabores_txt = ', '.join(
        f"{item.quantidade_escolhida}x {item.id_sorvete.nome_sorvete}"
        for item in itens
        if item.id_sorvete
    )

    qtd_carrinhos = quantidade_carrinhos_reserva(reserva)
    subtotal = Decimal(str(reserva.subtotal_sorvetes()))
    taxa_unitaria = Decimal(str(reserva.taxa_aluguel()))
    valor_carrinhos = taxa_unitaria * qtd_carrinhos
    total = subtotal + valor_carrinhos

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
        'quantidade_carrinhos': qtd_carrinhos,
        'carrinho_nome': (
            f"{qtd_carrinhos} carrinho" if qtd_carrinhos == 1
            else f"{qtd_carrinhos} carrinhos"
        ),
        'sabores': sabores_txt or 'Não informado',
        'observacoes': reserva.descricao or '',
        'subtotal': str(subtotal),
        'taxa_aluguel': str(valor_carrinhos),
        'valor_carrinhos': str(valor_carrinhos),
        'total': str(total),
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

def serializar_sorvete_admin(sorvete):
    return {
        'id': sorvete.id,
        'nome': sorvete.nome_sorvete,
        'preco': str(sorvete.preco),
        'quantidade': getattr(sorvete, 'quantidade', 0),
        'ativo': sorvete.ativo,
        'imagem_url': sorvete.imagem.url if sorvete.imagem else '',
    }


def api_admin_sabores(request):
    if not _admin_required(request):
        return JsonResponse({'erro': 'Não autorizado.'}, status=401)

    if request.method == 'GET':
        sabores = Sorvete.objects.all().order_by('nome_sorvete')
        return JsonResponse([serializar_sorvete_admin(s) for s in sabores], safe=False)

    if request.method == 'POST':
        nome = request.POST.get('nome', '').strip()
        preco = request.POST.get('preco', '0')
        ativo = request.POST.get('ativo') == 'true'

        if not nome:
            return JsonResponse({'erro': 'Informe o nome do sabor.'}, status=400)

        sorvete = Sorvete(
            nome_sorvete=nome,
            preco=Decimal(str(preco).replace(',', '.')),
            ativo=ativo
        )

        if hasattr(sorvete, 'quantidade'):
            sorvete.quantidade = int(request.POST.get('quantidade') or 0)

        if request.FILES.get('imagem'):
            sorvete.imagem = request.FILES['imagem']

        sorvete.save()
        return JsonResponse(serializar_sorvete_admin(sorvete), status=201)

    return JsonResponse({'erro': 'Método não permitido.'}, status=405)


def api_admin_sabor_detalhe(request, sorvete_id):
    if not _admin_required(request):
        return JsonResponse({'erro': 'Não autorizado.'}, status=401)

    try:
        sorvete = Sorvete.objects.get(id=sorvete_id)
    except Sorvete.DoesNotExist:
        return JsonResponse({'erro': 'Sabor não encontrado.'}, status=404)

    if request.method == 'POST':
        nome = request.POST.get('nome', '').strip()
        preco = request.POST.get('preco', '0')

        if not nome:
            return JsonResponse({'erro': 'Informe o nome do sabor.'}, status=400)

        sorvete.nome_sorvete = nome
        sorvete.preco = Decimal(str(preco).replace(',', '.'))
        sorvete.ativo = request.POST.get('ativo') == 'true'

        if hasattr(sorvete, 'quantidade'):
            sorvete.quantidade = int(request.POST.get('quantidade') or 0)

        if request.FILES.get('imagem'):
            sorvete.imagem = request.FILES['imagem']

        sorvete.save()
        return JsonResponse(serializar_sorvete_admin(sorvete))

    return JsonResponse({'erro': 'Método não permitido.'}, status=405)