from django.test import TestCase
from django.core.exceptions import ValidationError
from .models import Carrinho, Sorvete, Cliente, Reserva, ReservaProduto
from decimal import Decimal
from datetime import date, timedelta

# Create your tests here.
class ReservaRegraDeNegocioTest(TestCase):
    # Configuração inicial para todos os testes
    def setUp(self):
        self.carrinho = Carrinho.objects.create(preco_diaria=Decimal('50.00'), status=True)
        self.sorvete = Sorvete.objects.create(nome_sorvete="Festa Achocolatado", preco=Decimal('1.75'), quantidade=200)
        self.cliente = Cliente.objects.create(nome_cliente="Izabella", endereco="Rua A", telefone="123", email="i@i.com")
        self.data_valida = date.today() + timedelta(days=5)

    def test_regra_aluguel_gratis_acima_300(self):
        """Teste: Se o pedido for R$ 300 em sorvete, aluguel deve ser R$ 0"""
        reserva = Reserva.objects.create(
            id_cliente=self.cliente,
            id_carrinho=self.carrinho,
            data_evento=self.data_valida,
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
            data_evento=date.today() + timedelta(days=2),
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

class ReservaRegrasAvancadasTest(TestCase):

    def setUp(self):
        # Setup básico
        self.carrinho = Carrinho.objects.create(preco_diaria=Decimal('50.00'), status=True)
        self.sorvete = Sorvete.objects.create(
            nome_sorvete='Festa Melancia',
            preco=Decimal('1.50'),
            quantidade=50 # Começamos com 50 no estoque
        )
        self.cliente = Cliente.objects.create(nome_cliente='Mariana', email="m@m.com")

    def test_impedir_reserva_menos_24h(self):
        """Teste: Não deve permitir reserva para hoje (menos de 24h)"""
        hoje = date.today()
        reserva = Reserva(
            id_cliente=self.cliente,
            id_carrinho=self.carrinho,
            data_evento=hoje,
            valor_pedido=0
        )
        # O self.assertRaises verifica se o Django bloqueou com ValidationError
        with self.assertRaises(ValidationError):
            reserva.clean()

    def test_permitir_reserva_mais_24h(self):
        """Teste: Deve permitir reserva para daqui a 3 dias"""
        daqui_a_2_dias= date.today() + timedelta(days=2)
        reserva = Reserva(
            id_cliente=self.cliente,
            id_carrinho=self.carrinho,
            data_evento=daqui_a_2_dias,
            valor_pedido=0
        )
        # Se não levantar erro, o teste passa
        try:
            reserva.clean()
        except ValidationError:
            self.fail("Reserva com 48h de antecedência deveria ser permitida.")

    def test_baixa_de_estoque_ao_confirmar(self):
        """Teste: Estoque deve diminuir apenas quando status mudar para 'confirmado'"""
        data_valida = date.today() + timedelta(days=5)
        reserva = Reserva.objects.create(
            id_cliente=self.cliente,
            id_carrinho=self.carrinho,
            data_evento=data_valida,
            status='pendente',
            valor_pedido=0
        )

        # Criamos o item (10 picolés)
        ReservaProduto.objects.create(
            id_reserva=reserva, 
            id_sorvete=self.sorvete, 
            quantidade_escolhida=10
        )

        # 1. Verifica que ainda tem 50 no estoque (ainda é pendente)
        self.sorvete.refresh_from_db()
        self.assertEqual(self.sorvete.quantidade, 50)

        # 2. Muda para confirmado e salva
        reserva.status = 'confirmado'
        reserva.save()

        # 3. Verifica se baixou para 40
        self.sorvete.refresh_from_db()
        self.assertEqual(self.sorvete.quantidade, 40)

        def test_link_whatsapp_contem_aviso_frete(self):
            """Teste: O link gerado deve conter a menção ao Lalamove"""
            reserva = Reserva.objects.create(
                id_cliente=self.cliente,
                id_carrinho=self.carrinho,
                data_evento=date.today() + timedelta(days=5),
                valor_pedido=0
            )

            link = reserva.gerar_link_whatsapp()
            self.assertIn("Lalamove", link)

