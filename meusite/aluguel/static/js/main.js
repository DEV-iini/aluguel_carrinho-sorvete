/* ══════════════════════════════════════════════
   ESTADO GLOBAL & CONFIGURAÇÕES
══════════════════════════════════════════════ */
const MAX_RESERVAS_DIA = 3;
const WHATSAPP_NUM = '5511999999999'; // Ajuste com o número real

const state = {
    viewDate: new Date(),
    selectedDate: null,
    sabores: [],
    selecoes: {},           // { saborId: true }
    disponMeses: {},        // Cache de dias bloqueados por mês
    disponSabores: {}       // Cache de sabores disponíveis por dia
};

/* ══════════════════════════════════════════════
   API HELPERS (Integração Django)
══════════════════════════════════════════════ */
function getCsrfToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    return cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
}

async function apiFetch(url, options = {}) {
    const method = options.method || 'GET';
    const headers = { 
        'Content-Type': 'application/json',
        ...(options.headers || {}) 
    };

    if (method !== 'GET') {
        headers['X-CSRFToken'] = getCsrfToken();
    }

    const resp = await fetch(url, { ...options, method, headers });
    if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.erro || `Erro HTTP ${resp.status}`);
    }
    return resp.json();
}

/* ══════════════════════════════════════════════
   LÓGICA DO CALENDÁRIO
══════════════════════════════════════════════ */
function mesKey(d = state.viewDate) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function carregarDisponibilidadeMes() {
    const mes = mesKey();
    if (state.disponMeses[mes]) return;
    try {
        state.disponMeses[mes] = await apiFetch(`/api/disponibilidade/?mes=${mes}`);
    } catch {
        state.disponMeses[mes] = { bloqueios: [], reservas_por_dia: {} };
    }
}

function renderCalendario() {
    const grid = document.getElementById('calGrid');
    if (!grid) return;

    const y = state.viewDate.getFullYear();
    const m = state.viewDate.getMonth();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    document.getElementById('calTitulo').textContent =
        state.viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const primeiroDiaSemana = new Date(y, m, 1).getDay();
    const totalDiasMes = new Date(y, m + 1, 0).getDate();
    const disp = state.disponMeses[mesKey()] || { bloqueios: [], reservas_por_dia: {} };

    let html = '';
    for (let i = 0; i < primeiroDiaSemana; i++) html += `<div class="cal-day other"></div>`;

    for (let d = 1; d <= totalDiasMes; d++) {
        const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dt = new Date(y, m, d);
        dt.setHours(0, 0, 0, 0);

        const bloqueado = disp.bloqueios.includes(iso);
        const lotado = (disp.reservas_por_dia[iso] || 0) >= MAX_RESERVAS_DIA;
        const isPast = dt < hoje;
        const isSelected = state.selectedDate === iso;

        let cls = 'cal-day';
        if (isPast) cls += ' past';
        else if (bloqueado || lotado) cls += ' indisponivel';
        else cls += ' disponivel';
        if (isSelected) cls += ' selected';

        const click = (!isPast && !bloqueado && !lotado) ? `onclick="selecionarData('${iso}')"` : '';
        html += `<div class="${cls}" ${click}>${d}</div>`;
    }
    grid.innerHTML = html;
}

async function selecionarData(iso) {
    state.selectedDate = iso;
    if (!state.disponSabores[iso]) {
        try {
            state.disponSabores[iso] = await apiFetch(`/api/sabores-disponibilidade/?data=${iso}`);
        } catch {
            state.disponSabores[iso] = {};
        }
    }
    renderCalendario();
    renderSabores();
    atualizarResumo();
}

/* ══════════════════════════════════════════════
   LÓGICA DE SABORES
══════════════════════════════════════════════ */
function renderSabores() {
    const grid = document.getElementById('saboresGrid');
    if (!grid) return;

    const dispDia = state.selectedDate ? (state.disponSabores[state.selectedDate] || {}) : {};

    grid.innerHTML = state.sabores.map(s => {
        const indisponivel = dispDia[s.id] === false;
        const selecionado = !!state.selecoes[s.id];
        return `
            <div class="sabor-card ${selecionado ? 'selected' : ''} ${indisponivel ? 'disabled' : ''}" 
                 onclick="${indisponivel ? '' : `toggleSabor(${s.id})`}">
                <span class="emoji">${s.emoji}</span>
                <p>${s.nome}</p>
                <small>R$ ${s.preco}</small>
            </div>`;
    }).join('');
}

function toggleSabor(id) {
    if (state.selecoes[id]) delete state.selecoes[id];
    else state.selecoes[id] = true;
    renderSabores();
    atualizarResumo();
}

/* ══════════════════════════════════════════════
   POP-UPS E UI
══════════════════════════════════════════════ */
function abrirPopup({ titulo, mensagem, icone, onClose }) {
    const overlay = document.getElementById('popupOverlay');
    document.getElementById('popupTitle').textContent = titulo;
    document.getElementById('popupMessage').textContent = mensagem;
    document.getElementById('popupIcon').textContent = icone;
    overlay.style.display = 'flex';
    document.getElementById('popupBtn').onclick = () => {
        overlay.style.display = 'none';
        if (onClose) onClose();
    };
}

function atualizarResumo() {
    const btn = document.getElementById('btnWhatsApp');
    const pronto = state.selectedDate && Object.keys(state.selecoes).length > 0;
    btn.classList.toggle('disabled', !pronto);
}

/* ══════════════════════════════════════════════
   ENVIO E WHATSAPP
══════════════════════════════════════════════ */
async function enviarReservaPendente(event) {
    event.preventDefault();
    const nome = document.getElementById('clienteNome').value.trim();
    const telefone = document.getElementById('clienteTelefone').value.trim();

    if (!nome || !telefone || !state.selectedDate) {
        abrirPopup({ titulo: 'Atenção', mensagem: 'Preencha todos os campos.', icone: '⚠️' });
        return;
    }

    const payload = {
        cliente_nome: nome,
        cliente_telefone: telefone,
        data: state.selectedDate,
        sabores: Object.keys(state.selecoes),
        observacoes: document.getElementById('clienteObservacoes').value
    };

    try {
        const resp = await apiFetch('/api/reservas/', { method: 'POST', body: JSON.stringify(payload) });
        abrirPopup({
            titulo: 'Sucesso!',
            mensagem: `Reserva #${resp.id} criada. Vamos ao WhatsApp?`,
            icone: '✅',
            onClose: () => {
                const msg = encodeURIComponent(`Olá! Gostaria de confirmar minha reserva #${resp.id} para o dia ${state.selectedDate}.`);
                window.open(`https://wa.me/${WHATSAPP_NUM}?text=${msg}`, '_blank');
            }
        });
    } catch (err) {
        abrirPopup({ titulo: 'Erro', mensagem: err.message, icone: '❌' });
    }
}

/* ══════════════════════════════════════════════
   INICIALIZAÇÃO
══════════════════════════════════════════════ */
async function init() {
    try {
        state.sabores = await apiFetch('/api/sabores/');
        await carregarDisponibilidadeMes();
        renderCalendario();
        renderSabores();
    } catch (e) { console.error("Falha ao iniciar:", e); }
}

document.getElementById('prevMes')?.addEventListener('click', async () => {
    state.viewDate.setMonth(state.viewDate.getMonth() - 1);
    await carregarDisponibilidadeMes();
    renderCalendario();
});

document.getElementById('nextMes')?.addEventListener('click', async () => {
    state.viewDate.setMonth(state.viewDate.getMonth() + 1);
    await carregarDisponibilidadeMes();
    renderCalendario();
});

init();