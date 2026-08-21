# 🍦 Sistema de Aluguel de Carrinhos de Sorvete

Aplicação web desenvolvida em Django para simplificar e agilizar a locação de carrinhos de sorvete.  
O sistema dispensa a criação de conta para o cliente, permitindo reservas rápidas com validação de disponibilidade em tempo real e um painel administrativo completo para controle operacional.

## 🚀 Funcionalidades Principais

### 💻 Área do Cliente (sem necessidade de login)

| Funcionalidade | Descrição |
|---|---|
| Verificação em tempo real | O cliente visualiza a disponibilidade dos carrinhos diretamente na tela inicial, de forma dinâmica. |
| Agendamento prático | Seleção intuitiva de datas e dos sabores de sorvete desejados para o evento. |
| Formulário simples | Coleta apenas os dados estritamente necessários para contato, entrega e faturamento da reserva. |
| Interface fluida | Desenvolvida com HTML5, CSS3 e JavaScript para atualizar informações sem recarregamentos desnecessários. |

### 🛡️ Painel Administrativo (Django Admin)

| Funcionalidade | Descrição |
|---|---|
| Controle de frota | Gestão completa dos carrinhos cadastrados no sistema. |
| Gestão de cardápio | Cadastro, edição e remoção dos sabores de sorvete disponíveis para locação. |
| Base de clientes | Centralização e consulta dos dados enviados pelos locatários. |
| Painel de reservas | Visualização e controle de todas as locações para evitar conflitos de datas e organizar a logística. |

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologias |
|---|---|
| Backend | Django (Python) |
| Banco de dados | MySQL |
| Frontend | HTML5, CSS3 e JavaScript (Vanilla JS) |

## 🔧 Como Executar o Projeto Localmente

| Etapa | Comando / Ação |
|---|---|
| 1. Clonar o repositório | `git clone https://github.com/DEV-iini/aluguel_carrinho-sorvete.git`<br>`cd aluguel_carrinho-sorvete` |
| 2. Criar ambiente virtual | Linux/macOS:<br>`python3 -m venv venv`<br>`source venv/bin/activate`<br><br>Windows:<br>`python -m venv venv`<br>`.\\venv\\Scripts\\activate` |
| 3. Instalar dependências | `pip install -r requirements.txt` |
| 4. Configurar MySQL | Criar o banco:<br>`CREATE DATABASE aluguel_sorvete CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`<br><br>Ajustar o `settings.py` com as credenciais do ambiente. |
| 5. Aplicar migrações | `python manage.py makemigrations`<br>`python manage.py migrate` |
| 6. Criar superusuário | `python manage.py createsuperuser` |
| 7. Iniciar o servidor | `python manage.py runserver` |

Acesse:
- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/painel`

## 🗄️ Modelagem de Dados

| Entidade | Finalidade |
|---|---|
| Clientes | Guarda o histórico de dados de quem aluga. |
| Carrinhos | Registra os carrinhos e monitora quais estão operacionais. |
| Sabores | Armazena as opções de sorvete oferecidas. |
| Reservas | Entidade central que une Cliente, Carrinho e Sabores a uma data específica, garantindo que o mesmo carrinho não receba duas reservas no mesmo dia. |

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.
