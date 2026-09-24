// ═══════════════════════════════════════════════════════════════════════════
// CHOPPATINHAS v2 — Cardápio digital (claro, editorial, foto em primeiro lugar)
// Mesmo banco e mesma lógica de pedido da v1 — só a experiência muda:
// vídeo em destaque, seção Frango, "mais pedidos" real, popup "combina com isso",
// checkout em página única com oferta rápida.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const C = window.CHOPP;
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ─── ESTADO ─────────────────────────────────────────────────────────────────
const S = {
  rows: [],
  grupos: [],
  porId: new Map(),
  info: {},
  vendas: new Map(),      // nome base → qtd vendida (histórico)
  vendasHoje: new Map(),  // nome base → qtd vendida hoje
  pedidosHoje: 0,
  afinidade: new Map(),
  carrinho: ls('chopp_carrinho', []),
  busca: '',
  filtro: 'tudo',
  pd: null,
  ck: null,
  canalPedido: null,
  recusasCombina: 0,
};

// ─── UTIL ───────────────────────────────────────────────────────────────────
function ls(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } }
const fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Preço de vitrine (engenharia de cardápio): sem "R$" e sem ",00" — reduz a "dor" do preço.
// Carrinho, checkout e botões de pagar continuam com fmt() completo.
const fmtMenu = v => { const n = Number(v || 0); return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); };
const fmtCurto = v => { const n = Number(v || 0); return 'R$ ' + (Number.isInteger(n) ? n : n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const r2 = n => Math.round(n * 100) / 100;
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const num = (k) => { const v = parseFloat(String(S.info[k] ?? '').replace(',', '.')); return Number.isFinite(v) ? v : C.DEFAULTS[k]; };
const valido = v => v && !/pendente/i.test(v);
const soDigitos = s => String(s || '').replace(/\D/g, '');
const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  somOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m23 9-6 6M17 9l6 6"/></svg>',
  somOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
};

// ─── TAMANHOS / NOMES (igual v1) ────────────────────────────────────────────
const ROTULO = { m: 'Média', g: 'Grande', p: 'Pequena', media: 'Média', média: 'Média', grande: 'Grande' };
function parseNome(nome) {
  const m = String(nome).match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (!m) return { base: String(nome).trim(), tam: null, letra: null };
  const raw = m[2].trim(); const k = raw.toLowerCase();
  if (ROTULO[k] || /^\d+\s*(ml|l)$/i.test(raw)) {
    const letra = k === 'm' || k === 'media' || k === 'média' ? 'M' : k === 'g' || k === 'grande' ? 'G' : k === 'p' ? 'P' : raw;
    return { base: m[1].trim(), tam: ROTULO[k] || raw, letra };
  }
  return { base: String(nome).trim(), tam: null, letra: null };
}
function gramasPorLetra(desc) {
  const out = {}; const re = /(\d+(?:[.,]\d+)?)\s*(kg|gr|g)\s*\((M|G)\)/gi; let m;
  while ((m = re.exec(desc || ''))) { let v = parseFloat(m[1].replace(',', '.')); if (/kg/i.test(m[2])) v *= 1000; out[m[3].toUpperCase()] = Math.round(v); }
  return out;
}
function limparDesc(desc) {
  let d = String(desc || '').split(' — ')[0];
  if (/^escolher/i.test(d)) return '';
  d = d.replace(/(porção\s+)?(com\s+)?(média|grande)?\s*\d+(?:[.,]\d+)?\s*(kg|gr|g)\s*\((M|G)\)\s*(ou)?\s*/gi, '');
  return d.replace(/^[\s,;]+|[\s,;]+$/g, '').replace(/^porção$/i, '');
}
const efetivo = r => { const pp = Number(r.preco_promocional); return pp > 0 && pp < Number(r.preco) ? pp : Number(r.preco); };
const copyDe = g => C.COPY[g.base.toLowerCase()] || C.COPY_SECAO[g.secao] || '';
const midiaDe = (nome, secao, img) => img
  ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">`
  : window.ChoppArt.svg(nome, secao);
// 'Combo Frango C/Batata Na Chapa' → 'Combo Frango c/ Batata na Chapa' (só exibição; o banco não muda)
const MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'e', 'na', 'no', 'nas', 'nos', 'em', 'ao', 'a', 'o', 'p/']);
function nomeBonito(t) {
  return String(t || '').replace(/\bC\/\s*/gi, 'c/ ').split(' ').map((w, i) => (i && MINUSC.has(w.toLowerCase())) ? w.toLowerCase() : w).join(' ');
}
const pesoTxt = gr => gr >= 1000 ? (gr / 1000).toLocaleString('pt-BR') + 'kg' : gr + 'g';

// ─── AGRUPAMENTO ────────────────────────────────────────────────────────────
function agrupar() {
  const mapa = new Map();
  S.porId = new Map(S.rows.map(r => [r.id, r]));
  for (const r of S.rows) {
    const { base, tam, letra } = parseNome(r.nome);
    const key = (r.categoria || '') + '|' + base.toLowerCase();
    if (!mapa.has(key)) mapa.set(key, { key, base, categoria: r.categoria || 'Outros', variantes: [], descricao: r.descricao });
    mapa.get(key).variantes.push({ ...r, tam, letra, efetivo: efetivo(r) });
  }
  const grupos = [];
  for (const g of mapa.values()) {
    g.variantes.sort((a, b) => ({ P: 0, M: 1, G: 2 }[a.letra] ?? 5) - ({ P: 0, M: 1, G: 2 }[b.letra] ?? 5) || a.efetivo - b.efetivo);
    const gr = gramasPorLetra(g.descricao);
    g.variantes.forEach(v => { v.gramas = gr[v.letra] || null; });
    g.disponiveis = g.variantes.filter(v => v.disponivel !== false);
    g.disponivel = g.disponiveis.length > 0;
    g.destaque = g.variantes.some(v => v.destaque);
    g.img = (g.disponiveis.find(v => v.imagem_url) || g.variantes.find(v => v.imagem_url))?.imagem_url || null;
    g.video = (g.disponiveis.find(v => v.video_url) || g.variantes.find(v => v.video_url))?.video_url || null;
    g.promo = g.disponiveis.some(v => Number(v.preco_promocional) > 0 && Number(v.preco_promocional) < Number(v.preco));
    g.min = g.disponiveis.length ? Math.min(...g.disponiveis.map(v => v.efetivo)) : Math.min(...g.variantes.map(v => v.efetivo));
    g.desc = limparDesc(g.descricao);
    g.nome = nomeBonito(g.base);
    g.secao = (C.SECOES.find(s => s.match(g)) || C.SECOES[C.SECOES.length - 1]).id;
    g.doce = g.secao === 'pizzas' && /prest[ií]gio|sensa[cç][aã]o|chocolate|doce/i.test(g.base + ' ' + g.descricao);
    g.opcoes = C.OPCOES[g.base.toLowerCase()] || null;
    g.simples = g.disponiveis.length <= 1 && !g.opcoes && g.secao !== 'pizzas';
    g.vendas = S.vendas.get(semAcento(g.base)) || 0;
    g.hoje = S.vendasHoje.get(semAcento(g.base)) || 0;
    grupos.push(g);
  }
  // ranking "mais pedidos": vendas reais do banco primeiro, depois a lista real do Anota.ai
  const rankAnota = new Map(C.MAIS_PEDIDOS.map((n, i) => [semAcento(n), i]));
  grupos.forEach(g => { g.rankAnota = rankAnota.has(semAcento(g.base)) ? rankAnota.get(semAcento(g.base)) : 99; });
  const bebOrdem = n => /cerveja|chopp/i.test(n) ? 0 : /lata/i.test(n) ? 1 : /guaran/i.test(n) ? 2 : /suco/i.test(n) ? 3 : /h2oh/i.test(n) ? 4 : 5;
  const ordem = {
    frango: (a, b) => a.rankAnota - b.rankAnota || b.min - a.min,
    combos: (a, b) => !!b.img - !!a.img || b.destaque - a.destaque || b.min - a.min,
    porcoes: (a, b) => !!b.img - !!a.img || a.rankAnota - b.rankAnota || b.vendas - a.vendas || b.min - a.min,
    lanches: (a, b) => b.destaque - a.destaque || b.min - a.min,
    acomp: (a, b) => a.rankAnota - b.rankAnota || a.min - b.min,
    bebidas: (a, b) => bebOrdem(a.base) - bebOrdem(b.base) || a.min - b.min,
  };
  grupos.sort((a, b) => {
    const ia = C.SECOES.findIndex(s => s.id === a.secao), ib = C.SECOES.findIndex(s => s.id === b.secao);
    if (ia !== ib) return ia - ib;
    return (ordem[a.secao] || ((x, y) => x.base.localeCompare(y.base)))(a, b) || a.base.localeCompare(b.base);
  });
  S.grupos = grupos;
}

function maisPedidos() {
  // A lista do Anota.ai (muito mais pedidos) manda; vendas do nosso banco desempatam
  // e completam com itens que já venderam 3+ vezes por aqui.
  return S.grupos.filter(g => g.disponivel && (g.vendas >= 3 || g.rankAnota < 99))
    .sort((a, b) => a.rankAnota - b.rankAnota || b.vendas - a.vendas)
    .slice(0, 6);
}

function selosDe(g, max = 2) {
  const t = [];
  if (g.promo) t.push('<span class="selo verm">Oferta</span>');
  if (g.rankAnota === 0) t.push('<span class="selo ambar">👑 Nº1 da casa</span>');
  else if (g.rankAnota < 99) t.push('<span class="selo ambar">🔥 Mais pedido</span>');
  if (g.destaque && g.rankAnota >= 99) t.push('<span class="selo">⭐ Casa indica</span>');
  const maxG = Math.max(0, ...g.variantes.map(v => v.gramas || 0));
  if (t.length < max && (g.secao === 'combos' || maxG >= 1000)) t.push('<span class="selo">Para compartilhar</span>');
  return t.slice(0, max).join('');
}
// "N hoje" só com venda real de hoje
const hojeDe = g => g.hoje >= 2 ? `<span class="selo-hoje">🔥 ${g.hoje} hoje</span>` : '';

// ─── HORÁRIOS / REGRAS ──────────────────────────────────────────────────────
const lojaAberta = () => String(S.info.loja_aberta ?? 'true') === 'true';
const marmitexAgora = () => { const h = new Date().getHours(); return h >= C.MARMITEX.inicio && h < C.MARMITEX.fim; };
const oferecerAlcool = () => String(S.info.oferecer_alcool ?? 'true') === 'true';
const ehAlcool = r => /cerveja|chopp/i.test(r.nome);

// Complementos certos pra cada prato (mesma lógica da v1, com a seção Frango)
function candidatosPara(g, max = 4) {
  const alcoolOk = oferecerAlcool() && g.secao !== 'marmitex' && !g.doce;
  const jaTemId = new Set(g.variantes.map(v => v.id));
  const porNome = n => { const r = S.rows.find(x => x.nome === n); return r && r.disponivel !== false && !jaTemId.has(r.id) ? r : null; };
  const lista = [];
  const add = ns => ns.forEach(n => { const r = porNome(n); if (r && !lista.includes(r)) lista.push(r); });

  const contexto = (g.base + ' ' + (g.descricao || '')).toLowerCase();
  const temArrozSalada = /completa|arroz e salada/.test(contexto);
  const ehArrozOuSalada = /^(arroz|salada)$/i.test(g.base);
  const temBatataNoNome = /batata/i.test(g.base);

  if (g.secao === 'frango' || g.secao === 'combos' || g.secao === 'porcoes') {
    if (!temBatataNoNome) add(['Porção De Batata Frita (M)']);
    if (!temArrozSalada && !ehArrozOuSalada) add(['Arroz', 'Salada']);
    if (alcoolOk) add(['Cerveja Brahma', 'Cerveja Skol']);
    add(['Guaraná Antarctica', 'Pepsi Lata', 'Suco De Maracujá Polpa']);
  } else if (g.secao === 'pizzas') {
    if (g.doce) add(['Suco De Acerola', 'Guaraná Antarctica', 'Água Com Gás']);
    else { if (alcoolOk) add(['Cerveja Brahma', 'Cerveja Skol']); add(['Guaraná Antarctica', 'Pepsi Lata']); }
  } else if (g.secao === 'lanches') {
    if (!/waffel/i.test(g.base)) add(['Porção De Batata Frita (M)']);
    add(['Guaraná Antarctica', 'Pepsi Lata', 'Sukita Lata']);
    if (alcoolOk) add(['Cerveja Brahma']);
  } else if (g.secao === 'caldos') {
    add(['Porção De Bolinho De Bacalhau']);
    if (alcoolOk) add(['Cerveja Brahma']);
    add(['Guaraná Antarctica']);
  } else if (g.secao === 'marmitex') {
    add(['Suco De Acerola', 'Suco De Maracujá Polpa', 'Guaraná Zero Lata', 'Água Sem Gás']);
  } else if (g.secao === 'bebidas') {
    if (/cerveja/i.test(g.base)) add(['Porção De Batata Frita (M)', 'Porção De Calabresa (M)', 'Porção De Polenta Frita']);
    else add(['Porção De Batata Frita (M)', 'Porção De Bolinho De Bacalhau']);
  }
  add(C.UPSELL_PADRAO.filter(n => alcoolOk || !/cerveja|chopp/i.test(n)));

  const af = S.afinidade.get(semAcento(g.base));
  if (af?.size) lista.sort((a, b) => (af.get(semAcento(parseNome(b.nome).base)) || 0) - (af.get(semAcento(parseNome(a.nome).base)) || 0));
  return lista.slice(0, max);
}

// ═══════════════════════════════════════════════════════════════════════════
// CARREGAMENTO
// ═══════════════════════════════════════════════════════════════════════════
function inicioDoDia() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }

async function carregar() {
  const [p, i] = await Promise.all([
    sb.from('produtos').select('*'),
    sb.from('info_restaurante').select('chave, valor'),
  ]);
  if (p.error) throw p.error;
  S.rows = p.data || [];
  (i.data || []).forEach(r => { S.info[r.chave] = r.valor; });
  carregarVendas();
}

async function carregarVendas() {
  const hoje = inicioDoDia();
  const [itens, ped] = await Promise.all([
    sb.from('itens_pedido').select('pedido_id, nome_produto, quantidade, created_at').order('created_at', { ascending: false }).limit(3000),
    sb.from('pedidos').select('id', { count: 'exact', head: true }).gte('created_at', hoje).neq('status', 'cancelado'),
  ]);
  S.pedidosHoje = ped.count || 0;
  const data = itens.data || [];
  const vendas = new Map(), vendasHoje = new Map(), porPedido = new Map();
  data.forEach(r => {
    const k = semAcento(parseNome(r.nome_produto || '').base);
    const q = r.quantidade || 1;
    vendas.set(k, (vendas.get(k) || 0) + q);
    if (r.created_at >= hoje) vendasHoje.set(k, (vendasHoje.get(k) || 0) + q);
    if (!porPedido.has(r.pedido_id)) porPedido.set(r.pedido_id, new Set());
    porPedido.get(r.pedido_id).add(k);
  });
  const afinidade = new Map();
  for (const itensP of porPedido.values()) {
    if (itensP.size < 2) continue;
    const arr = [...itensP];
    arr.forEach(a => {
      if (!afinidade.has(a)) afinidade.set(a, new Map());
      const m = afinidade.get(a);
      arr.forEach(b => { if (a !== b) m.set(b, (m.get(b) || 0) + 1); });
    });
  }
  S.vendas = vendas; S.vendasHoje = vendasHoje; S.afinidade = afinidade;
  agrupar(); renderPilulas(); renderTop(); renderMenu();
}

function tempoReal() {
  const reagir = debounce(() => {
    agrupar(); renderPalco(); renderFaixa(); renderTop(); renderMenu(); renderBarra();
    if ($('#sheetCarrinho').classList.contains('on')) renderCarrinho();
    if (!$('#adm').hidden && !ADM.edit) admRender();
  }, 300);
  sb.channel('cardapio-v2-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, ({ eventType, new: n, old: o }) => {
      if (eventType === 'DELETE') S.rows = S.rows.filter(r => r.id !== o.id);
      else { const i = S.rows.findIndex(r => r.id === n.id); if (i >= 0) S.rows[i] = n; else S.rows.push(n); }
      reagir();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'info_restaurante' }, ({ new: n }) => {
      if (n?.chave) { S.info[n.chave] = n.valor; renderPilulas(); renderRodape(); renderBarra(); if ($('#sheetCarrinho').classList.contains('on')) renderCarrinho(); }
    })
    .subscribe();
}

// ═══════════════════════════════════════════════════════════════════════════
// TOPO / INTRO / PALCO / FAIXA / MAIS PEDIDOS
// ═══════════════════════════════════════════════════════════════════════════
function horarioTxt() { return valido(S.info.horario) ? S.info.horario.replace(/\(.*?\)/g, '').trim() : C.DEFAULTS.horario; }

function renderPilulas() {
  const aberta = lojaAberta();
  const fg = num('frete_gratis_acima');
  const itens = [
    `<span class="pilula${aberta ? '' : ' fechado'}"><span class="ponto"></span><b>${aberta ? 'Aberto' : 'Fechado agora'}</b>${aberta ? ' · ' + esc(horarioTxt().toLowerCase()) : ''}</span>`,
    S.pedidosHoje >= 3 ? `<span class="pilula">🔥 <b>${S.pedidosHoje}</b> pedidos hoje</span>` : '',
    `<span class="pilula">⭐ <b>${C.DEFAULTS.avaliacao}</b></span>`,
    `<span class="pilula">🛵 <b>${C.DEFAULTS.tempo_entrega}</b></span>`,
    fg > 0 ? `<span class="pilula frete">🎁 Frete grátis acima de <b>${fmtCurto(fg)}</b></span>` : '',
  ];
  $('#pilulas').innerHTML = itens.join('');
}

function renderRodape() {
  $('#rodapeHora').textContent = horarioTxt();
  $('#rodapeEnd').textContent = valido(S.info.endereco) ? S.info.endereco : 'Umuarama-PR';
}

// Produto do palco: quem tem vídeo (⭐ primeiro); sem vídeo, o nº1 com foto
function grupoDoPalco() {
  const disp = S.grupos.filter(g => g.disponivel);
  const comVideo = disp.filter(g => g.video).sort((a, b) => b.destaque - a.destaque || a.rankAnota - b.rankAnota);
  if (comVideo.length) return comVideo[0];
  return disp.filter(g => g.img).sort((a, b) => a.rankAnota - b.rankAnota || b.destaque - a.destaque)[0] || null;
}

let obsPalco;
function renderPalco() {
  const g = grupoDoPalco();
  const palco = $('#palco');
  if (!g) { palco.hidden = true; return; }
  palco.hidden = false;
  const atual = palco.dataset.g;
  const midiaAtual = palco.dataset.m;
  const midia = (g.video || g.img) + '|' + g.min;
  if (atual === g.key && midiaAtual === midia) return; // nada mudou: não reinicia o vídeo
  palco.dataset.g = g.key; palco.dataset.m = midia;
  const video = g.video && !reduzMovimento();
  palco.innerHTML = `
    <article class="palco-card" data-abre="${esc(g.key)}" aria-label="Destaque: ${esc(g.nome)}">
      ${video
        ? `<video class="palco-media" id="palcoVideo" src="${esc(g.video)}" ${g.img ? `poster="${esc(g.img)}"` : ''} muted autoplay loop playsinline preload="auto" fetchpriority="high"></video>`
        : g.video
          ? `<video class="palco-media" id="palcoVideo" src="${esc(g.video)}" ${g.img ? `poster="${esc(g.img)}"` : ''} muted loop playsinline preload="auto" controls></video>`
          : `<img class="palco-media zoom" src="${esc(g.img)}" alt="">`}
      <span class="palco-selo"><i></i>${g.video ? 'Destaque da casa' : 'O mais pedido'}</span>
      ${video ? `<button class="palco-som" id="palcoSom" aria-label="Ligar som">${ICON.somOff}</button>` : ''}
      <div class="palco-corpo">
        ${g.rankAnota === 0 ? '<span class="palco-chip">👑 Nº1 em pedidos</span>' : g.destaque ? '<span class="palco-chip">⭐ A casa indica</span>' : ''}
        <h2 class="palco-nome">${esc(g.nome)}</h2>
        ${copyDe(g) ? `<p class="palco-copy">${esc(copyDe(g))}</p>` : ''}
        <div class="palco-pe">
          <div class="palco-preco"><small>${g.disponiveis.length > 1 ? 'a partir de' : 'por'}</small><strong>${fmtMenu(g.min)}</strong></div>
          <button class="btn-cta claro" data-add="${esc(g.key)}">Quero esse →</button>
        </div>
      </div>
      ${video ? '<span class="palco-barra"><i id="palcoBarra"></i></span>' : ''}
    </article>`;
  const v = $('#palcoVideo');
  if (v && video) {
    // Injetado via innerHTML: o atributo autoplay nem sempre dispara sozinho no
    // celular, e "preload=metadata" só baixava o cabeçalho — ficava esperando o
    // IntersectionObserver pra buscar o vídeo de verdade. Agora tenta tocar já,
    // e de novo assim que tiver dado suficiente (canplay), sem esperar rolagem.
    v.play().catch(() => {});
    v.addEventListener('canplay', () => { if (v.paused) v.play().catch(() => {}); }, { once: true });
    v.addEventListener('timeupdate', () => { const b = $('#palcoBarra'); if (b && v.duration) b.style.width = (v.currentTime / v.duration * 100) + '%'; });
    obsPalco?.disconnect();
    obsPalco = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: .25 });
    obsPalco.observe(v);
  }
}

function renderFaixa() {
  const fotos = S.grupos.filter(g => g.disponivel && g.img);
  const trilho = $('#faixaTrilho');
  if (fotos.length < 3) { $('#faixa').hidden = true; return; }
  $('#faixa').hidden = false;
  const imgs = fotos.map(g => `<img src="${esc(g.img)}" alt="" decoding="async">`).join('');
  trilho.innerHTML = imgs + imgs; // duplicado pro loop infinito
}

function renderTop() {
  const lista = maisPedidos();
  $('#top').hidden = lista.length < 3;
  $('#topTrilho').innerHTML = lista.map((g, i) => `
    <article class="top-card" data-abre="${esc(g.key)}">
      <div class="foto">${midiaDe(g.base, g.secao, g.img)}<span class="top-rank">${i + 1}</span></div>
      <strong>${esc(g.nome)}</strong>
      <div class="pe"><div class="preco">${precoBloco(g)}</div><button class="btn-mais" data-add="${esc(g.key)}" aria-label="Adicionar ${esc(g.nome)}">${ICON.plus}</button></div>
    </article>`).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// CARDÁPIO
// ═══════════════════════════════════════════════════════════════════════════
function secoesVisiveis() {
  const termo = semAcento(S.busca.trim());
  const filtra = g => !termo || semAcento(g.base + ' ' + g.descricao + ' ' + g.categoria).includes(termo);
  return C.SECOES.map(s => ({ ...s, grupos: S.grupos.filter(g => g.secao === s.id && g.disponivel && filtra(g)) }))
    .filter(s => s.grupos.length);
}

function renderCats(secoes) {
  if (S.filtro !== 'tudo' && !secoes.some(s => s.id === S.filtro)) S.filtro = 'tudo';
  $('#catsIn').innerHTML = [`<button class="cat${S.filtro === 'tudo' ? ' on' : ''}" data-cat="tudo">Tudo</button>`,
    ...secoes.map(s => `<button class="cat${S.filtro === s.id ? ' on' : ''}" data-cat="${s.id}">${esc(s.nome)}</button>`)].join('');
}

function qtdNoCarrinho(g) { const ids = new Set(g.variantes.map(v => v.id)); return S.carrinho.filter(i => ids.has(i.pid)).reduce((s, i) => s + i.qtd, 0); }
const badgeQtd = g => { const q = qtdNoCarrinho(g); return q ? `<span class="qtd">${q}</span>` : ''; };
const precoBloco = g => `${g.disponiveis.length > 1 ? '<small>a partir de</small>' : g.promo ? `<s>${fmtMenu(g.disponiveis[0].preco)}</s>` : ''}<strong>${fmtMenu(g.min)}</strong>`;

function estrelaHTML(g) {
  return `
  <article class="estrela" data-abre="${esc(g.key)}">
    <div class="foto"><img src="${esc(g.img)}" alt="" loading="lazy" decoding="async"><div class="selos">${selosDe(g, 1)}</div>${hojeDe(g)}</div>
    <div class="corpo">
      <h3>${esc(g.nome)}</h3>
      <p>${esc(copyDe(g) || cap(g.desc))}</p>
      <div class="pe">
        <div class="preco">${precoBloco(g)}</div>
        <button class="btn-mais" data-add="${esc(g.key)}" aria-label="Adicionar ${esc(g.nome)}">${ICON.plus}${badgeQtd(g)}</button>
      </div>
    </div>
  </article>`;
}

function cardHTML(g, i) {
  return `
  <article class="card" data-abre="${esc(g.key)}" style="animation-delay:${Math.min(i, 8) * 40}ms">
    <div class="foto"><img src="${esc(g.img)}" alt="" loading="lazy" decoding="async"><div class="selos">${selosDe(g)}</div>${hojeDe(g)}</div>
    <div class="corpo">
      <h3>${esc(g.nome)}</h3>
      ${(copyDe(g) || g.desc) ? `<p>${esc(copyDe(g) || cap(g.desc))}</p>` : ''}
      <div class="pe">
        <div class="preco">${precoBloco(g)}</div>
        <button class="btn-mais" data-add="${esc(g.key)}" aria-label="Adicionar ${esc(g.nome)}">${ICON.plus}${badgeQtd(g)}</button>
      </div>
    </div>
  </article>`;
}

function linhaHTML(g) {
  const v = g.disponiveis[0];
  const bebida = g.secao === 'bebidas';
  const item = bebida && g.disponiveis.length === 1 ? S.carrinho.find(it => it.pid === v.id && !it.obs) : null;
  const tams = g.disponiveis.length > 1 ? g.disponiveis.map(x => `<span>${esc(x.tam || x.letra)}${x.gramas ? ' ' + pesoTxt(x.gramas) : ''} · ${fmtMenu(x.efetivo)}</span>`).join('') : '';
  const tags = [g.rankAnota < 99 ? '<span class="verm">🔥 Mais pedido</span>' : '', g.hoje >= 2 ? `<span class="verm">${g.hoje} hoje</span>` : '', g.promo ? '<span class="verm">Oferta</span>' : '', tams].join('');
  const sub = C.COPY[g.base.toLowerCase()] || (bebida ? (v.tam || '') : g.desc);
  const acao = item
    ? `<div class="stepper"><button data-menos-pid="${v.id}" aria-label="Menos">−</button><b>${item.qtd}</b><button data-mais-pid="${v.id}" aria-label="Mais">+</button></div>`
    : `<button class="btn-mais" data-add="${esc(g.key)}" aria-label="Adicionar ${esc(g.nome)}">${ICON.plus}${bebida ? '' : badgeQtd(g)}</button>`;
  return `
  <div class="linha" data-abre="${esc(g.key)}">
    <div class="linha-txt">
      <div class="linha-topo"><strong>${esc(g.nome)}</strong><span class="pontos"></span><b>${fmtMenu(g.min)}</b></div>
      ${sub ? `<small>${esc(cap(sub))}</small>` : ''}
      ${tags ? `<div class="linha-tags">${tags}</div>` : ''}
    </div>
    ${bebida && /cerveja/i.test(g.base) && g.disponiveis.length === 1 ? `<button class="balde" data-balde="${v.id}">+6 latas</button>` : ''}
    ${acao}
  </div>`;
}

function renderMenu() {
  const secoes = secoesVisiveis();
  renderCats(secoes);
  const menu = $('#menu');
  if (!secoes.length) {
    menu.innerHTML = '';
    $('#buscaVazia').hidden = !S.busca;
    $('#buscaTermo').textContent = `“${S.busca}”`;
    return;
  }
  $('#buscaVazia').hidden = true;
  const mostrar = S.filtro === 'tudo' ? secoes : secoes.filter(s => s.id === S.filtro);
  menu.innerHTML = mostrar.map(s => {
    const comFoto = s.grupos.filter(g => g.img);
    const semFoto = s.grupos.filter(g => !g.img);
    const estrela = comFoto.length && (comFoto[0].rankAnota < 99 || comFoto[0].destaque || comFoto.length === 1) ? comFoto.shift() : null;
    const aviso = s.id === 'marmitex' && !marmitexAgora() ? `<div class="aviso-sec">⏰ Marmitex sai só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h.</div>` : '';
    return `
    <section class="secao" id="sec-${s.id}">
      <div class="secao-cab">
        <div><h2 class="secao-titulo">${esc(s.nome)}</h2>${s.sub ? `<p class="secao-sub">${esc(s.sub)}</p>` : ''}</div>
        <span class="secao-cont">${s.grupos.length}</span>
      </div>
      ${aviso}
      ${estrela ? estrelaHTML(estrela) : ''}
      ${comFoto.length ? `<div class="grade">${comFoto.map(cardHTML).join('')}</div>` : ''}
      ${semFoto.length ? `<div class="lista">${comFoto.length || estrela ? `<p class="lista-titulo">${s.id === 'bebidas' ? 'Geladas' : 'Mais opções'}</p>` : ''}${semFoto.map(linhaHTML).join('')}</div>` : ''}
    </section>`;
  }).join('');
}

function atualizarBotoesMenu() {
  $$('[data-add]').forEach(b => {
    const g = S.grupos.find(x => x.key === b.dataset.add); if (!g || b.closest('.palco-card, .top-card') || b.closest('.linha')?.querySelector('.stepper')) return;
    const q = qtdNoCarrinho(g); const badge = $('.qtd', b);
    if (q) { if (badge) badge.textContent = q; else b.insertAdjacentHTML('beforeend', `<span class="qtd">${q}</span>`); } else badge?.remove();
  });
  // bebidas com stepper: re-render só da linha
  $$('.secao#sec-bebidas .linha').forEach(l => {
    const g = S.grupos.find(x => x.key === l.dataset.abre); if (!g) return;
    l.outerHTML = linhaHTML(g);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RETORNO — acompanhar / pedir de novo (igual v1)
// ═══════════════════════════════════════════════════════════════════════════
const ETAPAS = {
  delivery: [
    { t: 'Pedido recebido', d: 'A casa já está vendo seu pedido', ico: '🧾' },
    { t: 'Na cozinha', d: 'Preparando tudo na hora', ico: '🔥' },
    { t: 'Saiu pra entrega', d: 'Está a caminho — pode preparar a mesa', ico: '🛵' },
    { t: 'Entregue', d: 'Bom apetite!', ico: '✅' },
  ],
  retirada: [
    { t: 'Pedido recebido', d: 'A casa já está vendo seu pedido', ico: '🧾' },
    { t: 'Na cozinha', d: 'Preparando tudo na hora', ico: '🔥' },
    { t: 'Pronto pra retirar', d: 'Pode vir buscar!', ico: '🛍️' },
    { t: 'Retirado', d: 'Bom apetite!', ico: '✅' },
  ],
};
function etapaDe(status) {
  const s = String(status || '').toLowerCase().replace(/\s+/g, '_');
  if (s === 'cancelado') return -1;
  if (['confirmado', 'preparando', 'aguardando_preparo'].includes(s)) return 1;
  if (['pronto', 'saiu_entrega'].includes(s)) return 2;
  if (s === 'entregue') return 3;
  return 0;
}
async function renderRetorno() {
  const box = $('#retorno');
  const ult = ls('chopp_ultimo', null);
  const partes = [];
  if (ult?.id && Date.now() - ult.criado < 12 * 3600e3) {
    const { data } = await sb.from('pedidos').select('status').eq('id', ult.id).maybeSingle();
    if (data) { ult.status = data.status; lsSet('chopp_ultimo', ult); }
    const et = etapaDe(ult.status);
    if (et >= 0 && et < 3) {
      const e = ETAPAS[ult.tipo || 'delivery'][et];
      partes.push(`<button class="ret-card vivo" data-acompanhar><span class="ret-ico">${e.ico}</span><span class="ret-txt"><strong>Pedido #${String(ult.numero).padStart(3, '0')} · ${e.t}</strong><small>${e.d}</small></span><span class="ret-seta">Acompanhar →</span></button>`);
    }
  }
  const rep = ls('chopp_repetir', null);
  if (rep?.itens?.length) {
    const total = rep.itens.reduce((s, i) => s + i.preco * i.qtd, 0);
    partes.push(`<button class="ret-card" data-repetir><span class="ret-ico">🔁</span><span class="ret-txt"><strong>Pedir de novo · ${fmt(total)}</strong><small>${esc(rep.itens.map(i => `${i.qtd}x ${i.titulo}`).join(', '))}</small></span><span class="ret-seta">Repetir →</span></button>`);
  }
  box.innerHTML = partes.join('');
  box.hidden = !partes.length;
}
function repetirPedido() {
  const rep = ls('chopp_repetir', null); if (!rep) return;
  if (!lojaAberta()) return toast('Estamos fechados agora. Volta mais tarde!', 'erro');
  let ok = 0, fora = 0;
  rep.itens.forEach(it => {
    const row = S.porId.get(it.pid);
    if (!row || row.disponivel === false) { fora++; return; }
    addItem({ ...it, preco: it.meio ? it.preco : efetivo(row), origem: 'repetir', fonte: 'repetir' }, false); ok++;
  });
  renderBarra(); renderMenu();
  toast(ok ? `${ok} ${ok === 1 ? 'item voltou' : 'itens voltaram'} pro pedido${fora ? ` (${fora} indisponível)` : ''}` : 'Esses itens não estão disponíveis hoje', ok ? 'ok' : 'erro');
  if (ok) setTimeout(abrirCarrinho, 350);
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIÇÃO — o que foi mostrado/aceito e quanto cada alavanca rendeu.
// Vai pra tabela eventos_cardapio (supabase/002_eventos_cardapio.sql). Sem a
// tabela, desliga sozinho no primeiro erro. Aparelhos da equipe não contam.
// ═══════════════════════════════════════════════════════════════════════════
const MED = { fila: [], ligado: true, sessao: null };
function sessaoId() {
  try { let s = sessionStorage.getItem('chopp_sessao'); if (!s) { s = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); sessionStorage.setItem('chopp_sessao', s); } return s; }
  catch { return MED.sessao || (MED.sessao = String(Math.random()).slice(2) + Date.now()); }
}
const aparelhoEquipe = () => { try { return localStorage.getItem('chopp_equipe') === '1'; } catch { return false; } };
function rastrear(evento, extra = {}) {
  if (!MED.ligado || aparelhoEquipe()) return;
  const { produto = null, valor = null, pedido_id = null, ...dados } = extra;
  MED.fila.push({ sessao: sessaoId(), evento, produto, valor, pedido_id, dados: Object.keys(dados).length ? dados : null, versao: 'v2' });
  if (MED.fila.length >= 12) enviarEventos();
}
function enviarEventos() {
  if (!MED.fila.length || !MED.ligado) return;
  const lote = MED.fila.splice(0);
  fetch(`${C.SUPABASE_URL}/rest/v1/eventos_cardapio`, {
    method: 'POST', keepalive: true, body: JSON.stringify(lote),
    headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  }).then(r => { if (r.status === 404) MED.ligado = false; }).catch(() => {});
}
setInterval(enviarEventos, 5000);
addEventListener('visibilitychange', () => { if (document.hidden) enviarEventos(); });
addEventListener('pagehide', enviarEventos);

// ═══════════════════════════════════════════════════════════════════════════
// CARRINHO — lógica (igual v1)
// ═══════════════════════════════════════════════════════════════════════════
function chaveItem(it) { return [it.pid, it.nomeDb, it.obs || ''].join('|'); }
function addItem(it, animar = true) {
  const k = chaveItem(it);
  const ex = S.carrinho.find(i => i.k === k);
  if (ex) ex.qtd += it.qtd; else S.carrinho.push({ origem: 'cardapio', fonte: 'cardapio', ...it, k });
  salvarCarrinho();
  rastrear('item_adicionado', { produto: it.titulo, valor: r2(it.preco * it.qtd), origem: it.origem || 'cardapio', fonte: it.fonte || 'cardapio' });
  if (animar) { renderBarra(true); atualizarBotoesMenu(); }
}
function mudarQtd(k, delta) {
  const it = S.carrinho.find(i => i.k === k); if (!it) return;
  it.qtd += delta;
  if (it.qtd <= 0) S.carrinho = S.carrinho.filter(i => i.k !== k);
  salvarCarrinho(); renderBarra(); atualizarBotoesMenu();
}
function salvarCarrinho() { lsSet('chopp_carrinho', S.carrinho); }
function subtotal() { return r2(S.carrinho.reduce((s, i) => s + i.preco * i.qtd, 0)); }
function totais(tipo = 'delivery') {
  const sub = subtotal();
  const fg = num('frete_gratis_acima');
  const gratis = fg > 0 && sub >= fg;
  const taxa = tipo === 'retirada' || gratis ? 0 : num('taxa_entrega');
  return { sub, taxa, gratis, total: r2(sub + taxa), fg, falta: fg > 0 ? r2(Math.max(0, fg - sub)) : 0 };
}
function grupoDaLinha(row) { return S.grupos.find(x => x.variantes.some(v => v.id === row.id)); }
function itemRapido(row, qtd = 1, origem = 'cardapio', fonte = 'cardapio') {
  const { base, tam } = parseNome(row.nome);
  const g = grupoDaLinha(row);
  return { pid: row.id, nomeDb: row.nome, titulo: nomeBonito(base), sub: tam || '', preco: efetivo(row), qtd, obs: '', secao: g?.secao || '', img: row.imagem_url || g?.img || null, origem, fonte };
}
function avisarFrete(antes) {
  const depois = totais();
  if (antes.fg > 0 && !antes.gratis && depois.gratis) { confete(); toast('🎉 Frete grátis desbloqueado!', 'ok'); return true; }
  return false;
}
function addRapido(row, { qtd = 1, el = null, combina = true, origem = 'cardapio', fonte = 'cardapio' } = {}) {
  if (!lojaAberta()) return toast('Estamos fechados agora. Volta mais tarde!', 'erro');
  const antes = totais();
  addItem(itemRapido(row, qtd, origem, fonte));
  pop(el);
  if (!avisarFrete(antes)) toast('Adicionado ao pedido', 'ok');
  const g = grupoDaLinha(row);
  if (combina && g) setTimeout(() => abrirCombina(g), 380);
}

function renderBarra(treme = false) {
  const qtd = S.carrinho.reduce((s, i) => s + i.qtd, 0);
  const t = totais();
  $('#sacolaQtd').textContent = qtd;
  $('#sacolaTotal').textContent = fmt(t.sub);
  if (treme) { const b = $('#btnSacola'); b.classList.remove('pula'); void b.offsetWidth; b.classList.add('pula'); }
  $('#barra').hidden = qtd === 0;
  if (!qtd) return;
  $('#barraQtd').textContent = qtd;
  $('#barraTotal').textContent = fmt(t.sub);
  $('#barraMeta').textContent = t.fg > 0 ? (t.gratis ? '🎉 Frete grátis garantido' : `Faltam ${fmt(t.falta)} pro frete grátis`) : `${qtd} ${qtd === 1 ? 'item' : 'itens'}`;
  $('#barraProg').style.width = t.fg > 0 ? Math.min(100, (t.sub / t.fg) * 100) + '%' : '0';
  if (treme) { const b = $('#barraBtn'); b.classList.remove('treme'); void b.offsetWidth; b.classList.add('treme'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEETS
// ═══════════════════════════════════════════════════════════════════════════
const pilha = [];
let ignorarPop = false;
function abrirSheet(id) {
  const el = $('#' + id);
  if (!pilha.includes(id)) pilha.push(id);
  $('#veu').classList.add('on');
  document.body.classList.add('travado');
  requestAnimationFrame(() => { if (pilha.includes(id)) el.classList.add('on'); });
  if (history.state?.sheet !== id) history.pushState({ sheet: id }, '');
}
function fecharSheet(id, viaHistorico = false) {
  const el = $('#' + id); if (!el) return;
  el.classList.remove('on');
  $$('video', el).forEach(v => v.pause());
  const i = pilha.indexOf(id); if (i >= 0) pilha.splice(i, 1);
  if (!pilha.length) { $('#veu').classList.remove('on'); document.body.classList.remove('travado'); }
  if (id === 'sheetStatus' && S.canalPedido) { sb.removeChannel(S.canalPedido); S.canalPedido = null; }
  if (!viaHistorico && history.state?.sheet === id) { ignorarPop = true; history.back(); }
}
function fecharTopo() { const id = pilha[pilha.length - 1]; if (id) fecharSheet(id); }
window.addEventListener('popstate', () => { if (ignorarPop) { ignorarPop = false; return; } const id = pilha[pilha.length - 1]; if (id) fecharSheet(id, true); });

// ═══════════════════════════════════════════════════════════════════════════
// PRODUTO
// ═══════════════════════════════════════════════════════════════════════════
function abrirProduto(key, fonte = 'cardapio') {
  const g = S.grupos.find(x => x.key === key); if (!g) return;
  const vs = g.disponiveis.length ? g.disponiveis : g.variantes;
  let idx = 0;
  if (vs.length > 1) { const a = vs[0], b = vs[vs.length - 1]; if ((b.efetivo - a.efetivo) / a.efetivo <= 0.2) idx = vs.length - 1; }
  S.pd = { g, vs, idx, idxInicial: idx, upgradeClicado: false, fonte, meio: false, sabor2: null, opc: {}, sem: new Set(), qtd: 1, obs: '' };
  rastrear('produto_aberto', { produto: g.nome, fonte });
  renderProduto();
  abrirSheet('sheetProduto');
  $('#sheetProduto .sheet-corpo').scrollTop = 0;
}
function precoPd() {
  const { g, vs, idx, meio, sabor2 } = S.pd;
  const v = vs[idx];
  let unit = v.efetivo, prodDb = v, extraNome = '';
  if (g.secao === 'pizzas' && meio && sabor2) {
    const g2 = S.grupos.find(x => x.key === sabor2);
    const v2 = g2 && (g2.disponiveis.find(x => x.letra === v.letra) || g2.disponiveis[0]);
    if (v2 && v2.efetivo > unit) { unit = v2.efetivo; prodDb = v2; }
    extraNome = g2 ? g2.nome : '';
  }
  return { v, unit, prodDb, extraNome, total: r2(unit * S.pd.qtd) };
}
function ingredientesDe(g) {
  if (g.secao !== 'lanches') return [];
  return String(g.descricao || '').split(/,\s*|\s+e\s+/).map(s => s.trim()).filter(s => s && s.length < 26 && !/^(hamb[uú]rguer|p[aã]o|frango|picanha)$/i.test(s));
}
function faltaPd() {
  const { g, meio, sabor2 } = S.pd;
  if (g.secao === 'pizzas' && meio && !sabor2) return 'Escolha o 2º sabor da pizza';
  const f = (g.opcoes || []).findIndex((_, i) => !S.pd.opc[i]);
  return f >= 0 ? g.opcoes[f].titulo : '';
}
function renderProduto() {
  const { g, vs, idx, meio, sabor2 } = S.pd;
  const v = vs[idx];
  const p = precoPd();
  const mm = g.secao === 'marmitex' && !marmitexAgora();
  const partes = [];

  if (vs.length > 1) {
    const ppg = vs.map(x => x.gramas ? x.efetivo / x.gramas : null);
    const melhor = ppg.every(Boolean) ? ppg.indexOf(Math.min(...ppg)) : -1;
    const maior = vs[vs.length - 1];
    partes.push(`
      <div class="bloco">
        <div class="bloco-cab"><h4>Escolha o tamanho</h4><span class="obr">Obrigatório</span></div>
        <div class="tams">${vs.map((x, i) => `
          <button class="tam${i === idx ? ' on' : ''}" data-tam="${i}">
            ${i === melhor && i === vs.length - 1 ? '<span class="fita">Melhor custo</span>' : ''}
            <strong>${esc(x.tam || x.letra)}</strong>
            <small>${x.gramas ? pesoTxt(x.gramas) : '&nbsp;'}</small>
            <em>${fmtMenu(x.efetivo)}</em>
          </button>`).join('')}
        </div>
        ${idx < vs.length - 1 ? `<button class="upgrade" data-tam="${vs.length - 1}">🔥 Por só <b>+${fmt(r2(maior.efetivo - v.efetivo))}</b> leva a ${esc((maior.tam || '').toLowerCase())}${maior.gramas && v.gramas ? ` (+${maior.gramas - v.gramas}g)` : ''}<span class="seta">Quero →</span></button>` : ''}
      </div>`);
  }
  if (g.secao === 'pizzas') {
    const outras = S.grupos.filter(x => x.secao === 'pizzas' && x.key !== g.key && x.disponivel);
    partes.push(`
      <div class="bloco">
        <button class="meio-toggle" data-meio><span style="font-size:24px">🍕</span><span><strong>Quer meio a meio?</strong><br><small>Vale o preço do sabor mais caro.</small></span><span class="sw${meio ? ' on' : ''}"></span></button>
        ${meio ? `<div class="bloco-cab" style="margin-top:14px"><h4>2º sabor</h4><span class="${sabor2 ? 'ok' : 'obr'}">${sabor2 ? 'Escolhido' : 'Obrigatório'}</span></div>
        <div class="opcs">${outras.map(o => { const ov = o.disponiveis.find(x => x.letra === v.letra) || o.disponiveis[0]; return `<label class="opc${sabor2 === o.key ? ' on' : ''}" data-sabor="${esc(o.key)}"><span class="marca-opc"></span><span class="opc-txt"><strong>${esc(o.nome)}</strong><small>${esc(o.desc)}</small></span><span class="opc-preco">${fmt(ov.efetivo)}</span></label>`; }).join('')}</div>` : ''}
      </div>`);
  }
  (g.opcoes || []).forEach((grp, gi) => {
    partes.push(`
      <div class="bloco">
        <div class="bloco-cab"><h4>${esc(grp.titulo)}</h4><span class="${S.pd.opc[gi] ? 'ok' : 'obr'}">${S.pd.opc[gi] ? 'Escolhido' : 'Obrigatório'}</span></div>
        <div class="opcs">${grp.itens.map(o => `<label class="opc${S.pd.opc[gi] === o ? ' on' : ''}" data-opc="${gi}" data-val="${esc(o)}"><span class="marca-opc"></span><span class="opc-txt"><strong>${esc(o)}</strong></span></label>`).join('')}</div>
      </div>`);
  });
  const ingr = ingredientesDe(g);
  if (ingr.length) {
    partes.push(`
      <div class="bloco">
        <div class="bloco-cab"><h4>Quer tirar algo?</h4><span>Opcional</span></div>
        <div class="chips">${ingr.map(i => `<button class="chip${S.pd.sem.has(i) ? ' on' : ''}" data-sem="${esc(i)}">${esc(cap(i))}</button>`).join('')}</div>
      </div>`);
  }
  partes.push(`
    <div class="bloco">
      <div class="bloco-cab"><h4>Alguma observação?</h4><span>Opcional</span></div>
      <textarea class="campo" id="pdObs" rows="2" maxlength="140" placeholder="Ex.: bem passado, molho à parte…">${esc(S.pd.obs)}</textarea>
    </div>`);

  const falta = faltaPd();
  const aberta = lojaAberta();
  const nomeTit = g.secao === 'pizzas' && meio && sabor2 ? `½ ${g.nome} + ½ ${p.extraNome}` : g.nome;
  const img = v.imagem_url || g.img;
  const midia = g.video
    ? `<video src="${esc(g.video)}" ${img ? `poster="${esc(img)}"` : ''} muted ${reduzMovimento() ? 'controls' : 'autoplay'} loop playsinline preload="auto"></video>`
    : midiaDe(g.base, g.secao, img);

  $('#sheetProduto').innerHTML = `
    <div class="sheet-corpo">
      <div class="pd-midia">${midia}<div class="selos">${selosDe(g)}</div><button class="fechar" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      <h2 class="pd-nome">${esc(nomeTit)}</h2>
      ${copyDe(g) ? `<p class="pd-copy">${esc(copyDe(g))}</p>` : ''}
      ${g.desc ? `<p class="pd-desc">${esc(cap(g.desc))}</p>` : ''}
      ${g.categoria === 'Porções' ? '<p class="pd-desc">Acompanha o molho branco da casa.</p>' : ''}
      ${partes.join('')}
    </div>
    <div class="sheet-pe">
      ${mm ? `<p class="aviso">⏰ Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h</p>` : !aberta ? '<p class="aviso">Estamos fechados agora</p>' : falta ? `<p class="aviso">${esc(falta)}</p>` : ''}
      <div class="pd-pe">
        <div class="stepper"><button data-pdq="-1" aria-label="Menos">−</button><b>${S.pd.qtd}</b><button data-pdq="1" aria-label="Mais">+</button></div>
        <button class="btn-cta" id="pdAdd" ${mm || !aberta || falta ? 'disabled' : ''}><span>Adicionar</span><span>${fmt(p.total)}</span></button>
      </div>
    </div>`;
}
function confirmarProduto(btn) {
  const { g, meio, sabor2 } = S.pd;
  const p = precoPd();
  const obs = [];
  if (g.secao === 'pizzas' && meio && sabor2) obs.push(`Meio a meio: ${g.base} + ${p.extraNome}`);
  (g.opcoes || []).forEach((grp, i) => obs.push(`${grp.rotulo || grp.titulo}: ${S.pd.opc[i]}`));
  if (S.pd.sem.size) obs.push('Sem ' + [...S.pd.sem].join(', '));
  if (S.pd.obs.trim()) obs.push(S.pd.obs.trim());
  const antes = totais();
  addItem({
    pid: p.prodDb.id, nomeDb: p.prodDb.nome,
    titulo: g.secao === 'pizzas' && meio && sabor2 ? `Pizza ½ ${g.nome} + ½ ${p.extraNome}` : (g.secao === 'pizzas' ? 'Pizza ' + g.nome : g.nome),
    sub: p.v.tam || '', preco: p.unit, qtd: S.pd.qtd, obs: obs.join(' · '),
    secao: g.secao, img: p.v.imagem_url || g.img, meio: !!(meio && sabor2),
    origem: 'cardapio', fonte: S.pd.fonte || 'cardapio',
    // tamanho maior: "upgrade" (tocou no botão) ou "ancora" (manteve o G pré-selecionado)
    ...(S.pd.vs.length > 1 && S.pd.idx === S.pd.vs.length - 1 ? {
      motivoTamanho: S.pd.upgradeClicado ? 'upgrade' : S.pd.idxInicial === S.pd.idx ? 'ancora' : 'escolha',
      difTamanho: r2(S.pd.vs[S.pd.idx].efetivo - S.pd.vs[0].efetivo),
    } : {}),
  });
  pop(btn);
  fecharSheet('sheetProduto');
  if (!avisarFrete(antes)) toast('Adicionado ao pedido', 'ok');
  setTimeout(() => abrirCombina(g), 420);
}

// ═══════════════════════════════════════════════════════════════════════════
// "COMBINA COM ISSO" — popup logo depois de adicionar um prato
// ═══════════════════════════════════════════════════════════════════════════
const SECOES_COMBINA = new Set(['frango', 'combos', 'porcoes', 'lanches', 'caldos', 'pizzas', 'marmitex']);
function abrirCombina(g) {
  if (!SECOES_COMBINA.has(g.secao) || S.recusasCombina >= 2 || pilha.length) return;
  const noCarrinho = new Set(S.carrinho.map(i => i.pid));
  const cands = candidatosPara(g, 6).filter(r => !noCarrinho.has(r.id)).slice(0, 3);
  if (!cands.length) return;
  const [r, ...outros] = cands;
  const { base, tam } = parseNome(r.nome);
  const gg = grupoDaLinha(r);
  const frase = ehAlcool(r) ? 'Uma cerveja gelada para acompanhar?' : /batata|polenta|mandioca/i.test(r.nome) ? 'Para acompanhar o seu prato' : /arroz|salada/i.test(r.nome) ? 'Transforme em refeição completa' : 'Combina perfeitamente';
  const falta = totais().falta;
  $('#sheetCombina').innerHTML = `
    <div class="alca"></div>
    <div class="sheet-corpo" style="padding-top:12px">
      <div class="combina">
        <div class="combina-foto">${midiaDe(base, gg?.secao, r.imagem_url || gg?.img)}</div>
        <span class="combina-tag">✨ ${frase}</span>
        <h3>${esc(nomeBonito(base))}${tam ? ` <small style="font-size:16px;opacity:.6">(${esc(tam)})</small>` : ''}</h3>
        <p>Vai junto com ${esc(g.nome)}${falta > 0 && efetivo(r) >= falta ? ' — <b>e já libera o frete grátis</b>' : ''}.</p>
        <div class="combina-preco">+ ${fmt(efetivo(r))}</div>
        ${outros.length ? `<div class="combina-outros">${outros.map(o => { const po = parseNome(o.nome); const go = grupoDaLinha(o); return `<button data-combina="${o.id}"><span class="mini">${midiaDe(po.base, go?.secao, o.imagem_url || go?.img)}</span><span>${esc(nomeBonito(po.base))}${po.tam ? ` (${esc(po.tam)})` : ''}<b>+ ${fmt(efetivo(o))}</b></span></button>`; }).join('')}</div>` : ''}
      </div>
    </div>
    <div class="sheet-pe">
      <button class="btn-cta full" data-combina="${r.id}">+ Adicionar ${esc(nomeBonito(base))}</button>
      <button class="combina-nao" data-combina-nao>Não, obrigado</button>
    </div>`;
  rastrear('combina_mostrado', { produto: nomeBonito(base), valor: efetivo(r), prato: g.nome });
  abrirSheet('sheetCombina');
}

// ═══════════════════════════════════════════════════════════════════════════
// CARRINHO (sheet)
// ═══════════════════════════════════════════════════════════════════════════
function sugestoes() {
  const noCarrinho = new Set(S.carrinho.map(i => i.pid));
  const disponivel = r => r && r.disponivel !== false && !noCarrinho.has(r.id);
  const t = totais();
  const out = [];
  const push = (r, fecha) => { if (r && disponivel(r) && !out.some(o => o.r.id === r.id)) out.push({ r, fecha }); };
  const soMarmitex = S.carrinho.length > 0 && S.carrinho.every(i => i.secao === 'marmitex');
  const alcoolOk = oferecerAlcool() && !soMarmitex;
  const semAlcool = r => alcoolOk || !ehAlcool(r);
  if (t.fg > 0 && !t.gratis && t.falta <= 60) {
    S.rows.filter(r => disponivel(r) && semAlcool(r) && efetivo(r) >= t.falta && !/marmit/i.test(r.nome) && !/^(Combo)/i.test(r.nome))
      .sort((a, b) => efetivo(a) - efetivo(b)).slice(0, 3).forEach(r => push(r, true));
  }
  const peso = new Map(); const vistos = new Set();
  S.carrinho.forEach(it => {
    const g = S.grupos.find(x => x.variantes.some(v => v.id === it.pid));
    if (!g || vistos.has(g.key)) return;
    vistos.add(g.key);
    candidatosPara(g, 6).forEach((r, i) => peso.set(r.id, (peso.get(r.id) || 0) + (6 - i)));
  });
  [...peso.entries()].sort((a, b) => b[1] - a[1]).forEach(([id]) => { const r = S.porId.get(id); if (r && semAlcool(r)) push(r); });
  return out.slice(0, 6);
}
function abrirCarrinho() {
  validarCarrinho(); renderCarrinho(); abrirSheet('sheetCarrinho');
  const t = totais(); rastrear('carrinho_aberto', { valor: t.sub, falta_frete: t.falta });
}
function validarCarrinho() {
  let removidos = 0;
  S.carrinho = S.carrinho.filter(it => {
    const r = S.porId.get(it.pid);
    if (!r || r.disponivel === false) { removidos++; return false; }
    if (!it.meio) it.preco = efetivo(r);
    return true;
  });
  if (removidos) { salvarCarrinho(); renderBarra(); toast(`${removidos} item${removidos > 1 ? 's' : ''} ficou indisponível e saiu do pedido`, 'erro'); }
}
function sugCardHTML({ r, fecha }) {
  const { base, tam } = parseNome(r.nome);
  const gg = grupoDaLinha(r);
  return `<div class="sug-card">
    <div class="ft">${midiaDe(base, gg?.secao, r.imagem_url || gg?.img)}</div>
    <strong>${esc(nomeBonito(base))}${tam ? ` (${esc(tam)})` : ''}</strong>
    ${fecha ? '<span class="libera">✓ Libera o frete</span>' : ''}
    <div class="pe"><b>${fmt(efetivo(r))}</b><button class="btn-mais" data-sug="${r.id}" ${fecha ? 'data-fecha' : ''} aria-label="Adicionar ${esc(nomeBonito(base))}">${ICON.plus}</button></div>
  </div>`;
}
function renderCarrinho() {
  const el = $('#sheetCarrinho');
  const qtd = S.carrinho.reduce((s, i) => s + i.qtd, 0);
  if (!qtd) {
    el.innerHTML = `<div class="alca"></div>
      <div class="sheet-cab"><h2>Seu pedido</h2><button class="fechar" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      <div class="sheet-corpo"><div class="vazio"><img src="assets/mascote.png" alt=""><p>Seu pedido tá vazio.<br>Que tal começar pelo frango?</p><button class="btn-cta" data-fechar>Ver cardápio</button></div></div>`;
    return;
  }
  const t = totais();
  const min = num('pedido_minimo');
  const pct = t.fg > 0 ? Math.min(100, (t.sub / t.fg) * 100) : 0;
  const sug = sugestoes();
  const fecha = sug.filter(s => s.fecha), resto = sug.filter(s => !s.fecha);
  el.innerHTML = `
    <div class="alca"></div>
    <div class="sheet-cab"><h2>Seu pedido</h2><button class="fechar" data-fechar aria-label="Fechar">${ICON.x}</button></div>
    <div class="sheet-corpo">
      ${t.fg > 0 ? `<div class="meta${t.gratis ? ' ok' : ''}"><p>${t.gratis ? '🎉 <b>Frete grátis</b> garantido no delivery!' : `🛵 Faltam <b>${fmt(t.falta)}</b> pro <b>frete grátis</b>`}</p><div class="meta-barra"><i style="width:${pct}%"></i></div></div>` : ''}
      ${fecha.length ? `<div class="sug" style="margin:0 0 16px"><h4>⚡ Um destes e a entrega sai de graça</h4><div class="sug-lista">${fecha.map(sugCardHTML).join('')}</div></div>` : ''}
      <div class="itens">${S.carrinho.map(it => `
        <div class="item">
          <div class="mini">${midiaDe(it.titulo, it.secao, it.img)}</div>
          <div class="item-txt"><strong>${esc(it.titulo)}</strong>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}${it.obs ? `<small>${esc(it.obs)}</small>` : ''}</div>
          <div class="item-lado"><b>${fmt(it.preco * it.qtd)}</b>
            <div class="stepper"><button data-q="-1" data-k="${esc(it.k)}" aria-label="Menos">${it.qtd === 1 ? '🗑' : '−'}</button><b>${it.qtd}</b><button data-q="1" data-k="${esc(it.k)}" aria-label="Mais">+</button></div>
          </div>
        </div>`).join('')}
      </div>
      ${resto.length ? `<div class="sug"><h4>✨ Vai bem com o seu pedido</h4><div class="sug-lista">${resto.map(sugCardHTML).join('')}</div></div>` : ''}
    </div>
    <div class="sheet-pe">
      <div class="totais">
        <div><span>Subtotal</span><span>${fmt(t.sub)}</span></div>
        <div><span>Entrega <small>(delivery)</small></span><span class="${t.gratis ? 'gratis' : ''}">${t.gratis ? 'Grátis' : fmt(t.taxa)}</span></div>
        <div class="tot"><span>Total</span><span>${fmt(t.total)}</span></div>
      </div>
      ${t.sub < min ? `<p class="aviso">Pedido mínimo de ${fmt(min)}. Faltam ${fmt(min - t.sub)}.</p>` : ''}
      ${!lojaAberta() ? '<p class="aviso">Estamos fechados agora. Volta mais tarde!</p>' : ''}
      <button class="btn-cta full" id="btnContinuar" ${t.sub < min || !lojaAberta() ? 'disabled' : ''}>Finalizar pedido · ${fmt(t.total)}</button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECKOUT — página única com oferta rápida
// ═══════════════════════════════════════════════════════════════════════════
const mascaraTel = v => { const d = soDigitos(v).slice(0, 11); if (d.length <= 2) return d; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };

// Oferta rápida: o melhor complemento barato que ainda não está no pedido
function escolherBump() {
  const soMarmitex = S.carrinho.length && S.carrinho.every(i => i.secao === 'marmitex');
  const temBebida = S.carrinho.some(i => i.secao === 'bebidas');
  const cands = sugestoes().map(s => s.r).filter(r => efetivo(r) <= 25 && !/marmit/i.test(r.nome));
  const bebida = !temBebida && cands.find(r => grupoDaLinha(r)?.secao === 'bebidas' && (!soMarmitex || !ehAlcool(r)));
  return bebida || cands[0] || null;
}

function abrirCheckout() {
  validarCarrinho();
  if (!S.carrinho.length) return;
  const cli = ls('chopp_cliente', {});
  const bump = escolherBump();
  S.ck = { tipo: cli.tipo || 'delivery', rua: cli.rua || '', bairro: cli.bairro || '', comp: cli.comp || '', nome: cli.nome || '', tel: cli.tel || '', pag: cli.pag || '', troco: '', obs: '', enviando: false, bumpPid: bump?.id || null, bumpOn: false };
  renderCheckout();
  abrirSheet('sheetCheckout');
  $('#sheetCheckout .sheet-corpo').scrollTop = 0;
  rastrear('checkout_aberto', { valor: totais().sub });
  if (bump) rastrear('oferta_mostrada', { produto: nomeBonito(parseNome(bump.nome).base), valor: efetivo(bump) });
}

function lerCampos() {
  const ck = S.ck; if (!ck || !$('#ckNome')) return;
  ck.nome = $('#ckNome').value.trim(); ck.tel = soDigitos($('#ckTel').value);
  if ($('#ckRua')) { ck.rua = $('#ckRua').value.trim(); ck.bairro = $('#ckBairro').value.trim(); ck.comp = $('#ckComp').value.trim(); }
  ck.obs = $('#ckObs')?.value.trim() || '';
  if ($('#ckTroco')) ck.troco = $('#ckTroco').value.trim();
}

function renderCheckout() {
  const ck = S.ck, t = totais(ck.tipo);
  const bump = ck.bumpPid && S.porId.get(ck.bumpPid);
  const bumpInfo = bump && parseNome(bump.nome);
  const pags = [
    { k: 'pix', ico: '⚡', t: 'PIX' },
    { k: 'dinheiro', ico: '💵', t: 'Dinheiro' },
    { k: 'cartao_credito', ico: '💳', t: 'Crédito' },
    { k: 'cartao_debito', ico: '💳', t: 'Débito' },
  ];
  $('#sheetCheckout').innerHTML = `
    <div class="alca"></div>
    <div class="sheet-cab"><h2>Finalizar pedido</h2><button class="fechar" data-fechar aria-label="Fechar">${ICON.x}</button></div>
    <div class="sheet-corpo">
      <div class="ck-sec">
        <h3><i>1</i> Seus dados</h3>
        <div class="campos">
          <div><label class="rot" for="ckNome">Seu nome</label><input class="campo" id="ckNome" autocomplete="name" placeholder="Como te chamamos?" value="${esc(ck.nome)}"></div>
          <div><label class="rot" for="ckTel">WhatsApp</label><input class="campo" id="ckTel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(44) 99999-9999" value="${esc(mascaraTel(ck.tel))}"></div>
        </div>
      </div>
      <div class="ck-sec">
        <h3><i>2</i> Como receber</h3>
        <div class="escolhas">
          <button class="escolha${ck.tipo === 'delivery' ? ' on' : ''}" data-tipo="delivery"><span class="ico">🛵</span><strong>Delivery</strong><small>${t.gratis ? 'Frete grátis' : fmt(num('taxa_entrega'))} · ${C.DEFAULTS.tempo_entrega}</small></button>
          <button class="escolha${ck.tipo === 'retirada' ? ' on' : ''}" data-tipo="retirada"><span class="ico">🛍️</span><strong>Retirar</strong><small>Sem taxa · ${C.DEFAULTS.tempo_retirada}</small></button>
        </div>
        ${ck.tipo === 'delivery' ? `
        <div class="campos" style="margin-top:12px">
          <div><label class="rot" for="ckRua">Rua e número</label><input class="campo" id="ckRua" autocomplete="street-address" placeholder="Ex.: Av. Paraná, 1234" value="${esc(ck.rua)}"></div>
          <div class="dupla">
            <div><label class="rot" for="ckBairro">Bairro</label><input class="campo" id="ckBairro" placeholder="Bairro" value="${esc(ck.bairro)}"></div>
            <div><label class="rot" for="ckComp">Compl.</label><input class="campo" id="ckComp" placeholder="Ap, casa" value="${esc(ck.comp)}"></div>
          </div>
        </div>` : `<p class="pd-desc" style="margin-top:12px">📍 Retirada em <b>${esc(valido(S.info.endereco) ? S.info.endereco : 'Choppatinhas, Umuarama-PR')}</b></p>`}
      </div>
      ${bump && (!S.carrinho.some(i => i.pid === bump.id) || ck.bumpOn) ? `
      <div class="ck-sec" style="padding:12px">
        <button class="bump${ck.bumpOn ? ' on' : ''}" data-bump>
          <span class="caixa"></span>
          <span class="mini">${midiaDe(bumpInfo.base, grupoDaLinha(bump)?.secao, bump.imagem_url || grupoDaLinha(bump)?.img)}</span>
          <span class="bump-txt"><em>Oferta rápida · + ${fmt(efetivo(bump))}</em><strong>${esc(nomeBonito(bumpInfo.base))}${bumpInfo.tam ? ` (${esc(bumpInfo.tam)})` : ''}</strong><small>${ck.bumpOn ? 'Adicionado ao pedido ✓' : ck.tipo === 'delivery' && t.falta > 0 && efetivo(bump) >= t.falta ? 'Inclua e a <b>entrega sai de graça</b>' : 'Toque pra incluir no pedido'}</small></span>
        </button>
      </div>` : ''}
      <div class="ck-sec">
        <h3><i>3</i> Pagamento</h3>
        <div class="pags">${pags.map(p => `<button class="pag${ck.pag === p.k ? ' on' : ''}" data-pag="${p.k}"><span>${p.ico}</span>${p.t}</button>`).join('')}</div>
        ${ck.pag === 'dinheiro' ? `<div style="margin-top:10px"><label class="rot" for="ckTroco">Troco para quanto? <small>(vazio se não precisar)</small></label><input class="campo" id="ckTroco" inputmode="decimal" placeholder="Ex.: 100" value="${esc(ck.troco)}"></div>` : ''}
        ${ck.pag && ck.pag !== 'pix' ? '<p class="pd-desc" style="margin-top:8px;font-size:12.5px">Pagamento na entrega / retirada.</p>' : ''}
      </div>
      <div class="ck-sec">
        <h3><i>4</i> Resumo</h3>
        <ul class="resumo-lista">${S.carrinho.map(i => `<li><span>${i.qtd}x ${esc(i.titulo)}${i.sub ? ` (${esc(i.sub)})` : ''}</span><span>${fmt(i.preco * i.qtd)}</span></li>`).join('')}</ul>
        <textarea class="campo" id="ckObs" rows="2" maxlength="200" placeholder="Observação pro pedido (opcional)" style="margin-top:12px">${esc(ck.obs)}</textarea>
      </div>
    </div>
    <div class="sheet-pe">
      <div class="totais">
        <div><span>Subtotal</span><span>${fmt(t.sub)}</span></div>
        <div><span>${ck.tipo === 'retirada' ? 'Retirada' : 'Entrega'}</span><span class="${t.taxa === 0 ? 'gratis' : ''}">${t.taxa === 0 ? 'Grátis' : fmt(t.taxa)}</span></div>
        <div class="tot"><span>Total</span><span>${fmt(t.total)}</span></div>
      </div>
      <button class="btn-cta full verde" id="ckFinalizar" ${ck.enviando ? 'disabled' : ''}>${ck.enviando ? 'Enviando pedido…' : `Confirmar pedido · ${fmt(t.total)}`}</button>
    </div>`;
}

function validarCheckout() {
  lerCampos();
  const ck = S.ck; const erros = [];
  if (ck.nome.length < 2) erros.push('#ckNome');
  if (ck.tel.length < 10) erros.push('#ckTel');
  if (ck.tipo === 'delivery') { if (ck.rua.length < 4) erros.push('#ckRua'); if (ck.bairro.length < 2) erros.push('#ckBairro'); }
  $$('.campo.erro').forEach(e => e.classList.remove('erro'));
  erros.forEach(s => $(s)?.classList.add('erro'));
  if (erros.length) { $(erros[0])?.scrollIntoView({ block: 'center', behavior: 'smooth' }); $(erros[0])?.focus({ preventScroll: true }); toast('Confere os campos marcados', 'erro'); return false; }
  if (!ck.pag) { toast('Escolha a forma de pagamento', 'erro'); $('.pags')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; }
  return true;
}

function telefoneBanco(d) { d = soDigitos(d); return d.length <= 11 ? '55' + d : d; }

async function finalizar() {
  const ck = S.ck;
  if (ck.enviando || !validarCheckout()) return;
  ck.enviando = true; renderCheckout();
  try {
    const { data: st } = await sb.from('info_restaurante').select('valor').eq('chave', 'loja_aberta').maybeSingle();
    if (st && String(st.valor) !== 'true') { S.info.loja_aberta = st.valor; renderPilulas(); throw new Error('FECHADA'); }
    if (S.carrinho.some(i => i.secao === 'marmitex') && !marmitexAgora()) throw new Error('MARMITEX');

    const t = totais(ck.tipo);
    const tel = telefoneBanco(ck.tel);
    const endereco = ck.tipo === 'delivery' ? `${ck.rua}${ck.comp ? ', ' + ck.comp : ''} - ${ck.bairro}` : null;

    let { data: cli } = await sb.from('clientes').select('id, total_pedidos, total_gasto, primeiro_pedido').eq('telefone', tel).maybeSingle();
    if (cli) {
      const patch = { nome: ck.nome }; if (endereco) patch.endereco = endereco;
      await sb.from('clientes').update(patch).eq('id', cli.id);
    } else {
      const r = await sb.from('clientes').insert({ nome: ck.nome, telefone: tel, endereco, total_pedidos: 0, total_gasto: 0 }).select('id, total_pedidos, total_gasto, primeiro_pedido').single();
      if (r.error) throw r.error; cli = r.data;
    }

    const obsPedido = [ck.obs, ck.pag === 'dinheiro' && ck.troco ? `Troco para R$ ${ck.troco}` : ''].filter(Boolean).join(' · ') || null;
    const troco = parseFloat(String(ck.troco).replace(',', '.'));
    const base = {
      cliente_id: cli.id, status: 'pendente', tipo_entrega: ck.tipo, endereco_entrega: endereco,
      forma_pagamento: ck.pag, troco_para: ck.pag === 'dinheiro' && troco > 0 ? troco : null,
      subtotal: t.sub, taxa_entrega: t.taxa, desconto: 0, total: t.total, observacao: obsPedido,
    };
    let r = await sb.from('pedidos').insert({ ...base, canal: C.CANAL }).select('id, numero_pedido').single();
    if (r.error && /canal/i.test(r.error.message)) r = await sb.from('pedidos').insert(base).select('id, numero_pedido').single();
    if (r.error) throw r.error;
    const pedido = r.data;

    const itens = S.carrinho.map(i => ({
      pedido_id: pedido.id, produto_id: i.pid, nome_produto: i.nomeDb, preco_unitario: i.preco,
      quantidade: i.qtd, observacao: i.obs || null, total: r2(i.preco * i.qtd),
    }));
    const ri = await sb.from('itens_pedido').insert(itens);
    if (ri.error) throw ri.error;

    const agora = new Date().toISOString();
    sb.from('clientes').update({
      total_pedidos: (cli.total_pedidos || 0) + 1, total_gasto: r2((Number(cli.total_gasto) || 0) + t.total),
      ultimo_pedido: agora, data_ultima_interacao: agora, ...(cli.primeiro_pedido ? {} : { primeiro_pedido: agora }),
    }).eq('id', cli.id).then(() => {});

    lsSet('chopp_cliente', { nome: ck.nome, tel: ck.tel, rua: ck.rua, bairro: ck.bairro, comp: ck.comp, tipo: ck.tipo, pag: ck.pag });
    const ult = { id: pedido.id, numero: pedido.numero_pedido, total: t.total, sub: t.sub, taxa: t.taxa, tipo: ck.tipo, pag: ck.pag, endereco, nome: ck.nome, criado: Date.now(), status: 'pendente', itens: S.carrinho.map(i => ({ ...i })) };
    lsSet('chopp_ultimo', ult);
    lsSet('chopp_repetir', { itens: S.carrinho.map(i => ({ ...i })) });
    const porOrigem = {}, porFonte = {};
    let ganhoTamanho = 0;
    S.carrinho.forEach(i => {
      const v = r2(i.preco * i.qtd);
      porOrigem[i.origem || 'cardapio'] = r2((porOrigem[i.origem || 'cardapio'] || 0) + v);
      porFonte[i.fonte || 'cardapio'] = r2((porFonte[i.fonte || 'cardapio'] || 0) + v);
      if (i.difTamanho && i.motivoTamanho !== 'escolha') ganhoTamanho = r2(ganhoTamanho + i.difTamanho * i.qtd);
    });
    const receitaSug = r2(['combina', 'libera_frete', 'vai_bem', 'oferta_rapida', 'latas6'].reduce((s2, o) => s2 + (porOrigem[o] || 0), 0));
    rastrear('pedido_feito', {
      pedido_id: pedido.id, valor: t.total, subtotal: t.sub, taxa: t.taxa, tipo: ck.tipo, pagamento: ck.pag,
      frete_gratis: ck.tipo === 'delivery' && t.taxa === 0, itens: S.carrinho.reduce((s2, i) => s2 + i.qtd, 0),
      por_origem: porOrigem, por_fonte: porFonte, receita_sugestoes: receitaSug, ganho_tamanho: ganhoTamanho,
    });
    enviarEventos();
    S.carrinho = []; salvarCarrinho();

    fecharSheet('sheetCheckout', true); fecharSheet('sheetCarrinho', true);
    history.replaceState(null, '');
    renderBarra(); renderMenu(); renderRetorno();
    abrirStatus(ult, true);
    confete();
  } catch (e) {
    console.error(e);
    ck.enviando = false; renderCheckout();
    if (e.message === 'FECHADA') toast('A loja acabou de fechar. Tenta mais tarde!', 'erro');
    else if (e.message === 'MARMITEX') toast(`Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h.`, 'erro');
    else toast('Não conseguimos enviar agora. Confere a internet e tenta de novo.', 'erro');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACOMPANHAR PEDIDO (igual v1)
// ═══════════════════════════════════════════════════════════════════════════
function msgWhatsApp(u) {
  const sep = '━━━━━━━━━━━━━━━';
  const linhas = u.itens.map(i => `${i.qtd}x ${i.titulo}${i.sub ? ` (${i.sub})` : ''}  ${fmt(i.preco * i.qtd)}${i.obs ? `\n   _${i.obs}_` : ''}`).join('\n');
  const pagNome = { pix: 'PIX', dinheiro: 'Dinheiro', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito' }[u.pag] || u.pag;
  return `Olá! Fiz um pedido pelo cardápio 🍻\n\n*Pedido #${String(u.numero).padStart(3, '0')}*\n${sep}\n${linhas}\n${sep}\nSubtotal: ${fmt(u.sub)}\n${u.taxa > 0 ? `Entrega: ${fmt(u.taxa)}\n` : ''}*Total: ${fmt(u.total)}*\n\n${u.tipo === 'delivery' ? `📍 *Entrega em:*\n${u.endereco}` : '🛍️ *Retirada no local*'}\n\n💳 *Pagamento:* ${pagNome}${u.pag === 'pix' ? '\n\nSegue o comprovante 👇' : ''}`;
}
async function abrirStatus(u, novo = false) {
  renderStatusPedido(u, novo);
  abrirSheet('sheetStatus');
  if (!novo) {
    const { data } = await sb.from('pedidos').select('status').eq('id', u.id).maybeSingle();
    if (data) { u.status = data.status; lsSet('chopp_ultimo', u); renderStatusPedido(u, false); }
  }
  if (S.canalPedido) sb.removeChannel(S.canalPedido);
  S.canalPedido = sb.channel('pedido-' + u.id)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${u.id}` }, ({ new: n }) => {
      const antes = etapaDe(u.status);
      u.status = n.status; lsSet('chopp_ultimo', u);
      renderStatusPedido(u, false); renderRetorno();
      if (etapaDe(n.status) > antes) { toast(ETAPAS[u.tipo][etapaDe(n.status)]?.t + '!', 'ok'); navigator.vibrate?.(120); }
    })
    .subscribe();
}
function renderStatusPedido(u, novo) {
  const et = etapaDe(u.status);
  const etapas = ETAPAS[u.tipo || 'delivery'];
  const wa = soDigitos(S.info.whatsapp);
  const chave = valido(S.info.chave_pix) ? S.info.chave_pix : '';
  const linkWa = wa.length >= 10 ? `https://wa.me/${wa.length <= 11 ? '55' + wa : wa}?text=${encodeURIComponent(msgWhatsApp(u))}` : '';
  $('#sheetStatus').innerHTML = `
    <div class="alca"></div>
    <div class="sheet-cab"><h2>${novo ? 'Pedido confirmado' : 'Seu pedido'}</h2><button class="fechar" data-fechar aria-label="Fechar">${ICON.x}</button></div>
    <div class="sheet-corpo">
      <div class="ok-topo">
        <div class="ok-selo">${et < 0 ? '😕' : et >= 3 ? '✅' : '🍻'}</div>
        <h3>${et < 0 ? 'Pedido cancelado' : novo ? 'Pedido recebido!' : etapas[Math.max(0, et)].t}</h3>
        <p>${et < 0 ? 'Fale com a gente no WhatsApp se tiver dúvida.' : u.tipo === 'delivery' ? `Previsão: ${C.DEFAULTS.tempo_entrega}` : `Fica pronto em ${C.DEFAULTS.tempo_retirada}`}</p>
        <span class="ok-num">#${String(u.numero).padStart(3, '0')} · ${fmt(u.total)}</span>
      </div>
      ${et < 0 ? '<div class="cancelado">Este pedido foi cancelado pela casa.</div>' : `
      <ol class="tempo">${etapas.map((e, i) => `<li class="${i < et || et === 3 ? 'feito' : i === et ? 'agora' : ''}"><span class="bola">${e.ico}</span><span><strong>${e.t}</strong><small>${e.d}</small></span></li>`).join('')}</ol>`}
      ${u.pag === 'pix' && et >= 0 && et < 3 ? `
      <div class="pix">
        <h4>⚡ Pagamento via PIX</h4>
        ${chave ? `<p>Copie a chave, pague e mande o comprovante no WhatsApp.</p><div class="pix-chave"><code id="pixChave">${esc(chave)}</code><button data-copiar="${esc(chave)}">Copiar</button></div>` : '<p>A casa te manda a chave PIX no WhatsApp em instantes.</p>'}
        <p class="pix-valor">Valor: <b>${fmt(u.total)}</b></p>
      </div>` : ''}
    </div>
    <div class="sheet-pe" style="display:grid;gap:8px">
      ${linkWa ? `<a class="btn-cta full verde" href="${linkWa}" target="_blank" rel="noopener">${u.pag === 'pix' ? 'Enviar comprovante no WhatsApp' : 'Falar com a casa no WhatsApp'}</a>` : ''}
      <button class="btn-ghost" data-fechar>Voltar ao cardápio</button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EFEITOS
// ═══════════════════════════════════════════════════════════════════════════
let toastT;
function toast(msg, tipo = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast on ' + tipo;
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
}
function pop(el) { if (!el?.classList) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function confete() {
  if (reduzMovimento()) return;
  const cores = ['#E6A11A', '#B8141F', '#2B1B12', '#FFFBF4', '#1F8A4C'];
  for (let i = 0; i < 42; i++) {
    const c = document.createElement('i'); c.className = 'confete';
    c.style.background = cores[i % cores.length];
    c.style.left = (innerWidth / 2) + 'px'; c.style.top = (innerHeight * .45) + 'px';
    document.body.appendChild(c);
    const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 220;
    c.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + 260}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.2,.8,.4,1)' }).onfinish = () => c.remove();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN (igual v1 + vídeo por produto + foto/vídeo aplicados a todos os tamanhos)
// ═══════════════════════════════════════════════════════════════════════════
const ADM = { aba: 'produtos', busca: '', edit: null };
function admAbrirSenha() {
  if (sessionStorage.getItem('chopp_adm') === '1') return admAbrir();
  $('#admSenha').hidden = false; $('#admErro').hidden = true; $('#admSenhaInput').value = '';
  setTimeout(() => $('#admSenhaInput').focus(), 50);
}
async function admVerificar(e) {
  e.preventDefault();
  const senha = $('#admSenhaInput').value.trim();
  const { data } = await sb.from('info_restaurante').select('valor').eq('chave', 'senha_admin').maybeSingle();
  if (senha && data?.valor && senha === String(data.valor)) {
    try { sessionStorage.setItem('chopp_adm', '1'); localStorage.setItem('chopp_equipe', '1'); } catch { /* ok */ }
    $('#admSenha').hidden = true; admAbrir();
  } else { $('#admErro').hidden = false; $('#admSenhaInput').select(); navigator.vibrate?.(80); }
}
function admAbrir() { $('#adm').hidden = false; document.body.classList.add('travado'); admRender(); }
function admFechar() { $('#adm').hidden = true; ADM.edit = null; if (!pilha.length) document.body.classList.remove('travado'); }
function admRender() {
  const painel = valido(S.info.painel_url) ? S.info.painel_url : '';
  $('#adm').innerHTML = `
    <div class="adm-topo">
      <div class="adm-topo-in">
        <img src="assets/mascote.png" alt="" width="34" height="34" style="border-radius:50%">
        <h2>Painel da casa</h2>
        ${painel ? `<a class="btn-ghost" style="height:38px;color:#fff;border-color:rgba(255,255,255,.3)" href="${esc(painel)}" target="_blank" rel="noopener">Pedidos ↗</a>` : ''}
        <button class="fechar" data-adm-fechar aria-label="Fechar">${ICON.x}</button>
      </div>
      <div class="adm-abas">
        <button class="adm-aba${ADM.aba === 'produtos' ? ' on' : ''}" data-adm-aba="produtos">Produtos</button>
        <button class="adm-aba${ADM.aba === 'loja' ? ' on' : ''}" data-adm-aba="loja">Loja</button>
        <button class="adm-aba${ADM.aba === 'resultados' ? ' on' : ''}" data-adm-aba="resultados">Resultados</button>
      </div>
    </div>
    <div class="adm-corpo">${ADM.aba === 'produtos' ? admProdutosHTML() : ADM.aba === 'loja' ? admLojaHTML() : '<div id="admRes"><p class="pd-desc">Carregando resultados…</p></div>'}</div>
    ${ADM.edit ? admEditHTML() : ''}`;
  if (ADM.aba === 'resultados') carregarResultados();
}

// ─── RESULTADOS (últimos 30 dias) ───────────────────────────────────────────
async function carregarResultados() {
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const [ped, ev] = await Promise.all([
    sb.from('pedidos').select('total, subtotal, taxa_entrega, tipo_entrega, canal, status').gte('created_at', desde).neq('status', 'cancelado').limit(5000),
    sb.from('eventos_cardapio').select('sessao, evento, produto, valor, dados').gte('created_at', desde).limit(20000),
  ]);
  const box = $('#admRes'); if (!box) return;
  const media = l => l.length ? r2(l.reduce((a, p) => a + Number(p.total || 0), 0) / l.length) : 0;
  const pedidos = ped.data || [];
  const doCard = pedidos.filter(p => p.canal === C.CANAL), outros = pedidos.filter(p => p.canal !== C.CANAL);
  const mC = media(doCard), mO = media(outros);
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const cartao = (rot, n, m, destaque) => `<div class="res-card${destaque ? ' on' : ''}"><small>${rot}</small><strong>${n ? fmt(m) : '—'}</strong><span>${n} pedido${n === 1 ? '' : 's'}</span></div>`;
  let html = `
    <h3 class="res-tit">Ticket médio · últimos 30 dias</h3>
    <div class="res-grid">${cartao('Cardápio digital', doCard.length, mC, true)}${cartao('WhatsApp e outros', outros.length, mO)}</div>
    ${doCard.length && outros.length ? `<p class="res-nota">${mC >= mO ? 'O cardápio está <b>' + fmt(r2(mC - mO)) + ' acima</b>' : 'O cardápio está <b>' + fmt(r2(mO - mC)) + ' abaixo</b>'} dos outros canais por pedido.</p>` : ''}
    ${doCard.length < 20 ? '<p class="res-nota">Ainda são poucos pedidos pelo cardápio — os números ficam confiáveis a partir de uns 30.</p>' : ''}`;

  if (ev.error) {
    html += `<div class="res-aviso"><strong>Medição das sugestões ainda não está ligada.</strong><p>Abra o Supabase → <b>SQL Editor</b> → cole o arquivo <code>supabase/002_eventos_cardapio.sql</code> → <b>Run</b>. Depois disso o cardápio começa a registrar sozinho.</p></div>`;
  } else {
    const E = ev.data || [];
    const conta = nome => E.filter(e => e.evento === nome).length;
    const feitos = E.filter(e => e.evento === 'pedido_feito');
    const somaOrigem = o => r2(feitos.reduce((a, e) => a + Number(e.dados?.por_origem?.[o] || 0), 0));
    const somaFonte = o => r2(feitos.reduce((a, e) => a + Number(e.dados?.por_fonte?.[o] || 0), 0));
    const aceitosOrigem = o => E.filter(e => e.evento === 'item_adicionado' && e.dados?.origem === o).length;
    const visitas = new Set(E.filter(e => e.evento === 'visita').map(e => e.sessao)).size;
    const receitaCard = r2(feitos.reduce((a, e) => a + Number(e.valor || 0), 0));
    const receitaSug = r2(feitos.reduce((a, e) => a + Number(e.dados?.receita_sugestoes || 0), 0));
    const ganhoTam = r2(feitos.reduce((a, e) => a + Number(e.dados?.ganho_tamanho || 0), 0));
    const comSug = feitos.filter(e => Number(e.dados?.receita_sugestoes || 0) > 0), semSug = feitos.filter(e => !(Number(e.dados?.receita_sugestoes || 0) > 0));
    const mediaEv = l => l.length ? fmt(r2(l.reduce((a, e) => a + Number(e.valor || 0), 0) / l.length)) : '—';
    const deliv = feitos.filter(e => e.dados?.tipo === 'delivery');
    const linha = (nome, mostrado, aceito, receita, nota = '') => `<tr><td>${nome}${nota ? `<small>${nota}</small>` : ''}</td><td>${mostrado ?? '—'}</td><td>${aceito}</td><td>${mostrado ? pct(aceito, mostrado) : '—'}</td><td><b>${fmt(receita)}</b></td></tr>`;
    html += `
      <h3 class="res-tit">Funil</h3>
      <div class="res-grid tres">
        <div class="res-card"><small>Visitas</small><strong>${visitas}</strong></div>
        <div class="res-card"><small>Pedidos</small><strong>${feitos.length}</strong></div>
        <div class="res-card"><small>Conversão</small><strong>${pct(feitos.length, visitas)}</strong></div>
      </div>
      <h3 class="res-tit">Quanto as sugestões renderam</h3>
      <div class="res-grid">
        <div class="res-card on"><small>Receita vinda de sugestões</small><strong>${fmt(r2(receitaSug + ganhoTam))}</strong><span>${pct(r2(receitaSug + ganhoTam), receitaCard)} do faturamento do cardápio</span></div>
        <div class="res-card"><small>Ticket com sugestão aceita</small><strong>${mediaEv(comSug)}</strong><span>sem sugestão: ${mediaEv(semSug)}</span></div>
      </div>
      <div class="res-tab-wrap"><table class="res-tab">
        <thead><tr><th>Alavanca</th><th>Mostrado</th><th>Aceito</th><th>Taxa</th><th>Receita*</th></tr></thead>
        <tbody>
          ${linha('Popup “combina”', conta('combina_mostrado'), conta('combina_aceito'), somaOrigem('combina'))}
          ${linha('Oferta rápida', conta('oferta_mostrada'), conta('oferta_aceita'), somaOrigem('oferta_rapida'))}
          ${linha('“Libera o frete”', null, aceitosOrigem('libera_frete'), somaOrigem('libera_frete'), 'no carrinho')}
          ${linha('“Vai bem com o pedido”', null, aceitosOrigem('vai_bem'), somaOrigem('vai_bem'), 'no carrinho')}
          ${linha('Tamanho maior', null, conta('upgrade_tamanho'), ganhoTam, 'botão + G pré-marcado')}
          ${linha('+6 latas', null, aceitosOrigem('latas6'), somaOrigem('latas6'))}
          ${linha('Vídeo em destaque', null, conta('destaque_clique'), somaFonte('destaque'), 'cliques → itens vindos dele')}
          ${linha('Os mais pedidos', null, E.filter(e => e.evento === 'produto_aberto' && e.dados?.fonte === 'mais_pedidos').length, somaFonte('mais_pedidos'))}
        </tbody>
      </table></div>
      <p class="res-nota">* Receita = valor desses itens em pedidos que foram de fato enviados. Frete grátis em ${pct(deliv.filter(e => e.dados?.frete_gratis).length, deliv.length)} dos deliveries.</p>`;
  }
  html += `<div class="adm-tg" style="margin-top:18px"><span><strong>Este aparelho é da equipe</strong><small>Ligado = o que você faz aqui não entra nas métricas (liga sozinho ao entrar no painel).</small></span><button class="sw${aparelhoEquipe() ? ' on' : ''}" data-adm-equipe></button></div>`;
  box.innerHTML = html;
}
function admProdutosHTML() {
  const termo = semAcento(ADM.busca);
  const rows = S.rows.filter(r => !termo || semAcento(r.nome + ' ' + r.categoria).includes(termo));
  const cats = [...new Set(S.rows.map(r => r.categoria || 'Outros'))];
  const palco = grupoDoPalco();
  return `
    <div class="adm-barra">
      <input class="campo" id="admBusca" placeholder="Buscar produto…" value="${esc(ADM.busca)}">
      <button class="btn-cta sm" data-adm-novo>＋ Novo produto</button>
    </div>
    <p class="adm-dica">🎬 <b>Vídeo no topo:</b> edite o produto (✎) e envie um vídeo. Ele vira o destaque do cardápio. ${palco?.video ? `Hoje: <b>${esc(palco.nome)}</b>.` : 'Nenhum vídeo ainda: o topo mostra a foto do mais pedido.'}</p>
    <p class="pd-desc" style="margin:10px 0 14px;font-size:12.5px">⭐ = destaque · o interruptor liga/desliga o produto na hora.</p>
    ${cats.map(cat => {
      const lista = rows.filter(r => (r.categoria || 'Outros') === cat).sort((a, b) => a.nome.localeCompare(b.nome));
      if (!lista.length) return '';
      return `<div class="adm-grupo"><h3>${esc(cat)} · ${lista.length}</h3>${lista.map(r => `
        <div class="adm-linha${r.disponivel === false ? ' off' : ''}">
          <div class="mini">${midiaDe(r.nome, cat === 'Bebidas' ? 'bebidas' : cat === 'Lanches' ? 'lanches' : '', r.imagem_url)}</div>
          <div class="adm-info"><strong>${esc(r.nome)}</strong><small>${Number(r.preco_promocional) > 0 && Number(r.preco_promocional) < Number(r.preco) ? `<s>${fmt(r.preco)}</s>${fmt(r.preco_promocional)}` : fmt(r.preco)}</small>${r.video_url ? '<span class="tem-video">🎬 vídeo</span>' : ''}</div>
          <div class="adm-acoes">
            <button class="adm-ico star${r.destaque ? ' on' : ''}" data-adm-star="${r.id}" aria-label="Destaque">${r.destaque ? '⭐' : '☆'}</button>
            <button class="sw${r.disponivel !== false ? ' on' : ''}" data-adm-disp="${r.id}" aria-label="Disponível"></button>
            <button class="adm-ico" data-adm-edit="${r.id}" aria-label="Editar">✎</button>
          </div>
        </div>`).join('')}</div>`;
    }).join('') || '<p class="pd-desc">Nenhum produto encontrado.</p>'}`;
}
function admEditHTML() {
  const r = ADM.edit;
  const cats = [...new Set(S.rows.map(x => x.categoria).filter(Boolean))];
  const prev = r._preview || r.imagem_url;
  const prevV = r._previewV || r.video_url;
  const irmaos = r.nome ? S.rows.filter(x => x.id !== r.id && x.categoria === r.categoria && parseNome(x.nome).base === parseNome(r.nome).base).length : 0;
  return `
    <div class="veu on" style="z-index:285" data-adm-cancelar></div>
    <section class="sheet on" style="z-index:290" role="dialog" aria-modal="true">
      <div class="alca"></div>
      <div class="sheet-cab"><h2>${r.id ? 'Editar produto' : 'Novo produto'}</h2><button class="fechar" data-adm-cancelar aria-label="Fechar">${ICON.x}</button></div>
      <div class="sheet-corpo">
        <form class="adm-form" id="admForm">
          <div class="adm-midia">
            <div class="adm-midia-prev">${prev ? `<img src="${esc(prev)}" alt="">` : window.ChoppArt.svg(r.nome || '', '')}</div>
            <div style="display:grid;gap:6px">
              <label class="btn-ghost" style="height:40px">📷 ${prev ? 'Trocar foto' : 'Enviar foto'}<input type="file" id="admFoto" accept="image/*" hidden></label>
              ${prev ? '<button type="button" class="btn-ghost adm-perigo" style="height:34px;font-size:13px" data-adm-semfoto>Remover foto</button>' : ''}
            </div>
          </div>
          <div class="adm-midia">
            <div class="adm-midia-prev">${prevV ? `<video src="${esc(prevV)}" muted autoplay loop playsinline></video>` : '<span style="font-size:26px">🎬</span>'}</div>
            <div style="display:grid;gap:6px">
              <label class="btn-ghost" style="height:40px">🎬 ${prevV ? 'Trocar vídeo' : 'Enviar vídeo'}<input type="file" id="admVideo" accept="video/mp4,video/webm,video/quicktime" hidden></label>
              ${prevV ? '<button type="button" class="btn-ghost adm-perigo" style="height:34px;font-size:13px" data-adm-semvideo>Remover vídeo</button>' : ''}
            </div>
          </div>
          <p class="adm-dica">Vídeo: MP4 vertical, até ${C.VIDEO_MAX_MB} MB, sem som (toca mudo). Produto com vídeo vira o destaque do topo.${irmaos ? ` Foto e vídeo valem pra <b>todos os tamanhos</b> deste produto.` : ''}</p>
          <div><label class="rot">Nome <small>(use "(M)" / "(G)" no fim para tamanhos)</small></label><input class="campo" name="nome" required value="${esc(r.nome || '')}"></div>
          <div><label class="rot">Categoria</label>
            <select class="campo" name="categoria">${cats.map(c => `<option${c === r.categoria ? ' selected' : ''}>${esc(c)}</option>`).join('')}<option value="__nova">＋ Nova categoria…</option></select>
          </div>
          <div id="admNovaCat" hidden><input class="campo" name="nova_cat" placeholder="Nome da nova categoria"></div>
          <div><label class="rot">Descrição</label><textarea class="campo" name="descricao" rows="3">${esc(r.descricao || '')}</textarea></div>
          <div class="dupla">
            <div><label class="rot">Preço (R$)</label><input class="campo" name="preco" inputmode="decimal" required value="${r.preco ?? ''}"></div>
            <div><label class="rot">Promo (R$) <small>opcional</small></label><input class="campo" name="preco_promocional" inputmode="decimal" value="${r.preco_promocional ?? ''}"></div>
          </div>
          <div class="adm-tg"><span><strong>Disponível</strong><small>Aparece no cardápio</small></span><button type="button" class="sw${r.disponivel !== false ? ' on' : ''}" data-adm-tg="disponivel"></button></div>
          <div class="adm-tg"><span><strong>Destaque ⭐</strong><small>Ganha selo e prioridade no topo</small></span><button type="button" class="sw${r.destaque ? ' on' : ''}" data-adm-tg="destaque"></button></div>
        </form>
      </div>
      <div class="sheet-pe" style="display:flex;gap:10px">
        ${r.id ? '<button class="btn-ghost adm-perigo" data-adm-excluir>Excluir</button>' : ''}
        <button class="btn-cta" style="flex:1" id="admSalvar">Salvar</button>
      </div>
    </section>`;
}
function admLojaHTML() {
  const v = k => esc(S.info[k] ?? '');
  const campo = (k, rot, dica = '', tipo = 'text') => `<div><label class="rot">${rot} ${dica ? `<small>${dica}</small>` : ''}</label><input class="campo" data-cfg="${k}" type="${tipo}" value="${v(k)}"></div>`;
  return `
    <div class="adm-cfg">
      <div class="adm-tg"><span><strong>${lojaAberta() ? '🟢 Loja aberta' : '🔴 Loja fechada'}</strong><small>Fechada = ninguém consegue pedir pelo cardápio</small></span><button class="sw${lojaAberta() ? ' on' : ''}" data-adm-loja></button></div>
      <div class="adm-tg"><span><strong>${oferecerAlcool() ? '🍺 Sugerindo cerveja' : '🚫 Sem álcool nas sugestões'}</strong><small>Cerveja em lata entrega normalmente; desligue se preferir não sugerir.</small></span><button class="sw${oferecerAlcool() ? ' on' : ''}" data-adm-alcool></button></div>
      ${campo('taxa_entrega', 'Taxa de entrega (R$)')}
      ${campo('frete_gratis_acima', 'Frete grátis acima de (R$)', '0 = desliga')}
      ${campo('pedido_minimo', 'Pedido mínimo (R$)')}
      ${campo('whatsapp', 'WhatsApp da casa', 'com DDD, só números')}
      ${campo('chave_pix', 'Chave PIX')}
      ${campo('horario', 'Horário', 'ex.: Aberto das 17h às 22h30')}
      ${campo('endereco', 'Endereço')}
      ${campo('painel_url', 'Link do painel de pedidos', 'opcional')}
      <button class="btn-cta full" data-adm-salvar-cfg>Salvar configurações</button>
    </div>`;
}
async function admSalvarCfg() {
  const linhas = $$('[data-cfg]').map(i => ({ chave: i.dataset.cfg, valor: i.value.trim() })).filter(l => l.valor !== '' || S.info[l.chave] !== undefined);
  const { error } = await sb.from('info_restaurante').upsert(linhas, { onConflict: 'chave' });
  if (error) return toast('Erro ao salvar: ' + error.message, 'erro');
  linhas.forEach(l => { S.info[l.chave] = l.valor; });
  renderPilulas(); renderRodape(); renderBarra();
  toast('Configurações salvas', 'ok');
}
async function admToggle(chave, atual, msgs) {
  const novo = !atual;
  const { error } = await sb.from('info_restaurante').upsert({ chave, valor: String(novo) }, { onConflict: 'chave' });
  if (error) return toast('Erro: ' + error.message, 'erro');
  S.info[chave] = String(novo); renderPilulas(); admRender();
  toast(novo ? msgs[0] : msgs[1], 'ok');
}
async function admPatch(id, patch) {
  const r = S.rows.find(x => x.id === id); if (!r) return;
  const antes = { ...r }; Object.assign(r, patch);
  agrupar(); renderPalco(); renderFaixa(); renderTop(); renderMenu(); admRender();
  const { error } = await sb.from('produtos').update(patch).eq('id', id);
  if (error) { Object.assign(r, antes); agrupar(); renderMenu(); admRender(); toast('Erro: ' + error.message, 'erro'); }
}
async function comprimir(file) {
  const img = await createImageBitmap(file);
  const max = 1200, s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', .85));
}
async function subir(caminho, blob, tipo) {
  const up = await sb.storage.from(C.BUCKET).upload(caminho, blob, { contentType: tipo, upsert: true });
  if (up.error) throw up.error;
  return sb.storage.from(C.BUCKET).getPublicUrl(caminho).data.publicUrl;
}
async function admSalvarProduto() {
  const f = $('#admForm'); const r = ADM.edit;
  const fd = new FormData(f);
  const nome = String(fd.get('nome') || '').trim();
  let categoria = String(fd.get('categoria'));
  if (categoria === '__nova') categoria = String(fd.get('nova_cat') || '').trim();
  const preco = parseFloat(String(fd.get('preco')).replace(',', '.'));
  const promoTxt = String(fd.get('preco_promocional') || '').trim();
  const promo = promoTxt ? parseFloat(promoTxt.replace(',', '.')) : null;
  if (!nome || !categoria || !(preco >= 0)) return toast('Preencha nome, categoria e preço', 'erro');

  const btn = $('#admSalvar'); btn.disabled = true; btn.textContent = r._arquivoV ? 'Enviando vídeo…' : 'Salvando…';
  try {
    const slug = semAcento(nome).replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    let imagem_url = r._semFoto ? null : (r.imagem_url || null);
    let video_url = r._semVideo ? null : (r.video_url || null);
    if (r._arquivo) imagem_url = await subir(`${Date.now()}-${slug}.jpg`, await comprimir(r._arquivo), 'image/jpeg');
    if (r._arquivoV) {
      const ext = (r._arquivoV.name.split('.').pop() || 'mp4').toLowerCase();
      video_url = await subir(`video-${Date.now()}-${slug}.${ext}`, r._arquivoV, r._arquivoV.type || 'video/mp4');
    }
    const dados = { nome, categoria, descricao: String(fd.get('descricao') || '').trim() || null, preco, preco_promocional: promo, disponivel: r.disponivel !== false, destaque: !!r.destaque, imagem_url, video_url };
    const q = r.id ? sb.from('produtos').update(dados).eq('id', r.id).select().single() : sb.from('produtos').insert(dados).select().single();
    const { data, error } = await q;
    if (error) throw error;
    const i = S.rows.findIndex(x => x.id === data.id); if (i >= 0) S.rows[i] = data; else S.rows.push(data);
    // mesma foto/vídeo nos outros tamanhos do mesmo produto (M/G)
    const base = parseNome(nome).base;
    const irmaos = S.rows.filter(x => x.id !== data.id && x.categoria === categoria && parseNome(x.nome).base === base);
    for (const x of irmaos) {
      if (x.imagem_url === imagem_url && x.video_url === video_url) continue;
      const up = await sb.from('produtos').update({ imagem_url, video_url }).eq('id', x.id).select().single();
      if (!up.error) Object.assign(x, up.data);
    }
    ADM.edit = null; agrupar(); renderPalco(); renderFaixa(); renderTop(); renderMenu(); admRender();
    toast('Produto salvo', 'ok');
  } catch (e) {
    console.error(e); btn.disabled = false; btn.textContent = 'Salvar';
    toast('Erro ao salvar: ' + (e.message || e), 'erro');
  }
}
async function admExcluir() {
  const r = ADM.edit;
  if (!confirm(`Excluir "${r.nome}" do cardápio?\n\nDica: se for só temporário, prefira desligar o interruptor.`)) return;
  const { error } = await sb.from('produtos').delete().eq('id', r.id);
  if (error) {
    if (/foreign key|violates/i.test(error.message)) { await admPatch(r.id, { disponivel: false }); ADM.edit = null; admRender(); return toast('Esse produto já tem pedidos, então foi desativado em vez de excluído.', 'ok'); }
    return toast('Erro: ' + error.message, 'erro');
  }
  S.rows = S.rows.filter(x => x.id !== r.id); ADM.edit = null;
  agrupar(); renderMenu(); admRender(); toast('Produto excluído', 'ok');
}
function admGuardarForm() {
  const f = $('#admForm'); if (!f) return;
  const fd = new FormData(f);
  ['nome', 'descricao', 'preco', 'preco_promocional'].forEach(k => { ADM.edit[k] = fd.get(k); });
  if (fd.get('categoria') !== '__nova') ADM.edit.categoria = fd.get('categoria');
}
function admEventos() {
  const adm = $('#adm');
  adm.addEventListener('click', e => {
    const t = e.target.closest('button, [data-adm-cancelar]'); if (!t) return;
    const d = t.dataset;
    if ('admFechar' in d) return admFechar();
    if (d.admAba) { ADM.aba = d.admAba; return admRender(); }
    if ('admNovo' in d) { ADM.edit = { nome: '', categoria: S.rows[0]?.categoria || 'Porções', disponivel: true, destaque: false }; return admRender(); }
    if (d.admEdit) { ADM.edit = { ...S.rows.find(x => x.id === d.admEdit) }; return admRender(); }
    if (d.admStar) { const r = S.rows.find(x => x.id === d.admStar); return admPatch(r.id, { destaque: !r.destaque }); }
    if (d.admDisp) { const r = S.rows.find(x => x.id === d.admDisp); return admPatch(r.id, { disponivel: r.disponivel === false }); }
    if ('admCancelar' in d) { ADM.edit = null; return admRender(); }
    if (d.admTg) { ADM.edit[d.admTg] = !(d.admTg === 'disponivel' ? ADM.edit.disponivel !== false : ADM.edit[d.admTg]); t.classList.toggle('on'); return; }
    if ('admSemfoto' in d) { admGuardarForm(); Object.assign(ADM.edit, { _semFoto: true, _arquivo: null, _preview: null, imagem_url: null }); return admRender(); }
    if ('admSemvideo' in d) { admGuardarForm(); Object.assign(ADM.edit, { _semVideo: true, _arquivoV: null, _previewV: null, video_url: null }); return admRender(); }
    if ('admExcluir' in d) return admExcluir();
    if (t.id === 'admSalvar') return admSalvarProduto();
    if ('admLoja' in d) return admToggle('loja_aberta', lojaAberta(), ['Loja aberta', 'Loja fechada']);
    if ('admAlcool' in d) return admToggle('oferecer_alcool', oferecerAlcool(), ['Sugestões de cerveja ligadas', 'Sugestões de cerveja desligadas']);
    if ('admSalvarCfg' in d) return admSalvarCfg();
    if ('admEquipe' in d) { try { aparelhoEquipe() ? localStorage.removeItem('chopp_equipe') : localStorage.setItem('chopp_equipe', '1'); } catch { /* ok */ } t.classList.toggle('on', aparelhoEquipe()); return toast(aparelhoEquipe() ? 'Este aparelho não conta nas métricas' : 'Este aparelho volta a contar', 'ok'); }
  });
  adm.addEventListener('input', debounce(e => {
    if (e.target.id === 'admBusca') { ADM.busca = e.target.value; const pos = e.target.selectionStart; admRender(); const i = $('#admBusca'); i.focus(); i.setSelectionRange(pos, pos); }
  }, 200));
  adm.addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (e.target.id === 'admFoto' && f) { admGuardarForm(); Object.assign(ADM.edit, { _arquivo: f, _semFoto: false, _preview: URL.createObjectURL(f) }); admRender(); }
    if (e.target.id === 'admVideo' && f) {
      if (f.size > C.VIDEO_MAX_MB * 1024 * 1024) { e.target.value = ''; return toast(`Vídeo muito grande (máx. ${C.VIDEO_MAX_MB} MB)`, 'erro'); }
      admGuardarForm(); Object.assign(ADM.edit, { _arquivoV: f, _semVideo: false, _previewV: URL.createObjectURL(f) }); admRender();
    }
    if (e.target.name === 'categoria') $('#admNovaCat').hidden = e.target.value !== '__nova';
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTOS
// ═══════════════════════════════════════════════════════════════════════════
function eventos() {
  const abrirBusca = () => { $('#busca').hidden = false; $('#buscaInput').focus(); };
  const fecharBusca = () => { $('#busca').hidden = true; $('#buscaInput').value = ''; S.busca = ''; renderMenu(); };
  $('#btnBusca').addEventListener('click', () => ($('#busca').hidden ? abrirBusca() : fecharBusca()));
  $('#buscaFechar').addEventListener('click', fecharBusca);
  $('#buscaInput').addEventListener('input', debounce(e => {
    S.busca = e.target.value; S.filtro = 'tudo'; renderMenu();
    const y = $('#cats').getBoundingClientRect().top + scrollY - 70;
    if (scrollY < y) scrollTo({ top: y, behavior: 'smooth' });
  }, 160));

  $('#catsIn').addEventListener('click', e => {
    const b = e.target.closest('.cat'); if (!b) return;
    S.filtro = b.dataset.cat; renderMenu();
    const y = $('#cats').getBoundingClientRect().top + scrollY - 64;
    if (scrollY > y || S.filtro !== 'tudo') scrollTo({ top: y, behavior: 'smooth' });
    b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });

  document.addEventListener('click', e => {
    if (e.target.closest('#palcoSom')) {
      const v = $('#palcoVideo'); if (!v) return;
      v.muted = !v.muted; if (!v.muted) v.play().catch(() => {});
      $('#palcoSom').innerHTML = v.muted ? ICON.somOff : ICON.somOn;
      return;
    }
    const el = e.target.closest('[data-add],[data-abre],[data-mais-pid],[data-menos-pid],[data-balde],[data-fechar],[data-acompanhar],[data-repetir],[data-combina],[data-combina-nao]');
    if (!el || el.closest('#adm')) return;
    const d = el.dataset;
    if ('fechar' in d) { const sh = el.closest('.sheet'); return sh ? fecharSheet(sh.id) : fecharTopo(); }
    if ('acompanhar' in d) { const u = ls('chopp_ultimo', null); return u && abrirStatus(u); }
    if ('repetir' in d) return repetirPedido();
    if ('combinaNao' in d) { S.recusasCombina++; rastrear('combina_recusado'); return fecharSheet('sheetCombina'); }
    if (d.combina) {
      const r = S.porId.get(d.combina); if (!r) return;
      const antes = totais(); addItem(itemRapido(r, 1, 'combina'));
      rastrear('combina_aceito', { produto: nomeBonito(parseNome(r.nome).base), valor: efetivo(r) });
      fecharSheet('sheetCombina');
      if (!avisarFrete(antes)) toast(`${nomeBonito(parseNome(r.nome).base)} no pedido`, 'ok');
      return;
    }
    if (d.balde) { const r = S.porId.get(d.balde); if (r) { addRapido(r, { qtd: 6, el, combina: false, origem: 'latas6' }); toast('6 latas no pedido', 'ok'); } return; }
    if (d.maisPid) { const it = S.carrinho.find(i => i.pid === d.maisPid && !i.obs); return it && mudarQtd(it.k, 1); }
    if (d.menosPid) { const it = S.carrinho.find(i => i.pid === d.menosPid && !i.obs); return it && mudarQtd(it.k, -1); }
    if (d.add) {
      e.stopPropagation();
      const g = S.grupos.find(x => x.key === d.add); if (!g) return;
      if (g.secao === 'marmitex' && !marmitexAgora()) return toast(`Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h`, 'erro');
      const fonte = el.closest('.palco-card') ? 'destaque' : el.closest('.top-card') ? 'mais_pedidos' : S.busca ? 'busca' : 'cardapio';
      if (fonte === 'destaque') rastrear('destaque_clique', { produto: g.nome });
      if (g.simples && g.disponiveis[0]) return addRapido(g.disponiveis[0], { el, fonte });
      return abrirProduto(g.key, fonte);
    }
    if (d.abre && !el.closest('.sheet')) {
      const fonte = el.closest('.palco-card') ? 'destaque' : el.closest('.top-card') ? 'mais_pedidos' : S.busca ? 'busca' : 'cardapio';
      if (fonte === 'destaque') rastrear('destaque_clique', { produto: S.grupos.find(x => x.key === d.abre)?.nome });
      return abrirProduto(d.abre, fonte);
    }
  });

  $('#veu').addEventListener('click', () => { if (pilha[pilha.length - 1] === 'sheetCombina') S.recusasCombina++; fecharTopo(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#adm').hidden) { if (ADM.edit) { ADM.edit = null; admRender(); } else admFechar(); } else fecharTopo(); } });
  $('#barraBtn').addEventListener('click', abrirCarrinho);
  $('#btnSacola').addEventListener('click', abrirCarrinho);

  $('#sheetProduto').addEventListener('click', e => {
    const t = e.target.closest('[data-tam],[data-meio],[data-sabor],[data-opc],[data-sem],[data-pdq],#pdAdd'); if (!t) return;
    e.preventDefault();
    const d = t.dataset;
    S.pd.obs = $('#pdObs')?.value ?? S.pd.obs;
    if (d.tam) {
      if (t.classList.contains('upgrade')) { S.pd.upgradeClicado = true; rastrear('upgrade_tamanho', { produto: S.pd.g.nome, valor: r2(S.pd.vs[+d.tam].efetivo - S.pd.vs[S.pd.idx].efetivo) }); }
      S.pd.idx = +d.tam;
    }
    else if ('meio' in d) { S.pd.meio = !S.pd.meio; if (!S.pd.meio) S.pd.sabor2 = null; }
    else if (d.sabor) S.pd.sabor2 = d.sabor;
    else if (d.opc) S.pd.opc[+d.opc] = d.val;
    else if (d.sem) S.pd.sem.has(d.sem) ? S.pd.sem.delete(d.sem) : S.pd.sem.add(d.sem);
    else if (d.pdq) S.pd.qtd = Math.max(1, Math.min(50, S.pd.qtd + +d.pdq));
    else if (t.id === 'pdAdd') return confirmarProduto(t);
    const y = $('#sheetProduto .sheet-corpo').scrollTop;
    renderProduto();
    $('#sheetProduto .sheet-corpo').scrollTop = y;
  });
  $('#sheetProduto').addEventListener('input', e => { if (e.target.id === 'pdObs') S.pd.obs = e.target.value; });

  $('#sheetCarrinho').addEventListener('click', e => {
    const t = e.target.closest('[data-q],[data-sug],#btnContinuar'); if (!t) return;
    if (t.dataset.q) { mudarQtd(t.dataset.k, +t.dataset.q); return renderCarrinho(); }
    if (t.dataset.sug) {
      const r = S.porId.get(t.dataset.sug); if (!r) return;
      const antes = totais(); addItem(itemRapido(r, 1, 'fecha' in t.dataset ? 'libera_frete' : 'vai_bem'));
      if (!avisarFrete(antes)) toast('Adicionado ao pedido', 'ok');
      return renderCarrinho();
    }
    if (t.id === 'btnContinuar') abrirCheckout();
  });

  $('#sheetCheckout').addEventListener('click', e => {
    const t = e.target.closest('[data-tipo],[data-pag],[data-bump],#ckFinalizar'); if (!t) return;
    const ck = S.ck; const d = t.dataset;
    lerCampos();
    const y = $('#sheetCheckout .sheet-corpo').scrollTop;
    if (d.tipo) ck.tipo = d.tipo;
    else if (d.pag) ck.pag = d.pag;
    else if ('bump' in d) {
      const r = S.porId.get(ck.bumpPid); if (!r) return;
      if (ck.bumpOn) { const it = S.carrinho.find(i => i.pid === r.id && !i.obs); if (it) mudarQtd(it.k, -it.qtd); ck.bumpOn = false; rastrear('oferta_desmarcada', { produto: nomeBonito(parseNome(r.nome).base) }); }
      else { addItem(itemRapido(r, 1, 'oferta_rapida')); ck.bumpOn = true; rastrear('oferta_aceita', { produto: nomeBonito(parseNome(r.nome).base), valor: efetivo(r) }); }
    } else if (t.id === 'ckFinalizar') return finalizar();
    renderCheckout();
    $('#sheetCheckout .sheet-corpo').scrollTop = y;
    if (d.pag === 'dinheiro') $('#ckTroco')?.focus({ preventScroll: true });
  });
  $('#sheetCheckout').addEventListener('input', e => {
    if (e.target.id === 'ckTel') { const p = e.target.selectionStart, antes = e.target.value.length; e.target.value = mascaraTel(e.target.value); const dif = e.target.value.length - antes; e.target.setSelectionRange(p + dif, p + dif); }
    e.target.classList.remove('erro');
  });

  $('#sheetStatus').addEventListener('click', async e => {
    const t = e.target.closest('[data-copiar]'); if (!t) return;
    try { await navigator.clipboard.writeText(t.dataset.copiar); t.textContent = 'Copiado ✓'; toast('Chave PIX copiada', 'ok'); }
    catch { const r = document.createRange(); r.selectNodeContents($('#pixChave')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Segure para copiar a chave'); }
  });

  $('#btnAdmin').addEventListener('click', admAbrirSenha);
  $('#admSenhaForm').addEventListener('submit', admVerificar);
  $('#admCancelar').addEventListener('click', () => { $('#admSenha').hidden = true; });
  admEventos();

  let ultimoMarmitex = marmitexAgora();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    renderRetorno();
    if (marmitexAgora() !== ultimoMarmitex) { ultimoMarmitex = marmitexAgora(); renderMenu(); }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// INÍCIO
// ═══════════════════════════════════════════════════════════════════════════
async function init() {
  eventos();
  renderBarra();
  try { await carregar(); }
  catch (e) {
    console.error(e);
    $('#menu').innerHTML = `<div class="vazio"><img src="assets/mascote.png" alt=""><p>Não conseguimos carregar o cardápio.<br>Confere sua internet.</p><button class="btn-cta" onclick="location.reload()">Tentar de novo</button></div>`;
    return;
  }
  agrupar();
  renderPilulas(); renderRodape(); renderPalco(); renderFaixa(); renderTop(); renderMenu();
  validarCarrinho(); renderBarra();
  renderRetorno();
  tempoReal();
  rastrear('visita', { tela: innerWidth < 760 ? 'celular' : 'computador', ref: document.referrer ? new URL(document.referrer).hostname : '' });
  if (location.hash === '#admin') admAbrirSenha();
}
document.addEventListener('DOMContentLoaded', init);
