// ═══════════════════════════════════════════════════════════════════════════
// CHOPPATINHAS — Cardápio digital
// Vanilla JS + Supabase (mesmo banco do agente de WhatsApp e do painel).
// Pedido gravado aqui cai na coluna "Novos" do painel em tempo real.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const C = window.CHOPP;
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ─── ESTADO ─────────────────────────────────────────────────────────────────
const S = {
  rows: [],          // linhas cruas da tabela produtos
  grupos: [],        // produtos agrupados por nome base (M/G viram 1 card)
  porId: new Map(),  // id → linha
  info: {},          // info_restaurante (chave → valor)
  vendas: new Map(), // nome base → qtd vendida (prova social real)
  afinidade: new Map(), // nome base → Map(nome base do complemento → vezes comprados juntos)
  carrinho: ls('chopp_carrinho', []),
  busca: '',
  pd: null,          // estado do sheet de produto aberto
  ck: null,          // estado do checkout
  canalPedido: null, // realtime do pedido acompanhado
};

// ─── UTIL ───────────────────────────────────────────────────────────────────
function ls(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } }
const fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurto = v => { const n = Number(v || 0); return 'R$ ' + (Number.isInteger(n) ? n : n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const r2 = n => Math.round(n * 100) / 100;
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const num = (k) => { const v = parseFloat(String(S.info[k] ?? '').replace(',', '.')); return Number.isFinite(v) ? v : C.DEFAULTS[k]; };
const valido = v => v && !/pendente/i.test(v);
const soDigitos = s => String(s || '').replace(/\D/g, '');

const ICON = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  drum: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.4 15.63a7.88 6 135 1 1 6.23-6.23 4.37 3.37 135 0 0-6.23 6.23"/><path d="m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59"/></svg>',
  pizza: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 11h.01M11 15h.01M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4"/></svg>',
  burger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a1 1 0 0 0 1-1 8 8 0 0 0-18 0 1 1 0 0 0 1 1Z"/><path d="M3 15h18M5 15v1a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-1"/></svg>',
  fries: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10 5 3M10 10V2M14 10l1-8M18 10l1-6"/><path d="M4 10h16l-2 11H6z"/></svg>',
  soup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M7 21h10M9 8c-1-1.5 1-2.5 0-4M13 8c-1-1.5 1-2.5 0-4"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M2 8h20M7 12h4"/></svg>',
  beer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
};

// ─── TAMANHOS / NOMES ───────────────────────────────────────────────────────
// "Frango Frito Especial (G)" → base "Frango Frito Especial", tamanho "Grande"
const ROTULO = { m: 'Média', g: 'Grande', p: 'Pequena', media: 'Média', média: 'Média', grande: 'Grande' };
function parseNome(nome) {
  const m = String(nome).match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (!m) return { base: nome.trim(), tam: null, letra: null };
  const raw = m[2].trim(); const k = raw.toLowerCase();
  if (ROTULO[k] || /^\d+\s*(ml|l)$/i.test(raw)) {
    const letra = k === 'm' || k === 'media' || k === 'média' ? 'M' : k === 'g' || k === 'grande' ? 'G' : k === 'p' ? 'P' : raw;
    return { base: m[1].trim(), tam: ROTULO[k] || raw, letra };
  }
  return { base: nome.trim(), tam: null, letra: null };
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
const artDe = (nome, secao, img, extra) => img
  ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">`
  : window.ChoppArt.svg(nome, secao, extra);

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
    g.promo = g.disponiveis.some(v => Number(v.preco_promocional) > 0 && Number(v.preco_promocional) < Number(v.preco));
    g.min = g.disponiveis.length ? Math.min(...g.disponiveis.map(v => v.efetivo)) : Math.min(...g.variantes.map(v => v.efetivo));
    g.desc = limparDesc(g.descricao);
    g.secao = (C.SECOES.find(s => s.match(g)) || C.SECOES[C.SECOES.length - 1]).id;
    g.doce = g.secao === 'pizzas' && /prest[ií]gio|sensa[cç][aã]o|chocolate|doce/i.test(g.base + ' ' + g.descricao);
    g.opcoes = C.OPCOES[g.base.toLowerCase()] || null;
    g.simples = g.disponiveis.length <= 1 && !g.opcoes && g.secao !== 'pizzas';
    g.vendas = S.vendas.get(semAcento(g.base)) || 0;
    grupos.push(g);
  }
  const bebOrdem = n => /cerveja|chopp/i.test(n) ? 0 : /lata/i.test(n) ? 1 : /guaran/i.test(n) ? 2 : /suco/i.test(n) ? 3 : /h2oh/i.test(n) ? 4 : 5;
  const ordem = {
    combos: (a, b) => b.destaque - a.destaque || b.min - a.min,
    porcoes: (a, b) => b.destaque - a.destaque || b.vendas - a.vendas || b.min - a.min,
    pizzas: (a, b) => a.doce - b.doce || b.destaque - a.destaque || b.min - a.min,
    lanches: (a, b) => b.destaque - a.destaque || b.min - a.min,
    acomp: (a, b) => a.min - b.min,
    bebidas: (a, b) => bebOrdem(a.base) - bebOrdem(b.base) || a.min - b.min,
  };
  grupos.sort((a, b) => {
    const ia = C.SECOES.findIndex(s => s.id === a.secao), ib = C.SECOES.findIndex(s => s.id === b.secao);
    if (ia !== ib) return ia - ib;
    return (ordem[a.secao] || ((x, y) => x.base.localeCompare(y.base)))(a, b) || a.base.localeCompare(b.base);
  });
  // "Mais pedido" só com dado real de venda
  const top = grupos.filter(g => g.vendas >= 3).sort((a, b) => b.vendas - a.vendas).slice(0, 5);
  grupos.forEach(g => { g.maisPedido = top.includes(g); });
  S.grupos = grupos;
}

function tagsDe(g) {
  const t = [];
  if (g.promo) t.push('<span class="tag red">Oferta</span>');
  if (g.maisPedido) t.push('<span class="tag red">🔥 Mais pedido</span>');
  if (g.destaque) t.push('<span class="tag">⭐ Casa indica</span>');
  const maxG = Math.max(0, ...g.variantes.map(v => v.gramas || 0));
  if (!g.destaque && (g.secao === 'combos' || maxG >= 1000)) t.push('<span class="tag">Para compartilhar</span>');
  if (g.secao === 'pizzas' && !g.doce && t.length === 0) t.push('<span class="tag">Meio a meio</span>');
  if (g.doce) t.push('<span class="tag">Doce</span>');
  return t.slice(0, 2).join('');
}

// ─── HORÁRIOS ───────────────────────────────────────────────────────────────
const lojaAberta = () => String(S.info.loja_aberta ?? 'true') === 'true';
const marmitexAgora = () => { const h = new Date().getHours(); return h >= C.MARMITEX.inicio && h < C.MARMITEX.fim; };

// ─── COMPLEMENTOS (order bump) ──────────────────────────────────────────────
// Álcool entrega numa boa em lata/garrafa (não é chopp de torneira — o
// cardápio não vende chopp, só "Cerveja Skol/Brahma" 350ml lata). Mesmo assim
// a casa pode desligar essa sugestão no admin (Loja → Sugerir cerveja/chopp).
const oferecerAlcool = () => String(S.info.oferecer_alcool ?? 'true') === 'true';

// Escolhe o que sugerir pra CADA prato — não é uma lista genérica por seção.
// Olha o que o produto já inclui (pra não repetir), o que combina de verdade,
// e no fim reordena pelo que a casa REALMENTE vende junto (S.afinidade, vindo
// do histórico de pedidos — fica mais afiado sozinho conforme mais gente pede
// pelo cardápio).
function candidatosPara(g, max = 4) {
  // marmitex (contexto de almoço rápido) e pizza doce (não combina) nunca sugerem álcool,
  // independente do interruptor; fora isso, respeita o que a casa configurou no admin.
  const alcoolOk = oferecerAlcool() && g.secao !== 'marmitex' && !g.doce;
  const jaTemId = new Set(g.variantes.map(v => v.id));
  const porNome = n => { const r = S.rows.find(x => x.nome === n); return r && r.disponivel !== false && !jaTemId.has(r.id) ? r : null; };
  const lista = [];
  const add = ns => ns.forEach(n => { const r = porNome(n); if (r && !lista.includes(r)) lista.push(r); });

  const contexto = (g.base + ' ' + (g.descricao || '')).toLowerCase();
  const temArrozSalada = /completa|arroz e salada/.test(contexto);
  const ehArrozOuSalada = /^(arroz|salada)$/i.test(g.base);
  const temBatataNoNome = /batata/i.test(g.base);

  if (g.secao === 'combos' || g.secao === 'porcoes') {
    if (!temArrozSalada && !ehArrozOuSalada) add(['Arroz', 'Salada']);
    if (!temBatataNoNome) add(['Porção De Batata Frita (M)']);
    if (alcoolOk) add(['Cerveja Brahma', 'Cerveja Skol']);
    add(['Guaraná Antarctica', 'Pepsi Lata', 'Suco De Maracujá Polpa']);
  } else if (g.secao === 'pizzas') {
    if (g.doce) {
      add(['Suco De Acerola', 'Guaraná Antarctica', 'Água Com Gás']);
    } else {
      if (alcoolOk) add(['Cerveja Brahma', 'Cerveja Skol']);
      add(['Guaraná Antarctica', 'Pepsi Lata']);
      add(['Prestígio (M)', 'Sensação (M)']); // sobremesa
    }
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
    if (/cerveja/i.test(g.base)) add(['Cerveja Brahma', 'Cerveja Skol', 'Porção De Batata Frita (M)', 'Porção De Calabresa (M)']);
    else add(['Porção De Batata Frita (M)', 'Porção De Bolinho De Bacalhau']);
  }
  add(C.UPSELL_PADRAO.filter(n => alcoolOk || !/cerveja|chopp/i.test(n))); // rede de segurança, caso a lista específica fique curta

  // reordena pelo que a casa realmente vende junto (histórico real de pedidos)
  const af = S.afinidade.get(semAcento(g.base));
  if (af?.size) {
    lista.sort((a, b) => (af.get(semAcento(parseNome(b.nome).base)) || 0) - (af.get(semAcento(parseNome(a.nome).base)) || 0));
  }
  return lista.slice(0, max);
}

// ═══════════════════════════════════════════════════════════════════════════
// CARREGAMENTO
// ═══════════════════════════════════════════════════════════════════════════
async function carregar() {
  const [p, i] = await Promise.all([
    sb.from('produtos').select('*'),
    sb.from('info_restaurante').select('chave, valor'),
  ]);
  if (p.error) throw p.error;
  S.rows = p.data || [];
  (i.data || []).forEach(r => { S.info[r.chave] = r.valor; });
  carregarVendas(); // não bloqueia a primeira pintura
}
async function carregarVendas() {
  const { data } = await sb.from('itens_pedido').select('pedido_id, nome_produto, quantidade').order('created_at', { ascending: false }).limit(3000);
  if (!data?.length) return;
  const vendas = new Map();
  const porPedido = new Map(); // pedido_id → Set(nomes base) — pra descobrir o que é comprado junto
  data.forEach(r => {
    const k = semAcento(parseNome(r.nome_produto || '').base);
    vendas.set(k, (vendas.get(k) || 0) + (r.quantidade || 1));
    if (!porPedido.has(r.pedido_id)) porPedido.set(r.pedido_id, new Set());
    porPedido.get(r.pedido_id).add(k);
  });
  S.vendas = vendas;

  // afinidade real: quem pediu X, pediu também Y quantas vezes (mesmo pedido)
  const afinidade = new Map();
  for (const itens of porPedido.values()) {
    if (itens.size < 2) continue;
    const arr = [...itens];
    arr.forEach(a => {
      if (!afinidade.has(a)) afinidade.set(a, new Map());
      const m = afinidade.get(a);
      arr.forEach(b => { if (a !== b) m.set(b, (m.get(b) || 0) + 1); });
    });
  }
  S.afinidade = afinidade;

  agrupar(); renderMenu(); renderDestaques();
}

function tempoReal() {
  const reagir = debounce(() => { agrupar(); renderMenu(); renderDestaques(); renderBarra(); if ($('#sheetCarrinho').classList.contains('on')) renderCarrinho(); if (!$('#adm').hidden && !ADM.edit) admRender(); }, 250);
  sb.channel('cardapio-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, ({ eventType, new: n, old: o }) => {
      if (eventType === 'DELETE') S.rows = S.rows.filter(r => r.id !== o.id);
      else { const i = S.rows.findIndex(r => r.id === n.id); if (i >= 0) S.rows[i] = n; else S.rows.push(n); }
      reagir();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'info_restaurante' }, ({ new: n }) => {
      if (n?.chave) { S.info[n.chave] = n.valor; renderStatus(); renderHeroInfo(); renderBarra(); if ($('#sheetCarrinho').classList.contains('on')) renderCarrinho(); }
    })
    .subscribe();
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER — TOPO / HERO
// ═══════════════════════════════════════════════════════════════════════════
function renderStatus() {
  const el = $('#status'), txt = $('#statusTxt');
  const aberta = lojaAberta();
  el.classList.toggle('fechado', !aberta);
  const hor = valido(S.info.horario) ? S.info.horario.replace(/\(.*?\)/g, '').trim() : C.DEFAULTS.horario;
  txt.textContent = aberta ? `Aberto agora · ${hor.toLowerCase()}` : 'Fechado agora · volte mais tarde';
  $('#rodapeHora').textContent = hor;
  $('#rodapeEnd').textContent = valido(S.info.endereco) ? S.info.endereco : 'Umuarama-PR';
}
function renderHeroInfo() {
  const fg = num('frete_gratis_acima');
  const itens = [
    `⭐ <b>${C.DEFAULTS.avaliacao}</b> avaliação`,
    `🛵 <b>${C.DEFAULTS.tempo_entrega}</b>`,
    fg > 0 ? `🎁 Frete grátis acima de <b>${fmtCurto(fg)}</b>` : `Entrega <b>${fmtCurto(num('taxa_entrega'))}</b>`,
    `Pedido mín. <b>${fmtCurto(num('pedido_minimo'))}</b>`,
  ];
  $('#heroInfo').innerHTML = itens.map((t, i) => `<li class="${i === 2 && fg > 0 ? 'frete' : ''}">${t}</li>`).join('');
}
function renderDestaques() {
  let lista = S.grupos.filter(g => g.disponivel && g.destaque);
  const extras = S.grupos.filter(g => g.disponivel && !lista.includes(g) && (g.maisPedido || g.secao === 'combos'))
    .sort((a, b) => b.maisPedido - a.maisPedido || b.min - a.min);
  lista = [...lista, ...extras].slice(0, 4);
  const box = $('#destaques');
  box.innerHTML = lista.map((g, i) => `
    <article class="dest" data-g="${esc(g.key)}" style="animation-delay:${i * 80}ms">
      <span class="dest-selo">${g.destaque ? '⭐ A casa indica' : g.maisPedido ? '🔥 Mais pedido' : '⭐ Destaque da casa'}</span>
      <div class="dest-art">${artDe(g.base, g.secao, g.img)}</div>
      <div class="dest-corpo">
        <h3 class="dest-nome">${esc(g.base)}</h3>
        <p class="dest-copy">${esc(copyDe(g))}</p>
        <div class="dest-pe">
          <div class="dest-preco"><small>${g.disponiveis.length > 1 ? 'a partir de' : 'por'}</small><strong>${fmt(g.min)}</strong></div>
          <button class="btn-cta sm" data-g="${esc(g.key)}">Quero esse ${ICON.plus.replace('stroke-width="3"', 'stroke-width="3" width="16" height="16"')}</button>
        </div>
      </div>
    </article>`).join('');
  $('#destaquesDots').innerHTML = lista.length > 1 ? lista.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('') : '';
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER — MENU
// ═══════════════════════════════════════════════════════════════════════════
function secoesVisiveis() {
  const termo = semAcento(S.busca.trim());
  const filtra = g => !termo || semAcento(g.base + ' ' + g.descricao + ' ' + g.categoria).includes(termo);
  return C.SECOES.map(s => ({ ...s, grupos: S.grupos.filter(g => g.secao === s.id && g.disponivel && filtra(g)) }))
    .filter(s => s.grupos.length);
}

function renderCats(secoes) {
  $('#catsIn').innerHTML = secoes.map((s, i) => `<button class="cat${i ? '' : ' on'}" data-sec="${s.id}">${ICON[s.icon] || ''}${esc(s.nome)}</button>`).join('');
}

function cardHTML(g, i) {
  const qtd = qtdNoCarrinho(g);
  const mm = g.secao === 'marmitex' && !marmitexAgora();
  const tamanhos = g.disponiveis.length > 1 ? `<div class="card-tam">${g.disponiveis.map(v => `<span>${esc(v.letra || v.tam)}</span>`).join('')}</div>` : '';
  const precoCheio = !tamanhos && g.promo ? `<s>${fmt(g.disponiveis[0].preco)}</s>` : '';
  const largo = g.secao === 'combos';
  return `
  <article class="card${largo ? ' largo' : ''}${mm ? ' indisp' : ''}" data-g="${esc(g.key)}" style="animation-delay:${Math.min(i, 8) * 45}ms">
    <div class="card-art">
      <div class="card-tags">${tagsDe(g)}</div>
      ${artDe(g.base, g.secao, g.img)}
    </div>
    <div class="card-corpo">
      <h3 class="card-nome">${esc(g.base)}</h3>
      ${largo ? `<p class="card-copy">${esc(copyDe(g))}</p>` : (copyDe(g) || g.desc) ? `<p class="card-desc">${esc(copyDe(g) || g.desc)}</p>` : ''}
      ${tamanhos}
      <div class="card-pe">
        <div class="preco">${g.disponiveis.length > 1 ? '<small>a partir de</small>' : precoCheio}<strong>${fmt(g.min)}</strong></div>
        <button class="btn-add" data-add="${esc(g.key)}" aria-label="Adicionar ${esc(g.base)}">${ICON.plus}${qtd ? `<span class="qtd">${qtd}</span>` : ''}</button>
      </div>
    </div>
  </article>`;
}

function linhaHTML(g, i) {
  const v = g.disponiveis[0];
  const item = S.carrinho.find(it => it.pid === v.id && !it.obs);
  const cerveja = /cerveja/i.test(g.base);
  return `
  <div class="linha" data-g="${esc(g.key)}" style="animation-delay:${Math.min(i, 10) * 35}ms">
    <div class="linha-art">${artDe(g.base, g.secao, g.img)}</div>
    <div class="linha-txt" data-abre="${esc(g.key)}">
      <strong>${esc(g.base)}${g.disponiveis.length > 1 ? '' : v.tam ? ` <small>${esc(v.tam)}</small>` : ''}</strong>
      <span>${g.disponiveis.length > 1 ? 'a partir de ' : ''}${fmt(g.min)}</span>
    </div>
    ${cerveja && g.disponiveis.length === 1 ? `<button class="balde" data-balde="${v.id}">+6 latas</button>` : ''}
    ${g.disponiveis.length > 1
      ? `<button class="btn-add" data-add="${esc(g.key)}" aria-label="Adicionar">${ICON.plus}</button>`
      : item
        ? `<div class="stepper"><button data-menos-pid="${v.id}" aria-label="Menos">−</button><b>${item.qtd}</b><button data-mais-pid="${v.id}" aria-label="Mais">+</button></div>`
        : `<button class="btn-add" data-add="${esc(g.key)}" aria-label="Adicionar ${esc(g.base)}">${ICON.plus}</button>`}
  </div>`;
}

function renderMenu() {
  const secoes = secoesVisiveis();
  $('#skeleton')?.remove();
  const menu = $('#menu');
  if (!secoes.length) {
    menu.innerHTML = '';
    $('#buscaVazia').hidden = !S.busca;
    $('#buscaTermo').textContent = `“${S.busca}”`;
    renderCats([]);
    return;
  }
  $('#buscaVazia').hidden = true;
  menu.innerHTML = secoes.map(s => {
    const lista = s.id === 'bebidas';
    const aviso = s.id === 'marmitex' && !marmitexAgora()
      ? `<div class="aviso-sec">⏰ Marmitex sai só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h. Volta no almoço!</div>` : '';
    return `
    <section class="secao" id="sec-${s.id}" data-sec="${s.id}">
      <div class="secao-cab">
        <div><h2 class="secao-titulo">${esc(s.nome)}</h2>${s.sub ? `<p class="secao-sub">${esc(s.sub)}</p>` : ''}</div>
        <span class="secao-cont">${s.grupos.length} ${s.grupos.length === 1 ? 'opção' : 'opções'}</span>
      </div>
      ${aviso}
      ${lista ? `<div class="lista">${s.grupos.map(linhaHTML).join('')}</div>`
             : `<div class="grade${s.id === 'combos' ? ' largo' : ''}">${s.grupos.map(cardHTML).join('')}</div>`}
    </section>`;
  }).join('');
  const ativa = $('.cat.on')?.dataset.sec;
  renderCats(secoes);
  if (ativa) marcarCat(ativa, false);
  observarSecoes();
}

// categoria ativa conforme o scroll
let obsSec;
function observarSecoes() {
  obsSec?.disconnect();
  obsSec = new IntersectionObserver(ents => {
    const vis = ents.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (vis && !rolandoPorClique) marcarCat(vis.target.dataset.sec, true);
  }, { rootMargin: '-130px 0px -60% 0px' });
  $$('.secao').forEach(s => obsSec.observe(s));
}
let rolandoPorClique = false;
function marcarCat(id, rolarChip) {
  $$('.cat').forEach(c => c.classList.toggle('on', c.dataset.sec === id));
  const chip = $(`.cat[data-sec="${id}"]`);
  if (chip && rolarChip) { const box = $('#catsIn'); box.scrollTo({ left: chip.offsetLeft - box.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' }); }
}

// ═══════════════════════════════════════════════════════════════════════════
// RETORNO — acompanhar pedido / pedir de novo
// ═══════════════════════════════════════════════════════════════════════════
const ETAPAS = {
  delivery: [
    { k: 'recebido', t: 'Pedido recebido', d: 'A casa já está vendo seu pedido', ico: '🧾' },
    { k: 'cozinha', t: 'Na cozinha', d: 'Preparando tudo na hora', ico: '🔥' },
    { k: 'saiu', t: 'Saiu pra entrega', d: 'Está a caminho — pode preparar a mesa', ico: '🛵' },
    { k: 'fim', t: 'Entregue', d: 'Bom apetite!', ico: '✅' },
  ],
  retirada: [
    { k: 'recebido', t: 'Pedido recebido', d: 'A casa já está vendo seu pedido', ico: '🧾' },
    { k: 'cozinha', t: 'Na cozinha', d: 'Preparando tudo na hora', ico: '🔥' },
    { k: 'saiu', t: 'Pronto pra retirar', d: 'Pode vir buscar!', ico: '🛍️' },
    { k: 'fim', t: 'Retirado', d: 'Bom apetite!', ico: '✅' },
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
    const nomes = rep.itens.map(i => `${i.qtd}x ${i.titulo}`).join(', ');
    partes.push(`<button class="ret-card" data-repetir><span class="ret-ico">🔁</span><span class="ret-txt"><strong>Pedir de novo · ${fmt(total)}</strong><small>${esc(nomes)}</small></span><span class="ret-seta">Repetir →</span></button>`);
  }
  box.innerHTML = partes.join('');
  box.hidden = !partes.length;
}

function repetirPedido() {
  const rep = ls('chopp_repetir', null); if (!rep) return;
  if (!lojaAberta()) return toast('Estamos fechados agora. Volta mais tarde! 🍻', 'erro');
  let ok = 0, fora = 0;
  rep.itens.forEach(it => {
    const row = S.porId.get(it.pid);
    if (!row || row.disponivel === false) { fora++; return; }
    addItem({ ...it, preco: it.meio ? it.preco : efetivo(row) }, false);
    ok++;
  });
  renderBarra(); renderMenu();
  toast(ok ? `${ok} ${ok === 1 ? 'item voltou' : 'itens voltaram'} pro carrinho${fora ? ` (${fora} indisponível)` : ''} 🍻` : 'Esses itens não estão disponíveis hoje', ok ? 'ok' : 'erro');
  if (ok) setTimeout(abrirCarrinho, 350);
}

// ═══════════════════════════════════════════════════════════════════════════
// CARRINHO — lógica
// ═══════════════════════════════════════════════════════════════════════════
function chaveItem(it) { return [it.pid, it.nomeDb, it.obs || ''].join('|'); }
function addItem(it, animar = true) {
  const k = chaveItem(it);
  const ex = S.carrinho.find(i => i.k === k);
  if (ex) ex.qtd += it.qtd; else S.carrinho.push({ ...it, k });
  salvarCarrinho();
  if (animar) { renderBarra(true); atualizarBotoesMenu(); }
}
function mudarQtd(k, delta) {
  const it = S.carrinho.find(i => i.k === k); if (!it) return;
  it.qtd += delta;
  if (it.qtd <= 0) S.carrinho = S.carrinho.filter(i => i.k !== k);
  salvarCarrinho(); renderBarra(); atualizarBotoesMenu();
}
function salvarCarrinho() { lsSet('chopp_carrinho', S.carrinho); }
function qtdNoCarrinho(g) { const ids = new Set(g.variantes.map(v => v.id)); return S.carrinho.filter(i => ids.has(i.pid)).reduce((s, i) => s + i.qtd, 0); }
function subtotal() { return r2(S.carrinho.reduce((s, i) => s + i.preco * i.qtd, 0)); }
function totais(tipo = 'delivery') {
  const sub = subtotal();
  const fg = num('frete_gratis_acima');
  const gratis = fg > 0 && sub >= fg;
  const taxa = tipo === 'retirada' || gratis ? 0 : num('taxa_entrega');
  return { sub, taxa, gratis, total: r2(sub + taxa), fg, falta: fg > 0 ? r2(Math.max(0, fg - sub)) : 0 };
}
function itemRapido(row, qtd = 1) {
  const { base, tam } = parseNome(row.nome);
  const g = S.grupos.find(x => x.variantes.some(v => v.id === row.id));
  return { pid: row.id, nomeDb: row.nome, titulo: base, sub: tam || '', preco: efetivo(row), qtd, obs: '', secao: g?.secao || '', img: row.imagem_url || g?.img || null };
}
function addRapido(row, qtd = 1, origem) {
  if (!lojaAberta()) return toast('Estamos fechados agora. Volta mais tarde! 🍻', 'erro');
  const antes = totais();
  addItem(itemRapido(row, qtd));
  voar(origem);
  const depois = totais();
  if (antes.fg > 0 && !antes.gratis && depois.gratis) { confete(); toast('🎉 Frete grátis desbloqueado!', 'ok'); }
}
function atualizarBotoesMenu() {
  // atualiza só contadores/steppers sem re-render total (mantém scroll e animações)
  $$('.card').forEach(card => {
    const g = S.grupos.find(x => x.key === card.dataset.g); if (!g) return;
    const btn = $('.btn-add', card); const q = qtdNoCarrinho(g);
    const badge = $('.qtd', btn);
    if (q) { if (badge) badge.textContent = q; else btn.insertAdjacentHTML('beforeend', `<span class="qtd">${q}</span>`); } else badge?.remove();
  });
  $$('.linha').forEach(l => {
    const g = S.grupos.find(x => x.key === l.dataset.g); if (!g) return;
    l.outerHTML = linhaHTML(g, 0);
  });
  $$('.linha').forEach(l => { l.style.animation = 'none'; });
}

function renderBarra(treme = false) {
  const qtd = S.carrinho.reduce((s, i) => s + i.qtd, 0);
  const barra = $('#barra');
  barra.hidden = qtd === 0;
  if (!qtd) return;
  const t = totais();
  $('#barraQtd').textContent = qtd;
  $('#barraTotal').textContent = fmt(t.sub);
  $('#barraMeta').textContent = t.fg > 0 ? (t.gratis ? '🎉 Frete grátis garantido' : `Faltam ${fmt(t.falta)} pro frete grátis`) : `${qtd} ${qtd === 1 ? 'item' : 'itens'}`;
  $('#barraProg').style.width = t.fg > 0 ? Math.min(100, (t.sub / t.fg) * 100) + '%' : '0';
  if (treme) { const b = $('#barraBtn'); b.classList.remove('treme'); void b.offsetWidth; b.classList.add('treme'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEETS (abrir/fechar)
// ═══════════════════════════════════════════════════════════════════════════
const pilha = [];
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
  const i = pilha.indexOf(id); if (i >= 0) pilha.splice(i, 1);
  if (!pilha.length) { $('#veu').classList.remove('on'); document.body.classList.remove('travado'); }
  if (id === 'sheetStatus' && S.canalPedido) { sb.removeChannel(S.canalPedido); S.canalPedido = null; }
  if (!viaHistorico && history.state?.sheet === id) { ignorarPop = true; history.back(); }
}
let ignorarPop = false;
function fecharTopo() { const id = pilha[pilha.length - 1]; if (id) fecharSheet(id); }
window.addEventListener('popstate', () => { if (ignorarPop) { ignorarPop = false; return; } const id = pilha[pilha.length - 1]; if (id) fecharSheet(id, true); });

// ═══════════════════════════════════════════════════════════════════════════
// PRODUTO (sheet)
// ═══════════════════════════════════════════════════════════════════════════
function abrirProduto(key) {
  const g = S.grupos.find(x => x.key === key); if (!g) return;
  const vs = g.disponiveis.length ? g.disponiveis : g.variantes;
  // Pré-seleciona o tamanho maior quando o salto de preço é pequeno (ancoragem)
  let idx = 0;
  if (vs.length > 1) {
    const a = vs[0], b = vs[vs.length - 1];
    if ((b.efetivo - a.efetivo) / a.efetivo <= 0.2) idx = vs.length - 1;
  }
  S.pd = { g, vs, idx, meio: false, sabor2: null, opc: {}, sem: new Set(), addons: new Set(), qtd: 1, obs: '' };
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
    extraNome = g2 ? g2.base : '';
  }
  const addons = [...S.pd.addons].map(id => S.porId.get(id)).filter(Boolean);
  const addTot = addons.reduce((s, r) => s + efetivo(r), 0);
  return { v, unit, prodDb, extraNome, addons, total: r2(unit * S.pd.qtd + addTot) };
}

function ingredientesDe(g) {
  if (g.secao !== 'lanches') return [];
  return String(g.descricao || '').split(/,\s*|\s+e\s+/).map(s => s.trim()).filter(s => s && s.length < 26 && !/^(hamb[uú]rguer|p[aã]o|frango|picanha)$/i.test(s));
}

function renderProduto() {
  const { g, vs, idx, meio, sabor2 } = S.pd;
  const v = vs[idx];
  const p = precoPd();
  const mm = g.secao === 'marmitex' && !marmitexAgora();
  const partes = [];

  // tamanhos
  if (vs.length > 1) {
    const ppg = vs.map(x => x.gramas ? x.efetivo / x.gramas : null);
    const melhor = ppg.every(Boolean) ? ppg.indexOf(Math.min(...ppg)) : -1;
    partes.push(`
      <div class="pd-bloco">
        <div class="pd-bloco-cab"><h4>Escolha o tamanho</h4><span class="obr">Obrigatório</span></div>
        <div class="tams">${vs.map((x, i) => `
          <button class="tam${i === idx ? ' on' : ''}" data-tam="${i}">
            ${i === melhor && vs.length > 1 && i === vs.length - 1 ? '<span class="fita">Melhor custo</span>' : ''}
            <strong>${esc(x.tam || x.letra)}</strong>
            <small>${x.gramas ? (x.gramas >= 1000 ? (x.gramas / 1000).toLocaleString('pt-BR') + 'kg' : x.gramas + 'g') : '&nbsp;'}</small>
            <em>${fmt(x.efetivo)}</em>
          </button>`).join('')}
        </div>
        ${idx < vs.length - 1 ? (() => {
          const maior = vs[vs.length - 1], dif = r2(maior.efetivo - v.efetivo);
          const ganho = maior.gramas && v.gramas ? ` (+${maior.gramas - v.gramas}g)` : '';
          return `<button class="upgrade" data-tam="${vs.length - 1}">🔥 Por só <b>+${fmt(dif)}</b> leva a ${esc((maior.tam || '').toLowerCase())}${ganho}<span class="seta">Quero →</span></button>`;
        })() : ''}
      </div>`);
  }

  // pizza meio a meio
  if (g.secao === 'pizzas') {
    const outras = S.grupos.filter(x => x.secao === 'pizzas' && x.key !== g.key && x.disponivel);
    partes.push(`
      <div class="pd-bloco">
        <button class="meio-toggle" data-meio>
          <span style="font-size:26px">🍕</span>
          <span><strong>Quer meio a meio?</strong><small>Escolha um 2º sabor. Vale o preço do mais caro.</small></span>
          <span class="sw${meio ? ' on' : ''}"></span>
        </button>
        ${meio ? `<div class="pd-bloco-cab" style="margin-top:14px"><h4>2º sabor</h4><span class="${sabor2 ? 'ok' : 'obr'}">${sabor2 ? 'Escolhido' : 'Obrigatório'}</span></div>
        <div class="opcs meio-lista">${outras.map(o => {
          const ov = o.disponiveis.find(x => x.letra === v.letra) || o.disponiveis[0];
          return `<label class="opc${sabor2 === o.key ? ' on' : ''}" data-sabor="${esc(o.key)}">
            <span class="opc-marca"></span>
            <span class="opc-mini">${artDe(o.base, 'pizzas', o.img)}</span>
            <span class="opc-txt"><strong>${esc(o.base)}</strong><small>${esc(o.desc)}</small></span>
            <span class="opc-preco">${fmt(ov.efetivo)}</span>
          </label>`;
        }).join('')}</div>` : ''}
      </div>`);
  }

  // opções obrigatórias (corte do frango, carne do marmitex)
  (g.opcoes || []).forEach((grp, gi) => {
    partes.push(`
      <div class="pd-bloco">
        <div class="pd-bloco-cab"><h4>${esc(grp.titulo)}</h4><span class="${S.pd.opc[gi] ? 'ok' : 'obr'}">${S.pd.opc[gi] ? 'Escolhido' : 'Obrigatório'}</span></div>
        <div class="opcs">${grp.itens.map(o => `
          <label class="opc${S.pd.opc[gi] === o ? ' on' : ''}" data-opc="${gi}" data-val="${esc(o)}">
            <span class="opc-marca"></span><span class="opc-txt"><strong>${esc(o)}</strong></span>
          </label>`).join('')}
        </div>
      </div>`);
  });

  // tirar ingrediente
  const ingr = ingredientesDe(g);
  if (ingr.length) {
    partes.push(`
      <div class="pd-bloco">
        <div class="pd-bloco-cab"><h4>Quer tirar algo?</h4><span>Opcional</span></div>
        <div class="chips">${ingr.map(i => `<button class="chip${S.pd.sem.has(i) ? ' on' : ''}" data-sem="${esc(i)}">${esc(cap(i))}</button>`).join('')}</div>
      </div>`);
  }

  // turbine (order bump) — complemento certo pro prato, ordenado pelo que a casa vende junto
  const addons = candidatosPara(g, 4);
  if (addons.length) {
    partes.push(`
      <div class="pd-bloco">
        <div class="pd-bloco-cab"><h4>🔥 Turbine seu pedido</h4><span>Opcional</span></div>
        <div class="opcs">${addons.map(r => {
          const { base, tam } = parseNome(r.nome);
          const on = S.pd.addons.has(r.id);
          const gg = S.grupos.find(x => x.variantes.some(y => y.id === r.id));
          return `<label class="opc check${on ? ' on' : ''}" data-addon="${r.id}">
            <span class="opc-marca"></span>
            <span class="opc-mini">${artDe(base, gg?.secao, r.imagem_url || gg?.img)}</span>
            <span class="opc-txt"><strong>${esc(base)}${tam ? ` <small>(${esc(tam)})</small>` : ''}</strong></span>
            <span class="opc-preco">+ ${fmt(efetivo(r))}</span>
          </label>`;
        }).join('')}</div>
      </div>`);
  }

  partes.push(`
    <div class="pd-bloco">
      <div class="pd-bloco-cab"><h4>Alguma observação?</h4><span>Opcional</span></div>
      <textarea class="campo" id="pdObs" rows="2" maxlength="140" placeholder="Ex.: bem passado, molho à parte…">${esc(S.pd.obs)}</textarea>
    </div>`);

  const falta = faltaPd();
  const aberta = lojaAberta();
  const nomeTit = g.secao === 'pizzas' && meio && sabor2 ? `½ ${g.base} + ½ ${p.extraNome}` : g.base;

  $('#sheetProduto').innerHTML = `
    <div class="sheet-corpo">
      <div class="pd-art">
        <div class="card-tags">${tagsDe(g)}</div>
        ${g.secao === 'pizzas' && meio ? window.ChoppArt.pizzaMeio() : artDe(g.base, g.secao, v.imagem_url || g.img)}
        <button class="sheet-fechar" data-fechar aria-label="Fechar">${ICON.x}</button>
      </div>
      <h2 class="pd-nome">${esc(nomeTit)}</h2>
      ${copyDe(g) ? `<p class="pd-copy">${esc(copyDe(g))}</p>` : ''}
      ${g.desc ? `<p class="pd-desc">${esc(cap(g.desc))}</p>` : ''}
      ${g.categoria === 'Porções' ? '<p class="pd-desc">🥣 Acompanha molho branco da casa.</p>' : ''}
      ${partes.join('')}
    </div>
    <div class="sheet-pe">
      ${mm ? `<p class="min-aviso">⏰ Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h</p>` : !aberta ? '<p class="min-aviso">Estamos fechados agora</p>' : falta ? `<p class="min-aviso">${esc(falta)}</p>` : ''}
      <div class="pd-pe">
        <div class="stepper"><button data-pdq="-1" aria-label="Menos">−</button><b>${S.pd.qtd}</b><button data-pdq="1" aria-label="Mais">+</button></div>
        <button class="btn-cta" id="pdAdd" ${mm || !aberta || falta ? 'disabled' : ''}><span>Adicionar</span><span>${fmt(p.total)}</span></button>
      </div>
    </div>`;
}

function faltaPd() {
  const { g, meio, sabor2 } = S.pd;
  if (g.secao === 'pizzas' && meio && !sabor2) return 'Escolha o 2º sabor da pizza';
  const f = (g.opcoes || []).findIndex((_, i) => !S.pd.opc[i]);
  if (f >= 0) return g.opcoes[f].titulo;
  return '';
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
    pid: p.prodDb.id,
    nomeDb: p.prodDb.nome,
    titulo: g.secao === 'pizzas' && meio && sabor2 ? `Pizza ½ ${g.base} + ½ ${p.extraNome}` : (g.secao === 'pizzas' ? 'Pizza ' + g.base : g.base),
    sub: p.v.tam || '',
    preco: p.unit, qtd: S.pd.qtd, obs: obs.join(' · '),
    secao: g.secao, img: p.v.imagem_url || g.img, meio: !!(meio && sabor2),
  }, false);
  p.addons.forEach(r => addItem(itemRapido(r, 1), false));
  renderBarra(true); atualizarBotoesMenu();
  voar(btn);
  fecharSheet('sheetProduto');
  const depois = totais();
  if (antes.fg > 0 && !antes.gratis && depois.gratis) { confete(); toast('🎉 Frete grátis desbloqueado!', 'ok'); }
  else toast(`${p.addons.length ? 'Itens adicionados' : 'Adicionado'} ao pedido 🍻`, 'ok');
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

  // se o carrinho é só marmitex (almoço rápido), não empurra álcool aqui também
  const soMarmitex = S.carrinho.length > 0 && S.carrinho.every(i => i.secao === 'marmitex');
  const alcoolOk = oferecerAlcool() && !soMarmitex;
  const semAlcool = r => alcoolOk || !/cerveja|chopp/i.test(r.nome);

  // 1) itens que sozinhos já liberam o frete grátis (os mais baratos que fecham a meta)
  if (t.fg > 0 && !t.gratis && t.falta <= 60) {
    S.rows.filter(r => disponivel(r) && semAlcool(r) && efetivo(r) >= t.falta && !/marmit/i.test(r.nome) && !/^(Combo)/i.test(r.nome))
      .sort((a, b) => efetivo(a) - efetivo(b)).slice(0, 3).forEach(r => push(r, true));
  }

  // 2) complementos de cada produto que já está no carrinho, com peso por quantos
  //    itens diferentes do pedido "puxam" a mesma sugestão (e pela posição nessa lista)
  const peso = new Map();
  const gruposVistos = new Set();
  S.carrinho.forEach(it => {
    const g = S.grupos.find(x => x.variantes.some(v => v.id === it.pid));
    if (!g || gruposVistos.has(g.key)) return;
    gruposVistos.add(g.key);
    candidatosPara(g, 6).forEach((r, i) => peso.set(r.id, (peso.get(r.id) || 0) + (6 - i)));
  });
  [...peso.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([id]) => { const r = S.porId.get(id); if (r && semAlcool(r)) push(r); });

  return out.slice(0, 6);
}

function abrirCarrinho() { validarCarrinho(); renderCarrinho(); abrirSheet('sheetCarrinho'); }

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

function renderCarrinho() {
  const el = $('#sheetCarrinho');
  const qtd = S.carrinho.reduce((s, i) => s + i.qtd, 0);
  if (!qtd) {
    el.innerHTML = `<div class="sheet-alca"></div>
      <div class="sheet-cab"><h2>Seu pedido</h2><button class="sheet-fechar" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      <div class="sheet-corpo"><div class="vazio"><img src="assets/mascote.png" alt=""><p>Seu pedido está vazio.<br>Que tal começar pelo nosso frango?</p><button class="btn-cta" data-fechar>Ver cardápio</button></div></div>`;
    return;
  }
  const t = totais();
  const min = num('pedido_minimo');
  const pct = t.fg > 0 ? Math.min(100, (t.sub / t.fg) * 100) : 0;
  const sug = sugestoes();
  const fechaFrete = sug.filter(s => s.fecha), resto = sug.filter(s => !s.fecha);
  const sugCard = ({ r, fecha }) => {
    const { base, tam } = parseNome(r.nome);
    const gg = S.grupos.find(x => x.variantes.some(y => y.id === r.id));
    return `<div class="sug-card">
      <div class="sug-art">${artDe(base, gg?.secao, r.imagem_url || gg?.img)}</div>
      <div class="sug-txt"><strong>${esc(base)}${tam ? ` (${esc(tam)})` : ''}</strong>
        ${fecha ? '<span class="fecha-gap">✓ Libera o frete</span>' : ''}
        <div class="sug-pe"><b>${fmt(efetivo(r))}</b><button class="btn-add" data-sug="${r.id}" aria-label="Adicionar ${esc(base)}">${ICON.plus}</button></div>
      </div></div>`;
  };

  el.innerHTML = `
    <div class="sheet-alca"></div>
    <div class="sheet-cab"><h2>Seu pedido</h2><button class="sheet-fechar" data-fechar aria-label="Fechar">${ICON.x}</button></div>
    <div class="sheet-corpo">
      ${t.fg > 0 ? `<div class="meta${t.gratis ? ' ok' : ''}">
        <p>${t.gratis ? '🎉 <b>Frete grátis</b> desbloqueado no delivery!' : `🛵 Faltam <b>${fmt(t.falta)}</b> pro <b>frete grátis</b>`}</p>
        <div class="meta-barra"><i style="width:${pct}%"></i></div>
      </div>` : ''}
      ${fechaFrete.length ? `<div class="sug" style="margin:0 0 16px"><h4>⚡ Adicione 1 destes e a entrega sai de graça</h4><div class="sug-lista">${fechaFrete.map(sugCard).join('')}</div></div>` : ''}
      <div class="itens">${S.carrinho.map(it => `
        <div class="item">
          <div class="item-art">${artDe(it.titulo, it.secao, it.img)}</div>
          <div class="item-txt"><strong>${esc(it.titulo)}</strong>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}${it.obs ? `<small>${esc(it.obs)}</small>` : ''}</div>
          <div class="item-lado"><b>${fmt(it.preco * it.qtd)}</b>
            <div class="stepper"><button data-q="-1" data-k="${esc(it.k)}" aria-label="Menos">${it.qtd === 1 ? '🗑' : '−'}</button><b>${it.qtd}</b><button data-q="1" data-k="${esc(it.k)}" aria-label="Mais">+</button></div>
          </div>
        </div>`).join('')}
      </div>
      ${resto.length ? `<div class="sug"><h4>✨ Vai bem com isso</h4><div class="sug-lista">${resto.map(sugCard).join('')}</div></div>` : ''}
    </div>
    <div class="sheet-pe">
      <div class="totais">
        <div><span>Subtotal</span><span>${fmt(t.sub)}</span></div>
        <div><span>Entrega <small>(delivery)</small></span><span class="${t.gratis ? 'gratis' : ''}">${t.gratis ? 'Grátis 🎉' : fmt(t.taxa)}</span></div>
        <div class="tot"><span>Total</span><span>${fmt(t.total)}</span></div>
      </div>
      ${t.sub < min ? `<p class="min-aviso">Pedido mínimo de ${fmt(min)}. Faltam ${fmt(min - t.sub)}.</p>` : ''}
      ${!lojaAberta() ? '<p class="min-aviso">Estamos fechados agora. Volta mais tarde! 🍻</p>' : ''}
      <button class="btn-cta full" id="btnContinuar" ${t.sub < min || !lojaAberta() ? 'disabled' : ''}>Continuar · ${fmt(t.total)} →</button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECKOUT
// ═══════════════════════════════════════════════════════════════════════════
function abrirCheckout() {
  validarCarrinho();
  if (!S.carrinho.length) return;
  const cli = ls('chopp_cliente', {});
  S.ck = { passo: 1, tipo: cli.tipo || 'delivery', rua: cli.rua || '', bairro: cli.bairro || '', comp: cli.comp || '', nome: cli.nome || '', tel: cli.tel || '', pag: cli.pag || '', troco: '', obs: '', enviando: false, ultimaFechada: false };
  renderCheckout();
  abrirSheet('sheetCheckout');
}
const mascaraTel = v => { const d = soDigitos(v).slice(0, 11); if (d.length <= 2) return d; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };

function renderCheckout() {
  const ck = S.ck, t = totais(ck.tipo);
  const el = $('#sheetCheckout');
  const cab = `<div class="sheet-alca"></div>
    <div class="sheet-cab">
      ${ck.passo > 1 ? `<button class="sheet-fechar" data-ck-voltar aria-label="Voltar">${ICON.voltar}</button>` : ''}
      <h2 style="flex:1">${ck.passo === 1 ? 'Entrega e dados' : 'Pagamento'}</h2>
      <button class="sheet-fechar" data-fechar aria-label="Fechar">${ICON.x}</button>
    </div>
    <div class="passos"><i class="on"></i><i class="${ck.passo > 1 ? 'on' : ''}"></i></div>`;

  if (ck.passo === 1) {
    el.innerHTML = `${cab}
      <div class="sheet-corpo">
        <h3 class="ck-titulo">Como você quer receber?</h3>
        <div class="tipos">
          <button class="tipo${ck.tipo === 'delivery' ? ' on' : ''}" data-tipo="delivery"><span class="ico">🛵</span><strong>Delivery</strong><small>${t.gratis ? 'Grátis 🎉' : fmt(num('taxa_entrega'))} · ${C.DEFAULTS.tempo_entrega}</small></button>
          <button class="tipo${ck.tipo === 'retirada' ? ' on' : ''}" data-tipo="retirada"><span class="ico">🛍️</span><strong>Retirar</strong><small>Sem taxa · ${C.DEFAULTS.tempo_retirada}</small></button>
        </div>
        ${ck.tipo === 'delivery' ? `
        <div class="campos">
          <div><label class="campo-rot" for="ckRua">Rua e número</label><input class="campo" id="ckRua" autocomplete="street-address" placeholder="Ex.: Av. Paraná, 1234" value="${esc(ck.rua)}"></div>
          <div class="dupla">
            <div><label class="campo-rot" for="ckBairro">Bairro</label><input class="campo" id="ckBairro" placeholder="Bairro" value="${esc(ck.bairro)}"></div>
            <div><label class="campo-rot" for="ckComp">Compl.</label><input class="campo" id="ckComp" placeholder="Ap, casa" value="${esc(ck.comp)}"></div>
          </div>
        </div>` : `<p class="pd-desc" style="margin-top:12px">📍 Retirada em: <b>${esc(valido(S.info.endereco) ? S.info.endereco : 'Choppatinhas, Umuarama-PR')}</b></p>`}
        <h3 class="ck-titulo">Quem tá pedindo?</h3>
        <div class="campos" style="margin-top:0">
          <div><label class="campo-rot" for="ckNome">Seu nome</label><input class="campo" id="ckNome" autocomplete="name" placeholder="Como te chamamos?" value="${esc(ck.nome)}"></div>
          <div><label class="campo-rot" for="ckTel">WhatsApp</label><input class="campo" id="ckTel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(44) 99999-9999" value="${esc(mascaraTel(ck.tel))}"></div>
        </div>
      </div>
      <div class="sheet-pe"><button class="btn-cta full" id="ckAvancar">Ir para pagamento →</button></div>`;
    return;
  }

  const soMarmitexCk = S.carrinho.length > 0 && S.carrinho.every(i => i.secao === 'marmitex');
  const nomeUltima = (oferecerAlcool() && !soMarmitexCk) ? C.BEBIDA_ULTIMA_CHANCE : C.BEBIDA_ULTIMA_CHANCE_SEM_ALCOOL;
  const bebida = S.rows.find(r => r.nome === nomeUltima && r.disponivel !== false)
    || S.rows.find(r => r.nome === C.BEBIDA_ULTIMA_CHANCE_SEM_ALCOOL && r.disponivel !== false);
  const semBebida = !S.carrinho.some(i => i.secao === 'bebidas');
  const pags = [
    { k: 'pix', ico: '⚡', t: 'PIX', d: 'Aprovação na hora' },
    { k: 'dinheiro', ico: '💵', t: 'Dinheiro', d: 'Pague na entrega' },
    { k: 'cartao_credito', ico: '💳', t: 'Cartão de crédito', d: 'Maquininha na entrega' },
    { k: 'cartao_debito', ico: '💳', t: 'Cartão de débito', d: 'Maquininha na entrega' },
  ];
  el.innerHTML = `${cab}
    <div class="sheet-corpo">
      ${semBebida && bebida && !ck.ultimaFechada ? `
      <div class="ultima">
        <span class="opc-mini">${artDe(bebida.nome, 'bebidas', bebida.imagem_url)}</span>
        <div class="ultima-txt"><strong>${/cerveja|chopp/i.test(bebida.nome) ? 'Uma cerveja gelada para acompanhar?' : 'Vai com uma bebida? 🥤'}</strong><small>${esc(bebida.nome)} por ${fmt(efetivo(bebida))}</small></div>
        <button class="btn-cta sm" data-ultima="${bebida.id}">+ Pôr</button>
      </div>` : ''}
      <h3 class="ck-titulo">Como vai pagar?</h3>
      <div class="pags">${pags.map(p => `
        <button class="pag${ck.pag === p.k ? ' on' : ''}" data-pag="${p.k}"><span class="ico">${p.ico}</span><span><strong>${p.t}</strong><small>${p.d}</small></span><span class="opc-marca"></span></button>`).join('')}
      </div>
      ${ck.pag === 'dinheiro' ? `<div class="troco"><label class="campo-rot" for="ckTroco">Troco para quanto? <small>(deixe vazio se não precisar)</small></label><input class="campo" id="ckTroco" inputmode="decimal" placeholder="Ex.: 100" value="${esc(ck.troco)}"></div>` : ''}
      <h3 class="ck-titulo">Observação pro pedido</h3>
      <textarea class="campo" id="ckObs" rows="2" maxlength="200" placeholder="Ex.: interfone quebrado, pode ligar">${esc(ck.obs)}</textarea>
      <div class="resumo">
        <h5>Resumo</h5>
        <ul>${S.carrinho.map(i => `<li><span>${i.qtd}x ${esc(i.titulo)}${i.sub ? ` (${esc(i.sub)})` : ''}</span><span>${fmt(i.preco * i.qtd)}</span></li>`).join('')}</ul>
        <div class="totais" style="margin:0">
          <div><span>Subtotal</span><span>${fmt(t.sub)}</span></div>
          <div><span>${ck.tipo === 'retirada' ? 'Retirada' : 'Entrega'}</span><span class="${t.taxa === 0 ? 'gratis' : ''}">${t.taxa === 0 ? 'Grátis' : fmt(t.taxa)}</span></div>
          <div class="tot"><span>Total</span><span>${fmt(t.total)}</span></div>
        </div>
        <p class="pd-desc" style="margin-top:8px;font-size:12.5px">${ck.tipo === 'delivery' ? `🛵 ${esc(ck.rua)}${ck.comp ? ', ' + esc(ck.comp) : ''} · ${esc(ck.bairro)}` : '🛍️ Retirada no balcão'} · ${esc(ck.nome)}</p>
      </div>
    </div>
    <div class="sheet-pe"><button class="btn-cta full verde" id="ckFinalizar" ${ck.enviando ? 'disabled' : ''}>${ck.enviando ? 'Enviando pedido…' : `Confirmar pedido · ${fmt(t.total)}`}</button></div>`;
}

function lerPasso1() {
  const ck = S.ck;
  if ($('#ckRua')) { ck.rua = $('#ckRua').value.trim(); ck.bairro = $('#ckBairro').value.trim(); ck.comp = $('#ckComp').value.trim(); }
  ck.nome = $('#ckNome').value.trim(); ck.tel = soDigitos($('#ckTel').value);
}
function validarPasso1() {
  lerPasso1();
  const ck = S.ck; const erros = [];
  if (ck.tipo === 'delivery') {
    if (ck.rua.length < 4) erros.push('#ckRua');
    if (ck.bairro.length < 2) erros.push('#ckBairro');
  }
  if (ck.nome.length < 2) erros.push('#ckNome');
  if (ck.tel.length < 10) erros.push('#ckTel');
  $$('.campo.erro').forEach(e => e.classList.remove('erro'));
  erros.forEach(s => $(s)?.classList.add('erro'));
  if (erros.length) { $(erros[0])?.focus(); toast('Confere os campos marcados 👀', 'erro'); }
  return !erros.length;
}

function telefoneBanco(d) { d = soDigitos(d); return d.length <= 11 ? '55' + d : d; } // mesmo formato do agente (JID do WhatsApp)

async function finalizar() {
  const ck = S.ck;
  if (ck.enviando) return;
  if (!ck.pag) return toast('Escolha a forma de pagamento', 'erro');
  ck.obs = $('#ckObs')?.value.trim() || '';
  if (ck.pag === 'dinheiro') ck.troco = $('#ckTroco')?.value.trim() || '';
  ck.enviando = true; renderCheckout();

  try {
    // loja ainda aberta?
    const { data: st } = await sb.from('info_restaurante').select('valor').eq('chave', 'loja_aberta').maybeSingle();
    if (st && String(st.valor) !== 'true') { S.info.loja_aberta = st.valor; renderStatus(); throw new Error('FECHADA'); }
    if (S.carrinho.some(i => i.secao === 'marmitex') && !marmitexAgora()) throw new Error('MARMITEX');

    const t = totais(ck.tipo);
    const tel = telefoneBanco(ck.tel);
    const endereco = ck.tipo === 'delivery' ? `${ck.rua}${ck.comp ? ', ' + ck.comp : ''} - ${ck.bairro}` : null;

    // 1. cliente (mesma regra do agente: telefone só dígitos com 55)
    let { data: cli } = await sb.from('clientes').select('id, total_pedidos, total_gasto, primeiro_pedido').eq('telefone', tel).maybeSingle();
    if (cli) {
      const patch = { nome: ck.nome }; if (endereco) patch.endereco = endereco;
      await sb.from('clientes').update(patch).eq('id', cli.id);
    } else {
      const r = await sb.from('clientes').insert({ nome: ck.nome, telefone: tel, endereco, total_pedidos: 0, total_gasto: 0 }).select('id, total_pedidos, total_gasto, primeiro_pedido').single();
      if (r.error) throw r.error; cli = r.data;
    }

    // 2. pedido
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

    // 3. itens
    const itens = S.carrinho.map(i => ({
      pedido_id: pedido.id, produto_id: i.pid, nome_produto: i.nomeDb, preco_unitario: i.preco,
      quantidade: i.qtd, observacao: i.obs || null, total: r2(i.preco * i.qtd),
    }));
    const ri = await sb.from('itens_pedido').insert(itens);
    if (ri.error) throw ri.error;

    // 4. estatística do cliente (não bloqueia se falhar)
    const agora = new Date().toISOString();
    sb.from('clientes').update({
      total_pedidos: (cli.total_pedidos || 0) + 1, total_gasto: r2((Number(cli.total_gasto) || 0) + t.total),
      ultimo_pedido: agora, data_ultima_interacao: agora, ...(cli.primeiro_pedido ? {} : { primeiro_pedido: agora }),
    }).eq('id', cli.id).then(() => {});

    // 5. memória local
    lsSet('chopp_cliente', { nome: ck.nome, tel: ck.tel, rua: ck.rua, bairro: ck.bairro, comp: ck.comp, tipo: ck.tipo, pag: ck.pag });
    const ult = { id: pedido.id, numero: pedido.numero_pedido, total: t.total, sub: t.sub, taxa: t.taxa, tipo: ck.tipo, pag: ck.pag, endereco, nome: ck.nome, criado: Date.now(), status: 'pendente', itens: S.carrinho.map(i => ({ ...i })) };
    lsSet('chopp_ultimo', ult);
    lsSet('chopp_repetir', { itens: S.carrinho.map(i => ({ ...i })) });
    S.carrinho = []; salvarCarrinho();

    fecharSheet('sheetCheckout', true); fecharSheet('sheetCarrinho', true);
    history.replaceState(null, '');
    renderBarra(); renderMenu(); renderRetorno();
    abrirStatus(ult, true);
    confete();
  } catch (e) {
    console.error(e);
    ck.enviando = false; renderCheckout();
    if (e.message === 'FECHADA') toast('A loja acabou de fechar 😕 Tenta mais tarde!', 'erro');
    else if (e.message === 'MARMITEX') toast(`Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h. Tira ele do pedido pra continuar.`, 'erro');
    else toast('Não conseguimos enviar agora. Confere a internet e tenta de novo.', 'erro');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACOMPANHAR PEDIDO
// ═══════════════════════════════════════════════════════════════════════════
function msgWhatsApp(u) {
  const sep = '━━━━━━━━━━━━━━━';
  const linhas = u.itens.map(i => `${i.qtd}x ${i.titulo}${i.sub ? ` (${i.sub})` : ''}  ${fmt(i.preco * i.qtd)}${i.obs ? `\n   _${i.obs}_` : ''}`).join('\n');
  const pagNome = { pix: 'PIX', dinheiro: 'Dinheiro', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito' }[u.pag] || u.pag;
  return `Olá! Fiz um pedido pelo cardápio 🍻\n\n*Pedido #${String(u.numero).padStart(3, '0')}*\n${sep}\n${linhas}\n${sep}\nSubtotal: ${fmt(u.sub)}\n${u.taxa > 0 ? `Entrega: ${fmt(u.taxa)}\n` : ''}*Total: ${fmt(u.total)}*\n\n${u.tipo === 'delivery' ? `📍 *Entrega em:*\n${u.endereco}` : '🛍️ *Retirada no local*'}\n\n💳 *Pagamento:* ${pagNome}${u.pag === 'pix' ? '\n\nSegue o comprovante 👇' : ''}`;
}

async function abrirStatus(u, novo = false) {
  S.statusAtual = u;
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
    <div class="sheet-alca"></div>
    <div class="sheet-cab"><h2>${novo ? 'Pedido confirmado' : 'Seu pedido'}</h2><button class="sheet-fechar" data-fechar aria-label="Fechar">${ICON.x}</button></div>
    <div class="sheet-corpo">
      <div class="ok-topo">
        <div class="ok-selo">${et < 0 ? '😕' : et >= 3 ? '✅' : '🍻'}</div>
        <h3>${et < 0 ? 'Pedido cancelado' : novo ? 'Pedido recebido!' : etapas[Math.max(0, et)].t}</h3>
        <p>${et < 0 ? 'Fale com a gente no WhatsApp se tiver dúvida.' : u.tipo === 'delivery' ? `Previsão: ${C.DEFAULTS.tempo_entrega}` : `Fica pronto em ${C.DEFAULTS.tempo_retirada}`}</p>
        <span class="ok-num">#${String(u.numero).padStart(3, '0')} · ${fmt(u.total)}</span>
      </div>
      ${et < 0 ? '<div class="cancelado-box">Este pedido foi cancelado pela casa.</div>' : `
      <ol class="linha-tempo">${etapas.map((e, i) => `
        <li class="${i < et || et === 3 ? 'feito' : i === et ? 'agora' : ''}"><span class="bola">${e.ico}</span><span><strong>${e.t}</strong><small>${e.d}</small></span></li>`).join('')}
      </ol>`}
      ${u.pag === 'pix' && et >= 0 && et < 3 ? `
      <div class="pix">
        <h4>⚡ Pagamento via PIX</h4>
        ${chave ? `<p>Copie a chave, pague e mande o comprovante no WhatsApp.</p>
          <div class="pix-chave"><code id="pixChave">${esc(chave)}</code><button data-copiar="${esc(chave)}">Copiar</button></div>`
          : '<p>A casa te manda a chave PIX no WhatsApp em instantes. 🙌</p>'}
        <p class="pix-valor">Valor: <b>${fmt(u.total)}</b></p>
      </div>` : ''}
    </div>
    <div class="sheet-pe" style="display:grid;gap:8px">
      ${linkWa ? `<a class="btn-cta full verde" href="${linkWa}" target="_blank" rel="noopener">${u.pag === 'pix' ? '📲 Enviar comprovante no WhatsApp' : '💬 Falar com a casa no WhatsApp'}</a>` : ''}
      <button class="btn-ghost" data-fechar>Voltar ao cardápio</button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EFEITOS
// ═══════════════════════════════════════════════════════════════════════════
let toastT;
function toast(msg, tipo = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast on ' + tipo;
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}
function voar(origem) {
  const alvo = $('#barraBtn'); if (!origem || !alvo || $('#barra').hidden) return;
  const a = origem.getBoundingClientRect(), b = alvo.getBoundingClientRect();
  const v = $('#voa'); v.textContent = '+1';
  const x0 = a.left + a.width / 2 - 17, y0 = a.top + a.height / 2 - 17;
  const x1 = b.left + 30 - 17, y1 = b.top + b.height / 2 - 17;
  v.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
    { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 80}px) scale(1.15)`, opacity: 1, offset: .5 },
    { transform: `translate(${x1}px, ${y1}px) scale(.4)`, opacity: 0 },
  ], { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' });
  origem.classList?.remove('pop'); void origem.offsetWidth; origem.classList?.add('pop');
}
function confete() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cores = ['#FFC94D', '#F5A524', '#E8414B', '#F6EBD4', '#3FBE74'];
  for (let i = 0; i < 42; i++) {
    const c = document.createElement('i'); c.className = 'confete';
    c.style.background = cores[i % cores.length];
    c.style.left = (window.innerWidth / 2) + 'px'; c.style.top = (window.innerHeight * .45) + 'px';
    document.body.appendChild(c);
    const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 220;
    c.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + 260}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.2,.8,.4,1)' }).onfinish = () => c.remove();
  }
}
function bolhas() {
  const box = $('.hero-bolhas'); if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  box.innerHTML = Array.from({ length: 16 }, () => {
    const s = 4 + Math.random() * 10;
    return `<i style="left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${6 + Math.random() * 7}s;animation-delay:${Math.random() * 8}s"></i>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN (engrenagem → senha → painel embutido)
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
    try { sessionStorage.setItem('chopp_adm', '1'); } catch { /* ok */ }
    $('#admSenha').hidden = true; admAbrir();
  } else { $('#admErro').hidden = false; $('#admSenhaInput').select(); navigator.vibrate?.(80); }
}
function admAbrir() { $('#adm').hidden = false; document.body.classList.add('travado'); admRender(); }
function admFechar() { $('#adm').hidden = true; ADM.edit = null; if (!pilha.length) document.body.classList.remove('travado'); }

function admRender() {
  const el = $('#adm');
  const painel = valido(S.info.painel_url) ? S.info.painel_url : '';
  el.innerHTML = `
    <div class="adm-topo">
      <div class="adm-topo-in">
        <img src="assets/mascote.png" alt="" width="36" height="36" style="border-radius:50%">
        <h2>Painel da casa</h2>
        ${painel ? `<a class="btn-ghost" style="height:40px" href="${esc(painel)}" target="_blank" rel="noopener">Pedidos ↗</a>` : ''}
        <button class="sheet-fechar" data-adm-fechar aria-label="Fechar">${ICON.x}</button>
      </div>
      <div class="adm-abas">
        <button class="adm-aba${ADM.aba === 'produtos' ? ' on' : ''}" data-adm-aba="produtos">Produtos</button>
        <button class="adm-aba${ADM.aba === 'loja' ? ' on' : ''}" data-adm-aba="loja">Loja</button>
      </div>
    </div>
    <div class="adm-corpo">${ADM.aba === 'produtos' ? admProdutosHTML() : admLojaHTML()}</div>
    ${ADM.edit ? admEditHTML() : ''}`;
}

function admProdutosHTML() {
  const termo = semAcento(ADM.busca);
  const rows = S.rows.filter(r => !termo || semAcento(r.nome + ' ' + r.categoria).includes(termo));
  const cats = [...new Set(S.rows.map(r => r.categoria || 'Outros'))];
  return `
    <div class="adm-barra">
      <input class="campo" id="admBusca" placeholder="Buscar produto…" value="${esc(ADM.busca)}">
      <button class="btn-cta sm" data-adm-novo>＋ Novo produto</button>
    </div>
    <p class="pd-desc" style="margin:-4px 0 14px;font-size:12.5px">⭐ = aparece em destaque no topo · o interruptor liga/desliga o produto no cardápio na hora.</p>
    ${cats.map(cat => {
      const lista = rows.filter(r => (r.categoria || 'Outros') === cat).sort((a, b) => a.nome.localeCompare(b.nome));
      if (!lista.length) return '';
      return `<div class="adm-grupo"><h3>${esc(cat)} · ${lista.length}</h3>${lista.map(r => `
        <div class="adm-linha${r.disponivel === false ? ' off' : ''}">
          <div class="adm-thumb">${artDe(r.nome, cat === 'Pizzas' ? 'pizzas' : cat === 'Bebidas' ? 'bebidas' : cat === 'Lanches' ? 'lanches' : '', r.imagem_url)}</div>
          <div class="adm-info"><strong>${esc(r.nome)}</strong><small>${Number(r.preco_promocional) > 0 && Number(r.preco_promocional) < Number(r.preco) ? `<s>${fmt(r.preco)}</s>${fmt(r.preco_promocional)}` : fmt(r.preco)}</small></div>
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
  return `
    <div class="veu on" style="z-index:285" data-adm-cancelar></div>
    <section class="sheet on" style="z-index:290" role="dialog" aria-modal="true">
      <div class="sheet-alca"></div>
      <div class="sheet-cab"><h2>${r.id ? 'Editar produto' : 'Novo produto'}</h2><button class="sheet-fechar" data-adm-cancelar aria-label="Fechar">${ICON.x}</button></div>
      <div class="sheet-corpo">
        <form class="adm-form" id="admForm">
          <div class="adm-foto">
            <div class="adm-foto-prev">${prev ? `<img src="${esc(prev)}" alt="">` : window.ChoppArt.svg(r.nome || '', '')}</div>
            <div style="display:grid;gap:6px">
              <label class="btn-ghost" style="height:40px">📷 ${prev ? 'Trocar foto' : 'Enviar foto'}<input type="file" id="admFoto" accept="image/*" hidden></label>
              ${prev ? '<button type="button" class="btn-ghost adm-perigo" style="height:36px;font-size:13px" data-adm-semfoto>Remover foto</button>' : ''}
            </div>
          </div>
          <div><label class="campo-rot">Nome <small>(use "(M)" / "(G)" no fim para tamanhos)</small></label><input class="campo" name="nome" required value="${esc(r.nome || '')}"></div>
          <div><label class="campo-rot">Categoria</label>
            <select class="campo" name="categoria">${cats.map(c => `<option${c === r.categoria ? ' selected' : ''}>${esc(c)}</option>`).join('')}<option value="__nova">＋ Nova categoria…</option></select>
          </div>
          <div id="admNovaCat" hidden><input class="campo" name="nova_cat" placeholder="Nome da nova categoria"></div>
          <div><label class="campo-rot">Descrição</label><textarea class="campo" name="descricao" rows="3">${esc(r.descricao || '')}</textarea></div>
          <div class="dupla">
            <div><label class="campo-rot">Preço (R$)</label><input class="campo" name="preco" inputmode="decimal" required value="${r.preco ?? ''}"></div>
            <div><label class="campo-rot">Promo (R$) <small>opcional</small></label><input class="campo" name="preco_promocional" inputmode="decimal" value="${r.preco_promocional ?? ''}"></div>
          </div>
          <div class="adm-tg"><span><strong>Disponível</strong><small>Aparece no cardápio</small></span><button type="button" class="sw${r.disponivel !== false ? ' on' : ''}" data-adm-tg="disponivel"></button></div>
          <div class="adm-tg"><span><strong>Destaque ⭐</strong><small>Vai pro carrossel do topo</small></span><button type="button" class="sw${r.destaque ? ' on' : ''}" data-adm-tg="destaque"></button></div>
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
  const campo = (k, rot, dica = '', tipo = 'text') => `<div><label class="campo-rot">${rot} ${dica ? `<small>${dica}</small>` : ''}</label><input class="campo" data-cfg="${k}" type="${tipo}" value="${v(k)}"></div>`;
  return `
    <div class="adm-cfg">
      <div class="adm-tg"><span><strong>${lojaAberta() ? '🟢 Loja aberta' : '🔴 Loja fechada'}</strong><small>Fechada = ninguém consegue pedir pelo cardápio</small></span><button class="sw${lojaAberta() ? ' on' : ''}" data-adm-loja></button></div>
      <div class="adm-tg"><span><strong>${oferecerAlcool() ? '🍺 Sugerindo cerveja/chopp' : '🚫 Sem álcool nas sugestões'}</strong><small>Vale pro "Turbine seu pedido" e "Vai bem com isso". Cerveja em lata entrega numa boa (não é chopp de torneira — a casa não vende chopp puro), mas se preferir não empurrar, desliga aqui.</small></span><button class="sw${oferecerAlcool() ? ' on' : ''}" data-adm-alcool></button></div>
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
  renderStatus(); renderHeroInfo(); renderBarra();
  toast('Configurações salvas ✅', 'ok');
}

async function admToggleLoja() {
  const novo = !lojaAberta();
  const { error } = await sb.from('info_restaurante').upsert({ chave: 'loja_aberta', valor: String(novo) }, { onConflict: 'chave' });
  if (error) return toast('Erro: ' + error.message, 'erro');
  S.info.loja_aberta = String(novo); renderStatus(); admRender();
  toast(novo ? 'Loja aberta 🟢' : 'Loja fechada 🔴', 'ok');
}

async function admToggleAlcool() {
  const novo = !oferecerAlcool();
  const { error } = await sb.from('info_restaurante').upsert({ chave: 'oferecer_alcool', valor: String(novo) }, { onConflict: 'chave' });
  if (error) return toast('Erro: ' + error.message, 'erro');
  S.info.oferecer_alcool = String(novo); admRender();
  toast(novo ? 'Sugestões de cerveja/chopp ligadas 🍺' : 'Sugestões de cerveja/chopp desligadas 🚫', 'ok');
}

async function admPatch(id, patch) {
  const r = S.rows.find(x => x.id === id); if (!r) return;
  const antes = { ...r }; Object.assign(r, patch);
  agrupar(); renderMenu(); renderDestaques(); admRender();
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

  const btn = $('#admSalvar'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    let imagem_url = r.imagem_url || null;
    if (r._arquivo) {
      const blob = await comprimir(r._arquivo);
      const caminho = `${Date.now()}-${semAcento(nome).replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.jpg`;
      const up = await sb.storage.from(C.BUCKET).upload(caminho, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      imagem_url = sb.storage.from(C.BUCKET).getPublicUrl(caminho).data.publicUrl;
    }
    if (r._semFoto) imagem_url = null;
    const dados = { nome, categoria, descricao: String(fd.get('descricao') || '').trim() || null, preco, preco_promocional: promo, disponivel: r.disponivel !== false, destaque: !!r.destaque, imagem_url };
    const q = r.id ? sb.from('produtos').update(dados).eq('id', r.id).select().single() : sb.from('produtos').insert(dados).select().single();
    const { data, error } = await q;
    if (error) throw error;
    const i = S.rows.findIndex(x => x.id === data.id); if (i >= 0) S.rows[i] = data; else S.rows.push(data);
    ADM.edit = null; agrupar(); renderMenu(); renderDestaques(); admRender();
    toast('Produto salvo ✅', 'ok');
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
    // produto já usado em pedidos (FK) → desativa em vez de apagar
    if (/foreign key|violates/i.test(error.message)) { await admPatch(r.id, { disponivel: false }); ADM.edit = null; admRender(); return toast('Esse produto já tem pedidos, então foi desativado em vez de excluído.', 'ok'); }
    return toast('Erro: ' + error.message, 'erro');
  }
  S.rows = S.rows.filter(x => x.id !== r.id); ADM.edit = null;
  agrupar(); renderMenu(); renderDestaques(); admRender(); toast('Produto excluído', 'ok');
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
    if ('admSemfoto' in d) { admGuardarForm(); ADM.edit._semFoto = true; ADM.edit._arquivo = null; ADM.edit._preview = null; ADM.edit.imagem_url = null; return admRender(); }
    if ('admExcluir' in d) return admExcluir();
    if (t.id === 'admSalvar') return admSalvarProduto();
    if ('admLoja' in d) return admToggleLoja();
    if ('admAlcool' in d) return admToggleAlcool();
    if ('admSalvarCfg' in d) return admSalvarCfg();
  });
  adm.addEventListener('input', debounce(e => {
    if (e.target.id === 'admBusca') { ADM.busca = e.target.value; const pos = e.target.selectionStart; admRender(); const i = $('#admBusca'); i.focus(); i.setSelectionRange(pos, pos); }
  }, 200));
  adm.addEventListener('change', e => {
    if (e.target.id === 'admFoto' && e.target.files[0]) {
      admGuardarForm();
      const f = e.target.files[0]; ADM.edit._arquivo = f; ADM.edit._semFoto = false;
      ADM.edit._preview = URL.createObjectURL(f); admRender();
    }
    if (e.target.name === 'categoria') $('#admNovaCat').hidden = e.target.value !== '__nova';
  });
}
function admGuardarForm() {
  const f = $('#admForm'); if (!f) return;
  const fd = new FormData(f);
  ['nome', 'descricao', 'preco', 'preco_promocional'].forEach(k => { ADM.edit[k] = fd.get(k); });
  if (fd.get('categoria') !== '__nova') ADM.edit.categoria = fd.get('categoria');
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTOS
// ═══════════════════════════════════════════════════════════════════════════
function eventos() {
  // header com borda ao rolar
  addEventListener('scroll', () => $('#topo').classList.toggle('rolou', scrollY > 8), { passive: true });

  // busca
  const abrirBusca = () => { $('#busca').hidden = false; $('#buscaInput').focus(); };
  const fecharBusca = () => { $('#busca').hidden = true; $('#buscaInput').value = ''; S.busca = ''; renderMenu(); };
  $('#btnBusca').addEventListener('click', () => ($('#busca').hidden ? abrirBusca() : fecharBusca()));
  $('#buscaFechar').addEventListener('click', fecharBusca);
  $('#buscaInput').addEventListener('input', debounce(e => {
    S.busca = e.target.value; renderMenu();
    const y = $('#cats').getBoundingClientRect().top + scrollY - 70;
    if (scrollY < y) scrollTo({ top: y, behavior: 'smooth' });
  }, 160));

  // carrossel: bolinhas
  $('#destaques').addEventListener('scroll', debounce(() => {
    const box = $('#destaques'); const cards = $$('.dest', box); if (!cards.length) return;
    const i = Math.round(box.scrollLeft / (cards[0].offsetWidth + 14));
    $$('#destaquesDots i').forEach((d, j) => d.classList.toggle('on', j === i));
  }, 60), { passive: true });

  // categorias
  $('#catsIn').addEventListener('click', e => {
    const b = e.target.closest('.cat'); if (!b) return;
    const sec = $('#sec-' + b.dataset.sec); if (!sec) return;
    rolandoPorClique = true; marcarCat(b.dataset.sec, true);
    scrollTo({ top: sec.getBoundingClientRect().top + scrollY - (64 + 58), behavior: 'smooth' });
    setTimeout(() => { rolandoPorClique = false; }, 900);
  });

  // cliques gerais (delegação)
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-add],[data-g],[data-abre],[data-mais-pid],[data-menos-pid],[data-balde],[data-fechar],[data-acompanhar],[data-repetir]');
    if (!el || el.closest('#adm')) return;
    const d = el.dataset;

    if ('fechar' in d) { const sh = el.closest('.sheet'); return sh ? fecharSheet(sh.id) : fecharTopo(); }
    if ('acompanhar' in d) { const u = ls('chopp_ultimo', null); return u && abrirStatus(u); }
    if ('repetir' in d) return repetirPedido();
    if (d.balde) { const r = S.porId.get(d.balde); return r && (addRapido(r, 6, el), toast('6 latas no pedido', 'ok')); }
    if (d.maisPid) { const it = S.carrinho.find(i => i.pid === d.maisPid && !i.obs); return it && mudarQtd(it.k, 1); }
    if (d.menosPid) { const it = S.carrinho.find(i => i.pid === d.menosPid && !i.obs); return it && mudarQtd(it.k, -1); }
    if (d.add) {
      e.stopPropagation();
      const g = S.grupos.find(x => x.key === d.add); if (!g) return;
      if (g.secao === 'marmitex' && !marmitexAgora()) return toast(`Marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h ⏰`, 'erro');
      if (g.simples && g.disponiveis[0]) return addRapido(g.disponiveis[0], 1, el);
      return abrirProduto(g.key);
    }
    if (d.abre) return abrirProduto(d.abre);
    if (d.g && !el.closest('.sheet')) return abrirProduto(d.g);
  });

  $('#veu').addEventListener('click', fecharTopo);
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#adm').hidden) { if (ADM.edit) { ADM.edit = null; admRender(); } else admFechar(); } else fecharTopo(); } });
  $('#barraBtn').addEventListener('click', abrirCarrinho);

  // sheet produto
  $('#sheetProduto').addEventListener('click', e => {
    const t = e.target.closest('[data-tam],[data-meio],[data-sabor],[data-opc],[data-sem],[data-addon],[data-pdq],#pdAdd'); if (!t) return;
    e.preventDefault();
    const d = t.dataset;
    S.pd.obs = $('#pdObs')?.value || S.pd.obs;
    if (d.tam) S.pd.idx = +d.tam;
    else if ('meio' in d) { S.pd.meio = !S.pd.meio; if (!S.pd.meio) S.pd.sabor2 = null; }
    else if (d.sabor) S.pd.sabor2 = d.sabor;
    else if (d.opc) S.pd.opc[+d.opc] = d.val;
    else if (d.sem) S.pd.sem.has(d.sem) ? S.pd.sem.delete(d.sem) : S.pd.sem.add(d.sem);
    else if (d.addon) S.pd.addons.has(d.addon) ? S.pd.addons.delete(d.addon) : S.pd.addons.add(d.addon);
    else if (d.pdq) S.pd.qtd = Math.max(1, Math.min(50, S.pd.qtd + +d.pdq));
    else if (t.id === 'pdAdd') return confirmarProduto(t);
    const corpo = $('#sheetProduto .sheet-corpo'); const y = corpo.scrollTop;
    renderProduto();
    $('#sheetProduto .sheet-corpo').scrollTop = y;
  });
  $('#sheetProduto').addEventListener('input', e => { if (e.target.id === 'pdObs') S.pd.obs = e.target.value; });

  // sheet carrinho
  $('#sheetCarrinho').addEventListener('click', e => {
    const t = e.target.closest('[data-q],[data-sug],#btnContinuar'); if (!t) return;
    if (t.dataset.q) { mudarQtd(t.dataset.k, +t.dataset.q); return renderCarrinho(); }
    if (t.dataset.sug) {
      const r = S.porId.get(t.dataset.sug); if (!r) return;
      const antes = totais(); addItem(itemRapido(r, 1));
      const depois = totais();
      if (antes.fg > 0 && !antes.gratis && depois.gratis) { confete(); toast('🎉 Frete grátis desbloqueado!', 'ok'); } else toast('Adicionado 🍻', 'ok');
      return renderCarrinho();
    }
    if (t.id === 'btnContinuar') abrirCheckout();
  });

  // checkout
  $('#sheetCheckout').addEventListener('click', e => {
    const t = e.target.closest('[data-tipo],[data-pag],[data-ultima],[data-ck-voltar],#ckAvancar,#ckFinalizar'); if (!t) return;
    const ck = S.ck; const d = t.dataset;
    if (ck.passo === 1 && $('#ckNome')) lerPasso1();
    if (ck.passo === 2) { ck.obs = $('#ckObs')?.value || ck.obs; if ($('#ckTroco')) ck.troco = $('#ckTroco').value; }
    if (d.tipo) { ck.tipo = d.tipo; return renderCheckout(); }
    if (d.pag) { ck.pag = d.pag; renderCheckout(); if (d.pag === 'dinheiro') $('#ckTroco')?.focus(); return; }
    if (d.ultima) { const r = S.porId.get(d.ultima); if (r) { addItem(itemRapido(r, 1)); ck.ultimaFechada = true; toast('Cerveja adicionada', 'ok'); } return renderCheckout(); }
    if ('ckVoltar' in d) { ck.passo = 1; return renderCheckout(); }
    if (t.id === 'ckAvancar') { if (validarPasso1()) { ck.passo = 2; renderCheckout(); $('#sheetCheckout .sheet-corpo').scrollTop = 0; } return; }
    if (t.id === 'ckFinalizar') finalizar();
  });
  $('#sheetCheckout').addEventListener('input', e => {
    if (e.target.id === 'ckTel') { const p = e.target.selectionStart, antes = e.target.value.length; e.target.value = mascaraTel(e.target.value); const dif = e.target.value.length - antes; e.target.setSelectionRange(p + dif, p + dif); }
    e.target.classList.remove('erro');
  });

  // status
  $('#sheetStatus').addEventListener('click', async e => {
    const t = e.target.closest('[data-copiar]'); if (!t) return;
    try { await navigator.clipboard.writeText(t.dataset.copiar); t.textContent = 'Copiado ✓'; toast('Chave PIX copiada ✅', 'ok'); }
    catch { const r = document.createRange(); r.selectNodeContents($('#pixChave')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Segure para copiar a chave', ''); }
  });

  // admin
  $('#btnAdmin').addEventListener('click', admAbrirSenha);
  $('#admSenhaForm').addEventListener('submit', admVerificar);
  $('#admCancelar').addEventListener('click', () => { $('#admSenha').hidden = true; });
  admEventos();

  // voltou pra aba: atualiza status do pedido e horário do marmitex
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
  bolhas();
  eventos();
  renderBarra();
  try {
    await carregar();
  } catch (e) {
    console.error(e);
    $('#menu').innerHTML = `<div class="vazio"><img src="assets/mascote.png" alt=""><p>Não conseguimos carregar o cardápio.<br>Confere sua internet.</p><button class="btn-cta" onclick="location.reload()">Tentar de novo</button></div>`;
    return;
  }
  agrupar();
  renderStatus(); renderHeroInfo(); renderDestaques(); renderMenu();
  validarCarrinho(); renderBarra();
  renderRetorno();
  tempoReal();
  if (location.hash === '#admin') admAbrirSenha();
}
document.addEventListener('DOMContentLoaded', init);
