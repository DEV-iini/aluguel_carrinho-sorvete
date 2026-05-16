/**
 * main.js - Versão Restaurada e Corrigida
 */

let dataSelecionada = null;
let totalCarrinhosGlobal = 0;
let ocupacaoGlobal = {};
let saboresCache = [];
let carrinho = {};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date();
    const mesAno = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}`;
    carregarSabores();
    carregarDisponibilidade(mesAno);
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
    const taxa = subtotalSorvetes >= 300 ? 0 : 50;
    const totalGeral = subtotalSorvetes + taxa;

    html += `<li style="display:flex;justify-content:space-between;margin-top:10px;color:${taxa === 0 ? 'green' : '#555'};">
        <span>Aluguel Carrinho ${taxa === 0 ? '(Grátis!)' : ''}</span><span>R$ ${taxa.toFixed(2)}</span></li>`;
    
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

async function finalizarPedido() {
    if (!dataSelecionada) return alert("Por favor, selecione uma data no calendário.");
    
    const selecionados = saboresCache
        .filter(s => (carrinho[s.id]?.qtd || 0) > 0)
        .map(s => ({ id: s.id, qtd: carrinho[s.id].qtd }));

    if (selecionados.length === 0) return alert("Escolha pelo menos um sabor.");

    const payload = {
        nome: document.getElementById('cli-nome').value.trim(),
        telefone: document.getElementById('cli-tel').value.replace(/\D/g, ""), // Limpa máscara para o banco
        endereco: document.getElementById('cli-end').value.trim(),
        email: document.getElementById('cli-email').value.trim(),
        descricao: document.getElementById('cli-obs').value.trim(),
        data: dataSelecionada,
        sabores: selecionados
    };

    try {
        // URL sincronizada com seu urls.py: path('api/reserva/criar/', ...)
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
        const data = await response.json();
        totalCarrinhosGlobal = data.total_carrinhos;
        ocupacaoGlobal = data.ocupacao;
        renderizarCalendario(mesAno);
    } catch (e) {
        console.error("Erro na disponibilidade:", e);
    }
}

function definirClasseOcupacao(dataISO) {
    const reservas = ocupacaoGlobal[dataISO] || 0;
    if (totalCarrinhosGlobal === 0) return 'esgotado';
    const percentual = (reservas / totalCarrinhosGlobal) * 100;
    if (percentual >= 100) return 'esgotado';
    if (percentual >= 75)  return 'critico';
    if (percentual >= 40)  return 'alerta';
    return 'livre';
}

function renderizarCalendario(mesAno) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const [ano, mes] = mesAno.split('-').map(Number);
    const diasNoMes = new Date(ano, mes, 0).getDate();
    
    for (let i = 1; i <= diasNoMes; i++) {
        const dataISO = `${ano}-${mes.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        const div = document.createElement('div');
        div.classList.add('dia-calendario');
        div.innerText = i;
        
        const classe = definirClasseOcupacao(dataISO);
        div.classList.add(classe);
        
        if (classe !== 'esgotado') {
            div.onclick = () => {
                document.querySelectorAll('.dia-calendario').forEach(d => d.classList.remove('selecionado'));
                div.classList.add('selecionado');
                dataSelecionada = dataISO;
                atualizarResumoReserva();
            };
        }
        grid.appendChild(div);
    }
}

function validarLimite(input) {
    if (input.value.length > 3) input.value = input.value.slice(0, 3);
    if (parseInt(input.value) > 999) input.value = 999;
}