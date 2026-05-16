from django.shortcuts import render

def index(request):
    # Certifique-se que o caminho do template está correto
    return render(request, 'aluguel/index.html')