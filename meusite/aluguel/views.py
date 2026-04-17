from django.shortcuts import render
from django.http import JsonResponse
from .models import Reserva, Sorvete # Importe seus modelos
import json

def index(request):
    return render(request, 'reserva/index.html')

def api_criar_reserva(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        
        # Criando a reserva no banco
        reserva = Reserva.objects.create(
            cliente_nome=data['cliente_nome'],
            telefone=data['cliente_telefone'],
            data_evento=data['data'],
            observacoes=data['observacoes']
        )
        
        # Associando os sabores (Many-to-Many se você tiver)
        # sabores = Sorvete.objects.filter(id__in=data['sabores_ids'])
        # reserva.sabores.set(sabores)

        return JsonResponse({'id': reserva.id, 'status': 'pendente'})
    
    return JsonResponse({'erro': 'Método não permitido'}, status=405)