from django.db import models
from PIL import Image
from decimal import Decimal

# Create your models here.
class Carrinho(models.Model):
    preco_diaria = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.BooleanField(default=True)

    def __str__(self):
        return str(self.id)

class Sorvete(models.Model):
    nome_sorvete = models.CharField(max_length=200)
    preco = models.DecimalField(max_digits=5, decimal_places=2)
    quantidade = models.IntegerField(default=0)
    imagem = models.ImageField(upload_to='sabores/', null=True, blank=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if self.imagem:
            img = Image.open(self.imagem.path)

            max_size = (400, 400)
            img.thumbnail(max_size)

            img.save(self.imagem.path)

    def __str__(self):
        return self.nome_sorvete

    
class Cliente(models.Model):
    nome_cliente = models.CharField(max_length=200)
    endereco = models.CharField(max_length=300)
    telefone = models.CharField(max_length=20)
    email = models.CharField(max_length=200)

    def __str__(self):
        return self.nome_cliente

class Reserva(models.Model):
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('confirmado', 'Confirmado'),
        ('cancelado', 'Cancelado'),
    ]


    id_cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE)
    id_carrinho = models.ForeignKey(Carrinho, on_delete=models.CASCADE)
    data_evento = models.DateField("Data do evento")
    valor_pedido = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pendente')
    descricao = models.CharField(max_length=500)
    disponibilidade = models.BooleanField(default=False)

    def subtotal_sorvetes(self):
        """Calcula APENAS o valor dos produtos escolhidos."""
        total = sum(item.quantidade_escolhida * item.id_sorvete.preco for item in self.itens.all())
        return Decimal(total)
    
    def taxa_aluguel(self):
        """Calcula APENAS a taxa, aplicando a regra de gratuidade."""
        if self.subtotal_sorvetes() >= 300:
            return Decimal('0.00')
        return self.id_carrinho.preco_diaria
    
    def total_pedido(self):
        """Soma as duas partes para dar o valor final ao cliente."""
        return self.subtotal_sorvetes() + self.taxa_aluguel()

    @classmethod
    def vagas_disponiveis(cls, data_desejada):
        """
        Retorna a quantidade de carrinhos livres para uma data específica.
        """
        total_carrinho = Carrinho.objects.filter(status=True).count()
        alugueis_confirmados = cls.objects.filter(
            data_evento = data_desejada,
            status='confirmado'
        ).count()

        return total_carrinho - alugueis_confirmados
    
    def pode_confirmar(self):
        return self.vagas_disponiveis(self.data_evento) > 0

    def verificar_alerta_estoque(self):
        """
        Apenas avisa se HOJE não haveria estoque, 
        mas permite o pedido se a data for distante.
        """
        alertas = []
        for item in self.itens.all():
            if item.quantidade_escolhida > item.id_sorvete.quantidade:
                diferenca = item.quantidade_escolhida - item.id_sorvete.quantidade
                alertas.append(f"Faltam {diferenca} unidades de {item.id_sorvete.nome_sorvete}")
        return alertas

    def __str__(self):
        return f"Reserva {self.id} - {self.id_cliente.nome_cliente}"
    
class ReservaProduto(models.Model):
    # Atualização adicionada quantidade_escolhida
    id_reserva = models.ForeignKey(Reserva, on_delete=models.CASCADE, related_name="itens")
    id_sorvete = models.ForeignKey(Sorvete, on_delete=models.CASCADE, null=True) # Um por linha
    quantidade_escolhida = models.IntegerField(default=1)