import json
from django.http import JsonResponse
from .models import Sorvete, Reserva, ReservaProduto, Carrinho
from django.db.models import Count
from django.db import transaction

# --- API DE SABORES ---
def api_sabores(request):
    """Retorna todos os sabores ativos com suas respectivas fotos"""
    sabores = Sorvete.objects.filter(ativo=True)

    lista_sabores = []

    for s in sabores:
        lista_sabores.append({
            "id": s.id,
            "nome": s.nome_sorvete,
            "preco": float(s.preco),
            "imagem_url": s.imagem.url if s.imagem else ""
        })

    return JsonResponse(lista_sabores, safe=False)

# --- API DE DISPONIBILIDADE ---
def api_disponibilidade(request):
    """Informa ao calendário quais dias estão bloqueados ou lotados"""
    mes_ref = request.GET.get('mes') # Recebe algo como "2026-04"

    if not mes_ref or '-' not in mes_ref:
        return JsonResponse({"bloqueios": [], "reservas_por_dia": {}})
    
    try:
        ano, mes = map(int, mes_ref.split('-'))

        # 1. Total de carrinhos operacionais no sistema
        total_carrinhos = Carrinho.objects.filter(status=True).count()

        # 2. Contagem de reservas ocupando carrinhos (ignora as canceladas)
        contagem = (
            Reserva.objects.filter(data_evento__year=ano, data_evento__month=mes)
            .exclude(status='cancelado') 
            .values('data_evento')
            .annotate(total=Count('id'))
        )

        reservas_por_dia = {}
        bloqueios = []

        for item in contagem:
            data_iso = item['data_evento'].strftime('%Y-%m-%d')
            total = item['total']
            reservas_por_dia[data_iso] = total

            # Se atingiu o limite de carrinhos físicos, adiciona à lista de bloqueio
            if total >= total_carrinhos:
                bloqueios.append(data_iso)

        return JsonResponse({
            "bloqueios": bloqueios, 
            "reservas_por_dia": reservas_por_dia
        })
    
    except ValueError:
        return JsonResponse({"erro": "Formato de data inválido"}, status=400)

# --- API DE CRIAR RESERVA ---
def api_criar_reserva(request):
    """Recebe os dados do formulário e salva a reserva real no banco de dados"""
    if request.method == "POST":
        try:
            dados = json.loads(request.body)

            # Usamos o transaction.atomic para garantir que se a criação dos itens falhar,
            # a reserva e o cliente não sejam salvos sozinhos. Tudo ou nada.
            with transaction.atomic():
                
                # 1. Gestão do Cliente
                # Tenta encontrar um cliente pelo telefone, se não existir, cria com os dados fornecidos
                cliente, _ = Cliente.objects.get_or_create(
                    telefone=dados.get('cliente_telefone'),
                    defaults={
                        'nome_cliente': dados.get('cliente_nome'),
                        'email': dados.get('cliente_email', 'nao@informado.com'),
                        'endereco': 'A definir via WhatsApp' # O endereço final costuma ser refinado no chat
                    }
                )

                # 2. Criação da Reserva
                # O campo valor_pedido será calculado automaticamente pelo save() do seu model
                nova_reserva = Reserva.objects.create(
                    id_cliente=cliente,
                    data_evento=dados.get('data'),
                    descricao=f"Obs: {dados.get('observacoes', '')}",
                    status='pendente'
                    # id_carrinho fica vazio (null) até você definir no Admin
                )

                # 3. Adicionar os Sabores Selecionados
                # Esperamos que o front-end envie uma lista de IDs em 'ids_sabores'
                ids_sabores = dados.get('ids_sabores', [])
                
                if not ids_sabores:
                    raise ValueError("É necessário selecionar pelo menos um sabor.")

                for sabor_id in ids_sabores:
                    sabor = Sorvete.objects.get(id=sabor_id)
                    ReservaProduto.objects.create(
                        id_reserva=nova_reserva,
                        id_sorvete=sabor,
                        quantidade_escolhida=1  # Padrão inicial de 1 unidade por sabor
                    )

            # Se chegou aqui, a transação foi concluída com sucesso
            return JsonResponse({
                "success": True,
                "reserva_id": nova_reserva.id,
                "status": nova_reserva.status,
                "valor_total": float(nova_reserva.valor_pedido),
                "whatsapp_url": nova_reserva.gerar_link_whatsapp()
            }, status=201)

        except Exception as e:
            # Qualquer erro aqui dentro desfaz as alterações no banco (Rollback)
            return JsonResponse({
                "success": False,
                "erro": str(e)
            }, status=400)

    return JsonResponse({"erro": "Método não permitido"}, status=405)