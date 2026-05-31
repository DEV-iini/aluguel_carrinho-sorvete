let dataSelecionada = null;
let totalCarrinhosGlobal = 0;
let ocupacaoGlobal = {};
let saboresCache = [];
let carrinho = {};
let quantidadeCarrinhosSelecionada = 1;
let anoAtualVisualizacao = new Date().getFullYear(); 
let mesAtualVisualizacao = new Date().getMonth() + 1;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarSabores();
    carregarMes(anoAtualVisualizacao, mesAtualVisualizacao);
});

// --- GESTÃO DE SABORES ---

async function carregarSabores() {
    try {
        const response = await fetch('/api/sabores/');
        saboresCache = await response.json();
        renderizarCards();
    } catch (e) {
        console.error("Erro ao carregar sabores:", e);
    }
}

function renderizarCards() {
    const container = document.getElementById('lista-sorvetes');
    if (!container) return;
    container.innerHTML = saboresCache.map(s => `
        <div class="card">
            <img src="${s.imagem_url}" alt="${s.nome}">
            <h3>${s.nome}</h3>
            <p>R$ ${parseFloat(s.preco).toFixed(2)}</p>
            <div class="qty-control">
                <button type="button" class="btn-qty btn-menos" onclick="atualizarQtd(${s.id}, -1)">-</button>
                <input type="number" id="qty-${s.id}" class="input-qty" 
                    value="${carrinho[s.id]?.qtd || 0}" 
                    min="0" max="999" 
                    oninput="validarLimite(this)"
                    onchange="inputManual(${s.id}, this.value)">
                <button type="button" class="btn-qty btn-mais" onclick="atualizarQtd(${s.id}, 1)">+</button>
            </div>
        </div>
    `).join('');
}

function atualizarQtd(id, delta) {
    let atual = carrinho[id]?.qtd || 0;
    let nova = atual + delta;
    
    // Trava de integridade: min 0, max 99 (evita estouro de campo)
    if (nova < 0) nova = 0;
    if (nova > 999) nova = 999;
    
    carrinho[id] = { qtd: nova };
    const el = document.getElementById(`qty-${id}`);
    if (el) el.value = nova;
    atualizarResumoReserva();
}

function inputManual(id, v) {
    let q = parseInt(v) || 0;
    if (q < 0) q = 0;
    if (q > 999) q = 999;
    carrinho[id] = { qtd: q };
    atualizarResumoReserva();
}

// --- NOTA FISCAL (Reflete a lógica do seu Model Python) ---

function atualizarResumoReserva() {
    const res = document.getElementById('resumo-pedido');
    if (!res) return;

    const itens = saboresCache.filter(s => (carrinho[s.id]?.qtd || 0) > 0);
    
    if (itens.length === 0 && !dataSelecionada) {
        res.innerHTML = '<p style="text-align:center;color:#888;">Selecione sabores e uma data para ver o resumo.</p>';
        return;
    }

    let subtotalSorvetes = 0;
    let html = '<ul style="list-style:none;padding:0;margin:0;">';
    
    itens.forEach(s => {
        const q = carrinho[s.id].qtd;
        const p = q * parseFloat(s.preco);
        subtotalSorvetes += p;
        html += `<li style="display:flex;justify-content:space-between;border-bottom:1px dashed #eee;padding:4px 0;">
            <span>${q}x ${s.nome}</span><span>R$ ${p.toFixed(2)}</span></li>`;
    });

    // Simulação visual da sua regra taxa_aluguel do Python
    const taxaBase = subtotalSorvetes >= 300 ? 0 : 50;
    const taxaTotal = taxaBase * quantidadeCarrinhosSelecionada;
    const totalGeral = subtotalSorvetes + taxaTotal;

    html += `<li style="display:flex;justify-content:space-between;margin-top:10px;color:${taxaTotal === 0 ? 'green' : '#555'};">
        <span>Aluguel (${quantidadeCarrinhosSelecionada}x Carrinho) ${taxaTotal === 0 ? '(Grátis!)' : ''}</span><span>R$ ${taxaTotal.toFixed(2)}</span></li>`;
    
    html += '</ul>';

    if (dataSelecionada) {
        const dataFormatada = dataSelecionada.split('-').reverse().join('/');
        html += `<p style="margin-top:15px; font-size:0.9rem;"><strong>📅 Data:</strong> ${dataFormatada}</p>`;
    }

    html += `<div style="margin-top:10px;padding-top:10px;border-top:2px solid #333;display:flex;justify-content:space-between;font-weight:bold;font-size:1.1rem;">
        <span>TOTAL:</span><span>R$ ${totalGeral.toFixed(2)}</span></div>`;
    
    res.innerHTML = html;
}

// --- FINALIZAÇÃO E INTEGRAÇÃO (URL CORRIGIDA) ---

function finalizarPedido() {
    if (!dataSelecionada) return alert("Por favor, selecione uma data no calendário.");
    
    const selecionados = saboresCache
        .filter(s => (carrinho[s.id]?.qtd || 0) > 0)
        .map(s => ({ id: s.id, qtd: carrinho[s.id].qtd }));

    if (selecionados.length === 0) return alert("Escolha pelo menos um sabor para continuar.");

    const nome = document.getElementById('cli-nome').value.trim();
    const telefone = document.getElementById('cli-tel').value.trim();
    const endereco = document.getElementById('cli-end').value.trim();

    // Injeta os dados no HTML do contrato
    document.getElementById('ct-dados-cliente').innerHTML = `
        <strong>Nome/Razão Social:</strong> ${nome}<br>
        <strong>WhatsApp:</strong> ${telefone}<br>
        <strong>Endereço:</strong> ${endereco}
    `;
    
    document.getElementById('ct-qtd-carrinhos').innerText = quantidadeCarrinhosSelecionada;
    document.getElementById('ct-endereco-evento').innerText = endereco;
    const dataFormatada = dataSelecionada.split('-').reverse().join('/');
    document.getElementById('ct-data-evento').innerText = dataFormatada;

    // Reseta checkbox e botão
    document.getElementById('aceite-contrato').checked = false;
    document.getElementById('btn-enviar-reserva').disabled = true;

    // Abre o contrato
    abrirModalContrato();
    document.getElementById('corpo-contrato-scroll').scrollTop = 0;
}

async function enviarFormularioServidor() {
    const selecionados = saboresCache
        .filter(s => (carrinho[s.id]?.qtd || 0) > 0)
        .map(s => ({ id: s.id, qtd: carrinho[s.id].qtd }));

    const payload = {
        nome: document.getElementById('cli-nome').value.trim(),
        telefone: document.getElementById('cli-tel').value.replace(/\D/g, ""), 
        endereco: document.getElementById('cli-end').value.trim(),
        email: document.getElementById('cli-email').value.trim(),
        descricao: document.getElementById('cli-obs').value.trim(),
        data: dataSelecionada,
        quantidade_carrinhos: quantidadeCarrinhosSelecionada,
        sabores: selecionados
    };

    try {
        const response = await fetch('/api/reserva/criar/', { 
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        if (res.status === 'sucesso') {
            window.location.href = res.whatsapp_url;
        } else {
            alert("Erro: " + (res.message || "Falha ao criar reserva"));
        }
    } catch (e) {
        console.error("Erro na requisição:", e);
        alert("Erro de conexão com o servidor.");
    }
}

// --- UTILITÁRIOS (Mascara e Segurança) ---

function mascaraTelefone(i) {
    let v = i.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11); // Trava em 11 dígitos
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    i.value = v;
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// --- DISPONIBILIDADE (CALENDÁRIO) ---

async function carregarDisponibilidade(mesAno) {
    try {
        const response = await fetch(`/api/disponibilidade/?mes=${mesAno}`);
        
        // Verifica se a resposta do servidor foi um sucesso (código 200)
        if (!response.ok) {
            throw new Error(`Erro na API do Django: status ${response.status}`);
        }
        
        const data = await response.json();
        totalCarrinhosGlobal = data.total_carrinhos || 0;
        ocupacaoGlobal = data.ocupacao || {};
        
    } catch (e) {
        console.error("Aviso: Falha de comunicação com o servidor.", e);
        
        totalCarrinhosGlobal = 10; 
        ocupacaoGlobal = {};
        
    } finally {
        renderizarCalendario(mesAno);
    }
}

function definirClasseOcupacao(dataISO) {
    const reservas = ocupacaoGlobal[dataISO] || 0;
    if (totalCarrinhosGlobal === 0) return 'esgotado';
    const percentual = (reservas / totalCarrinhosGlobal) * 100;
    if (percentual >= 100) return 'esgotado';
    if (percentual >= 40)  return 'alerta';
    return 'livre';
}

function renderizarCalendario(mesAno) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const [ano, mes] = mesAno.split('-').map(Number);
    
    // 1. Cria o cabeçalho com os dias da semana (Dom, Seg, Ter...)
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    diasSemana.forEach(dia => {
        const div = document.createElement('div');
        div.style.fontWeight = 'bold';
        div.style.textAlign = 'center';
        div.style.paddingBottom = '10px';
        div.style.color = '#555';
        div.innerText = dia;
        grid.appendChild(div);
    });

    // 2. Descobre em qual dia da semana cai o dia 1º do mês
    const primeiroDia = new Date(ano, mes - 1, 1).getDay();
    const diasNoMes = new Date(ano, mes, 0).getDate();
    
    // 3. Pega a data de hoje e zera as horas para comparar corretamente
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 4. Adiciona "blocos invisíveis" para alinhar o dia 1º no dia da semana correto
    for (let i = 0; i < primeiroDia; i++) {
        const divVazia = document.createElement('div');
        grid.appendChild(divVazia);
    }
    
    // 5. Renderiza os dias reais do mês
    for (let i = 1; i <= diasNoMes; i++) {
        const dataISO = `${ano}-${mes.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        // Cria a data do dia renderizado para verificar se já passou
        const dataAtual = new Date(ano, mes - 1, i);
        
        const div = document.createElement('div');
        div.classList.add('dia-calendario');
        div.innerText = i;
        
        // BLOQUEIO DE SEGURANÇA: Se o dia for antes de hoje
        if (dataAtual <= hoje) {
            div.classList.add('esgotado');
            div.style.opacity = '0.3';
            div.style.cursor = 'not-allowed';
            div.title = "Data no passado";
        } else {
            // Lógica normal para datas de hoje em diante
            const classe = definirClasseOcupacao(dataISO);
            div.classList.add(classe);
            
            if (classe !== 'esgotado') {
                div.onclick = () => {
                    document.querySelectorAll('.dia-calendario').forEach(d => d.classList.remove('selecionado'));
                    div.classList.add('selecionado');
                    dataSelecionada = dataISO;
                    
                    atualizarSeletorCarrinhos(dataISO);
                    atualizarResumoReserva();
                };
            }
        }
        grid.appendChild(div);
    }
}

function validarLimite(input) {
    if (input.value.length > 3) input.value = input.value.slice(0, 3);
    if (parseInt(input.value) > 999) input.value = 999;
}

function abrirModal() {
    const temSabores = Object.values(carrinho).some(item => (item?.qtd || 0) > 0);

    if (!dataSelecionada) {
        alert("Por favor, selecione uma data no calendário antes de finalizar a reserva.");
        return;
    }

    if (!temSabores) {
        alert("Escolha pelo menos um sabor antes de finalizar a reserva.");
        return;
    }

    document.getElementById('modal-reserva').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function fecharModal() {
    document.getElementById('modal-reserva').style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.onclick = function(event) {
    if (event.target == document.getElementById('modal-reserva')) {
        fecharModal();
    }
};

function alternarBotaoFinalizar() {
    const check = document.getElementById('aceite-contrato').checked;
    document.getElementById('btn-enviar-reserva').disabled = !check;
}

function atualizarSeletorCarrinhos(dataISO) {
    const secao = document.getElementById('secao-carrinhos');
    const select = document.getElementById('qtd-carrinhos');
    const aviso = document.getElementById('aviso-disponibilidade');
    if (!secao || !select) return;

    const ocupados = ocupacaoGlobal[dataISO] || 0;
    const disponiveisHoje = totalCarrinhosGlobal - ocupados;

    if (disponiveisHoje <= 0) {
        secao.style.display = 'none';
        alert("Desculpe, não há carrinhos disponíveis para este dia.");
        dataSelecionada = null;
        return;
    }

    secao.style.display = 'block';
    select.innerHTML = '';
    if (disponiveisHoje === 1) {
    aviso.innerText = '1 carrinho disponível para esta data';
    } else {
        aviso.innerText = `${disponiveisHoje} carrinhos disponíveis para esta data`;
    }

    for (let i = 1; i <= disponiveisHoje; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `${i} carrinho${i > 1 ? 's' : ''}`;
        select.appendChild(opt);
    }
    
    quantidadeCarrinhosSelecionada = 1; 
}

function atualizarQuantidadeCarrinhos() {
    const select = document.getElementById('qtd-carrinhos');
    quantidadeCarrinhosSelecionada = parseInt(select.value) || 1;
    atualizarResumoReserva();
}

function carregarMes(ano, mes) {
    const mesAno = `${ano}-${mes.toString().padStart(2, '0')}`;
    atualizarLabelMesAno(ano, mes);
    // Chama a sua API que já existe para buscar os dados deste novo mês
    carregarDisponibilidade(mesAno);
}

function mudarMes(delta) {
    mesAtualVisualizacao += delta;
    
    // Vira o ano se passar de Dezembro ou voltar de Janeiro
    if (mesAtualVisualizacao > 12) {
        mesAtualVisualizacao = 1;
        anoAtualVisualizacao++;
    } else if (mesAtualVisualizacao < 1) {
        mesAtualVisualizacao = 12;
        anoAtualVisualizacao--;
    }
    
    carregarMes(anoAtualVisualizacao, mesAtualVisualizacao);
}

function atualizarLabelMesAno(ano, mes) {
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('mes-ano-display').innerText = `${nomesMeses[mes - 1]} ${ano}`;
    
    const hoje = new Date();
    const btnAnterior = document.getElementById('btn-mes-anterior');
    
    if (ano === hoje.getFullYear() && mes === hoje.getMonth() + 1) {
        btnAnterior.disabled = true;
    } else {
        btnAnterior.disabled = false;
    }
}

const menuToggle = document.querySelector('.menu-toggle');
const menuLinks = document.querySelector('.menu-links');

if (menuToggle && menuLinks) {
    menuToggle.addEventListener('click', () => {
        menuLinks.classList.toggle('ativo');
    });

    document.querySelectorAll('.menu-links a').forEach(link => {
        link.addEventListener('click', () => {
            menuLinks.classList.remove('ativo');
        });
    });
}