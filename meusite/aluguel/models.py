from django.db import models

# Create your models here.
class Carrinho(models.Model):
    preco_diaria = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.BooleanField(default=True)

    def __str__(self):
        return self.id

class Sorvete(models.Model):
    nome_sorvete = models.CharField(max_length=200)
    preco = models.DecimalField(max_digits=5, decimal_places=2)
    quantidade = models.IntegerField(default=0)

    def __str__(self):
        return self.id
    
class Cliente(models.Model):
    nome_cliente = models.CharField(max_length=200)
    endereço = models.CharField(max_length=300)
    telefone = models.CharField(max_length=20)
    email = models.CharField(max_length=200)

    def __str__(self):
        return self.id

class Reserva(models.Model):
    id_cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE)
    id_carrinho = models.ForeignKey(Carrinho, on_delete=models.CASCADE)
    data_evento = models.DateField("Data do evento")
    valor_pedido = models.DecimalField(max_digits=6, decimal_places=2)
    status = models.CharField(max_length=10)
    descricao = models.CharField(max_length=500)
    disponibilidade = models.BooleanField(default=False)

    def __str__(self):
        return self.id
    
class ReservaProduto(models.Model):
    id_reserva = models.ForeignKey(Reserva, on_delete=models.CASCADE)
    id_sorvete = models.ManyToManyField(Sorvete, related_name="sorvetes")