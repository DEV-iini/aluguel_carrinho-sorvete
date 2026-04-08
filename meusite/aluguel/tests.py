from django.test import TestCase
from .models import Carrinho, Sorvete, Cliente, Reserva, ReservaProduto
from decimal import Decimal
from datetime import date

# Create your tests here.
class ReservaRegraDeNegocioTest(TestCase):
    # Configuração inicial para todos os testes
    def setUp(self):
        self.carrinho = Carrinho.objects.create(preco_diaria=Decimal('50.00'), status=True)
        self.sorvete = Sorvete.objects.create(nome_sorvete="Festa Achocolatado", preco=Decimal('1.75'), quantidade=200)
        self.cliente = Cliente.objects.create(nome_cliente="João", endereco="Rua A", telefone="123", email="j@j.com")

    def test_regra_aluguel_gratis_acima_300(self):
        """Teste: Se o pedido for R$ 300 em sorvete, aluguel deve ser R$ 0"""
        reserva = Reserva.objects.create(
            id_cliente=self.cliente,
            id_carrinho=self.carrinho,
            data_evento=date.today(),
            valor_pedido=0 # Será calculado
        )
        # Adiciona 172 picolés de R$ 1,75 = R$ 301
        ReservaProduto.objects.create(id_reserva=reserva, id_sorvete=self.sorvete, quantidade_escolhida=172)

        self.assertEqual(reserva.taxa_aluguel(), Decimal('0.00'))
        self.assertEqual(reserva.total_pedido(), Decimal('301.00'))

    def test_taxa_aluguel_abaixo_300(self):
        """Teste: Se o pedido for menor que R$ 300, deve cobrar a taxa do carrinho"""
        reserva = Reserva.objects.create(
            id_cliente=self.cliente,
            id_carrinho=self.carrinho,
            data_evento=date.today(),
            valor_pedido=0
        )
        # Adiciona 50 picolés de R$ 1,75 = R$ 87,50
        ReservaProduto.objects.create(id_reserva=reserva, id_sorvete=self.sorvete, quantidade_escolhida=50)

        self.assertEqual(reserva.taxa_aluguel(), Decimal('50.00'))
        self.assertEqual(reserva.total_pedido(), Decimal('137.50'))

    def test_disponibilidade_de_carrinhos(self):
        """Teste: Se temos 1 carrinho, a segunda reserva confirmada deve falhar na checagem"""

        data = date(2026, 5, 20)

        # Primeira reserva confirmada
        Reserva.objects.create(
            id_cliente=self.cliente, id_carrinho=self.carrinho,
            data_evento=data, status='confirmado', valor_pedido=0
        )

        # Tenta verificar se há vaga para uma segunda reserva
        pode_alugar = Reserva.vagas_disponiveis(data) > 0
        self.assertFalse(pode_alugar)