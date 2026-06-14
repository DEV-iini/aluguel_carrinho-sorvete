
# 🍦 Sistema de Aluguel de Carrinhos de Sorvete

  

Uma aplicação web em Django desenvolvida para simplificar e agilizar o processo de locação de carrinhos de sorvete. O sistema elimina a barreira de criação de contas para o cliente, permitindo reservas rápidas com validação de disponibilidade em tempo real, além de oferecer um painel administrativo completo para o controle operacional.

  

---

  

## 🚀 Funcionalidades Principais

  

### 💻 Área do Cliente (Sem necessidade de Login)

*  **Verificação em Tempo Real:** O cliente visualiza a disponibilidade dos carrinhos de sorvete diretamente na tela inicial de forma dinâmica.

*  **Agendamento Prático:** Seleção intuitiva de datas e dos sabores de sorvete desejados para o evento.

*  **Formulário Simples:** Coleta apenas dos dados estritamente necessários para o contato, entrega e faturamento da reserva.

*  **Interface Fluida:** Desenvolvida com HTML5, CSS3 e interações em JavaScript para atualizar as informações na tela sem recarregamentos desnecessários.

  

### 🛡️ Painel Administrativo (Django Admin)

*  **Controle de Frota:** Gestão completa dos carrinhos de sorvete cadastrados no sistema.

*  **Gestão de Cardápio:** Cadastro, edição e remoção dos sabores de sorvete disponíveis para locação.

*  **Base de Clientes:** Centralização e consulta dos dados enviados pelos locatários.

*  **Painel de Reservas:** Visualização e controle de todas as locações do banco de dados para evitar conflitos de datas e organizar a logística.

  

---

  

## 🛠️ Tecnologias Utilizadas

  

*  **Backend:** [Django](https://www.djangoproject.com/) (Framework Python)

*  **Banco de Dados:** [MySQL](https://www.mysql.com/) (Armazenamento relacional robusto)

*  **Frontend:** HTML5, CSS3 e JavaScript (Vanila JS para requisições dinâmicas)

  

---

  

## 🔧 Como Executar o Projeto Localmente

  

Siga o passo a passo abaixo para rodar a aplicação na sua máquina:

  

### 1. Clonar o Repositório

```Bash```
```
git clone [https://github.com/DEV-iini/aluguel_carrinho-sorvete.git](https://github.com/DEV-iini/aluguel_carrinho-sorvete.git)

cd aluguel_carrinho-sorvete
```
### 2. Configurar o Ambiente Virtual (Recomendado)

No Linux/macOS:

  

```Bash```
```
python3 -m venv venv

source venv/bin/activate
```
No Windows:

  

```Bash```
```
python -m venv venv

.\venv\Scripts\activate
```
### 3. Instalar as Dependências

Certifique-se de instalar os pacotes necessários (incluindo o driver de conexão com o MySQL como mysqlclient ou pymysql):

  

```Bash```
```
pip install -r requirements.txt
```
### 4. Configurar o Banco de Dados MySQL

Crie um schema no seu servidor MySQL local:

  

SQL
```
CREATE DATABASE aluguel_sorvete CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
No arquivo settings.py do projeto Django, certifique-se de ajustar as credenciais de acesso de acordo com o seu ambiente:

  

Python
```
DATABASES = {

'default': {

'ENGINE': 'django.db.backends.mysql',

'NAME': 'aluguel_sorvete',

'USER': 'seu_usuario_mysql',

'PASSWORD': 'sua_senha_mysql',

'HOST': 'localhost',

'PORT': '3306',

}

}
```
  

### 5. Aplicar as Migrações

Gere as tabelas estruturadas no banco de dados:

  

```Bash```
```
python manage.py makemigrations

python manage.py migrate
```
### 6. Criar Conta do Administrador

Crie as credenciais para conseguir acessar o painel (/admin) e gerenciar os dados:

  

```Bash```
```
python manage.py createsuperuser
```
### 7. Inicializar o Servidor

```Bash```
```
python manage.py runserver
```
Acesse http://127.0.0.1:8000/ no seu navegador para testar a aplicação!
Acesse http://127.0.0.1:8000/painel no seu navegador para testar a página de admin!

  

🗄️ Modelagem de Dados

O banco de dados foi estruturado de forma condizente com as regras de negócio do sistema:

  

Clientes: Guarda o histórico de dados de quem aluga.

  

Carrinhos: Registra os carrinhos e monitora quais estão operacionais.

  

Sabores: Armazena as opções de sorvete oferecidas.

  

Reservas: Entidade central que une Cliente, Carrinho e Sabores a uma Data específica, garantindo que o mesmo carrinho não receba duas reservas no mesmo dia.

  

📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais det