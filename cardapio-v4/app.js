// ═══════════════════════════════════════════════════════════════════════════
// CHOPPATINHAS v4 — "Monte sua mesa"
// Totalmente diferente da v3: noite, escuro, cinematográfico; o círculo (o
// prato) é a forma principal; o pedido é GUIADO — pra quantas pessoas →
// o prato → pra acompanhar → pra beber — e o carrinho é uma mesa onde os
// pratos vão sendo servidos (e os lugares vazios pedem pra ser completados).
// Mesmo banco, mesmas regras de pedido, mesmo admin e mesma medição.
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
  vendas: new Map(),
  vendasHoje: new Map(),
  pedidosHoje: 0,
  afinidade: new Map(),
  carrinho: ls('chopp_carrinho', []),
  pessoas: ls('chopp_pessoas', 0), // 0 = não informou; 1, 2, 4 (3–4), 6 (5+)
  etapa: 0,        // 0 abertura · 1 o prato · 2 pra acompanhar · 3 pra beber
  busca: '',
  zoom: null,      // prato aberto de perto
  sugMesa: null,   // "combina com" logo depois de servir
  sugVista: new Set(),
  fecharModo: 'mesa', // mesa | checkout | status
  ck: null,
  ult: null,
  stEtapa: null,
  canalPedido: null,
  recusasCombina: 0,
};

// ─── UTIL ───────────────────────────────────────────────────────────────────
function ls(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } }
const fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMenu = v => { const n = Number(v || 0); return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); };
const fmtCurto = v => { const n = Number(v || 0); return 'R$ ' + (Number.isInteger(n) ? n : n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const r2 = n => Math.round(n * 100) / 100;
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const num = k => { const v = parseFloat(String(S.info[k] ?? '').replace(',', '.')); return Number.isFinite(v) ? v : C.DEFAULTS[k]; };
const valido = v => v && !/pendente/i.test(v);
const soDigitos = s => String(s || '').replace(/\D/g, '');
const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const doisDig = n => String(n).padStart(2, '0');

const ICON = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  menos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  gente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c2.4.1 4 1.7 4.5 4.3"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>',
};

// ─── TAMANHOS / NOMES ───────────────────────────────────────────────────────
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
const MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'e', 'na', 'no', 'nas', 'nos', 'em', 'ao', 'a', 'o', 'p/', 'c/']);
function nomeBonito(t) {
  return String(t || '').replace(/\bC\/\s*/gi, 'c/ ').split(' ').map((w, i) => (i && MINUSC.has(w.toLowerCase())) ? w.toLowerCase() : w).join(' ');
}
const pesoTxt = gr => gr >= 1000 ? (gr / 1000).toLocaleString('pt-BR') + ' kg' : gr + ' g';
// Prato sem foto vira um prato de louça com as iniciais (ex.: "Porção de Calabresa" → CA)
function mono(nome) {
  const p = nomeBonito(parseNome(nome).base).replace(/^(combo|porção de|porção|caldo de|filé de)\s+/i, '')
    .split(/\s+/).filter(w => w.length > 1 && !MINUSC.has(w.toLowerCase()));
  return (((p[0] || '?')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase();
}
const pratoMini = (nome, img, cls = '') => `<span class="pm ${cls}">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : `<b>${esc(mono(nome))}</b>`}</span>`;

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
    g.opcoes = C.OPCOES[g.base.toLowerCase()] || null;
    g.simples = g.disponiveis.length <= 1 && !g.opcoes && g.secao !== 'pizzas';
    g.vendas = S.vendas.get(semAcento(g.base)) || 0;
    g.hoje = S.vendasHoje.get(semAcento(g.base)) || 0;
    grupos.push(g);
  }
  const rankAnota = new Map(C.MAIS_PEDIDOS.map((n, i) => [semAcento(n), i]));
  grupos.forEach(g => { g.rankAnota = rankAnota.has(semAcento(g.base)) ? rankAnota.get(semAcento(g.base)) : 99; });
  const bebOrdem = n => /cerveja|chopp/i.test(n) ? 0 : /lata/i.test(n) ? 1 : /guaran/i.test(n) ? 2 : /suco/i.test(n) ? 3 : /h2oh/i.test(n) ? 4 : 5;
  const ordem = {
    frango: (a, b) => a.rankAnota - b.rankAnota || b.min - a.min,
    combos: (a, b) => !!b.img - !!a.img || b.destaque - a.destaque || b.min - a.min,
    porcoes: (a, b) => !!b.img - !!a.img || a.rankAnota - b.rankAnota || b.vendas - a.vendas || b.min - a.min,
    lanches: (a, b) => b.destaque - a.destaque || b.min - a.min,
    acomp: (a, b) => (b.base === C.MOLHO_CASA) - (a.base === C.MOLHO_CASA) || a.rankAnota - b.rankAnota || a.min - b.min,
    bebidas: (a, b) => bebOrdem(a.base) - bebOrdem(b.base) || a.min - b.min,
  };
  grupos.sort((a, b) => {
    const ia = C.SECOES.findIndex(s => s.id === a.secao), ib = C.SECOES.findIndex(s => s.id === b.secao);
    if (ia !== ib) return ia - ib;
    return (ordem[a.secao] || ((x, y) => x.base.localeCompare(y.base)))(a, b) || a.base.localeCompare(b.base);
  });
  S.grupos = grupos;
  if (S.zoom) {
    const ng = grupos.find(x => x.key === S.zoom.g.key);
    if (ng?.disponivel) { S.zoom.g = ng; S.zoom.vs = ng.disponiveis; S.zoom.idx = Math.min(S.zoom.idx, S.zoom.vs.length - 1); }
  }
}

function notaDe(g) {
  if (g.base.toLowerCase() === C.MOLHO_CASA.toLowerCase()) return 'Especial da casa';
  if (g.promo) return 'Oferta de hoje';
  if (g.rankAnota === 0) return 'O nº 1 da casa';
  if (g.hoje >= 3) return `${g.hoje} pedidos hoje`;
  if (g.rankAnota < 99) return 'Um dos mais pedidos';
  if (g.destaque) return 'A casa recomenda';
  return '';
}

// ─── REGRAS DA CASA ─────────────────────────────────────────────────────────
const lojaAberta = () => String(S.info.loja_aberta ?? 'true') === 'true';
const marmitexAgora = () => { const h = new Date().getHours(); return h >= C.MARMITEX.inicio && h < C.MARMITEX.fim; };
const oferecerAlcool = () => String(S.info.oferecer_alcool ?? 'true') === 'true';
const ehAlcool = r => /cerveja|chopp/i.test(r.nome);
function horarioTxt() { return valido(S.info.horario) ? S.info.horario.replace(/\(.*?\)/g, '').trim() : C.DEFAULTS.horario; }
const ateQuando = () => { const m = horarioTxt().match(/fecha\s+(?:às|as)\s+(.+)/i); return m ? m[1] : ''; };

// Molho especial da casa (R$ 10): 1ª sugestão pra frango, combos e porções
const ehMolho = r => !!r && r.nome === C.MOLHO_CASA;

function candidatosPara(g, max = 4) {
  const alcoolOk = oferecerAlcool() && g.secao !== 'marmitex';
  const jaTemId = new Set(g.variantes.map(v => v.id));
  const porNome = n => { const r = S.rows.find(x => x.nome === n); return r && r.disponivel !== false && !jaTemId.has(r.id) ? r : null; };
  const lista = [];
  const add = ns => ns.forEach(n => { const r = porNome(n); if (r && !lista.includes(r)) lista.push(r); });
  const contexto = (g.base + ' ' + (g.descricao || '')).toLowerCase();
  const temArrozSalada = /completa|arroz e salada/.test(contexto);
  const ehArrozOuSalada = /^(arroz|salada)$/i.test(g.base);
  const temBatataNoNome = /batata/i.test(g.base);

  if (g.secao === 'frango' || g.secao === 'combos' || g.secao === 'porcoes') {
    add([C.MOLHO_CASA]);
    if (!temBatataNoNome) add(['Porção De Batata Frita (M)']);
    if (!temArrozSalada && !ehArrozOuSalada) add(['Arroz', 'Salada']);
    if (alcoolOk) add(['Cerveja Brahma', 'Cerveja Skol']);
    add(['Guaraná Antarctica', 'Pepsi Lata', 'Suco De Maracujá Polpa']);
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
  const iMolho = lista.findIndex(ehMolho);
  if (iMolho > 0) lista.unshift(...lista.splice(iMolho, 1));
  return lista.slice(0, max);
}
const SECOES_COMBINA = new Set(['frango', 'combos', 'porcoes', 'lanches', 'caldos', 'marmitex']);

// ─── A JORNADA ──────────────────────────────────────────────────────────────
const PESSOAS = [{ n: 1, rot: '1', sub: 'pessoa' }, { n: 2, rot: '2', sub: 'pessoas' }, { n: 4, rot: '3–4', sub: 'pessoas' }, { n: 6, rot: '5+', sub: 'pessoas' }];
const mesaDe = () => S.pessoas ? `mesa de ${S.pessoas >= 6 ? '5+' : S.pessoas === 4 ? '3–4' : S.pessoas}` : 'sua mesa';
const PAINEIS = [
  { id: 'prato', curto: 'O prato', titulo: 'O prato principal', secoes: ['frango', 'combos', 'porcoes', 'lanches', 'caldos', 'marmitex', 'pizzas', 'outros'] },
  { id: 'acomp', curto: 'Acompanhar', titulo: 'Pra acompanhar', secoes: ['acomp'] },
  { id: 'beber', curto: 'Beber', titulo: 'Pra beber', secoes: ['bebidas'] },
];
const painelDaSecao = secao => PAINEIS.findIndex(p => p.secoes.includes(secao));

// "A casa recomenda": os 3 pratos mais caros, com pelo menos um de frango
function recomendados() {
  const capa = grupoDestaque()?.key;
  const topo = g => Math.max(...g.disponiveis.map(v => v.efetivo));
  const pratos = S.grupos
    .filter(g => g.disponivel && g.key !== capa && painelDaSecao(g.secao) === 0)
    .sort((a, b) => topo(b) - topo(a) || a.rankAnota - b.rankAnota);
  const frango = pratos.find(g => /frango/i.test(g.base));
  const lista = pratos.filter(g => g !== frango).slice(0, frango ? 2 : 3);
  if (frango) lista.push(frango);
  return lista.sort((a, b) => b.min - a.min || topo(b) - topo(a));
}
function grupoDestaque() {
  const disp = S.grupos.filter(g => g.disponivel);
  const comVideo = disp.filter(g => g.video).sort((a, b) => b.destaque - a.destaque || a.rankAnota - b.rankAnota);
  if (comVideo.length) return comVideo[0];
  return disp.filter(g => g.img).sort((a, b) => a.rankAnota - b.rankAnota || b.destaque - a.destaque)[0] || null;
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
  const vendas = new Map(), vendasHoje = new Map(), porPedido = new Map();
  (itens.data || []).forEach(r => {
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
  agrupar(); renderPaineis();
}
function renderTudo() {
  agrupar(); renderAbertura(); renderPaineis(); renderMesa();
  if (!$('#fechar').hidden && S.fecharModo === 'mesa') renderFechar();
}
function tempoReal() {
  const reagir = debounce(() => { renderTudo(); if (!$('#adm').hidden && !ADM.edit) admRender(); }, 300);
  sb.channel('cardapio-v4-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, ({ eventType, new: n, old: o }) => {
      if (eventType === 'DELETE') S.rows = S.rows.filter(r => r.id !== o.id);
      else { const i = S.rows.findIndex(r => r.id === n.id); if (i >= 0) S.rows[i] = n; else S.rows.push(n); }
      reagir();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'info_restaurante' }, ({ new: n }) => {
      if (!n?.chave) return;
      S.info[n.chave] = n.valor;
      renderTopo(); renderAbertura(); renderMesa();
    })
    .subscribe();
}

// ═══════════════════════════════════════════════════════════════════════════
// VÍDEO (autoplay + plano B do WhatsApp: troca pra animação .webp)
// ═══════════════════════════════════════════════════════════════════════════
function videoHTML(g) {
  if (!g.video || reduzMovimento()) return g.img ? `<img class="mid" src="${esc(g.img)}" alt="">` : '';
  return `<video class="mid" src="${esc(g.video)}" ${g.img ? `poster="${esc(g.img)}"` : ''} muted autoplay loop playsinline preload="auto"></video>
    <img class="mid anim" alt="" hidden>
    <button class="toque" data-tocar aria-label="Tocar vídeo">${ICON.play}</button>`;
}
const obsVideo = new WeakMap();
function ligarVideo(box) {
  const v = box && $('video', box); if (!v) return;
  tentarTocar(v, box);
  v.addEventListener('canplay', () => { if (v.paused) tentarTocar(v, box); }, { once: true });
  obsVideo.get(box)?.disconnect();
  const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) tentarTocar(v, box); else v.pause(); }, { threshold: .2 });
  o.observe(v); obsVideo.set(box, o);
}
function tentarTocar(v, box) {
  v.play().then(() => box.classList.remove('precisa-toque')).catch(() => usarAnimacao(v, box));
}
function usarAnimacao(v, box) {
  const a = $('img.anim', box);
  if (!a) { box.classList.add('precisa-toque'); return; }
  if (!a.hidden) { box.classList.remove('precisa-toque'); return; }
  if (box.dataset.animTentada) return;
  box.dataset.animTentada = '1';
  a.addEventListener('load', () => { v.style.visibility = 'hidden'; a.hidden = false; box.classList.remove('precisa-toque'); }, { once: true });
  a.addEventListener('error', () => box.classList.add('precisa-toque'), { once: true });
  a.src = v.currentSrc.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.webp$2');
}

// ═══════════════════════════════════════════════════════════════════════════
// TOPO / ABERTURA
// ═══════════════════════════════════════════════════════════════════════════
function renderTopo() {
  const el = $('#topoStatus');
  el.classList.toggle('fechado', !lojaAberta());
  el.innerHTML = lojaAberta() ? `<i></i>Aberto${ateQuando() ? ' até ' + esc(ateQuando()) : ''}` : '<i></i>Fechado agora';
}
function renderAbertura() {
  const g = grupoDestaque();
  const box = $('#abreMidia');
  const chave = g ? (g.video || g.img) : '';
  if (box.dataset.m !== chave) {
    box.dataset.m = chave;
    box.innerHTML = g ? videoHTML(g) : '';
    ligarVideo(box);
  }
  $('#abreSobre').textContent = lojaAberta() ? `Cozinha aberta${ateQuando() ? ' até ' + ateQuando() : ''} · Umuarama` : 'Fechado agora · você já pode montar a mesa';
  $('#pessoas').innerHTML = PESSOAS.map(p => `
    <button class="pessoa${S.pessoas === p.n ? ' on' : ''}" data-pessoas="${p.n}">
      <span class="pessoa-prato">${p.rot}</span><small>${p.sub}</small>
    </button>`).join('');
  const fg = num('frete_gratis_acima');
  const cel = (rot, val) => `<div><small>${rot}</small><b>${esc(val)}</b></div>`;
  $('#info3').innerHTML = [
    cel('Entrega', C.DEFAULTS.tempo_entrega),
    cel('Retirada', C.DEFAULTS.tempo_retirada),
    fg > 0 ? cel('Frete grátis', 'acima de ' + fmtCurto(fg)) : cel('Avaliação', '★ ' + C.DEFAULTS.avaliacao),
  ].join('');
}

// ─── ACOMPANHAR / PEDIR DE NOVO ─────────────────────────────────────────────
const ETAPAS = {
  delivery: [
    { t: 'Recebido', d: 'a casa já está com o seu pedido' },
    { t: 'Na cozinha', d: 'preparando tudo na hora' },
    { t: 'Saiu pra entrega', d: 'está a caminho — pode pôr a mesa' },
    { t: 'Entregue', d: 'bom apetite!' },
  ],
  retirada: [
    { t: 'Recebido', d: 'a casa já está com o seu pedido' },
    { t: 'Na cozinha', d: 'preparando tudo na hora' },
    { t: 'Pronto pra retirar', d: 'pode vir buscar!' },
    { t: 'Retirado', d: 'bom apetite!' },
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
    if (et >= 0 && et < 3) partes.push(`<button class="ret vivo" data-acompanhar><i></i>Pedido nº ${String(ult.numero).padStart(3, '0')} · <b>${esc(ETAPAS[ult.tipo || 'delivery'][et].t)}</b><span>acompanhar</span></button>`);
  }
  const rep = ls('chopp_repetir', null);
  if (rep?.itens?.length) {
    const total = rep.itens.reduce((s, i) => s + i.preco * i.qtd, 0);
    partes.push(`<button class="ret" data-repetir>Repetir a última mesa · <b>${fmt(total)}</b><span>repetir</span></button>`);
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
  renderMesa(); atualizarMais();
  toast(ok ? `${ok} ${ok === 1 ? 'prato voltou' : 'pratos voltaram'} pra mesa${fora ? ` (${fora} indisponível)` : ''}` : 'Esses itens não estão disponíveis hoje', ok ? 'ok' : 'erro');
  if (ok) { if (!S.etapa) irEtapa(1); setTimeout(() => abrirFechar('mesa'), 300); }
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPAS (o prato → pra acompanhar → pra beber)
// ═══════════════════════════════════════════════════════════════════════════
function irEtapa(n) {
  const de = S.etapa;
  S.etapa = n;
  $('#abertura').hidden = n !== 0;
  $('#palco').hidden = n === 0;
  if (n > 0) {
    $('#paineis').style.transform = `translateX(${-(n - 1) * 100}%)`;
    $$('.painel').forEach((p, i) => p.setAttribute('aria-hidden', String(i !== n - 1)));
    renderPassos();
    if (de === 0) ligarVideo($('#painel0 .destaque-midia'));
    rastrear('etapa', { etapa: PAINEIS[n - 1].id, pessoas: S.pessoas || null });
    marcarSugVista(n - 1);
  } else {
    scrollTo(0, 0);
  }
  renderMesa();
}
function renderPassos() {
  $('#passos').innerHTML = `
    ${PAINEIS.map((p, i) => {
      const feito = S.carrinho.some(it => painelDaSecao(it.secao) === i);
      return `<button class="passo${S.etapa === i + 1 ? ' on' : ''}${feito ? ' feito' : ''}" data-etapa="${i + 1}"><i>${feito ? ICON.ok : i + 1}</i>${p.curto}</button>`;
    }).join('')}
    <button class="passo-mesa" data-etapa="0" aria-label="Mudar número de pessoas (${esc(mesaDe())})">${ICON.gente}${S.pessoas ? (S.pessoas >= 6 ? '5+' : S.pessoas === 4 ? '3–4' : S.pessoas) : '?'}</button>`;
}

function qtdNoCarrinho(g) { const ids = new Set(g.variantes.map(v => v.id)); return S.carrinho.filter(i => ids.has(i.pid)).reduce((s, i) => s + i.qtd, 0); }

// Botão de pôr na mesa (ou passo − n + pra quem já está na mesa)
function maisHTML(g) {
  const v = g.disponiveis[0];
  const q = qtdNoCarrinho(g);
  const passo = g.simples && (g.secao === 'bebidas' || g.secao === 'acomp');
  const it = passo && S.carrinho.find(i => i.pid === v.id && !i.obs);
  const seis = g.secao === 'bebidas' && /cerveja/i.test(g.base) ? `<button class="seis" data-balde="${v.id}">+6</button>` : '';
  if (it) return `${seis}<span class="passo-q"><button data-menos-pid="${v.id}" aria-label="Menos">${ICON.menos}</button><b>${it.qtd}</b><button data-mais-pid="${v.id}" aria-label="Mais">${ICON.plus}</button></span>`;
  return `${seis}<button class="mais${q ? ' tem' : ''}" data-add="${esc(g.key)}" aria-label="Pôr ${esc(g.nome)} na mesa">${q ? `<b>${q}</b>` : ICON.plus}</button>`;
}

function itemHTML(g) {
  const nota = notaDe(g);
  const multi = g.disponiveis.length > 1;
  const preco = `${multi ? '<small>a partir de</small>' : ''}<b>${fmtMenu(g.min)}</b>`;
  if (g.img && g.secao !== 'bebidas') {
    return `
    <article class="tile" data-item="${esc(g.key)}">
      <button class="tile-foto" data-abrir="${esc(g.key)}" aria-label="Ver ${esc(g.nome)}">
        <img src="${esc(g.img)}" alt="" loading="lazy" decoding="async">
      </button>
      <div class="tile-txt" data-abrir="${esc(g.key)}">
        ${nota ? `<em>${esc(nota)}</em>` : ''}
        <h3>${esc(g.nome)}</h3>
        <p class="preco">${preco}</p>
      </div>
      <span class="it-acao">${maisHTML(g)}</span>
    </article>`;
  }
  const sub = [
    nota ? `<em>${esc(nota)}</em>` : '',
    multi ? esc(g.disponiveis.map(v => v.tam || v.letra).join(' · ')) : '',
    g.secao === 'bebidas' ? esc(copyDe(g)) : '',
  ].filter(Boolean).join('<i>·</i>');
  return `
    <article class="linha" data-item="${esc(g.key)}">
      <button class="linha-txt" data-abrir="${esc(g.key)}">
        ${pratoMini(g.nome, null, 'linha-pm')}
        <span><b>${esc(g.nome)}</b>${sub ? `<small>${sub}</small>` : ''}</span>
      </button>
      <p class="preco">${preco}</p>
      <span class="it-acao">${maisHTML(g)}</span>
    </article>`;
}
// atualiza só os botões (sem redesenhar e sem reiniciar vídeo)
function atualizarMais() {
  $$('[data-item]').forEach(el => {
    const g = S.grupos.find(x => x.key === el.dataset.item); if (!g) return;
    const a = $('.it-acao', el); if (a) a.innerHTML = maisHTML(g);
  });
  $$('[data-sug-etapa]').forEach(el => { el.outerHTML = sugEtapaHTML(+el.dataset.sugEtapa); });
  if (S.etapa) renderPassos();
}

// "A casa sugere pra mesa de 4": completa a etapa num toque, na medida da mesa
function sugestaoDaEtapa(p) {
  const n = S.pessoas || 2;
  const naMesa = r => S.carrinho.some(i => i.pid === r.id);
  const pode = r => r && r.disponivel !== false && !naMesa(r);
  const porNome = nome => S.rows.find(r => r.nome === nome);
  const itens = [];
  if (p === 1) {
    const pratos = S.carrinho.filter(i => painelDaSecao(i.secao) === 0).sort((a, b) => b.preco * b.qtd - a.preco * a.qtd);
    if (!pratos.length) return null;
    const g = S.grupos.find(x => x.variantes.some(v => v.id === pratos[0].pid));
    const molho = porNome(C.MOLHO_CASA);
    if (pode(molho) && g && ['frango', 'combos', 'porcoes'].includes(g.secao)) itens.push({ r: molho, qtd: n >= 6 ? 2 : 1 });
    let acomp = g && candidatosPara(g, 8).find(r => !ehMolho(r) && grupoDaLinha(r)?.secao === 'acomp' && pode(r));
    if (acomp && n >= 4) { const gg = grupoDaLinha(acomp); const maior = gg?.disponiveis[gg.disponiveis.length - 1]; if (pode(maior)) acomp = maior; }
    if (acomp) itens.push({ r: acomp, qtd: n >= 6 ? 2 : 1 });
  } else if (p === 2) {
    if (S.carrinho.some(i => i.secao === 'bebidas') || !S.carrinho.length) return null;
    const r = n >= 3 ? porNome('Guaraná Antarctica') : porNome('Pepsi Lata');
    if (pode(r)) itens.push({ r, qtd: n >= 6 ? 2 : n >= 3 ? 1 : Math.max(1, n) });
  }
  return itens.length ? itens : null;
}
function sugEtapaHTML(p) {
  const itens = sugestaoDaEtapa(p);
  if (!itens) return `<div class="sug-etapa vazia" data-sug-etapa="${p}"></div>`;
  const total = r2(itens.reduce((s, { r, qtd }) => s + efetivo(r) * qtd, 0));
  return `
    <div class="sug-etapa" data-sug-etapa="${p}">
      <p class="se-rot">A casa sugere pra ${esc(mesaDe())}</p>
      <div class="se-itens">${itens.map(({ r, qtd }) => {
        const { base, tam } = parseNome(r.nome); const gg = grupoDaLinha(r);
        return `<div class="se-it">${pratoMini(r.nome, r.imagem_url || gg?.img)}<span><b>${qtd > 1 ? qtd + '× ' : ''}${esc(nomeBonito(base))}</b><small>${ehMolho(r) ? 'especial da casa' : esc(tam || '')}</small></span><em>${fmtNum(efetivo(r) * qtd)}</em></div>`;
      }).join('')}</div>
      <button class="se-add" data-sug-add="${p}"><span>Pôr na mesa</span><b>+ ${fmt(total)}</b></button>
    </div>`;
}
function marcarSugVista(p) {
  const itens = sugestaoDaEtapa(p);
  if (!itens || S.sugVista.has(p)) return;
  S.sugVista.add(p);
  rastrear('sugestao_mesa_mostrada', { etapa: PAINEIS[p].id, valor: r2(itens.reduce((s, { r, qtd }) => s + efetivo(r) * qtd, 0)), pessoas: S.pessoas || null });
  if (itens.some(({ r }) => ehMolho(r))) rastrear('molho_mostrado', { produto: nomeBonito(C.MOLHO_CASA), valor: 10, onde: 'etapa' });
}

function secaoHTML(s, grupos) {
  return `
    <section class="sec" id="sec-${s.id}" data-sec="${s.id}">
      <header class="sec-cab"><h2>${esc(s.nome)}</h2><span>${grupos.length}</span></header>
      ${s.id === 'marmitex' && !marmitexAgora() ? `<p class="sec-aviso">Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h</p>` : ''}
      ${grupos.map(itemHTML).join('')}
    </section>`;
}
function renderPaineis() {
  if (!S.grupos.length) return;
  const ys = $$('.painel').map(p => p.scrollTop);
  PAINEIS.forEach((p, i) => {
    const secoes = C.SECOES.filter(s => p.secoes.includes(s.id))
      .map(s => ({ s, grupos: S.grupos.filter(g => g.secao === s.id && g.disponivel) }))
      .filter(x => x.grupos.length);
    let html = `<header class="pn-cab"><p>${i + 1} de 3 · ${esc(cap(mesaDe()))}</p><h2>${p.titulo}</h2></header>`;
    if (i === 0) {
      const d = grupoDestaque();
      if (d) html += `
        <article class="destaque" data-item="${esc(d.key)}" data-fonte="destaque">
          <div class="destaque-midia" data-abrir="${esc(d.key)}">${videoHTML(d)}</div>
          <div class="destaque-txt" data-abrir="${esc(d.key)}">
            <em>Destaque da casa</em>
            <h3>${esc(d.nome)}</h3>
            <p class="preco">${d.disponiveis.length > 1 ? '<small>a partir de</small>' : ''}<b>${fmtMenu(d.min)}</b></p>
          </div>
          <span class="it-acao">${maisHTML(d)}</span>
        </article>`;
      html += `<nav class="sub-nav">${secoes.map(x => `<button data-ir-sec="${x.s.id}">${esc(x.s.nome)}</button>`).join('')}</nav>`;
      const rec = recomendados();
      if (rec.length) html += `<section class="sec rec" data-fonte="mais_pedidos"><header class="sec-cab"><h2>A casa recomenda</h2><span>os mais completos</span></header>${rec.map(itemHTML).join('')}</section>`;
    } else {
      html += sugEtapaHTML(i);
    }
    html += secoes.map(x => secaoHTML(x.s, x.grupos)).join('');
    html += i < 2
      ? `<button class="proximo" data-etapa="${i + 2}"><small>Próximo</small><b>${PAINEIS[i + 1].titulo}</b><span>→</span></button>`
      : `<button class="proximo" data-ver-mesa><small>Tudo certo?</small><b>Ver minha mesa</b><span>→</span></button>
         <footer class="rodape"><img src="assets/wordmark.png" alt="Choppatinhas" width="150" height="36"><p>${esc(valido(S.info.endereco) ? S.info.endereco : 'Umuarama — PR')}</p><p>${esc(horarioTxt())}</p><button class="btn-admin" data-admin>área da casa</button></footer>`;
    const el = $('#painel' + i);
    el.innerHTML = html;
    el.scrollTop = ys[i] || 0;
  });
  if (S.etapa) { renderPassos(); ligarVideo($('#painel0 .destaque-midia')); }
  if (S.busca) renderBusca();
}

// ─── BUSCA ──────────────────────────────────────────────────────────────────
function renderBusca() {
  const box = $('#buscaRes');
  const termo = semAcento(S.busca.trim());
  if (!termo) { box.hidden = true; return; }
  const achados = S.grupos.filter(g => g.disponivel && semAcento(g.base + ' ' + g.descricao + ' ' + g.categoria).includes(termo));
  box.hidden = false;
  box.innerHTML = achados.length
    ? `<p class="busca-rot">${achados.length} ${achados.length === 1 ? 'prato' : 'pratos'} com “${esc(S.busca)}”</p>${achados.map(itemHTML).join('')}`
    : `<p class="busca-vazia">Nada com “${esc(S.busca)}”.<small>Tenta “frango” ou “batata”.</small></p>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// O PRATO DE PERTO (zoom)
// ═══════════════════════════════════════════════════════════════════════════
function novoPd(g, fonte = 'cardapio') {
  const vs = g.disponiveis.length ? g.disponiveis : g.variantes;
  let idx = 0, porPessoas = false;
  if (vs.length > 1) {
    const a = vs[0], b = vs[vs.length - 1];
    if (S.pessoas >= 3) { idx = vs.length - 1; porPessoas = true; } // mesa grande: já vem no maior
    else if ((b.efetivo - a.efetivo) / a.efetivo <= 0.2) idx = vs.length - 1; // ancoragem
  }
  return { g, vs, idx, idxInicial: idx, porPessoas, upgradeClicado: false, fonte, opc: {}, sem: new Set(), qtd: 1, obs: '', obsAberta: false };
}
function ingredientesDe(g) {
  if (g.secao !== 'lanches') return [];
  return String(g.descricao || '').split(/,\s*|\s+e\s+/).map(s => s.trim()).filter(s => s && s.length < 26 && !/^(hamb[uú]rguer|p[aã]o|frango|picanha)$/i.test(s));
}
function faltaZoom() {
  const { g } = S.zoom;
  const f = (g.opcoes || []).findIndex((_, i) => !S.zoom.opc[i]);
  return f >= 0 ? g.opcoes[f].titulo : '';
}
function abrirZoom(key, fonte = 'cardapio') {
  const g = S.grupos.find(x => x.key === key); if (!g) return;
  if (g.secao === 'marmitex' && !marmitexAgora()) return toast(`Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h`, 'erro');
  S.zoom = novoPd(g, fonte);
  rastrear('produto_aberto', { produto: g.nome, fonte });
  const z = $('#zoom');
  z.innerHTML = `
    <div class="zoom-midia">${g.video || g.img ? videoHTML(g) : `<div class="zoom-louca">${pratoMini(g.nome, null, 'grande')}</div>`}</div>
    <button class="zoom-fechar" data-fechar-zoom aria-label="Fechar">${ICON.x}</button>
    <div class="zoom-rola"><div class="zoom-corpo" id="zoomCorpo"></div></div>
    <div class="zoom-pe" id="zoomPe"></div>`;
  renderZoom();
  mostrarCamada('zoom');
  ligarVideo($('.zoom-midia', z));
}
function renderZoom() {
  const { g, vs, idx } = S.zoom;
  const v = vs[idx];
  const nota = notaDe(g);
  const desc = [copyDe(g), g.desc && g.desc !== copyDe(g) ? cap(g.desc) : ''].filter(Boolean);
  const partes = [];
  if (vs.length > 1) {
    const gramas = vs.map(x => x.gramas || 0);
    const temGramas = gramas.every(Boolean);
    const maxG = Math.max(...gramas), minG = Math.min(...gramas);
    const ppg = vs.map(x => x.gramas ? x.efetivo / x.gramas : null);
    const melhor = ppg.every(Boolean) ? ppg.indexOf(Math.min(...ppg)) : -1;
    const maior = vs[vs.length - 1];
    partes.push(`
      <div class="z-bloco">
        <p class="z-rot">Tamanho${S.zoom.porPessoas ? ` <span>pra ${esc(mesaDe())}, a casa sugere o ${esc((maior.tam || '').toLowerCase())}</span>` : ''}</p>
        <div class="tams">${vs.map((x, i) => {
          const d = temGramas && maxG > minG ? Math.round(88 + 34 * ((x.gramas - minG) / (maxG - minG))) : 88 + 14 * i;
          return `<button class="tam${i === idx ? ' on' : ''}" data-tam="${i}">
            <span class="tam-prato" style="--d:${d}px"><b>${esc(x.letra || x.tam)}</b>${x.gramas ? `<small>${pesoTxt(x.gramas)}</small>` : ''}</span>
            <em>${fmtMenu(x.efetivo)}</em>${i === melhor && i === vs.length - 1 ? '<i>melhor custo</i>' : ''}
          </button>`;
        }).join('')}</div>
        ${idx < vs.length - 1 ? `<button class="up" data-tam="${vs.length - 1}" data-up>Por <b>+${fmt(r2(maior.efetivo - v.efetivo))}</b> você leva o ${esc((maior.tam || '').toLowerCase())}${maior.gramas && v.gramas ? ` (+${maior.gramas - v.gramas} g)` : ''}<span>trocar</span></button>` : ''}
      </div>`);
  }
  (g.opcoes || []).forEach((grp, gi) => {
    partes.push(`
      <div class="z-bloco">
        <p class="z-rot">${esc(grp.titulo)} <span class="${S.zoom.opc[gi] ? 'ok' : 'obr'}">${S.zoom.opc[gi] ? 'escolhido' : 'escolha um'}</span></p>
        <div class="opcs">${grp.itens.map(o => `<button class="opc${S.zoom.opc[gi] === o ? ' on' : ''}" data-opc="${gi}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div>
      </div>`);
  });
  const ingr = ingredientesDe(g);
  if (ingr.length) partes.push(`
    <div class="z-bloco">
      <p class="z-rot">Quer tirar algo? <span>toque pra tirar</span></p>
      <div class="opcs">${ingr.map(i => `<button class="opc ingr${S.zoom.sem.has(i) ? ' fora' : ''}" data-sem="${esc(i)}">${esc(i)}</button>`).join('')}</div>
    </div>`);
  partes.push(S.zoom.obsAberta || S.zoom.obs
    ? `<div class="z-bloco"><label class="z-rot" for="zObs">Observação</label><input class="campo" id="zObs" maxlength="140" placeholder="Ex.: bem passado, molho à parte" value="${esc(S.zoom.obs)}"></div>`
    : '<button class="z-obs" data-obs>+ Observação</button>');

  $('#zoomCorpo').innerHTML = `
    ${nota ? `<em class="z-nota">${esc(nota)}</em>` : ''}
    <h2 class="z-nome">${esc(g.nome)}</h2>
    ${desc.map(t => `<p class="z-desc">${esc(t)}</p>`).join('')}
    ${g.categoria === 'Porções' && g.secao !== 'acomp' ? '<p class="z-desc fraco">Acompanha o molho branco da casa.</p>' : ''}
    ${partes.join('')}`;
  const falta = faltaZoom();
  const mm = g.secao === 'marmitex' && !marmitexAgora();
  const aviso = mm ? `Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h` : !lojaAberta() ? 'Estamos fechados agora' : falta ? falta : '';
  $('#zoomPe').innerHTML = `
    ${aviso ? `<p class="z-aviso">${esc(aviso)}</p>` : ''}
    <div class="z-pe">
      <span class="passo-q grande"><button data-zq="-1" aria-label="Menos">${ICON.menos}</button><b>${S.zoom.qtd}</b><button data-zq="1" aria-label="Mais">${ICON.plus}</button></span>
      <button class="servir" data-servir ${aviso ? 'disabled' : ''}><span>Pôr na mesa</span><b>${fmt(r2(v.efetivo * S.zoom.qtd))}</b></button>
    </div>`;
}
function servir() {
  const { g } = S.zoom;
  const v = S.zoom.vs[S.zoom.idx];
  const obs = [];
  (g.opcoes || []).forEach((grp, i) => obs.push(`${grp.rotulo || grp.titulo}: ${S.zoom.opc[i]}`));
  if (S.zoom.sem.size) obs.push('Sem ' + [...S.zoom.sem].join(', '));
  if (S.zoom.obs.trim()) obs.push(S.zoom.obs.trim());
  const antes = totais();
  const origemRect = $('#zoom .zoom-midia')?.getBoundingClientRect();
  const ultimo = S.zoom.vs.length > 1 && S.zoom.idx === S.zoom.vs.length - 1;
  addItem({
    pid: v.id, nomeDb: v.nome, titulo: g.nome, sub: v.tam || '', preco: v.efetivo, qtd: S.zoom.qtd, obs: obs.join(' · '),
    secao: g.secao, img: v.imagem_url || g.img, origem: 'cardapio', fonte: S.zoom.fonte || 'cardapio',
    ...(ultimo ? {
      motivoTamanho: S.zoom.upgradeClicado ? 'upgrade' : S.zoom.idxInicial === S.zoom.idx ? 'ancora' : 'escolha',
      difTamanho: r2(v.efetivo - S.zoom.vs[0].efetivo),
    } : {}),
  });
  esconderCamada('zoom');
  voar(origemRect, g.nome, v.imagem_url || g.img);
  avisarFrete(antes);
  setTimeout(() => mostrarSugMesa(g), 700);
}

// ═══════════════════════════════════════════════════════════════════════════
// "COMBINA COM" — aparece colado na mesa, sem travar a tela
// ═══════════════════════════════════════════════════════════════════════════
let sugMesaT;
function mostrarSugMesa(g) {
  if (!SECOES_COMBINA.has(g.secao) || S.recusasCombina >= 2 || pilha.length) return;
  const cands = candidatosPara(g, 6).filter(r => !S.carrinho.some(i => i.pid === r.id)).slice(0, 2);
  if (!cands.length) return;
  if (S.sugMesa && !S.sugMesa.aceitos.size) encerrarSugMesa(true);
  S.sugMesa = { prato: g.nome, cands, aceitos: new Set() };
  rastrear('combina_mostrado', { produto: nomeBonito(parseNome(cands[0].nome).base), valor: efetivo(cands[0]), prato: g.nome });
  const molho = cands.find(ehMolho);
  if (molho) rastrear('molho_mostrado', { produto: nomeBonito(molho.nome), valor: efetivo(molho), prato: g.nome });
  renderSugMesa();
  clearTimeout(sugMesaT);
  sugMesaT = setTimeout(() => encerrarSugMesa(true), 12000);
}
function renderSugMesa() {
  const el = $('#sugMesa');
  if (!S.sugMesa) { el.classList.remove('on'); setTimeout(() => { if (!S.sugMesa) el.hidden = true; }, 300); return; }
  const { prato, cands, aceitos } = S.sugMesa;
  el.innerHTML = `
    <p>Combina com <b>${esc(prato)}</b></p>
    <div class="sm-itens">${cands.map(r => {
      const { base, tam } = parseNome(r.nome); const gg = grupoDaLinha(r);
      return `<button class="sm-it${aceitos.has(r.id) ? ' on' : ''}" data-junto="${r.id}">${pratoMini(r.nome, r.imagem_url || gg?.img)}<span><b>${esc(nomeBonito(base))}${tam ? ` (${esc(tam)})` : ''}</b><small>${ehMolho(r) ? 'especial da casa · ' : ''}+ ${fmtNum(efetivo(r))}</small></span><i>${aceitos.has(r.id) ? ICON.ok : ICON.plus}</i></button>`;
    }).join('')}</div>
    <button class="sm-x" data-sug-fechar aria-label="Dispensar">${ICON.x}</button>`;
  el.hidden = false; void el.offsetWidth; el.classList.add('on');
}
function encerrarSugMesa(recusou) {
  clearTimeout(sugMesaT);
  if (S.sugMesa && recusou && !S.sugMesa.aceitos.size) { S.recusasCombina++; rastrear('combina_recusado'); }
  S.sugMesa = null;
  renderSugMesa();
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIÇÃO (igual v2/v3, versão "v4")
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
  MED.fila.push({ sessao: sessaoId(), evento, produto, valor, pedido_id, dados: Object.keys(dados).length ? dados : null, versao: 'v4' });
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
// A MESA — lógica do carrinho (igual v2/v3)
// ═══════════════════════════════════════════════════════════════════════════
function chaveItem(it) { return [it.pid, it.nomeDb, it.obs || ''].join('|'); }
function addItem(it, animar = true) {
  const k = chaveItem(it);
  const ex = S.carrinho.find(i => i.k === k);
  if (ex) ex.qtd += it.qtd; else S.carrinho.push({ origem: 'cardapio', fonte: 'cardapio', ...it, k });
  salvarCarrinho();
  rastrear('item_adicionado', { produto: it.titulo, valor: r2(it.preco * it.qtd), origem: it.origem || 'cardapio', fonte: it.fonte || 'cardapio' });
  if (animar) { renderMesa(); atualizarMais(); if (!$('#fechar').hidden && S.fecharModo === 'mesa') renderFechar(); }
}
function mudarQtd(k, delta) {
  const it = S.carrinho.find(i => i.k === k); if (!it) return;
  it.qtd += delta;
  if (it.qtd <= 0) S.carrinho = S.carrinho.filter(i => i.k !== k);
  salvarCarrinho(); renderMesa(); atualizarMais();
  if (!$('#fechar').hidden && S.fecharModo === 'mesa') renderFechar();
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
function grupoDaLinha(row) { return row && S.grupos.find(x => x.variantes.some(v => v.id === row.id)); }
function itemRapido(row, qtd = 1, origem = 'cardapio', fonte = 'cardapio') {
  const { base, tam } = parseNome(row.nome);
  const g = grupoDaLinha(row);
  return { pid: row.id, nomeDb: row.nome, titulo: nomeBonito(base), sub: tam || '', preco: efetivo(row), qtd, obs: '', secao: g?.secao || '', img: row.imagem_url || g?.img || null, origem, fonte };
}
function avisarFrete(antes) {
  const depois = totais();
  if (antes.fg > 0 && !antes.gratis && depois.gratis) {
    toast('Frete grátis desbloqueado!', 'ok');
    const m = $('#mesa'); m.classList.remove('festa'); void m.offsetWidth; m.classList.add('festa');
    return true;
  }
  return false;
}
function addRapido(row, { qtd = 1, combina = true, origem = 'cardapio', fonte = 'cardapio', de = null } = {}) {
  if (!lojaAberta()) return toast('Estamos fechados agora. Volta mais tarde!', 'erro');
  const g = grupoDaLinha(row);
  const antes = totais();
  addItem(itemRapido(row, qtd, origem, fonte));
  voar(de, row.nome, row.imagem_url || g?.img);
  avisarFrete(antes);
  if (combina && g) setTimeout(() => mostrarSugMesa(g), 700);
}

// Pratos da mesa (agrupados) e os lugares que ainda estão vazios
function pratosNaMesa() {
  const m = new Map();
  S.carrinho.forEach(it => {
    const g = S.grupos.find(x => x.variantes.some(v => v.id === it.pid));
    const k = g?.key || it.pid;
    const e = m.get(k) || { nome: it.titulo, img: it.img || g?.img, qtd: 0 };
    e.qtd += it.qtd; m.set(k, e);
  });
  return [...m.values()];
}
function lugaresVazios() {
  if (!S.carrinho.some(i => painelDaSecao(i.secao) === 0)) return [];
  const out = [];
  const molho = S.rows.find(ehMolho);
  if (!S.carrinho.some(i => i.secao === 'acomp' && !ehMolho(S.porId.get(i.pid)))) out.push({ rot: 'acomp.', etapa: 2 });
  if (molho && molho.disponivel !== false && !S.carrinho.some(i => i.pid === molho.id)) out.push({ rot: 'molho', etapa: 2 });
  if (!S.carrinho.some(i => i.secao === 'bebidas')) out.push({ rot: 'bebida', etapa: 3 });
  return out;
}
function renderMesa(pula = false) {
  const qtd = S.carrinho.reduce((s, i) => s + i.qtd, 0);
  const mesa = $('#mesa');
  mesa.hidden = qtd === 0;
  document.body.classList.toggle('com-mesa', qtd > 0);
  if (!qtd) return;
  const t = totais();
  const pratos = pratosNaMesa();
  const vis = pratos.slice(0, 5);
  $('#mesaPratos').innerHTML = vis.map(p => `<span class="mp">${pratoMini(p.nome, p.img)}${p.qtd > 1 ? `<i>${p.qtd}</i>` : ''}</span>`).join('')
    + (pratos.length > 5 ? `<span class="mp mais-n">+${pratos.length - 5}</span>` : '')
    + lugaresVazios().map(l => `<button class="vazio" data-lugar="${l.etapa}" aria-label="Escolher ${l.rot}"><span>${ICON.plus}</span><small>${l.rot}</small></button>`).join('');
  $('#mesaTotal').textContent = fmt(t.sub);
  $('#mesaFreteBarra').style.width = t.fg > 0 ? Math.min(100, t.sub / t.fg * 100) + '%' : '0';
  $('#mesaDica').innerHTML = t.fg > 0 ? (t.gratis ? '<b>Frete grátis</b> garantido' : `Faltam <b>${fmt(t.falta)}</b> pro frete grátis`) : `${qtd} ${qtd === 1 ? 'item' : 'itens'} na mesa`;
  if (pula) { mesa.classList.remove('pula'); void mesa.offsetWidth; mesa.classList.add('pula'); }
}
// O prato "voa" de onde foi tocado até a mesa
function voar(origem, nome, img) {
  const alvoEl = $('#mesaPratos');
  if (reduzMovimento() || !origem || $('#mesa').hidden) { renderMesa(true); return; }
  const de = origem.getBoundingClientRect ? origem.getBoundingClientRect() : origem;
  const ultimo = $('#mesaPratos .mp:last-of-type') || alvoEl;
  const ate = ultimo.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'voo';
  p.innerHTML = pratoMini(nome, img);
  const tam = 64;
  p.style.left = (de.left + de.width / 2 - tam / 2) + 'px';
  p.style.top = (de.top + de.height / 2 - tam / 2) + 'px';
  document.body.appendChild(p);
  const dx = ate.left + ate.width / 2 - (de.left + de.width / 2);
  const dy = ate.top + ate.height / 2 - (de.top + de.height / 2);
  p.animate([
    { transform: 'translate(0,0) scale(.6)', opacity: 0 },
    { transform: `translate(${dx * .35}px, ${dy * .35 - 90}px) scale(1.15)`, opacity: 1, offset: .4 },
    { transform: `translate(${dx}px, ${dy}px) scale(.55)`, opacity: 1 },
  ], { duration: 720, easing: 'cubic-bezier(.45,0,.25,1)' }).onfinish = () => { p.remove(); renderMesa(true); };
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMADAS (prato de perto / fechar a mesa) + botão voltar do celular
// ═══════════════════════════════════════════════════════════════════════════
const pilha = [];
let ignorarPop = false;
function mostrarCamada(id) {
  const el = $('#' + id);
  el.hidden = false; void el.offsetWidth; el.classList.add('on');
  if (!pilha.includes(id)) { pilha.push(id); history.pushState({ camada: id }, ''); }
  document.body.classList.add('travado');
  if (S.sugMesa) encerrarSugMesa(false);
}
function esconderCamada(id, viaHistorico = false) {
  const el = $('#' + id);
  if (!el || el.hidden) return;
  el.classList.remove('on');
  $$('video', el).forEach(v => v.pause());
  setTimeout(() => { if (!el.classList.contains('on')) el.hidden = true; }, 340);
  const i = pilha.indexOf(id); if (i >= 0) pilha.splice(i, 1);
  if (!pilha.length) document.body.classList.remove('travado');
  if (id === 'fechar') {
    if (S.canalPedido) { sb.removeChannel(S.canalPedido); S.canalPedido = null; }
    if (S.fecharModo === 'status') S.fecharModo = 'mesa';
  }
  if (id === 'zoom') S.zoom = null;
  if (!viaHistorico && history.state?.camada === id) { ignorarPop = true; history.back(); }
}
addEventListener('popstate', () => {
  if (ignorarPop) { ignorarPop = false; return; }
  const topo = pilha[pilha.length - 1];
  if (topo === 'fechar' && S.fecharModo === 'checkout') { lerCampos(); S.fecharModo = 'mesa'; renderFechar(); history.pushState({ camada: 'fechar' }, ''); return; }
  if (topo) esconderCamada(topo, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// FECHAR A MESA — revisão → seus dados → acompanhar
// ═══════════════════════════════════════════════════════════════════════════
function abrirFechar(modo = 'mesa') {
  if (S.zoom) esconderCamada('zoom');
  S.fecharModo = modo;
  if (modo === 'mesa') { validarCarrinho(); const t = totais(); rastrear('carrinho_aberto', { valor: t.sub, falta_frete: t.falta }); }
  renderFechar();
  mostrarCamada('fechar');
  $('#fechar .f-rola') && ($('#fechar .f-rola').scrollTop = 0);
}
function renderFechar() {
  const el = $('#fechar');
  const y = $('.f-rola', el)?.scrollTop || 0;
  const mesmo = el.dataset.modo === S.fecharModo;
  const c = S.fecharModo === 'checkout' && S.ck ? fCheckout() : S.fecharModo === 'status' && S.ult ? fStatus() : fMesa();
  el.dataset.modo = S.fecharModo;
  el.innerHTML = `
    <header class="f-topo">
      <button class="f-volta" ${S.fecharModo === 'checkout' ? 'data-f-voltar' : 'data-fechar-mesa'} aria-label="Voltar">${ICON.voltar}</button>
      <div><small>${c.sobre}</small><h2>${c.titulo}</h2></div>
    </header>
    <div class="f-rola">${c.corpo}</div>
    ${c.pe ? `<footer class="f-pe">${c.pe}</footer>` : ''}`;
  if (mesmo) $('.f-rola', el).scrollTop = y;
}

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
      .sort((a, b) => efetivo(a) - efetivo(b)).slice(0, 2).forEach(r => push(r, true));
  }
  const peso = new Map(); const vistos = new Set();
  S.carrinho.forEach(it => {
    const g = S.grupos.find(x => x.variantes.some(v => v.id === it.pid));
    if (!g || vistos.has(g.key)) return;
    vistos.add(g.key);
    candidatosPara(g, 6).forEach((r, i) => peso.set(r.id, (peso.get(r.id) || 0) + (6 - i)));
  });
  [...peso.entries()].sort((a, b) => b[1] - a[1]).forEach(([id]) => { const r = S.porId.get(id); if (r && semAlcool(r)) push(r); });
  return out.slice(0, 5);
}
function validarCarrinho() {
  if (!S.porId.size) return;
  let removidos = 0;
  S.carrinho = S.carrinho.filter(it => {
    const r = S.porId.get(it.pid);
    if (!r || r.disponivel === false) { removidos++; return false; }
    if (!it.meio) it.preco = efetivo(r);
    return true;
  });
  if (removidos) { salvarCarrinho(); renderMesa(); atualizarMais(); toast(`${removidos} item${removidos > 1 ? 's' : ''} ficou indisponível e saiu da mesa`, 'erro'); }
}

function fMesa() {
  const qtd = S.carrinho.reduce((s, i) => s + i.qtd, 0);
  const sobre = cap(mesaDe());
  if (!qtd) return { sobre, titulo: 'Sua mesa', corpo: `<div class="f-vazia">${pratoMini('Mesa', null, 'grande vazio')}<p>A mesa ainda está vazia.</p><button class="btn-brasa" data-fechar-mesa>Escolher os pratos</button></div>`, pe: '' };
  const t = totais();
  const min = num('pedido_minimo');
  const sug = sugestoes();
  const fecha = sug.filter(s => s.fecha), resto = sug.filter(s => !s.fecha);
  const vazios = lugaresVazios();
  const chip = ({ r, fecha: f }) => {
    const { base, tam } = parseNome(r.nome); const gg = grupoDaLinha(r);
    return `<button class="chip-prato" data-sug="${r.id}" ${f ? 'data-fecha' : ''}>${pratoMini(r.nome, r.imagem_url || gg?.img)}<b>${esc(nomeBonito(base))}${tam ? ` (${esc(tam)})` : ''}</b><small>${ehMolho(r) ? 'especial da casa' : f ? 'libera o frete' : ''}</small><em>+ ${fmtNum(efetivo(r))}</em></button>`;
  };
  const corpo = `
    <div class="f-mesa-vista">
      ${pratosNaMesa().map(p => `<div class="fv-prato">${pratoMini(p.nome, p.img)}${p.qtd > 1 ? `<i>${p.qtd}</i>` : ''}</div>`).join('')}
      ${vazios.map(l => `<button class="fv-vazio" data-lugar="${l.etapa}"><span>${ICON.plus}</span><small>${l.rot}</small></button>`).join('')}
    </div>
    ${vazios.length ? `<p class="f-dica">Ainda tem lugar na mesa: ${vazios.map(l => l.rot.replace('.', 'anhamento')).join(', ')}.</p>` : ''}
    <div class="f-itens">${S.carrinho.map(it => `
      <div class="f-it">
        ${pratoMini(it.titulo, it.img)}
        <div class="f-it-txt"><b>${esc(it.titulo)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}${it.obs ? `<small>${esc(it.obs)}</small>` : ''}</div>
        <div class="f-it-lado">
          <em>${fmt(it.preco * it.qtd)}</em>
          <span class="passo-q"><button data-q="-1" data-k="${esc(it.k)}" aria-label="Menos">${ICON.menos}</button><b>${it.qtd}</b><button data-q="1" data-k="${esc(it.k)}" aria-label="Mais">${ICON.plus}</button></span>
        </div>
      </div>`).join('')}
    </div>
    ${t.fg > 0 ? `
      <div class="f-frete${t.gratis ? ' ok' : ''}">
        <p>${t.gratis ? '<b>Frete grátis</b> garantido na entrega' : `Faltam <b>${fmt(t.falta)}</b> pro frete grátis`}</p>
        <span><i style="width:${Math.min(100, t.sub / t.fg * 100)}%"></i></span>
      </div>` : ''}
    ${fecha.length ? `<p class="f-rot">Com um destes, a entrega sai grátis</p><div class="chips">${fecha.map(chip).join('')}</div>` : ''}
    ${resto.length ? `<p class="f-rot">Pra completar a mesa</p><div class="chips">${resto.map(chip).join('')}</div>` : ''}`;
  const pe = `
    <div class="f-tot">
      <p><span>Subtotal</span><span>${fmt(t.sub)}</span></p>
      <p><span>Entrega</span><span>${t.gratis ? 'grátis' : fmt(t.taxa)}</span></p>
      <p class="tot"><span>Total</span><span>${fmt(t.total)}</span></p>
    </div>
    ${t.sub < min ? `<p class="f-aviso">Pedido mínimo de ${fmt(min)} — faltam ${fmt(r2(min - t.sub))}</p>` : ''}
    ${!lojaAberta() ? '<p class="f-aviso">Estamos fechados agora. Volta mais tarde!</p>' : ''}
    <button class="btn-brasa grande" data-f-checkout ${t.sub < min || !lojaAberta() ? 'disabled' : ''}><span>Continuar</span><b>${fmt(t.total)}</b></button>`;
  return { sobre, titulo: 'Sua mesa', corpo, pe };
}

// ─── SEUS DADOS ─────────────────────────────────────────────────────────────
const mascaraTel = v => { const d = soDigitos(v).slice(0, 11); if (d.length <= 2) return d; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };
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
  S.fecharModo = 'checkout';
  renderFechar();
  $('#fechar .f-rola').scrollTop = 0;
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
const campo = (id, rot, val, extra = '') => `<label class="cmp"><span>${rot}</span><input class="campo" id="${id}" value="${esc(val)}" ${extra}></label>`;
function fCheckout() {
  const ck = S.ck, t = totais(ck.tipo);
  const bump = ck.bumpPid && S.porId.get(ck.bumpPid);
  const bi = bump && parseNome(bump.nome);
  const pags = [{ k: 'pix', t: 'PIX' }, { k: 'dinheiro', t: 'Dinheiro' }, { k: 'cartao_credito', t: 'Crédito' }, { k: 'cartao_debito', t: 'Débito' }];
  const corpo = `
    <div class="ck-sec">
      <p class="f-rot">Quem pede</p>
      ${campo('ckNome', 'Nome', ck.nome, 'autocomplete="name" placeholder="Como te chamamos?"')}
      ${campo('ckTel', 'WhatsApp', mascaraTel(ck.tel), 'type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(44) 99999-9999"')}
    </div>
    <div class="ck-sec">
      <p class="f-rot">Como receber</p>
      <div class="duas">
        <button class="op${ck.tipo === 'delivery' ? ' on' : ''}" data-tipo="delivery"><b>Entrega</b><small>${t.gratis || ck.tipo === 'delivery' && t.taxa === 0 ? 'frete grátis' : fmt(num('taxa_entrega'))} · ${C.DEFAULTS.tempo_entrega}</small></button>
        <button class="op${ck.tipo === 'retirada' ? ' on' : ''}" data-tipo="retirada"><b>Retirar</b><small>sem taxa · ${C.DEFAULTS.tempo_retirada}</small></button>
      </div>
      ${ck.tipo === 'delivery'
        ? `${campo('ckRua', 'Rua e número', ck.rua, 'autocomplete="street-address" placeholder="Av. Paraná, 1234"')}
           <div class="duas">${campo('ckBairro', 'Bairro', ck.bairro, 'placeholder="Bairro"')}${campo('ckComp', 'Complemento', ck.comp, 'placeholder="Ap, casa"')}</div>`
        : `<p class="f-nota">Retirada em <b>${esc(valido(S.info.endereco) ? S.info.endereco : 'Choppatinhas, Umuarama-PR')}</b></p>`}
    </div>
    ${bump && (!S.carrinho.some(i => i.pid === bump.id) || ck.bumpOn) ? `
      <button class="bump${ck.bumpOn ? ' on' : ''}" data-bump>
        ${pratoMini(bump.nome, bump.imagem_url || grupoDaLinha(bump)?.img)}
        <span><small>Última chamada da cozinha</small><b>${esc(nomeBonito(bi.base))}${bi.tam ? ` (${esc(bi.tam)})` : ''}</b><em>${ck.bumpOn ? 'na mesa ✓' : ck.tipo === 'delivery' && t.falta > 0 && efetivo(bump) >= t.falta ? 'inclua e a entrega sai grátis' : 'um toque e vai junto'}</em></span>
        <strong>+ ${fmtNum(efetivo(bump))}</strong>
      </button>` : ''}
    <div class="ck-sec">
      <p class="f-rot">Pagamento</p>
      <div class="quatro">${pags.map(p => `<button class="op${ck.pag === p.k ? ' on' : ''}" data-pag="${p.k}"><b>${p.t}</b></button>`).join('')}</div>
      ${ck.pag === 'dinheiro' ? campo('ckTroco', 'Troco para', ck.troco, 'inputmode="decimal" placeholder="Vazio se não precisar"') : ''}
      ${ck.pag && ck.pag !== 'pix' ? '<p class="f-nota">Pagamento na entrega / retirada.</p>' : ''}
    </div>
    <div class="ck-sec">
      <p class="f-rot">Observação</p>
      <input class="campo" id="ckObs" maxlength="200" placeholder="Alguma observação pro pedido?" value="${esc(ck.obs)}">
    </div>`;
  const pe = `
    <div class="f-tot">
      <p><span>Subtotal</span><span>${fmt(t.sub)}</span></p>
      <p><span>${ck.tipo === 'retirada' ? 'Retirada' : 'Entrega'}</span><span>${t.taxa === 0 ? 'grátis' : fmt(t.taxa)}</span></p>
      <p class="tot"><span>Total</span><span>${fmt(t.total)}</span></p>
    </div>
    <button class="btn-brasa grande verde" id="ckFinalizar" ${ck.enviando ? 'disabled' : ''}><span>${ck.enviando ? 'Enviando…' : 'Enviar pedido'}</span><b>${ck.enviando ? '' : fmt(t.total)}</b></button>`;
  return { sobre: cap(mesaDe()), titulo: 'Seus dados', corpo, pe };
}
function validarCheckout() {
  lerCampos();
  const ck = S.ck; const erros = [];
  if (ck.nome.length < 2) erros.push('#ckNome');
  if (ck.tel.length < 10) erros.push('#ckTel');
  if (ck.tipo === 'delivery') { if (ck.rua.length < 4) erros.push('#ckRua'); if (ck.bairro.length < 2) erros.push('#ckBairro'); }
  $$('#fechar .campo.erro').forEach(e => e.classList.remove('erro'));
  erros.forEach(s => $(s)?.classList.add('erro'));
  if (erros.length) { $(erros[0])?.scrollIntoView({ block: 'center', behavior: 'smooth' }); $(erros[0])?.focus({ preventScroll: true }); toast('Confere os campos marcados', 'erro'); return false; }
  if (!ck.pag) { toast('Escolha a forma de pagamento', 'erro'); $('#fechar .quatro')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; }
  return true;
}
function telefoneBanco(d) { d = soDigitos(d); return d.length <= 11 ? '55' + d : d; }

async function finalizar() {
  const ck = S.ck;
  if (ck.enviando || !validarCheckout()) return;
  ck.enviando = true; renderFechar();
  try {
    const { data: st } = await sb.from('info_restaurante').select('valor').eq('chave', 'loja_aberta').maybeSingle();
    if (st && String(st.valor) !== 'true') { S.info.loja_aberta = st.valor; renderTopo(); throw new Error('FECHADA'); }
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

    const obsPedido = [S.pessoas ? `Mesa de ${S.pessoas >= 6 ? '5+' : S.pessoas === 4 ? '3-4' : S.pessoas} pessoa(s)` : '', ck.obs, ck.pag === 'dinheiro' && ck.troco ? `Troco para R$ ${ck.troco}` : ''].filter(Boolean).join(' · ') || null;
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
    const receitaSug = r2(['combina', 'molho', 'sugestao_mesa', 'libera_frete', 'vai_bem', 'oferta_rapida', 'latas6'].reduce((s2, o) => s2 + (porOrigem[o] || 0), 0));
    rastrear('pedido_feito', {
      pedido_id: pedido.id, valor: t.total, subtotal: t.sub, taxa: t.taxa, tipo: ck.tipo, pagamento: ck.pag, pessoas: S.pessoas || null,
      frete_gratis: ck.tipo === 'delivery' && t.taxa === 0, itens: S.carrinho.reduce((s2, i) => s2 + i.qtd, 0),
      por_origem: porOrigem, por_fonte: porFonte, receita_sugestoes: receitaSug, ganho_tamanho: ganhoTamanho,
    });
    enviarEventos();
    S.carrinho = []; salvarCarrinho(); S.ck = null; S.sugVista.clear();
    renderMesa(); atualizarMais(); renderRetorno();
    abrirStatus(ult, true);
  } catch (e) {
    console.error(e);
    ck.enviando = false; renderFechar();
    if (e.message === 'FECHADA') toast('A loja acabou de fechar. Tenta mais tarde!', 'erro');
    else if (e.message === 'MARMITEX') toast(`Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h`, 'erro');
    else toast('Não conseguimos enviar agora. Confere a internet e tenta de novo.', 'erro');
  }
}

// ─── ACOMPANHAR ─────────────────────────────────────────────────────────────
function msgWhatsApp(u) {
  const sep = '━━━━━━━━━━━━━━━';
  const linhas = u.itens.map(i => `${i.qtd}x ${i.titulo}${i.sub ? ` (${i.sub})` : ''}  ${fmt(i.preco * i.qtd)}${i.obs ? `\n   _${i.obs}_` : ''}`).join('\n');
  const pagNome = { pix: 'PIX', dinheiro: 'Dinheiro', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito' }[u.pag] || u.pag;
  return `Olá! Fiz um pedido pelo cardápio.\n\n*Pedido #${String(u.numero).padStart(3, '0')}*\n${sep}\n${linhas}\n${sep}\nSubtotal: ${fmt(u.sub)}\n${u.taxa > 0 ? `Entrega: ${fmt(u.taxa)}\n` : ''}*Total: ${fmt(u.total)}*\n\n${u.tipo === 'delivery' ? `📍 *Entrega em:*\n${u.endereco}` : '🛍️ *Retirada no local*'}\n\n💳 *Pagamento:* ${pagNome}${u.pag === 'pix' ? '\n\nSegue o comprovante 👇' : ''}`;
}
async function abrirStatus(u, novo = false) {
  S.ult = u; S.stEtapa = novo ? null : etapaDe(u.status);
  if ($('#fechar').hidden) { S.fecharModo = 'status'; renderFechar(); mostrarCamada('fechar'); }
  else { S.fecharModo = 'status'; renderFechar(); }
  if (!novo) {
    const { data } = await sb.from('pedidos').select('status').eq('id', u.id).maybeSingle();
    if (data) { u.status = data.status; lsSet('chopp_ultimo', u); if (S.fecharModo === 'status') renderFechar(); }
  }
  if (S.canalPedido) sb.removeChannel(S.canalPedido);
  S.canalPedido = sb.channel('pedido-' + u.id)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${u.id}` }, ({ new: n }) => {
      const antes = etapaDe(u.status);
      u.status = n.status; lsSet('chopp_ultimo', u);
      if (S.fecharModo === 'status') renderFechar();
      renderRetorno();
      if (etapaDe(n.status) > antes) { toast(ETAPAS[u.tipo][etapaDe(n.status)]?.t + '!', 'ok'); navigator.vibrate?.(120); }
    })
    .subscribe();
}
function fStatus() {
  const u = S.ult;
  const et = etapaDe(u.status);
  const etapas = ETAPAS[u.tipo || 'delivery'];
  const anima = S.stEtapa !== et && !reduzMovimento(); S.stEtapa = et;
  const wa = soDigitos(S.info.whatsapp);
  const chave = valido(S.info.chave_pix) ? S.info.chave_pix : '';
  const linkWa = wa.length >= 10 ? `https://wa.me/${wa.length <= 11 ? '55' + wa : wa}?text=${encodeURIComponent(msgWhatsApp(u))}` : '';
  const CIRC = 2 * Math.PI * 70;
  const prog = et < 0 ? 0 : (et + 1) / 4;
  const corpo = `
    <div class="st-anel${anima ? ' anima' : ''}">
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle cx="80" cy="80" r="70" class="st-fundo"/>
        <circle cx="80" cy="80" r="70" class="st-prog${et < 0 ? ' cancel' : ''}" style="stroke-dasharray:${CIRC};stroke-dashoffset:${CIRC * (1 - prog)}"/>
      </svg>
      <div class="st-centro"><small>Pedido</small><b>nº ${String(u.numero).padStart(3, '0')}</b><span>${et < 0 ? 'cancelado' : esc(etapas[Math.max(0, et)].t)}</span></div>
    </div>
    ${et < 0 ? '<p class="f-aviso">Este pedido foi cancelado pela casa. Fale com a gente no WhatsApp se tiver dúvida.</p>' : `
    <ol class="st-etapas">${etapas.map((e, i) => `<li class="${i < et || et === 3 ? 'feito' : i === et ? 'agora' : ''}"><i>${i < et || et === 3 ? ICON.ok : i + 1}</i><span><b>${esc(e.t)}</b><small>${esc(e.d)}</small></span></li>`).join('')}</ol>
    ${et < 3 ? `<p class="f-nota centro">${u.tipo === 'delivery' ? `Previsão: ${C.DEFAULTS.tempo_entrega}` : `Fica pronto em ${C.DEFAULTS.tempo_retirada}`} · ${fmt(u.total)}</p>` : ''}`}
    ${u.pag === 'pix' && et >= 0 && et < 3 ? `
    <div class="st-pix">
      <p class="f-rot">Pagamento via PIX</p>
      ${chave ? `<p>Copie a chave, pague e mande o comprovante no WhatsApp.</p><div class="pix-chave"><code id="pixChave">${esc(chave)}</code><button data-copiar="${esc(chave)}">Copiar</button></div>` : '<p>A casa te manda a chave PIX no WhatsApp em instantes.</p>'}
      <p>Valor: <b>${fmt(u.total)}</b></p>
    </div>` : ''}`;
  const pe = `
    ${linkWa ? `<a class="btn-brasa grande verde" href="${linkWa}" target="_blank" rel="noopener"><span>${u.pag === 'pix' ? 'Enviar comprovante' : 'Falar com a casa'}</span><b>WhatsApp</b></a>` : ''}
    <button class="btn-link" data-fechar-mesa>Voltar ao cardápio</button>`;
  return { sobre: 'Acompanhando', titulo: 'Seu pedido', corpo, pe };
}

// ─── AVISO ──────────────────────────────────────────────────────────────────
let toastT;
function toast(msg, tipo = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'aviso on ' + tipo;
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN (mesma lógica das versões anteriores)
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
        ${painel ? `<a class="btn-ghost claro" href="${esc(painel)}" target="_blank" rel="noopener">Pedidos ↗</a>` : ''}
        <button class="fechar" data-adm-fechar aria-label="Fechar">${ICON.x}</button>
      </div>
      <div class="adm-abas">
        <button class="adm-aba${ADM.aba === 'produtos' ? ' on' : ''}" data-adm-aba="produtos">Produtos</button>
        <button class="adm-aba${ADM.aba === 'loja' ? ' on' : ''}" data-adm-aba="loja">Loja</button>
        <button class="adm-aba${ADM.aba === 'resultados' ? ' on' : ''}" data-adm-aba="resultados">Resultados</button>
      </div>
    </div>
    <div class="adm-corpo">${ADM.aba === 'produtos' ? admProdutosHTML() : ADM.aba === 'loja' ? admLojaHTML() : '<div id="admRes"><p class="adm-dica">Carregando resultados…</p></div>'}</div>
    ${ADM.edit ? admEditHTML() : ''}`;
  if (ADM.aba === 'resultados') carregarResultados();
}
async function carregarResultados() {
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const [ped, ev] = await Promise.all([
    sb.from('pedidos').select('total, subtotal, taxa_entrega, tipo_entrega, canal, status').gte('created_at', desde).neq('status', 'cancelado').limit(5000),
    sb.from('eventos_cardapio').select('sessao, evento, produto, valor, dados, versao').gte('created_at', desde).limit(20000),
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
    const porVersao = v => { const f = feitos.filter(e => e.versao === v); return f.length ? `${f.length} · ${mediaEv(f)}` : '—'; };
    const linha = (nome, mostrado, aceito, receita, nota = '') => `<tr><td>${nome}${nota ? `<small>${nota}</small>` : ''}</td><td>${mostrado ?? '—'}</td><td>${aceito}</td><td>${mostrado ? pct(aceito, mostrado) : '—'}</td><td><b>${fmt(receita)}</b></td></tr>`;
    html += `
      <h3 class="res-tit">Funil</h3>
      <div class="res-grid tres">
        <div class="res-card"><small>Visitas</small><strong>${visitas}</strong></div>
        <div class="res-card"><small>Pedidos</small><strong>${feitos.length}</strong></div>
        <div class="res-card"><small>Conversão</small><strong>${pct(feitos.length, visitas)}</strong></div>
      </div>
      <h3 class="res-tit">Por versão do cardápio</h3>
      <div class="res-grid tres">
        <div class="res-card"><small>v2</small><strong style="font-size:18px">${porVersao('v2')}</strong><span>pedidos · ticket</span></div>
        <div class="res-card"><small>v3</small><strong style="font-size:18px">${porVersao('v3')}</strong><span>pedidos · ticket</span></div>
        <div class="res-card on"><small>v4</small><strong style="font-size:18px">${porVersao('v4')}</strong><span>pedidos · ticket</span></div>
      </div>
      <h3 class="res-tit">Quanto as sugestões renderam</h3>
      <div class="res-grid">
        <div class="res-card on"><small>Receita vinda de sugestões</small><strong>${fmt(r2(receitaSug + ganhoTam))}</strong><span>${pct(r2(receitaSug + ganhoTam), receitaCard)} do faturamento do cardápio</span></div>
        <div class="res-card"><small>Ticket com sugestão aceita</small><strong>${mediaEv(comSug)}</strong><span>sem sugestão: ${mediaEv(semSug)}</span></div>
      </div>
      <div class="res-tab-wrap"><table class="res-tab">
        <thead><tr><th>Alavanca</th><th>Mostrado</th><th>Aceito</th><th>Taxa</th><th>Receita*</th></tr></thead>
        <tbody>
          ${linha('“Combina com” / “vai bem junto”', conta('combina_mostrado'), conta('combina_aceito'), somaOrigem('combina'))}
          ${linha('Molho especial da casa', conta('molho_mostrado'), aceitosOrigem('molho'), somaOrigem('molho'), 'sugerido com frango, combos e porções')}
          ${linha('“A casa sugere pra sua mesa”', conta('sugestao_mesa_mostrada'), conta('sugestao_mesa_aceita'), somaOrigem('sugestao_mesa'), 'v4: completa a etapa num toque')}
          ${linha('Oferta rápida', conta('oferta_mostrada'), conta('oferta_aceita'), somaOrigem('oferta_rapida'))}
          ${linha('“Libera o frete”', null, aceitosOrigem('libera_frete'), somaOrigem('libera_frete'), 'no carrinho')}
          ${linha('Sugestões no carrinho', null, aceitosOrigem('vai_bem'), somaOrigem('vai_bem'))}
          ${linha('Tamanho maior', null, conta('upgrade_tamanho'), ganhoTam, 'botão + maior pré-marcado')}
          ${linha('+6 latas', null, aceitosOrigem('latas6'), somaOrigem('latas6'))}
          ${linha('Vídeo em destaque', null, conta('destaque_clique'), somaFonte('destaque'), 'cliques → itens vindos dele')}
          ${linha('A casa recomenda', null, E.filter(e => e.evento === 'produto_aberto' && e.dados?.fonte === 'mais_pedidos').length, somaFonte('mais_pedidos'))}
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
  const palco = grupoDestaque();
  return `
    <div class="adm-barra">
      <input class="campo" id="admBusca" placeholder="Buscar produto…" value="${esc(ADM.busca)}">
      <button class="btn-cta sm" data-adm-novo>＋ Novo produto</button>
    </div>
    <p class="adm-dica">🎬 <b>Vídeo no topo:</b> edite o produto (✎) e envie um vídeo. Ele vira o destaque do cardápio. ${palco?.video ? `Hoje: <b>${esc(palco.nome)}</b>.` : 'Nenhum vídeo ainda: o topo mostra a foto do mais pedido.'}</p>
    <p class="adm-leg">⭐ = destaque · o interruptor liga/desliga o produto na hora.</p>
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
    }).join('') || '<p class="adm-dica">Nenhum produto encontrado.</p>'}`;
}
function admEditHTML() {
  const r = ADM.edit;
  const cats = [...new Set(S.rows.map(x => x.categoria).filter(Boolean))];
  const prev = r._preview || r.imagem_url;
  const prevV = r._previewV || r.video_url;
  const irmaos = r.nome ? S.rows.filter(x => x.id !== r.id && x.categoria === r.categoria && parseNome(x.nome).base === parseNome(r.nome).base).length : 0;
  return `
    <div class="adm-veu" data-adm-cancelar></div>
    <section class="adm-sheet" role="dialog" aria-modal="true">
      <div class="adm-sheet-cab"><h2>${r.id ? 'Editar produto' : 'Novo produto'}</h2><button class="fechar" data-adm-cancelar aria-label="Fechar">${ICON.x}</button></div>
      <div class="adm-sheet-corpo">
        <form class="adm-form" id="admForm">
          <div class="adm-midia">
            <div class="adm-midia-prev">${prev ? `<img src="${esc(prev)}" alt="">` : window.ChoppArt.svg(r.nome || '', '')}</div>
            <div style="display:grid;gap:6px">
              <label class="btn-ghost">📷 ${prev ? 'Trocar foto' : 'Enviar foto'}<input type="file" id="admFoto" accept="image/*" hidden></label>
              ${prev ? '<button type="button" class="btn-ghost adm-perigo" data-adm-semfoto>Remover foto</button>' : ''}
            </div>
          </div>
          <div class="adm-midia">
            <div class="adm-midia-prev">${prevV ? `<video src="${esc(prevV)}" muted autoplay loop playsinline></video>` : '<span style="font-size:26px">🎬</span>'}</div>
            <div style="display:grid;gap:6px">
              <label class="btn-ghost">🎬 ${prevV ? 'Trocar vídeo' : 'Enviar vídeo'}<input type="file" id="admVideo" accept="video/mp4,video/webm,video/quicktime" hidden></label>
              ${prevV ? '<button type="button" class="btn-ghost adm-perigo" data-adm-semvideo>Remover vídeo</button>' : ''}
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
      <div class="adm-sheet-pe">
        ${r.id ? '<button class="btn-ghost adm-perigo" data-adm-excluir>Excluir</button>' : ''}
        <button class="btn-cta" style="flex:1" id="admSalvar">Salvar</button>
      </div>
    </section>`;
}
function admLojaHTML() {
  const v = k => esc(S.info[k] ?? '');
  const campoCfg = (k, rot, dica = '', tipo = 'text') => `<div><label class="rot">${rot} ${dica ? `<small>${dica}</small>` : ''}</label><input class="campo" data-cfg="${k}" type="${tipo}" value="${v(k)}"></div>`;
  return `
    <div class="adm-cfg">
      <div class="adm-tg"><span><strong>${lojaAberta() ? '🟢 Loja aberta' : '🔴 Loja fechada'}</strong><small>Fechada = ninguém consegue pedir pelo cardápio</small></span><button class="sw${lojaAberta() ? ' on' : ''}" data-adm-loja></button></div>
      <div class="adm-tg"><span><strong>${oferecerAlcool() ? '🍺 Sugerindo cerveja' : '🚫 Sem álcool nas sugestões'}</strong><small>Cerveja em lata entrega normalmente; desligue se preferir não sugerir.</small></span><button class="sw${oferecerAlcool() ? ' on' : ''}" data-adm-alcool></button></div>
      ${campoCfg('taxa_entrega', 'Taxa de entrega (R$)')}
      ${campoCfg('frete_gratis_acima', 'Frete grátis acima de (R$)', '0 = desliga')}
      ${campoCfg('pedido_minimo', 'Pedido mínimo (R$)')}
      ${campoCfg('whatsapp', 'WhatsApp da casa', 'com DDD, só números')}
      ${campoCfg('chave_pix', 'Chave PIX')}
      ${campoCfg('horario', 'Horário', 'ex.: Aberto das 17h às 22h30')}
      ${campoCfg('endereco', 'Endereço')}
      ${campoCfg('painel_url', 'Link do painel de pedidos', 'opcional')}
      <button class="btn-cta full" data-adm-salvar-cfg>Salvar configurações</button>
    </div>`;
}
async function admSalvarCfg() {
  const linhas = $$('[data-cfg]').map(i => ({ chave: i.dataset.cfg, valor: i.value.trim() })).filter(l => l.valor !== '' || S.info[l.chave] !== undefined);
  const { error } = await sb.from('info_restaurante').upsert(linhas, { onConflict: 'chave' });
  if (error) return toast('Erro ao salvar: ' + error.message, 'erro');
  linhas.forEach(l => { S.info[l.chave] = l.valor; });
  renderTopo(); renderAbertura(); renderMesa();
  toast('Configurações salvas', 'ok');
}
async function admToggle(chave, atual, msgs) {
  const novo = !atual;
  const { error } = await sb.from('info_restaurante').upsert({ chave, valor: String(novo) }, { onConflict: 'chave' });
  if (error) return toast('Erro: ' + error.message, 'erro');
  S.info[chave] = String(novo); renderTopo(); renderAbertura(); admRender();
  toast(novo ? msgs[0] : msgs[1], 'ok');
}
async function admPatch(id, patch) {
  const r = S.rows.find(x => x.id === id); if (!r) return;
  const antes = { ...r }; Object.assign(r, patch);
  renderTudo(); admRender();
  const { error } = await sb.from('produtos').update(patch).eq('id', id);
  if (error) { Object.assign(r, antes); renderTudo(); admRender(); toast('Erro: ' + error.message, 'erro'); }
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
    const base = parseNome(nome).base;
    const irmaos = S.rows.filter(x => x.id !== data.id && x.categoria === categoria && parseNome(x.nome).base === base);
    for (const x of irmaos) {
      if (x.imagem_url === imagem_url && x.video_url === video_url) continue;
      const up = await sb.from('produtos').update({ imagem_url, video_url }).eq('id', x.id).select().single();
      if (!up.error) Object.assign(x, up.data);
    }
    ADM.edit = null; renderTudo(); admRender();
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
    if (/foreign key|violates/i.test(error.message)) { await admPatch(r.id, { disponivel: false }); ADM.edit = null; admRender(); return toast('Esse produto já tem pedidos, então foi desativado em vez de excluído', 'ok'); }
    return toast('Erro: ' + error.message, 'erro');
  }
  S.rows = S.rows.filter(x => x.id !== r.id); ADM.edit = null;
  renderTudo(); admRender(); toast('Produto excluído', 'ok');
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
const ALVOS = [
  '[data-tocar]', '[data-pessoas]', '[data-etapa]', '[data-ir-sec]', '[data-lugar]', '[data-acompanhar]', '[data-repetir]', '[data-admin]',
  '[data-add]', '[data-abrir]', '[data-balde]', '[data-mais-pid]', '[data-menos-pid]', '[data-sug-add]',
  '[data-tam]', '[data-opc]', '[data-sem]', '[data-zq]', '[data-obs]', '[data-servir]', '[data-fechar-zoom]',
  '[data-junto]', '[data-sug-fechar]',
  '[data-ver-mesa]', '[data-fechar-mesa]', '[data-f-checkout]', '[data-f-voltar]', '[data-q]', '[data-sug]', '[data-tipo]', '[data-pag]', '[data-bump]', '#ckFinalizar', '[data-copiar]',
].join(',');
const fonteDe = el => el.closest('[data-fonte]')?.dataset.fonte || (S.busca ? 'busca' : 'cardapio');

function eventos() {
  $('#btnInicio').addEventListener('click', () => { if (pilha.length) return; irEtapa(0); });
  $('#btnPular').addEventListener('click', () => { S.pessoas = 0; lsSet('chopp_pessoas', 0); renderAbertura(); renderPaineis(); irEtapa(1); });
  const abrirBusca = () => { $('#busca').hidden = false; $('#buscaInput').focus(); };
  const fecharBusca = () => { $('#busca').hidden = true; $('#buscaInput').value = ''; S.busca = ''; renderBusca(); };
  $('#btnBusca').addEventListener('click', () => ($('#busca').hidden ? abrirBusca() : fecharBusca()));
  $('#buscaFechar').addEventListener('click', fecharBusca);
  $('#buscaInput').addEventListener('input', debounce(e => {
    S.busca = e.target.value;
    if (S.busca && S.etapa === 0) irEtapa(1);
    renderBusca();
  }, 160));

  document.addEventListener('click', async e => {
    if (e.target.closest('#adm, #admSenha')) return;
    const b = e.target.closest(ALVOS); if (!b) return;
    const d = b.dataset;

    if ('tocar' in d) { e.stopPropagation(); const box = b.parentElement; const v = $('video', box); v?.play().then(() => box.classList.remove('precisa-toque')).catch(() => {}); return; }
    if (d.pessoas) {
      S.pessoas = +d.pessoas; lsSet('chopp_pessoas', S.pessoas);
      rastrear('pessoas_escolhidas', { pessoas: S.pessoas });
      renderAbertura(); renderPaineis(); atualizarMais();
      $('#painel0').scrollTop = 0;
      return irEtapa(1);
    }
    if (d.etapa !== undefined) { if (pilha.includes('fechar')) esconderCamada('fechar'); return irEtapa(+d.etapa); }
    if (d.irSec) { const s = $(`#painel0 #sec-${d.irSec}`); if (s) $('#painel0').scrollTo({ top: s.offsetTop - 56, behavior: reduzMovimento() ? 'auto' : 'smooth' }); return; }
    if (d.lugar) { if (pilha.includes('fechar')) esconderCamada('fechar'); return irEtapa(+d.lugar); }
    if ('acompanhar' in d) { const u = ls('chopp_ultimo', null); return u && abrirStatus(u); }
    if ('repetir' in d) return repetirPedido();
    if ('admin' in d) return admAbrirSenha();

    // ── cardápio ──
    if (d.add) {
      e.stopPropagation();
      const g = S.grupos.find(x => x.key === d.add); if (!g) return;
      if (g.secao === 'marmitex' && !marmitexAgora()) return toast(`Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h`, 'erro');
      const fonte = fonteDe(b);
      if (fonte === 'destaque') rastrear('destaque_clique', { produto: g.nome });
      if (g.simples && g.disponiveis[0]) {
        const art = b.closest('[data-item]');
        return addRapido(g.disponiveis[0], { fonte, de: $('.tile-foto, .destaque-midia, .pm', art) || b });
      }
      return abrirZoom(g.key, fonte);
    }
    if (d.abrir) {
      const fonte = fonteDe(b);
      if (fonte === 'destaque') rastrear('destaque_clique', { produto: S.grupos.find(x => x.key === d.abrir)?.nome });
      return abrirZoom(d.abrir, fonte);
    }
    if (d.balde) { const r = S.porId.get(d.balde); if (r) { addRapido(r, { qtd: 6, combina: false, origem: 'latas6', de: b }); toast('6 latas na mesa', 'ok'); } return; }
    if (d.maisPid) { const it = S.carrinho.find(i => i.pid === d.maisPid && !i.obs); return it && mudarQtd(it.k, 1); }
    if (d.menosPid) { const it = S.carrinho.find(i => i.pid === d.menosPid && !i.obs); return it && mudarQtd(it.k, -1); }
    if (d.sugAdd) {
      const p = +d.sugAdd; const itens = sugestaoDaEtapa(p); if (!itens) return;
      if (!lojaAberta()) return toast('Estamos fechados agora. Volta mais tarde!', 'erro');
      const antes = totais();
      itens.forEach(({ r, qtd }) => addItem(itemRapido(r, qtd, ehMolho(r) ? 'molho' : 'sugestao_mesa', 'sugestao_mesa'), false));
      rastrear('sugestao_mesa_aceita', { etapa: PAINEIS[p].id, valor: r2(itens.reduce((s, { r, qtd }) => s + efetivo(r) * qtd, 0)) });
      const box = b.closest('.sug-etapa');
      voar($('.se-it .pm', box), itens[0].r.nome, itens[0].r.imagem_url || grupoDaLinha(itens[0].r)?.img);
      atualizarMais(); avisarFrete(antes);
      return;
    }

    // ── prato de perto ──
    if (d.tam || d.opc || d.sem || d.zq) {
      if (!S.zoom) return;
      S.zoom.obs = $('#zObs')?.value ?? S.zoom.obs;
      if (d.tam) {
        if ('up' in d) { S.zoom.upgradeClicado = true; rastrear('upgrade_tamanho', { produto: S.zoom.g.nome, valor: r2(S.zoom.vs[+d.tam].efetivo - S.zoom.vs[S.zoom.idx].efetivo) }); }
        S.zoom.idx = +d.tam;
      } else if (d.opc) S.zoom.opc[+d.opc] = d.val;
      else if (d.sem) S.zoom.sem.has(d.sem) ? S.zoom.sem.delete(d.sem) : S.zoom.sem.add(d.sem);
      else if (d.zq) S.zoom.qtd = Math.max(1, Math.min(50, S.zoom.qtd + +d.zq));
      return renderZoom();
    }
    if ('obs' in d) { if (!S.zoom) return; S.zoom.obsAberta = true; renderZoom(); $('#zObs')?.focus({ preventScroll: true }); return; }
    if ('servir' in d) return servir();
    if ('fecharZoom' in d) return esconderCamada('zoom');

    // ── combina com ──
    if (d.junto) {
      const r = S.porId.get(d.junto); if (!r || !S.sugMesa) return;
      if (S.sugMesa.aceitos.has(r.id)) {
        const it = S.carrinho.find(i => i.pid === r.id && (i.origem === 'combina' || i.origem === 'molho') && !i.obs);
        if (it) mudarQtd(it.k, -1);
        S.sugMesa.aceitos.delete(r.id);
      } else {
        const antes = totais();
        addItem(itemRapido(r, 1, ehMolho(r) ? 'molho' : 'combina'), false);
        S.sugMesa.aceitos.add(r.id);
        rastrear('combina_aceito', { produto: nomeBonito(parseNome(r.nome).base), valor: efetivo(r) });
        voar($('.pm', b), r.nome, r.imagem_url || grupoDaLinha(r)?.img);
        atualizarMais(); avisarFrete(antes);
      }
      renderSugMesa();
      clearTimeout(sugMesaT);
      sugMesaT = setTimeout(() => encerrarSugMesa(true), S.sugMesa.aceitos.size === S.sugMesa.cands.length ? 1500 : 9000);
      return;
    }
    if ('sugFechar' in d) return encerrarSugMesa(true);

    // ── fechar a mesa ──
    if ('verMesa' in d) return abrirFechar('mesa');
    if ('fecharMesa' in d) return esconderCamada('fechar');
    if ('fCheckout' in d) return abrirCheckout();
    if ('fVoltar' in d) { lerCampos(); S.fecharModo = 'mesa'; return renderFechar(); }
    if (d.q) return mudarQtd(d.k, +d.q);
    if (d.sug) {
      const r = S.porId.get(d.sug); if (!r) return;
      const antes = totais();
      addItem(itemRapido(r, 1, ehMolho(r) ? 'molho' : 'fecha' in d ? 'libera_frete' : 'vai_bem'), false);
      renderMesa(); atualizarMais(); renderFechar(); avisarFrete(antes);
      return;
    }
    if (d.tipo || d.pag || 'bump' in d) {
      const ck = S.ck; if (!ck) return;
      lerCampos();
      if (d.tipo) ck.tipo = d.tipo;
      else if (d.pag) ck.pag = d.pag;
      else {
        const r = S.porId.get(ck.bumpPid); if (!r) return;
        if (ck.bumpOn) { const it = S.carrinho.find(i => i.pid === r.id && !i.obs); if (it) { it.qtd -= 1; if (it.qtd <= 0) S.carrinho = S.carrinho.filter(i => i !== it); salvarCarrinho(); } ck.bumpOn = false; rastrear('oferta_desmarcada', { produto: nomeBonito(parseNome(r.nome).base) }); }
        else { addItem(itemRapido(r, 1, 'oferta_rapida'), false); ck.bumpOn = true; rastrear('oferta_aceita', { produto: nomeBonito(parseNome(r.nome).base), valor: efetivo(r) }); }
        renderMesa(); atualizarMais();
      }
      renderFechar();
      if (d.pag === 'dinheiro') $('#ckTroco')?.focus({ preventScroll: true });
      return;
    }
    if (b.id === 'ckFinalizar') return finalizar();
    if (d.copiar) {
      try { await navigator.clipboard.writeText(d.copiar); b.textContent = 'Copiado ✓'; toast('Chave PIX copiada', 'ok'); }
      catch { const r = document.createRange(); r.selectNodeContents($('#pixChave')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Segure para copiar a chave'); }
    }
  });

  $('#zoom').addEventListener('input', e => { if (e.target.id === 'zObs' && S.zoom) S.zoom.obs = e.target.value; });
  $('#fechar').addEventListener('input', e => {
    if (e.target.id === 'ckTel') { const p = e.target.selectionStart, antes = e.target.value.length; e.target.value = mascaraTel(e.target.value); const dif = e.target.value.length - antes; e.target.setSelectionRange(p + dif, p + dif); }
    e.target.classList.remove('erro');
  });
  $('#mesaPratos').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirFechar('mesa'); } });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#adm').hidden) { if (ADM.edit) { ADM.edit = null; admRender(); } else admFechar(); return; }
    const topo = pilha[pilha.length - 1];
    if (topo) esconderCamada(topo);
  });

  $('#admSenhaForm').addEventListener('submit', admVerificar);
  $('#admCancelar').addEventListener('click', () => { $('#admSenha').hidden = true; });
  admEventos();

  let ultimoMarmitex = marmitexAgora();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    renderRetorno();
    if (marmitexAgora() !== ultimoMarmitex) { ultimoMarmitex = marmitexAgora(); renderPaineis(); }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// INÍCIO
// ═══════════════════════════════════════════════════════════════════════════
async function init() {
  eventos();
  try { await carregar(); }
  catch (e) {
    console.error(e);
    $('#abreSobre').textContent = 'Não conseguimos carregar o cardápio. Confere sua internet.';
    return;
  }
  agrupar();
  renderTopo(); renderAbertura(); renderPaineis();
  validarCarrinho(); renderMesa();
  renderRetorno();
  tempoReal();
  rastrear('visita', { tela: innerWidth < 760 ? 'celular' : 'computador', ref: document.referrer ? new URL(document.referrer).hostname : '', pessoas_salvo: S.pessoas || null });
  if (location.hash === '#admin') admAbrirSenha();
}
document.addEventListener('DOMContentLoaded', init);
