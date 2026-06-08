/* ══════════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════════ */
const MAX_RESERVAS_DIA = 3;
const NUM_CARRINHOS    = 3;

/* ══════════════════════════════════════════════
   ESTADO GLOBAL
══════════════════════════════════════════════ */
const state = {
  viewDate:               new Date(),
  reservas:               [],
  bloqueios:              [],
  sabores:                [],
  carrinhos:              [],
  clientes:               [],
  saboresDisponibilidade: {},  // cache: 'YYYY-MM-DD' → { "saborId": bool }
  filtroReservas:         'todas',
};

/* ══════════════════════════════════════════════
   HELPERS DE FORMATO
══════════════════════════════════════════════ */
const fmt    = d  => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmtBR  = iso => { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };
const fmtMes = dt  => dt.toLocaleString('pt-BR', { month:'long', year:'numeric' });

/* ══════════════════════════════════════════════
   API HELPERS
══════════════════════════════════════════════ */
function getCsrfToken() {
  const match = document.cookie.split(';')
    .map(c => c.trim().split('='))
    .find(([k]) => k === 'csrftoken');
  return match ? decodeURIComponent(match[1]) : '';
}

async function apiFetch(url, options = {}) {
  const method  = options.method || 'GET';
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (method !== 'GET') headers['X-CSRFToken'] = getCsrfToken();
  const resp = await fetch(url, { ...options, method, headers, credentials: 'include' });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { const d = await resp.json(); msg = d.erro || msg; } catch {}
    throw new Error(msg);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

/* ══════════════════════════════════════════════
   LOGIN / LOGOUT / AUTH
══════════════════════════════════════════════ */
async function tentarLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  document.getElementById('loginError').style.display = 'none';

  try {
    await apiFetch('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username: u, password: p }),
    });
    document.getElementById('loginScreen').style.display = 'none';
    await init();
  } catch {
    document.getElementById('loginError').style.display = 'block';
  }
}

async function logout() {
  await apiFetch('/api/auth/logout/', { method: 'POST' });
  location.reload();
}

document.getElementById('loginUser').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginPass').focus();
});
document.getElementById('loginPass').addEventListener('keydown', e => {
  if (e.key === 'Enter') tentarLogin();
});

/* ══════════════════════════════════════════════
   CARREGAR DADOS DO BANCO
══════════════════════════════════════════════ */
async function carregarDados() {
  try {
    state.reservas = await apiFetch('/api/reservas/');
  } catch (e) {
    console.error('Erro ao carregar reservas:', e);
    state.reservas = [];
  }

  try {
    state.bloqueios = await apiFetch('/api/bloqueios/');
  } catch (e) {
    console.error('Erro ao carregar bloqueios:', e);
    state.bloqueios = [];
  }

  try {
    state.sabores = await apiFetch('/api/sabores/');
  } catch (e) {
    console.error('Erro ao carregar sabores:', e);
    state.sabores = [];
  }

  try {
    state.carrinhos = await apiFetch('/api/carrinhos/');
  } catch (e) {
    console.error('Erro ao carregar carrinhos:', e);
    state.carrinhos = [];
  }

  try {
    state.clientes = await apiFetch('/api/clientes/');
  } catch (e) {
    console.error('Erro ao carregar clientes:', e);
    state.clientes = [];
  }

  console.log('CLIENTES CARREGADOS:', state.clientes);
}

/* ══════════════════════════════════════════════
   HELPERS DE NEGÓCIO
══════════════════════════════════════════════ */
function reservasDoDia(iso) {
  return state.reservas.filter(r => r.data === iso && r.status !== 'cancelado');
}

function diaDisponivel(iso) {
  if (state.bloqueios.find(b => b.data === iso)) return false;
  return reservasDoDia(iso).length < MAX_RESERVAS_DIA;
}

/* ══════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.className = `toast ${type}`;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

/* ══════════════════════════════════════════════
   MODAIS
══════════════════════════════════════════════ */
function openModal(id)  { document.getElementById(id).classList.add('open');    document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }

document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) { o.classList.remove('open'); document.body.style.overflow = ''; }
  });
});

/* ══════════════════════════════════════════════
   RENDER GERAL
══════════════════════════════════════════════ */
function renderTudo() {
  renderMetricas();
  renderCalendario();
  renderPendentes();
  renderReservasTabela();
  renderClientesTabela();
  renderSaboresAdmin();
  renderCarrinhos();
}

/* ══════════════════════════════════════════════
   MÉTRICAS
══════════════════════════════════════════════ */
function renderMetricas() {
  const pendentes   = state.reservas.filter(r => r.status === 'pendente').length;
  const confirmadas = state.reservas.filter(r => r.status === 'confirmado').length;
  const total       = state.reservas.filter(r => r.status !== 'cancelado').length;

  const hoje     = fmt(new Date());
  const resHoje  = reservasDoDia(hoje).length;
  const disponHj = Math.max(0, NUM_CARRINHOS - resHoje);

  document.getElementById('metPendentes').textContent   = pendentes;
  document.getElementById('metConfirmadas').textContent = confirmadas;
  document.getElementById('metTotal').textContent       = total;
  document.getElementById('metCarrinhos').textContent   = disponHj;
  document.getElementById('metPendDelta').textContent   = pendentes > 0
    ? `${pendentes} aguardando confirmação` : 'Nenhuma pendente';
}

/* ══════════════════════════════════════════════
   CALENDÁRIO
══════════════════════════════════════════════ */
function renderCalendario() {
  const y    = state.viewDate.getFullYear();
  const m    = state.viewDate.getMonth();
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + 1);
  const primeiraDataPermitida = fmt(hoje);

  document.getElementById('calTitle').textContent = fmtMes(state.viewDate);

  const primeiro  = new Date(y, m, 1).getDay();
  const totalDias = new Date(y, m + 1, 0).getDate();
  const prevDias  = new Date(y, m, 0).getDate();
  const bloqSet   = new Set(state.bloqueios.map(b => b.data));

  let html = '';

  for (let i = primeiro - 1; i >= 0; i--) {
    html += `<div class="cal-cell other-month past"><div class="day-n">${prevDias - i}</div></div>`;
  }

  for (let d = 1; d <= totalDias; d++) {
    const iso   = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dt    = new Date(y, m, d);
    const isPast = iso < primeiraDataPermitida;
    const isToday   = dt.toDateString() === hoje.toDateString();
    const isBlocked = bloqSet.has(iso);
    const resDodia  = reservasDoDia(iso);
    const count     = resDodia.length;

    let cls = 'cal-cell';
    if (isPast)                           cls += ' past';
    if (isToday)                          cls += ' today';
    if (isBlocked)                        cls += ' blocked';
    if (!isBlocked && count >= MAX_RESERVAS_DIA) cls += ' full';

    let capClass = 'ok';
    if (count >= MAX_RESERVAS_DIA - 1 && count < MAX_RESERVAS_DIA) capClass = 'warn';
    if (count >= MAX_RESERVAS_DIA) capClass = 'full';

    const chips = resDodia.slice(0, 2).map(r =>
      `<div class="chip ${r.status}" onclick="event.stopPropagation();verDetalhe(${r.id})" title="${r.cliente_nome}">${r.cliente_nome}</div>`
    ).join('');
    const more = resDodia.length > 2 ? `<div class="chip-more">+${resDodia.length - 2} mais</div>` : '';

    const capBadge = !isPast && !isBlocked
      ? `<span class="day-capacity ${capClass}">${count}/${MAX_RESERVAS_DIA}</span>` : '';
    const bloqLabel = isBlocked
      ? `<div style="font-size:9px;color:var(--mid);margin-top:2px">🔒</div>` : '';

    const podeClicar = !isPast && !isBlocked && count < MAX_RESERVAS_DIA;

    html += `
      <div class="${cls}" ${podeClicar ? `onclick="clickDia('${iso}')"` : ''}>
        <div class="day-n">${d}</div>
        <div class="event-chips">${chips}${more}</div>
        ${capBadge}${bloqLabel}
      </div>`;
  }

  const trailing = (primeiro + totalDias) % 7;
  if (trailing > 0) {
    for (let d = 1; d <= 7 - trailing; d++) {
      html += `<div class="cal-cell other-month"><div class="day-n">${d}</div></div>`;
    }
  }

  document.getElementById('calBody').innerHTML = html;
}

/* ══════════════════════════════════════════════
   CLICK NUM DIA DO CALENDÁRIO
══════════════════════════════════════════════ */
function clickDia(iso) {
  const hoje = new Date();
  hoje.setDate(hoje.getDate() + 1);
  const primeiraDataPermitida = fmt(hoje);

  const [ano, mes, dia] = iso.split('-');
  const dataSelecionada = new Date(+ano, +mes - 1, +dia);
  dataSelecionada.setHours(12, 0, 0, 0);

  if (iso < primeiraDataPermitida) {
    showToast('Reservas exigem pelo menos 24h de antecedência.', 'error');
    return;
  }

  const bloqueio = state.bloqueios.find(b => b.data === iso);
  if (bloqueio) {
    if (confirm(`Data ${fmtBR(iso)} está bloqueada. Deseja desbloquear?`)) {
      desbloquearData(bloqueio.id);
    }
    return;
  }

  document.getElementById('fData').value = iso;
  verificarCapacidadeData(iso);
  popularSelectCarrinhos(iso);
  openModal('modalReserva');
}

async function desbloquearData(bloqueioId) {
  try {
    await apiFetch(`/api/bloqueios/${bloqueioId}/`, { method: 'DELETE' });
    state.bloqueios = state.bloqueios.filter(b => b.id !== bloqueioId);
    renderTudo();
    showToast('Data desbloqueada!', 'info');
  } catch (e) {
    showToast('Erro ao desbloquear: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════
   PENDENTES (sidebar)
══════════════════════════════════════════════ */
function renderPendentes() {
  const pendentes = state.reservas
    .filter(r => r.status === 'pendente')
    .sort((a, b) => a.data.localeCompare(b.data));

  document.getElementById('pendentesCount').textContent = pendentes.length;

  const el = document.getElementById('pendentesList');
  if (!pendentes.length) {
    el.innerHTML = `<p style="font-size:13px;color:var(--mid);text-align:center;padding:16px">Nenhuma reserva pendente ✓</p>`;
    return;
  }
  el.innerHTML = pendentes.map(r => `
    <div class="reserva-mini" onclick="verDetalhe(${r.id})">
      <h5>${r.cliente_nome}</h5>
      <p>📅 ${fmtBR(r.data)}</p>
      <p>🛒 ${r.carrinho_nome}</p>
      <span class="badge pendente">Pendente</span>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════
   DETALHE DA RESERVA
══════════════════════════════════════════════ */
function verDetalhe(id) {
  const r = state.reservas.find(x => x.id === id);
  if (!r) return;

  document.getElementById('detalheBody').innerHTML = `
    <div class="detail-row"><span class="detail-label">Cliente</span><span class="detail-val">${r.cliente_nome}</span></div>
    <div class="detail-row"><span class="detail-label">E-mail</span><span class="detail-val">${r.cliente_email || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Telefone</span><span class="detail-val">${r.cliente_telefone || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Carrinho</span><span class="detail-val">${r.carrinho_nome || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Data</span><span class="detail-val">${fmtBR(r.data)}</span></div>
    <div class="detail-row"><span class="detail-label">Sabores</span><span class="detail-val">${r.sabores || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Status</span><span class="badge ${r.status}">${r.status}</span></div>
    <div class="detail-row"><span class="detail-label">Observações</span><span class="detail-val">${r.observacoes || '—'}</span></div>
  `;

  const botoes = document.getElementById('detalheBotoes');
  botoes.innerHTML = '';

  const btnF = document.createElement('button');
  btnF.className = 'btn btn-outline'; btnF.textContent = 'Fechar';
  btnF.onclick = () => closeModal('modalDetalhe');
  botoes.appendChild(btnF);

  if (r.cliente_telefone) {
    const tel = r.cliente_telefone.replace(/\D/g, '');
    const btnW = document.createElement('a');
    btnW.className = 'btn'; btnW.style.background = '#25D366'; btnW.style.color = 'white';
    btnW.textContent = '💬 WhatsApp'; btnW.target = '_blank';
    btnW.href = `https://wa.me/55${tel}`;
    botoes.appendChild(btnW);
  }

  if (r.status === 'pendente') {
    const btnC = document.createElement('button');
    btnC.className = 'btn btn-success'; btnC.textContent = '✓ Confirmar';
    btnC.onclick = () => mudarStatus(id, 'confirmado');
    botoes.appendChild(btnC);

    const btnR = document.createElement('button');
    btnR.className = 'btn btn-danger'; btnR.textContent = '✕ Recusar';
    btnR.onclick = () => mudarStatus(id, 'cancelado');
    botoes.appendChild(btnR);
  } else if (r.status === 'confirmado') {
    const btnX = document.createElement('button');
    btnX.className = 'btn btn-danger'; btnX.textContent = '✕ Cancelar';
    btnX.onclick = () => mudarStatus(id, 'cancelado');
    botoes.appendChild(btnX);
  }

  openModal('modalDetalhe');
}

/* ══════════════════════════════════════════════
   ALTERAR STATUS (persiste no banco)
══════════════════════════════════════════════ */
async function mudarStatus(id, novoStatus) {
  try {
    await apiFetch(`/api/reservas/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status: novoStatus }),
    });
    // Atualizar estado local sem precisar rebuscar tudo
    const r = state.reservas.find(x => x.id === id);
    if (r) r.status = novoStatus;

    const msgs = { confirmado: 'Reserva confirmada! ✓', cancelado: 'Reserva cancelada.', pendente: 'Status alterado.' };
    showToast(msgs[novoStatus] || 'Atualizado!', novoStatus === 'confirmado' ? 'success' : 'info');
    closeModal('modalDetalhe');
    renderTudo();
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════
   CRIAR RESERVA (admin → banco)
══════════════════════════════════════════════ */
function verificarCapacidadeData(iso) {
  const count = reservasDoDia(iso).length;
  const aviso = document.getElementById('fDataAviso');
  if (!aviso) return;
  if (count >= MAX_RESERVAS_DIA) {
    aviso.textContent = `⚠️ Esta data já tem ${count}/${MAX_RESERVAS_DIA} reservas — limite atingido!`;
    aviso.style.color = 'var(--red)';
  } else {
    aviso.textContent = `${count}/${MAX_RESERVAS_DIA} reservas neste dia.`;
    aviso.style.color = 'var(--mid)';
  }
}

function popularSelectCarrinhos(iso) {
  const sel = document.getElementById('fCarrinho');
  if (!sel) return;
  const data = iso || document.getElementById('fData').value;
  const resNoDia   = data ? reservasDoDia(data) : [];
  const carrinhosBusy = new Set(resNoDia.map(r => r.carrinho_id));

  sel.innerHTML = state.carrinhos.map(c => {
    const ocupado = carrinhosBusy.has(c.id);
    return `<option value="${c.id}" ${ocupado ? 'disabled' : ''}>${c.nome}${ocupado ? ' — ocupado' : ''}</option>`;
  }).join('');
}

async function salvarReserva() {
  const nome  = document.getElementById('fNome').value.trim();
  const data  = document.getElementById('fData').value;
  const carId = parseInt(document.getElementById('fCarrinho').value);

  if (!nome || !data) { showToast('Preencha os campos obrigatórios.', 'error'); return; }

  try {
    await apiFetch('/api/reservas/', {
      method: 'POST',
      body: JSON.stringify({
        cliente_nome:     nome,
        cliente_email:    document.getElementById('fEmail').value.trim(),
        cliente_telefone: document.getElementById('fTelefone').value.trim(),
        sabores:          document.getElementById('fSabores').value.trim(),
        data,
        carrinho_id:      carId,
        observacoes:      document.getElementById('fObs').value.trim(),
      }),
    });

    // Rebuscar reservas para ter o objeto completo (com carrinho_nome etc.)
    state.reservas = await apiFetch('/api/reservas/');
    showToast('Reserva criada com sucesso!', 'success');
    closeModal('modalReserva');
    ['fNome','fEmail','fTelefone','fSabores','fObs','fData'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    renderTudo();
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════
   BLOQUEIO DE DATAS (persiste no banco)
══════════════════════════════════════════════ */
async function salvarBloqueio() {
  const data   = document.getElementById('bData').value;
  const motivo = document.getElementById('bMotivo').value.trim();
  if (!data) { showToast('Informe a data.', 'error'); return; }

  if (state.bloqueios.find(b => b.data === data)) {
    showToast('Esta data já está bloqueada.', 'info'); return;
  }

  try {
    const novo = await apiFetch('/api/bloqueios/', {
      method: 'POST',
      body: JSON.stringify({ data, motivo }),
    });
    state.bloqueios.push(novo);
    showToast('Data bloqueada! Usuários não poderão reservar este dia.', 'success');
    closeModal('modalBloqueio');
    document.getElementById('bData').value   = '';
    document.getElementById('bMotivo').value = '';
    renderTudo();
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════
   TABELA DE RESERVAS
══════════════════════════════════════════════ */
function filtrarReservas(filtro, btn) {
  state.filtroReservas = filtro;
  document.querySelectorAll('#reservasTabs .filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderReservasTabela();
}

function renderReservasTabela() {
  let reservas = [...state.reservas];
  const busca = (document.getElementById('buscaReserva')?.value || '').toLowerCase().trim();

  if (busca) {
    reservas = reservas.filter(r =>
      String(r.cliente_nome || '').toLowerCase().includes(busca) ||
      String(r.cliente_telefone || '').includes(busca) ||
      String(r.data || '').includes(busca)
  );
}
  if (state.filtroReservas !== 'todas') {
    reservas = reservas.filter(r => r.status === state.filtroReservas);
  }
  reservas.sort((a, b) => b.data.localeCompare(a.data));

  const tbody = document.getElementById('reservasTableBody');
  if (!tbody) return;

  if (!reservas.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--mid)">Nenhuma reserva encontrada</td></tr>`;
    return;
  }

  tbody.innerHTML = reservas.map(r => `
    <tr class="${r.data === fmt(new Date()) ? 'linha-hoje' : ''}">
      <td>
        <strong>${r.cliente_nome}</strong>
        ${r.cliente_telefone ? `<br><span style="font-size:11px;color:var(--mid)">${r.cliente_telefone}</span>` : ''}
      </td>
      <td>${fmtBR(r.data)}</td>
      <td>${r.carrinho_nome || '—'}</td>
      <td style="font-size:12px">${r.sabores || '—'}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td>
        <div class="td-actions">
          <button class="btn btn-outline btn-sm" onclick="verDetalhe(${r.id})">Ver</button>
          ${r.status === 'pendente' ? `
            <button class="btn btn-success btn-sm" onclick="mudarStatus(${r.id},'confirmado')">✓</button>
            <button class="btn btn-danger  btn-sm" onclick="mudarStatus(${r.id},'cancelado')">✕</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

/* ══════════════════════════════════════════════
   SABORES — disponibilidade por data (banco)
══════════════════════════════════════════════ */
function renderSaboresAdmin() {
  const grid = document.getElementById('saboresAdminGrid');
  if (!grid) return;

  grid.innerHTML = state.sabores.map(s => `
    <div class="sabor-row">
      ${
        s.imagem_url
          ? `<img src="${s.imagem_url}" class="sabor-row-img" alt="${s.nome}">`
          : `<span class="sabor-row-emoji">🍦</span>`
      }
      <span class="sabor-row-name">${s.nome}</span>
      <span style="font-size:12px;color:var(--mid);font-weight:700">R$ ${parseFloat(s.preco).toFixed(2)}</span>
    </div>
  `).join('');
}

async function toggleSaborAdmin(saborId, data) {
  if (!data) { showToast('Selecione uma data primeiro.', 'error'); return; }

  const dispAtual = state.saboresDisponibilidade[data]?.[String(saborId)] !== false;
  const novoValor = !dispAtual;

  try {
    await apiFetch('/api/sabores-disponibilidade/', {
      method: 'POST',
      body: JSON.stringify({ sabor_id: saborId, data, disponivel: novoValor }),
    });

    if (!state.saboresDisponibilidade[data]) state.saboresDisponibilidade[data] = {};
    state.saboresDisponibilidade[data][String(saborId)] = novoValor;

    const sabor = state.sabores.find(s => s.id === saborId);
    showToast(
      novoValor
        ? `${sabor?.nome} disponível para ${fmtBR(data)}`
        : `${sabor?.nome} desativado para ${fmtBR(data)}`,
      'info',
    );
    renderSaboresAdmin();
  } catch (e) {
    showToast('Erro ao atualizar: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════
   CARRINHOS
══════════════════════════════════════════════ */
function renderCarrinhos() {
  const el = document.getElementById('carrinhosList');
  if (!el) return;
  const hoje    = fmt(new Date());
  const resHoje = reservasDoDia(hoje);

  el.innerHTML = state.carrinhos.map(c => {
    const ocupado = resHoje.find(r => r.carrinho_id === c.id);
    return `
      <div class="carrinho-item">
        <div class="carrinho-num">${c.id}</div>
        <div class="carrinho-name">${c.nome}</div>
        <span class="carrinho-status-pill ${ocupado ? 'busy' : 'available'}">${ocupado ? '📅 Reservado hoje' : '✓ Disponível'}</span>
      </div>`;
  }).join('') + `
    <div style="margin-top:12px;padding:14px;background:var(--lavender-xl);border-radius:12px;font-size:13px;color:var(--mid);line-height:1.6">
      <strong style="color:var(--dark)">Regra de capacidade:</strong><br>
      Máximo de <strong style="color:var(--lavender-d)">${MAX_RESERVAS_DIA} reservas por dia</strong> — uma por carrinho.<br>
      Dias com ${MAX_RESERVAS_DIA} reservas são automaticamente marcados como indisponíveis na página de usuários.
    </div>`;
}

/* ══════════════════════════════════════════════
   NAVEGAÇÃO DE VIEWS
══════════════════════════════════════════════ */
const viewTitles = {
  calendario: '📅 Calendário de Reservas',
  reservas:   '📋 Todas as Reservas',
  clientes:   '👥 Clientes',
  sabores:    '🍨 Disponibilidade de Sabores',
  carrinhos:  '🛒 Carrinhos',
};

function setView(view, btn) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');
  if (btn) btn.classList.add('active');
  document.getElementById('pageTitle').textContent = viewTitles[view] || 'Admin';

  const actions = document.getElementById('topBarActions');
  actions.style.display = view === 'calendario' ? 'flex' : 'none';

  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');

  if (view === 'sabores') {
    const inp = document.getElementById('saborDataFiltro');
    if (inp && !inp.value) inp.value = fmt(new Date());
    renderSaboresAdmin();
  }
}

function renderClientesTabela() {
  const tbody = document.getElementById('clientesTableBody');
  const totalEl = document.getElementById('clientesTotal');

  if (!tbody) return;

  let clientes = [...(state.clientes || [])];

  const busca = (document.getElementById('clientesBusca')?.value || '').toLowerCase().trim();
  const ordem = document.getElementById('clientesOrdem')?.value || 'id';

  if (busca) {
    clientes = clientes.filter(c =>
      String(c.id || '').includes(busca) ||
      String(c.nome_cliente || '').toLowerCase().includes(busca) ||
      String(c.telefone || '').toLowerCase().includes(busca) ||
      String(c.email || '').toLowerCase().includes(busca) ||
      String(c.endereco || '').toLowerCase().includes(busca)
    );
  }

  if (ordem === 'nome') {
    clientes.sort((a, b) =>
      String(a.nome_cliente || '').localeCompare(String(b.nome_cliente || ''), 'pt-BR')
    );
  } else if (ordem === 'telefone') {
    clientes.sort((a, b) =>
      String(a.telefone || '').localeCompare(String(b.telefone || ''), 'pt-BR')
    );
  } else {
    clientes.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  }

  if (totalEl) {
    totalEl.textContent = `${clientes.length} de ${(state.clientes || []).length} cadastrados`;
  }

  if (!clientes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:32px;color:var(--mid)">
          Nenhum cliente encontrado
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clientes.map(c => `
    <tr>
      <td>${c.id}</td>
      <td><strong>${c.nome_cliente || '—'}</strong></td>
      <td>${c.telefone || '—'}</td>
      <td>${c.email || '—'}</td>
      <td>${c.endereco || '—'}</td>
    </tr>
  `).join('');
}

/* ══════════════════════════════════════════════
   NAVEGAÇÃO DO MÊS
══════════════════════════════════════════════ */
document.getElementById('prevMonth').addEventListener('click', () => {
  state.viewDate.setMonth(state.viewDate.getMonth() - 1);
  renderCalendario();
  renderPendentes();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  state.viewDate.setMonth(state.viewDate.getMonth() + 1);
  renderCalendario();
  renderPendentes();
});

/* ══════════════════════════════════════════════
   SIDEBAR MOBILE
══════════════════════════════════════════════ */
document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
});
document.getElementById('sidebarOverlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
});

/* ══════════════════════════════════════════════
   FORM: ATUALIZAR CARRINHOS AO MUDAR DATA
══════════════════════════════════════════════ */
document.getElementById('fData').addEventListener('change', function () {
  verificarCapacidadeData(this.value);
  popularSelectCarrinhos(this.value);
});

/* ══════════════════════════════════════════════
   INIT — verifica autenticação e carrega dados
══════════════════════════════════════════════ */
async function init() {
  try {
    await carregarDados();
    const inp = document.getElementById('saborDataFiltro');
    if (inp) inp.value = fmt(new Date());
    renderTudo();
  } catch (e) {
    showToast('Erro ao carregar dados: ' + e.message, 'error');
  }
}

// Verificar se já está autenticado ao carregar a página
(async () => {
  try {
    await apiFetch('/api/auth/check/');
    // Se chegou aqui, está autenticado
    document.getElementById('loginScreen').style.display = 'none';
    await init();
  } catch {
    // Não autenticado — tela de login já visível por padrão
  }
})();

async function salvarCliente() {
  const nome = document.getElementById('cNome').value.trim();

  if (!nome) {
    showToast('Informe o nome do cliente.', 'error');
    return;
  }

  try {
    const novo = await apiFetch('/api/clientes/', {
      method: 'POST',
      body: JSON.stringify({
        nome_cliente: nome,
        telefone: document.getElementById('cTelefone').value.trim(),
        email: document.getElementById('cEmail').value.trim(),
        endereco: document.getElementById('cEndereco').value.trim(),
      })
    });

    state.clientes.push(novo);

    renderClientesTabela();

    closeModal('modalCliente');

    showToast('Cliente cadastrado com sucesso!', 'success');

  } catch (e) {
    showToast('Erro ao cadastrar cliente', 'error');
  }
}

async function recarregarPainel() {
  showToast('Atualizando dados...', 'info');

  await carregarDados();
  renderTudo();

  showToast('Painel atualizado!', 'success');
}