// ═══════════════════════════════════════════════════════════════════════════
// CHOPPATINHAS v4 — "a comanda", enxuta
// Mesma linguagem da v3 (cartaz + comanda + caneta), com foco: cada item mostra
// só nome, preço e uma linha; tamanhos e opções aparecem quando o cliente abre.
// Caneta só onde decide alguma coisa (no máx. uma anotação por item), nada
// correndo na tela, navegação única fixa no topo. Mesmo banco e mesma medição.
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
  busca: '',
  aberto: null,     // item com o painel aberto no cardápio
  pd: null,         // escolhas feitas no painel
  pos: null,        // "vai bem junto", logo depois de anotar
  cmd: 'lista',     // o que a comanda mostra: lista | checkout | status
  cmdAberta: false, // comanda aberta por cima (celular)
  ck: null,
  ult: null,        // pedido acompanhado na comanda
  stEtapa: null,    // última etapa carimbada (anima só quando muda)
  ultimoK: null,    // última linha anotada (efeito de impressão)
  canalPedido: null,
  recusasCombina: 0,
};

// ─── UTIL ───────────────────────────────────────────────────────────────────
function ls(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } }
const fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Preço de vitrine: sem "R$" e sem ",00" (engenharia de cardápio). Comanda e pagamento usam o completo.
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
const desktop = () => matchMedia('(min-width: 1100px)').matches;
const doisDig = n => String(n).padStart(2, '0');
const cssEsc = s => (window.CSS?.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));

const ICON = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
};
// Traços de caneta (desenham na tela quando aparecem)
const RAB = {
  circulo: '<svg class="rab rab-circ" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M60 5C31 2 5 11 4 26c-1 14 24 21 47 20 24-1 45-7 45-21C96 11 76 3 46 6"/></svg>',
  sublinha: '<svg class="rab rab-sub" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 7C21 3 44 8 66 5s23-2 32 1"/></svg>',
  seta: '<svg class="rab rab-seta" viewBox="0 0 60 40" aria-hidden="true"><path pathLength="1" d="M4 5c15 1 31 9 38 27m0 0-10-4m10 4 2-11"/></svg>',
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
// Só a primeira frase: na lista o cliente precisa entender o prato, não ler um parágrafo
const frase1 = t => { const s = String(t || '').trim(); const m = s.match(/^.+?[.!?](?=\s|$)/); return m ? m[0] : s; };
const midiaDe = (nome, secao, img) => img
  ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">`
  : window.ChoppArt.svg(nome, secao);
const MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'e', 'na', 'no', 'nas', 'nos', 'em', 'ao', 'a', 'o', 'p/']);
function nomeBonito(t) {
  return String(t || '').replace(/\bC\/\s*/gi, 'c/ ').split(' ').map((w, i) => (i && MINUSC.has(w.toLowerCase())) ? w.toLowerCase() : w).join(' ');
}
const pesoTxt = gr => gr >= 1000 ? (gr / 1000).toLocaleString('pt-BR') + 'kg' : gr + 'g';

// Nome de cartaz: "Combo Alcatra na Chapa com Mandioca e Cebola" → "Alcatra na Chapa"
function nomeCartaz(g) {
  const sem = g.nome.replace(/^combo\s+/i, '');
  const corte = sem.split(/\s+(?:com|c\/)\s+/i)[0];
  return corte.split(' ').length >= 2 ? corte : sem;
}
// Quebra o nome em linhas de cartaz (cada linha ocupa a largura toda)
function linhasCartaz(txt, max = 3) {
  const p = txt.toUpperCase().split(/\s+/);
  const toks = [];
  for (let i = 0; i < p.length; i++) {
    if (/^(NA|NO|DE|DA|DO|E|C\/|COM|EM|AO)$/.test(p[i]) && i < p.length - 1) { toks.push(p[i] + ' ' + p[i + 1]); i++; } else toks.push(p[i]);
  }
  if (toks.length <= max) return toks;
  const alvo = toks.join(' ').length / max;
  const out = [''];
  toks.forEach(t => {
    const atual = out[out.length - 1];
    if (atual && (atual + ' ' + t).length > alvo * 1.2 && out.length < max) out.push(t);
    else out[out.length - 1] = atual ? atual + ' ' + t : t;
  });
  return out;
}

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
    acomp: (a, b) => a.rankAnota - b.rankAnota || a.min - b.min,
    bebidas: (a, b) => bebOrdem(a.base) - bebOrdem(b.base) || a.min - b.min,
  };
  grupos.sort((a, b) => {
    const ia = C.SECOES.findIndex(s => s.id === a.secao), ib = C.SECOES.findIndex(s => s.id === b.secao);
    if (ia !== ib) return ia - ib;
    return (ordem[a.secao] || ((x, y) => x.base.localeCompare(y.base)))(a, b) || a.base.localeCompare(b.base);
  });
  S.grupos = grupos;
  // o painel aberto continua apontando pro produto certo depois de uma atualização ao vivo
  if (S.pd) {
    const ng = grupos.find(x => x.key === S.pd.g.key);
    if (ng?.disponivel) { S.pd.g = ng; S.pd.vs = ng.disponiveis; S.pd.idx = Math.min(S.pd.idx, S.pd.vs.length - 1); }
    else { S.pd = null; S.aberto = null; }
  }
}

function maisPedidos() {
  return S.grupos.filter(g => g.disponivel && (g.vendas >= 3 || g.rankAnota < 99))
    .sort((a, b) => a.rankAnota - b.rankAnota || b.vendas - a.vendas)
    .slice(0, 6);
}

// Anotação de caneta do garçom (só com fato: ranking real, venda real, promo, destaque)
function notaDe(g) {
  if (g.promo) return 'oferta de hoje!';
  if (g.rankAnota === 0) return 'o nº 1 da casa';
  if (g.hoje >= 3) return `já saíram ${g.hoje} hoje`;
  if (g.rankAnota < 99) return 'um dos mais pedidos';
  if (g.destaque) return 'a casa recomenda';
  return '';
}
// "G por só +4" quando o maior custa até 20% a mais (ancoragem)
function dicaTamanho(g) {
  const vs = g.disponiveis; if (vs.length < 2) return '';
  const a = vs[0], b = vs[vs.length - 1]; const dif = r2(b.efetivo - a.efetivo);
  return dif > 0 && dif / a.efetivo <= 0.2 ? `${b.letra || 'G'} por só +${fmtMenu(dif)}` : '';
}

// ─── HORÁRIOS / REGRAS ──────────────────────────────────────────────────────
const lojaAberta = () => String(S.info.loja_aberta ?? 'true') === 'true';
const marmitexAgora = () => { const h = new Date().getHours(); return h >= C.MARMITEX.inicio && h < C.MARMITEX.fim; };
const oferecerAlcool = () => String(S.info.oferecer_alcool ?? 'true') === 'true';
const ehAlcool = r => /cerveja|chopp/i.test(r.nome);
function horarioTxt() { return valido(S.info.horario) ? S.info.horario.replace(/\(.*?\)/g, '').trim() : C.DEFAULTS.horario; }

// Complementos certos pra cada prato (mesma lógica da v2)
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
  return lista.slice(0, max);
}
const SECOES_COMBINA = new Set(['frango', 'combos', 'porcoes', 'lanches', 'caldos', 'marmitex']);

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
  agrupar(); renderInfo(); renderRanking(); renderMenu();
}

function renderTudo() {
  agrupar(); renderCapa(); renderRanking(); renderMenu(); renderAba();
  if (S.cmd === 'lista' && (S.cmdAberta || desktop())) renderComanda();
}

function tempoReal() {
  const reagir = debounce(() => {
    renderTudo();
    if (!$('#adm').hidden && !ADM.edit) admRender();
  }, 300);
  sb.channel('cardapio-v4-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, ({ eventType, new: n, old: o }) => {
      if (eventType === 'DELETE') S.rows = S.rows.filter(r => r.id !== o.id);
      else { const i = S.rows.findIndex(r => r.id === n.id); if (i >= 0) S.rows[i] = n; else S.rows.push(n); }
      reagir();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'info_restaurante' }, ({ new: n }) => {
      if (!n?.chave) return;
      S.info[n.chave] = n.valor;
      renderTopo(); renderInfo(); renderRodape(); renderAba();
      if (S.cmd === 'lista' && (S.cmdAberta || desktop())) renderComanda();
    })
    .subscribe();
}

// ═══════════════════════════════════════════════════════════════════════════
// TOPO / LETREIRO / RODAPÉ
// ═══════════════════════════════════════════════════════════════════════════
function renderTopo() {
  const el = $('#topoStatus');
  el.classList.toggle('fechado', !lojaAberta());
  const ate = horarioTxt().match(/fecha\s+(?:às|as)\s+(.+)/i);
  el.innerHTML = lojaAberta() ? `<i></i>aberto${ate ? ' até ' + esc(ate[1]) : ''}` : '<i></i>fechado agora';
}
// Só o que o cliente precisa antes de pedir: está aberto? demora? frete?
function renderInfo() {
  const fg = num('frete_gratis_acima');
  const ate = horarioTxt().match(/fecha\s+(?:às|as)\s+(.+)/i);
  const cel = (rot, val, cls = '') => `<div class="info-cel ${cls}"><small>${rot}</small><b>${esc(val)}</b></div>`;
  $('#info').innerHTML = [
    lojaAberta() ? cel('aberto', ate ? 'até ' + ate[1] : 'agora', 'aberto') : cel('agora', 'fechado', 'fechado'),
    cel('entrega', C.DEFAULTS.tempo_entrega),
    fg > 0 ? cel('frete grátis', 'acima de ' + fmtCurto(fg)) : cel('retirada', C.DEFAULTS.tempo_retirada),
  ].join('');
}
function renderRodape() {
  $('#rodapeHora').textContent = horarioTxt();
  $('#rodapeEnd').textContent = valido(S.info.endereco) ? S.info.endereco : 'Umuarama — PR';
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPA — o produto em destaque, em vídeo, com o nome em tamanho de cartaz
// ═══════════════════════════════════════════════════════════════════════════
function grupoDoPalco() {
  const disp = S.grupos.filter(g => g.disponivel);
  const comVideo = disp.filter(g => g.video).sort((a, b) => b.destaque - a.destaque || a.rankAnota - b.rankAnota);
  if (comVideo.length) return comVideo[0];
  return disp.filter(g => g.img).sort((a, b) => a.rankAnota - b.rankAnota || b.destaque - a.destaque)[0] || null;
}

let obsCapa;
// Navegador embutido de app (WhatsApp, Instagram…) costuma recusar autoplay de
// vídeo mesmo mudo. Aí troca pra animação (.webp com o mesmo nome do vídeo) —
// imagem animada nunca é bloqueada. Só sem animação é que aparece o botão de tocar.
function tentarTocarCapa(v) {
  const box = v.closest('.capa-midia');
  v.play().then(() => box?.classList.remove('precisa-toque')).catch(() => usarAnimacaoDeReserva(v, box));
}
function usarAnimacaoDeReserva(v, box) {
  if (!box) return;
  const anim = box.querySelector('#capaAnim');
  if (!anim) { box.classList.add('precisa-toque'); return; }
  if (!anim.hidden) { box.classList.remove('precisa-toque'); return; }
  if (box.dataset.animTentada) return;
  box.dataset.animTentada = '1';
  anim.addEventListener('load', () => { v.style.visibility = 'hidden'; anim.hidden = false; box.classList.remove('precisa-toque'); }, { once: true });
  anim.addEventListener('error', () => box.classList.add('precisa-toque'), { once: true });
  anim.src = v.currentSrc.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.webp$2');
}

function renderCapa() {
  const g = grupoDoPalco();
  const capa = $('#capa');
  if (!g) { capa.hidden = true; return; }
  capa.hidden = false;
  const midia = (g.video || g.img) + '|' + g.min;
  if (capa.dataset.g === g.key && capa.dataset.m === midia) return; // nada mudou: não reinicia o vídeo
  capa.dataset.g = g.key; capa.dataset.m = midia;
  const video = g.video && !reduzMovimento();
  const linhas = linhasCartaz(nomeCartaz(g));
  capa.innerHTML = `
    <div class="capa-midia" data-abre="${esc(g.key)}">
      ${video
        ? `<video id="capaVideo" src="${esc(g.video)}" ${g.img ? `poster="${esc(g.img)}"` : ''} muted autoplay loop playsinline preload="auto"></video>
           <img id="capaAnim" alt="" hidden>`
        : g.video
          ? `<video id="capaVideo" src="${esc(g.video)}" ${g.img ? `poster="${esc(g.img)}"` : ''} muted loop playsinline preload="auto" controls></video>`
          : `<img class="capa-zoom" src="${esc(g.img)}" alt="">`}
      <button class="capa-play" id="capaPlay" aria-label="Tocar vídeo">${ICON.play}</button>
    </div>
    <div class="capa-txt">
      <p class="capa-kicker">${g.video ? 'destaque da casa' : 'o mais pedido'}</p>
      <h2 class="capa-nome" aria-label="${esc(g.nome)}">${linhas.map(l => `<span class="encaixa" data-max="170">${esc(l)}</span>`).join('')}</h2>
      ${copyDe(g) ? `<p class="capa-copy">${esc(frase1(copyDe(g)))}</p>` : ''}
      <div class="capa-pe">
        <button class="capa-btn" data-add="${esc(g.key)}">quero esse <span>→</span></button>
        <div class="etiqueta" aria-label="Preço"><i class="furo"></i><small class="mao">${g.disponiveis.length > 1 ? 'a partir de' : 'por'}</small><b>${fmtMenu(g.min)}</b></div>
      </div>
    </div>`;
  encaixar(capa);
  observarRabiscos(capa);
  const v = $('#capaVideo');
  if (v && video) {
    tentarTocarCapa(v);
    v.addEventListener('canplay', () => { if (v.paused) tentarTocarCapa(v); }, { once: true });
    obsCapa?.disconnect();
    obsCapa = new IntersectionObserver(([e]) => { if (e.isIntersecting) tentarTocarCapa(v); else v.pause(); }, { threshold: .2 });
    obsCapa.observe(v);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RETORNO — acompanhar pedido / pedir de novo (canhotos de papel)
// ═══════════════════════════════════════════════════════════════════════════
const ETAPAS = {
  delivery: [
    { t: 'Pedido recebido', d: 'a casa já está com o seu pedido', c: 'recebido' },
    { t: 'Na cozinha', d: 'preparando tudo na hora', c: 'na cozinha' },
    { t: 'Saiu pra entrega', d: 'está a caminho — pode pôr a mesa', c: 'saiu' },
    { t: 'Entregue', d: 'bom apetite!', c: 'entregue' },
  ],
  retirada: [
    { t: 'Pedido recebido', d: 'a casa já está com o seu pedido', c: 'recebido' },
    { t: 'Na cozinha', d: 'preparando tudo na hora', c: 'na cozinha' },
    { t: 'Pronto pra retirar', d: 'pode vir buscar!', c: 'pronto' },
    { t: 'Retirado', d: 'bom apetite!', c: 'retirado' },
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
      partes.push(`<button class="canhoto vivo" data-acompanhar><span class="canhoto-num">Nº ${doisDig(ult.numero).padStart(3, '0')}</span><span class="canhoto-txt"><b>${esc(e.t)}</b><small>${esc(e.d)}</small></span><span class="canhoto-seta">acompanhar →</span></button>`);
    }
  }
  const rep = ls('chopp_repetir', null);
  if (rep?.itens?.length) {
    const total = rep.itens.reduce((s, i) => s + i.preco * i.qtd, 0);
    partes.push(`<button class="canhoto" data-repetir><span class="canhoto-num">↺</span><span class="canhoto-txt"><b>pedir de novo · ${fmt(total)}</b><small>${esc(rep.itens.map(i => `${i.qtd}x ${i.titulo}`).join(', '))}</small></span><span class="canhoto-seta">repetir →</span></button>`);
  }
  box.innerHTML = partes.join('');
  box.hidden = !partes.length;
}
function repetirPedido() {
  const rep = ls('chopp_repetir', null); if (!rep) return;
  if (!lojaAberta()) return toast('estamos fechados agora — volta mais tarde!', 'erro');
  let ok = 0, fora = 0;
  rep.itens.forEach(it => {
    const row = S.porId.get(it.pid);
    if (!row || row.disponivel === false) { fora++; return; }
    addItem({ ...it, preco: it.meio ? it.preco : efetivo(row), origem: 'repetir', fonte: 'repetir' }, false); ok++;
  });
  renderAba(); atualizarMenu();
  toast(ok ? `${ok} ${ok === 1 ? 'item voltou' : 'itens voltaram'} pra comanda${fora ? ` (${fora} indisponível)` : ''}` : 'esses itens não estão disponíveis hoje', ok ? 'ok' : 'erro');
  if (ok) setTimeout(() => abrirComanda('lista'), 300);
}

// ═══════════════════════════════════════════════════════════════════════════
// OS MAIS PEDIDOS — ranking tipográfico
// ═══════════════════════════════════════════════════════════════════════════
function renderRanking() {
  const lista = maisPedidos();
  const box = $('#ranking');
  box.hidden = lista.length < 3;
  if (box.hidden) return;
  // só os 3 primeiros: é um atalho pra quem não quer pensar, não um segundo cardápio
  box.innerHTML = `
    <h2 class="rk-tit">Os mais pedidos</h2>
    <ol class="rk-lista">${lista.slice(0, 3).map((g, i) => `
      <li class="rk-item" data-abre="${esc(g.key)}">
        <span class="rk-num">${i + 1}</span>
        <span class="rk-nome">${esc(g.nome)}</span>
        <span class="rk-preco">${fmtMenu(g.min)}</span>
        <button class="b-mais" data-add="${esc(g.key)}" aria-label="Pedir ${esc(g.nome)}">${ICON.plus}</button>
      </li>`).join('')}
    </ol>`;
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

function renderIndice(secoes) {
  $('#trilhoIn').innerHTML = secoes.map(s => `<a href="#sec-${s.id}" data-ir="${s.id}">${esc(s.nome)}</a>`).join('');
}

function qtdNoCarrinho(g) { const ids = new Set(g.variantes.map(v => v.id)); return S.carrinho.filter(i => ids.has(i.pid)).reduce((s, i) => s + i.qtd, 0); }

function acaoHTML(g) {
  const v = g.disponiveis[0];
  const bebida = g.secao === 'bebidas';
  if (bebida && g.simples) {
    const it = S.carrinho.find(i => i.pid === v.id && !i.obs);
    const seis = /cerveja/i.test(g.base) ? `<button class="b-6" data-balde="${v.id}">+6 latas</button>` : '';
    if (it) return `${seis}<span class="passo"><button data-menos-pid="${v.id}" aria-label="Menos">−</button><b>${it.qtd}</b><button data-mais-pid="${v.id}" aria-label="Mais">+</button></span>`;
    return `${seis}<button class="b-mais" data-add="${esc(g.key)}" aria-label="Anotar ${esc(g.nome)}">${ICON.plus}</button>`;
  }
  if (g.simples) return `<button class="b-mais" data-add="${esc(g.key)}" aria-label="Anotar ${esc(g.nome)}">${ICON.plus}</button>`;
  return `<button class="b-mais" data-toque aria-label="Escolher ${esc(g.nome)}">${ICON.plus}</button>`;
}

// Uma anotação de caneta por item, no máximo — senão nada se destaca
const anotacaoDe = g => notaDe(g) || dicaTamanho(g);

function itemHTML(g) {
  const aberto = S.aberto === g.key;
  const q = qtdNoCarrinho(g);
  const mao = anotacaoDe(g);
  const bebida = g.secao === 'bebidas';
  const desc = frase1(copyDe(g) || cap(g.desc));
  const marca = `<span class="it-marca mao"${q ? '' : ' hidden'}>${q}x</span>`;
  const multi = g.disponiveis.length > 1;
  const preco = `${multi ? '<small>a partir de</small>' : ''}${fmtMenu(g.min)}`;

  if (g.img && !bebida) {
    return `
    <article class="it prato${aberto ? ' aberto' : ''}" data-item="${esc(g.key)}">
      <div class="it-cab" data-toque>
        <figure class="prato-foto"><img src="${esc(g.img)}" alt="" loading="lazy" decoding="async">${mao ? `<figcaption class="prato-nota mao">${esc(mao)}</figcaption>` : ''}${marca}</figure>
        <div class="prato-barra">
          <h3 class="prato-placa">${esc(g.nome)}</h3>
          <span class="prato-preco">${preco}</span>
        </div>
        ${desc ? `<p class="it-desc">${esc(desc)}</p>` : ''}
      </div>
      ${aberto ? painelHTML(g) : `<button class="prato-cta" ${g.simples ? `data-add="${esc(g.key)}"` : 'data-toque'}>${g.simples ? 'anotar na comanda' : multi ? 'escolher tamanho' : 'escolher'} <span>${g.simples ? '+' : '→'}</span></button>`}
    </article>`;
  }
  return `
    <article class="it linha${aberto ? ' aberto' : ''}${bebida ? ' beb' : ''}" data-item="${esc(g.key)}">
      ${marca}
      <div class="linha-grade">
        <div class="it-cab" data-toque>
          <div class="linha-topo"><h3>${esc(g.nome)}</h3><span class="pontos"></span><b>${preco}</b></div>
          ${desc ? `<p class="it-desc">${esc(desc)}</p>` : ''}
          ${mao ? `<p class="linha-nota mao">${esc(mao)}</p>` : ''}
        </div>
        ${aberto ? '' : `<div class="it-acao">${acaoHTML(g)}</div>`}
      </div>
      ${aberto ? painelHTML(g) : ''}
    </article>`;
}

function renderMenu() {
  const secoes = secoesVisiveis();
  renderIndice(secoes);
  const menu = $('#menu');
  if (!secoes.length) {
    menu.innerHTML = '';
    $('#buscaVazia').hidden = !S.busca;
    $('#buscaTermo').textContent = `“${S.busca}”`;
    return;
  }
  $('#buscaVazia').hidden = true;
  menu.innerHTML = secoes.map((s, i) => `
    <section class="sec sec-${s.id}" id="sec-${s.id}" data-sec="${s.id}">
      <header class="sec-cab">
        <h2 class="sec-tit"><span class="encaixa" data-max="62">${esc(s.nome)}</span></h2>
        ${s.sub ? `<p class="sec-sub">${esc(s.sub)}</p>` : ''}
      </header>
      ${s.id === 'marmitex' && !marmitexAgora() ? `<p class="sec-aviso">marmitex sai só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h</p>` : ''}
      <div class="sec-itens${s.id === 'bebidas' ? ' compacto' : ''}">${s.grupos.map(itemHTML).join('')}</div>
    </section>`).join('');
  encaixar(menu);
  observarRabiscos(menu);
  observarSecoes();
}

// Re-desenha só um item (abrir/fechar painel, anotar) sem mexer no resto
function refreshItem(key) {
  if (!key) return null;
  const g = S.grupos.find(x => x.key === key);
  const el = $(`#menu [data-item="${cssEsc(key)}"]`);
  if (!g || !el) return null;
  el.outerHTML = itemHTML(g);
  const novo = $(`#menu [data-item="${cssEsc(key)}"]`);
  observarRabiscos(novo);
  return novo;
}
// Marcas de caneta "2x" e o passo das bebidas depois que a comanda muda
function atualizarMenu() {
  $$('#menu [data-item]').forEach(el => {
    const g = S.grupos.find(x => x.key === el.dataset.item); if (!g) return;
    if (g.secao === 'bebidas' && S.aberto !== g.key) { el.outerHTML = itemHTML(g); return; }
    const q = qtdNoCarrinho(g); const m = $('.it-marca', el);
    if (m) { m.textContent = q + 'x'; m.hidden = !q; }
  });
}

// ─── PAINEL DO ITEM (abre no próprio cardápio) ──────────────────────────────
function novoPd(g, fonte = 'cardapio') {
  const vs = g.disponiveis.length ? g.disponiveis : g.variantes;
  let idx = 0;
  // ancoragem: se o maior custa até 20% a mais, ele já vem marcado
  if (vs.length > 1) { const a = vs[0], b = vs[vs.length - 1]; if ((b.efetivo - a.efetivo) / a.efetivo <= 0.2) idx = vs.length - 1; }
  return { g, vs, idx, idxInicial: idx, upgradeClicado: false, fonte, opc: {}, sem: new Set(), qtd: 1, obs: '' };
}
function precoPd() {
  const v = S.pd.vs[S.pd.idx];
  return { v, unit: v.efetivo, prodDb: v, total: r2(v.efetivo * S.pd.qtd) };
}
function ingredientesDe(g) {
  if (g.secao !== 'lanches') return [];
  return String(g.descricao || '').split(/,\s*|\s+e\s+/).map(s => s.trim()).filter(s => s && s.length < 26 && !/^(hamb[uú]rguer|p[aã]o|frango|picanha)$/i.test(s));
}
function faltaPd() {
  const { g } = S.pd;
  const f = (g.opcoes || []).findIndex((_, i) => !S.pd.opc[i]);
  return f >= 0 ? g.opcoes[f].titulo : '';
}

function painelHTML(g) {
  if (S.pos?.key === g.key) return posHTML(g);
  if (!S.pd || S.pd.g.key !== g.key) S.pd = novoPd(g);
  const { vs, idx } = S.pd;
  const v = vs[idx];
  const p = precoPd();
  const partes = [];
  if (vs.length > 1) {
    const ppg = vs.map(x => x.gramas ? x.efetivo / x.gramas : null);
    const melhor = ppg.every(Boolean) ? ppg.indexOf(Math.min(...ppg)) : -1;
    const maior = vs[vs.length - 1];
    partes.push(`
      <div class="p-bloco">
        <p class="p-rot">tamanho</p>
        <div class="p-tams">${vs.map((x, i) => `
          <button class="p-tam${i === idx ? ' on' : ''}" data-tam="${i}">
            <b>${esc(x.tam || x.letra)}</b><span>${x.gramas ? pesoTxt(x.gramas) : '&nbsp;'}</span><em>${fmtMenu(x.efetivo)}</em>
            ${i === melhor && i === vs.length - 1 ? '<i class="mao">melhor custo!</i>' : ''}
          </button>`).join('')}
        </div>
        ${idx < vs.length - 1 ? `<button class="p-up" data-tam="${vs.length - 1}" data-up><span class="mao">por só <b>+${fmt(r2(maior.efetivo - v.efetivo))}</b> vem a ${esc((maior.tam || '').toLowerCase())}${maior.gramas && v.gramas ? ` (+${maior.gramas - v.gramas}g)` : ''}</span><u>trocar</u></button>` : ''}
      </div>`);
  }
  (g.opcoes || []).forEach((grp, gi) => {
    partes.push(`
      <div class="p-bloco">
        <p class="p-rot">${esc(grp.titulo)} <span class="${S.pd.opc[gi] ? 'ok' : 'obr'}">${S.pd.opc[gi] ? 'ok' : 'escolha um'}</span></p>
        <div class="p-opcs">${grp.itens.map(o => `<button class="p-opc${S.pd.opc[gi] === o ? ' on' : ''}" data-opc="${gi}" data-val="${esc(o)}"><i class="caixa"></i>${esc(o)}</button>`).join('')}</div>
      </div>`);
  });
  const ingr = ingredientesDe(g);
  if (ingr.length) {
    partes.push(`
      <div class="p-bloco">
        <p class="p-rot">quer tirar algo? <span>toque pra riscar</span></p>
        <p class="p-ingr">${ingr.map(i => `<button class="p-ing${S.pd.sem.has(i) ? ' riscado' : ''}" data-sem="${esc(i)}">${esc(i)}</button>`).join('')}</p>
      </div>`);
  }
  partes.push(S.pd.obsAberta || S.pd.obs
    ? `<div class="p-bloco">
        <label class="p-campo"><span>obs.</span><input id="pdObs" maxlength="140" placeholder="bem passado, molho à parte…" value="${esc(S.pd.obs)}"></label>
      </div>`
    : '<button class="p-mais-obs" data-obs>+ observação</button>');

  const falta = faltaPd();
  const mm = g.secao === 'marmitex' && !marmitexAgora();
  const aviso = mm ? `marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h` : !lojaAberta() ? 'estamos fechados agora' : falta ? falta.toLowerCase() : '';
  return `
    <div class="painel">
      ${partes.join('')}
      <div class="p-pe">
        <span class="passo grande"><button data-pdq="-1" aria-label="Menos">−</button><b>${S.pd.qtd}</b><button data-pdq="1" aria-label="Mais">+</button></span>
        <button class="p-anotar" data-anotar ${mm || !lojaAberta() || falta ? 'disabled' : ''}><span>anotar</span><b>${fmt(p.total)}</b></button>
      </div>
      ${aviso ? `<p class="p-aviso">${esc(aviso)}</p>` : ''}
      <button class="p-fechar" data-fechar-item>fechar</button>
    </div>`;
}

function posHTML() {
  const { cands, aceitos } = S.pos;
  const t = totais();
  return `
    <div class="painel pos">
      <p class="pos-ok mao">anotado! ✓</p>
      ${cands.length ? `
        <p class="p-rot">vai bem junto</p>
        <div class="pos-lista">${cands.map(r => {
          const { base, tam } = parseNome(r.nome);
          const libera = t.fg > 0 && !t.gratis && efetivo(r) >= t.falta;
          return `<button class="pos-it${aceitos.has(r.id) ? ' on' : ''}" data-junto="${r.id}"><i class="caixa"></i><span>${esc(nomeBonito(base))}${tam ? ` <small>(${esc(tam)})</small>` : ''}${libera ? '<em class="mao">libera o frete!</em>' : ''}</span><span class="pontos"></span><b>+${fmtNum(efetivo(r))}</b></button>`;
        }).join('')}</div>` : ''}
      <button class="pos-fim" data-pos-fim>${aceitos.size ? 'pronto, continuar →' : cands.length ? 'não, obrigado' : 'ok'}</button>
    </div>`;
}

function abrirItem(key, fonte = 'cardapio', rolar = false) {
  const g = S.grupos.find(x => x.key === key); if (!g) return;
  const anterior = S.aberto;
  let el = $(`#menu [data-item="${cssEsc(key)}"]`);
  const topoAntes = el?.getBoundingClientRect().top;
  if (S.pos && S.pos.key !== key) encerrarPos();
  S.aberto = key; S.pd = novoPd(g, fonte); S.pos = null;
  if (anterior && anterior !== key) refreshItem(anterior);
  el = refreshItem(key);
  if (!el) { // escondido pela busca: limpa e tenta de novo
    S.busca = ''; $('#buscaInput').value = ''; $('#busca').hidden = true;
    renderMenu(); el = $(`#menu [data-item="${cssEsc(key)}"]`); rolar = true;
  }
  rastrear('produto_aberto', { produto: g.nome, fonte });
  if (!el) return;
  if (rolar) rolarAte(el);
  else if (topoAntes != null) scrollBy(0, el.getBoundingClientRect().top - topoAntes); // o item tocado não "pula"
}
function fecharItem(key = S.aberto) {
  if (!key) return;
  if (S.pos?.key === key) encerrarPos();
  S.aberto = null; S.pd = null; S.pos = null;
  refreshItem(key);
}
function encerrarPos() {
  if (S.pos?.cands.length && !S.pos.aceitos.size) { S.recusasCombina++; rastrear('combina_recusado'); }
  S.pos = null;
}
function rolarAte(el) {
  const y = el.getBoundingClientRect().top + scrollY - (desktop() ? 70 : 58);
  scrollTo({ top: y, behavior: reduzMovimento() ? 'auto' : 'smooth' });
}
// Depois de anotar um prato: "vai bem junto" ali mesmo (substitui o pop-up da v2)
function mostrarJunto(g) {
  const cands = SECOES_COMBINA.has(g.secao) && S.recusasCombina < 2
    ? candidatosPara(g, 6).filter(r => !S.carrinho.some(i => i.pid === r.id)).slice(0, 3) : [];
  S.pos = { key: g.key, cands, aceitos: new Set() };
  if (cands.length) rastrear('combina_mostrado', { produto: nomeBonito(parseNome(cands[0].nome).base), valor: efetivo(cands[0]), prato: g.nome });
  return cands.length;
}

function anotar(btn) {
  const { g } = S.pd;
  const p = precoPd();
  const obs = [];
  (g.opcoes || []).forEach((grp, i) => obs.push(`${grp.rotulo || grp.titulo}: ${S.pd.opc[i]}`));
  if (S.pd.sem.size) obs.push('Sem ' + [...S.pd.sem].join(', '));
  if (S.pd.obs.trim()) obs.push(S.pd.obs.trim());
  const antes = totais();
  addItem({
    pid: p.prodDb.id, nomeDb: p.prodDb.nome, titulo: g.nome,
    sub: p.v.tam || '', preco: p.unit, qtd: S.pd.qtd, obs: obs.join(' · '),
    secao: g.secao, img: p.v.imagem_url || g.img,
    origem: 'cardapio', fonte: S.pd.fonte || 'cardapio',
    ...(S.pd.vs.length > 1 && S.pd.idx === S.pd.vs.length - 1 ? {
      motivoTamanho: S.pd.upgradeClicado ? 'upgrade' : S.pd.idxInicial === S.pd.idx ? 'ancora' : 'escolha',
      difTamanho: r2(S.pd.vs[S.pd.idx].efetivo - S.pd.vs[0].efetivo),
    } : {}),
  });
  S.pd = null;
  const tem = mostrarJunto(g);
  const el = refreshItem(g.key);
  carimbar(el);
  avisarFrete(antes);
  if (!tem) setTimeout(() => { if (S.pos?.key === g.key && !S.pos.cands.length) fecharItem(g.key); }, 1600);
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIÇÃO (igual v2, versão "v3")
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
// COMANDA — lógica do carrinho (igual v2)
// ═══════════════════════════════════════════════════════════════════════════
function chaveItem(it) { return [it.pid, it.nomeDb, it.obs || ''].join('|'); }
function comandaVisivel() { return S.cmd === 'lista' && (S.cmdAberta || desktop()); }
function addItem(it, animar = true) {
  const k = chaveItem(it);
  const ex = S.carrinho.find(i => i.k === k);
  if (ex) ex.qtd += it.qtd; else S.carrinho.push({ origem: 'cardapio', fonte: 'cardapio', ...it, k });
  S.ultimoK = k;
  salvarCarrinho();
  rastrear('item_adicionado', { produto: it.titulo, valor: r2(it.preco * it.qtd), origem: it.origem || 'cardapio', fonte: it.fonte || 'cardapio' });
  if (animar) { renderAba(it); atualizarMenu(); if (comandaVisivel()) renderComanda(); }
}
function mudarQtd(k, delta) {
  const it = S.carrinho.find(i => i.k === k); if (!it) return;
  it.qtd += delta;
  if (it.qtd <= 0) S.carrinho = S.carrinho.filter(i => i.k !== k);
  S.ultimoK = null;
  salvarCarrinho(); renderAba(); atualizarMenu();
  if (comandaVisivel()) renderComanda();
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
  if (antes.fg > 0 && !antes.gratis && depois.gratis) {
    toast('frete grátis desbloqueado!', 'ok');
    carimbar(desktop() ? $('#comanda .cmd-papel') : $('#aba'), 'frete grátis', 'verde');
    return true;
  }
  return false;
}
function addRapido(row, { qtd = 1, combina = true, origem = 'cardapio', fonte = 'cardapio' } = {}) {
  if (!lojaAberta()) return toast('estamos fechados agora — volta mais tarde!', 'erro');
  const g = grupoDaLinha(row);
  const antes = totais();
  if (S.aberto && S.aberto !== g?.key) { const a = S.aberto; if (S.pos) encerrarPos(); S.aberto = null; S.pd = null; refreshItem(a); }
  addItem(itemRapido(row, qtd, origem, fonte));
  if (g && combina && mostrarJunto(g)) { S.aberto = g.key; S.pd = null; }
  const el = g ? refreshItem(g.key) : null;
  carimbar(el);
  avisarFrete(antes);
}

// Aba da comanda (celular) — "imprime" a linha que acabou de entrar
function renderAba(novo) {
  const qtd = S.carrinho.reduce((s, i) => s + i.qtd, 0);
  const t = totais();
  $('#aba').hidden = qtd === 0;
  if (!qtd) return;
  $('#abaQtd').textContent = `${qtd} ${qtd === 1 ? 'item' : 'itens'}`;
  $('#abaTotal').textContent = fmt(t.sub);
  $('#abaMeta').textContent = t.fg > 0 ? (t.gratis ? 'frete grátis ✓' : `frete grátis em ${fmtCurto(r2(t.falta))}`) : '';
  if (novo && !desktop()) {
    const el = $('#abaImpressao');
    el.innerHTML = `<span>+ ${novo.qtd}x ${esc(novo.titulo)}${novo.sub ? ` (${esc(novo.sub)})` : ''}</span><b>${fmtNum(novo.preco * novo.qtd)}</b>`;
    el.classList.remove('sai'); void el.offsetWidth; el.classList.add('sai');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMANDA — papel (lista → fechar pedido → acompanhar)
// ═══════════════════════════════════════════════════════════════════════════
let ignorarPop = false;
function abrirComanda(modo = 'lista') {
  S.cmd = modo;
  if (modo === 'lista') {
    validarCarrinho();
    const t = totais(); rastrear('carrinho_aberto', { valor: t.sub, falta_frete: t.falta });
  }
  renderComanda();
  $('#comanda .cmd-corpo').scrollTop = 0;
  if (desktop() || S.cmdAberta) return;
  S.cmdAberta = true;
  $('#comanda').classList.add('on'); $('#veu').classList.add('on');
  document.body.classList.add('travado'); $('#aba').classList.add('some');
  history.pushState({ comanda: 1 }, '');
}
function fecharComanda(viaHistorico = false) {
  if (S.cmd === 'status' && S.canalPedido) { sb.removeChannel(S.canalPedido); S.canalPedido = null; }
  if (S.cmd !== 'lista') S.cmd = 'lista';
  if (!S.cmdAberta) { renderComanda(); return; }
  S.cmdAberta = false;
  $('#comanda').classList.remove('on'); $('#veu').classList.remove('on');
  document.body.classList.remove('travado'); $('#aba').classList.remove('some');
  if (!viaHistorico && history.state?.comanda) { ignorarPop = true; history.back(); }
  setTimeout(renderComanda, 450);
}
addEventListener('popstate', () => { if (ignorarPop) { ignorarPop = false; return; } if (S.cmdAberta) fecharComanda(true); });

function agoraTxt() { const d = new Date(); return `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)} · ${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`; }

function renderComanda() {
  const el = $('#comanda');
  const y = $('.cmd-corpo', el)?.scrollTop || 0;
  const mesmo = el.dataset.modo === S.cmd;
  const conteudo = S.cmd === 'checkout' && S.ck ? cmdCheckout() : S.cmd === 'status' && S.ult ? cmdStatus() : cmdLista();
  el.dataset.modo = S.cmd;
  el.innerHTML = `
    <div class="cmd-papel">
      <header class="cmd-cab">
        <button class="cmd-fechar" data-cmd-fechar aria-label="Fechar comanda">${ICON.x}</button>
        <p class="cmd-marca">CHOPPATINHAS</p>
        <p class="cmd-linha">${conteudo.linha}</p>
      </header>
      <div class="cmd-corpo">${conteudo.corpo}</div>
      ${conteudo.pe ? `<footer class="cmd-pe">${conteudo.pe}</footer>` : ''}
    </div>`;
  if (mesmo) $('.cmd-corpo', el).scrollTop = y;
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
  if (removidos) { salvarCarrinho(); renderAba(); atualizarMenu(); toast(`${removidos} item${removidos > 1 ? 's' : ''} ficou indisponível e saiu da comanda`, 'erro'); }
}

function reguaFrete(t) {
  const n = 16;
  const cheio = Math.round(Math.min(1, t.sub / t.fg) * n);
  return `<div class="cmd-frete${t.gratis ? ' ok' : ''}">
    <p class="cmd-rot">frete grátis</p>
    <p class="ascii">[${'■'.repeat(cheio)}${'·'.repeat(n - cheio)}]</p>
    <p class="mao">${t.gratis ? 'garantido! a entrega é por nossa conta' : `faltam ${fmt(t.falta)}`}</p>
  </div>`;
}

function cmdLista() {
  const qtd = S.carrinho.reduce((s, i) => s + i.qtd, 0);
  const linha = `comanda digital · ${agoraTxt()}`;
  if (!qtd) {
    return { linha, corpo: `<div class="cmd-vazia"><p class="mao">comanda em branco.</p><p>escolha algo no cardápio —<br>a gente anota aqui.</p></div>`, pe: '' };
  }
  const t = totais();
  const min = num('pedido_minimo');
  const sug = sugestoes();
  const corpo = `
    <div class="cmd-cols"><span>qtd</span><span>item</span><span>valor</span></div>
    <div class="cmd-itens">${S.carrinho.map(it => `
      <div class="cmd-it${it.k === S.ultimoK ? ' novo' : ''}">
        <span class="cmd-q">${it.qtd}x</span>
        <span class="cmd-n">${esc(it.titulo)}${it.sub ? ` (${esc(it.sub)})` : ''}${it.obs ? `<small>${esc(it.obs)}</small>` : ''}</span>
        <span class="cmd-v">${fmtNum(it.preco * it.qtd)}</span>
        <span class="cmd-ctl"><button data-q="-1" data-k="${esc(it.k)}">${it.qtd === 1 ? 'tirar' : '−1'}</button><button data-q="1" data-k="${esc(it.k)}">+1</button></span>
      </div>`).join('')}
    </div>
    ${t.fg > 0 ? reguaFrete(t) : ''}
    ${sug.length ? `
      <div class="cmd-sug">
        <p class="cmd-rot">sugestões da casa</p>
        ${sug.map(({ r, fecha }) => { const { base, tam } = parseNome(r.nome); return `
          <button class="cmd-sug-it" data-sug="${r.id}" ${fecha ? 'data-fecha' : ''}>
            <i>[+]</i><span>${esc(nomeBonito(base))}${tam ? ` (${esc(tam)})` : ''}${fecha ? '<em class="mao">libera o frete</em>' : ''}</span><span class="pontos"></span><b>${fmtNum(efetivo(r))}</b>
          </button>`; }).join('')}
      </div>` : ''}`;
  const pe = `
    <div class="cmd-tot">
      <p><span>subtotal</span><span>${fmtNum(t.sub)}</span></p>
      <p><span>entrega</span><span>${t.gratis ? 'grátis' : fmtNum(t.taxa)}</span></p>
      <p class="tot"><span>total</span><span>${fmt(t.total)}</span></p>
    </div>
    ${t.sub < min ? `<p class="cmd-aviso">pedido mínimo de ${fmt(min)} — faltam ${fmt(r2(min - t.sub))}</p>` : ''}
    ${!lojaAberta() ? '<p class="cmd-aviso">estamos fechados agora. volta mais tarde!</p>' : ''}
    <button class="cmd-btn" data-cmd-checkout ${t.sub < min || !lojaAberta() ? 'disabled' : ''}><span>fechar pedido</span><span>→</span></button>`;
  return { linha, corpo, pe };
}

// ─── FECHAR PEDIDO ──────────────────────────────────────────────────────────
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
  S.cmd = 'checkout';
  renderComanda();
  $('#comanda .cmd-corpo').scrollTop = 0;
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
const campo = (id, rot, val, extra = '') => `<label class="ck-campo"><span>${rot}</span><input id="${id}" value="${esc(val)}" ${extra}></label>`;

function cmdCheckout() {
  const ck = S.ck, t = totais(ck.tipo);
  const bump = ck.bumpPid && S.porId.get(ck.bumpPid);
  const bi = bump && parseNome(bump.nome);
  const pags = [{ k: 'pix', t: 'PIX' }, { k: 'dinheiro', t: 'Dinheiro' }, { k: 'cartao_credito', t: 'Crédito' }, { k: 'cartao_debito', t: 'Débito' }];
  const corpo = `
    <button class="cmd-voltar" data-cmd-voltar>← voltar pra comanda</button>
    <div class="ck-sec">
      <p class="cmd-rot">1 · quem pede</p>
      ${campo('ckNome', 'nome', ck.nome, 'autocomplete="name" placeholder="como te chamamos?"')}
      ${campo('ckTel', 'whatsapp', mascaraTel(ck.tel), 'type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(44) 99999-9999"')}
    </div>
    <div class="ck-sec">
      <p class="cmd-rot">2 · como receber</p>
      <div class="ck-ops">
        <button class="ck-op${ck.tipo === 'delivery' ? ' on' : ''}" data-tipo="delivery"><i class="caixa"></i><span><b>entrega</b><small>${t.gratis || ck.tipo === 'delivery' && t.taxa === 0 ? 'frete grátis' : fmt(num('taxa_entrega'))} · ${C.DEFAULTS.tempo_entrega}</small></span></button>
        <button class="ck-op${ck.tipo === 'retirada' ? ' on' : ''}" data-tipo="retirada"><i class="caixa"></i><span><b>retirar no balcão</b><small>sem taxa · ${C.DEFAULTS.tempo_retirada}</small></span></button>
      </div>
      ${ck.tipo === 'delivery' ? `
        ${campo('ckRua', 'rua e nº', ck.rua, 'autocomplete="street-address" placeholder="av. paraná, 1234"')}
        ${campo('ckBairro', 'bairro', ck.bairro, 'placeholder="bairro"')}
        ${campo('ckComp', 'compl.', ck.comp, 'placeholder="ap, casa, referência"')}`
        : `<p class="ck-nota">retirada em <b>${esc(valido(S.info.endereco) ? S.info.endereco : 'Choppatinhas, Umuarama-PR')}</b></p>`}
    </div>
    ${bump && (!S.carrinho.some(i => i.pid === bump.id) || ck.bumpOn) ? `
      <button class="ck-bump${ck.bumpOn ? ' on' : ''}" data-bump>
        <i class="caixa"></i>
        <span><em class="mao">sugestão da casa</em><b>${esc(nomeBonito(bi.base))}${bi.tam ? ` (${esc(bi.tam)})` : ''}</b><small>${ck.bumpOn ? 'anotado na comanda ✓' : ck.tipo === 'delivery' && t.falta > 0 && efetivo(bump) >= t.falta ? 'inclua e a entrega sai de graça' : 'toque pra incluir'}</small></span>
        <strong>+${fmtNum(efetivo(bump))}</strong>
      </button>` : ''}
    <div class="ck-sec">
      <p class="cmd-rot">3 · pagamento</p>
      <div class="ck-pags">${pags.map(p => `<button class="ck-op${ck.pag === p.k ? ' on' : ''}" data-pag="${p.k}"><i class="caixa"></i><span><b>${p.t}</b></span></button>`).join('')}</div>
      ${ck.pag === 'dinheiro' ? campo('ckTroco', 'troco p/', ck.troco, 'inputmode="decimal" placeholder="vazio se não precisar"') : ''}
      ${ck.pag && ck.pag !== 'pix' ? '<p class="ck-nota">pagamento na entrega / retirada.</p>' : ''}
    </div>
    <div class="ck-sec">
      <p class="cmd-rot">4 · confere</p>
      <div class="ck-resumo">${S.carrinho.map(i => `<p><span>${i.qtd}x ${esc(i.titulo)}${i.sub ? ` (${esc(i.sub)})` : ''}</span><span>${fmtNum(i.preco * i.qtd)}</span></p>`).join('')}</div>
      ${campo('ckObs', 'obs.', ck.obs, 'maxlength="200" placeholder="alguma observação?"')}
    </div>`;
  const pe = `
    <div class="cmd-tot">
      <p><span>subtotal</span><span>${fmtNum(t.sub)}</span></p>
      <p><span>${ck.tipo === 'retirada' ? 'retirada' : 'entrega'}</span><span>${t.taxa === 0 ? 'grátis' : fmtNum(t.taxa)}</span></p>
      <p class="tot"><span>total</span><span>${fmt(t.total)}</span></p>
    </div>
    <button class="cmd-btn verde" id="ckFinalizar" ${ck.enviando ? 'disabled' : ''}><span>${ck.enviando ? 'enviando…' : 'mandar pra cozinha'}</span><span>${ck.enviando ? '' : fmt(t.total)}</span></button>`;
  return { linha: 'fechando o pedido', corpo, pe };
}

function validarCheckout() {
  lerCampos();
  const ck = S.ck; const erros = [];
  if (ck.nome.length < 2) erros.push('#ckNome');
  if (ck.tel.length < 10) erros.push('#ckTel');
  if (ck.tipo === 'delivery') { if (ck.rua.length < 4) erros.push('#ckRua'); if (ck.bairro.length < 2) erros.push('#ckBairro'); }
  $$('#comanda .ck-campo.erro').forEach(e => e.classList.remove('erro'));
  erros.forEach(s => $(s)?.closest('.ck-campo')?.classList.add('erro'));
  if (erros.length) { $(erros[0])?.scrollIntoView({ block: 'center', behavior: 'smooth' }); $(erros[0])?.focus({ preventScroll: true }); toast('confere os campos marcados', 'erro'); return false; }
  if (!ck.pag) { toast('escolha a forma de pagamento', 'erro'); $('#comanda .ck-pags')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; }
  return true;
}
function telefoneBanco(d) { d = soDigitos(d); return d.length <= 11 ? '55' + d : d; }

async function finalizar() {
  const ck = S.ck;
  if (ck.enviando || !validarCheckout()) return;
  ck.enviando = true; renderComanda();
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
    S.carrinho = []; salvarCarrinho(); S.ck = null;
    renderAba(); atualizarMenu(); renderRetorno();
    abrirStatus(ult, true);
  } catch (e) {
    console.error(e);
    ck.enviando = false; renderComanda();
    if (e.message === 'FECHADA') toast('a loja acabou de fechar. tenta mais tarde!', 'erro');
    else if (e.message === 'MARMITEX') toast(`marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h`, 'erro');
    else toast('não conseguimos enviar agora. confere a internet e tenta de novo', 'erro');
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
  abrirComanda('status');
  if (!novo) {
    const { data } = await sb.from('pedidos').select('status').eq('id', u.id).maybeSingle();
    if (data) { u.status = data.status; lsSet('chopp_ultimo', u); if (S.cmd === 'status') renderComanda(); }
  }
  if (S.canalPedido) sb.removeChannel(S.canalPedido);
  S.canalPedido = sb.channel('pedido-' + u.id)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${u.id}` }, ({ new: n }) => {
      const antes = etapaDe(u.status);
      u.status = n.status; lsSet('chopp_ultimo', u);
      if (S.cmd === 'status') renderComanda();
      renderRetorno();
      if (etapaDe(n.status) > antes) { toast(ETAPAS[u.tipo][etapaDe(n.status)]?.t.toLowerCase() + '!', 'ok'); navigator.vibrate?.(120); }
    })
    .subscribe();
}
function cmdStatus() {
  const u = S.ult;
  const et = etapaDe(u.status);
  const etapas = ETAPAS[u.tipo || 'delivery'];
  const bate = S.stEtapa !== et; S.stEtapa = et;
  const wa = soDigitos(S.info.whatsapp);
  const chave = valido(S.info.chave_pix) ? S.info.chave_pix : '';
  const linkWa = wa.length >= 10 ? `https://wa.me/${wa.length <= 11 ? '55' + wa : wa}?text=${encodeURIComponent(msgWhatsApp(u))}` : '';
  const corpo = `
    <div class="st-topo">
      <p class="cmd-rot">pedido</p>
      <p class="st-num">Nº ${String(u.numero).padStart(3, '0')}</p>
      <p class="st-sub">${fmt(u.total)} · ${u.tipo === 'delivery' ? 'entrega' : 'retirada'}</p>
      <span class="carimbo st-carimbo${et < 0 ? '' : et >= 3 ? ' verde' : ''}${bate && !reduzMovimento() ? ' bate' : ''}">${et < 0 ? 'cancelado' : esc(etapas[Math.max(0, et)].c)}</span>
    </div>
    ${et < 0 ? '<p class="st-cancel">Este pedido foi cancelado pela casa. Fale com a gente no WhatsApp se tiver dúvida.</p>' : `
    <ol class="st-etapas">${etapas.map((e, i) => `<li class="${i < et || et === 3 ? 'feito' : i === et ? 'agora' : ''}"><i class="caixa"></i><span><b>${esc(e.t)}</b><small>${esc(e.d)}</small></span></li>`).join('')}</ol>
    ${et < 3 ? `<p class="st-prev mao">${u.tipo === 'delivery' ? `previsão: ${C.DEFAULTS.tempo_entrega}` : `fica pronto em ${C.DEFAULTS.tempo_retirada}`}</p>` : ''}`}
    ${u.pag === 'pix' && et >= 0 && et < 3 ? `
    <div class="st-pix">
      <p class="cmd-rot">pagamento via pix</p>
      ${chave ? `<p>copie a chave, pague e mande o comprovante no WhatsApp.</p><div class="pix-chave"><code id="pixChave">${esc(chave)}</code><button data-copiar="${esc(chave)}">copiar</button></div>` : '<p>a casa te manda a chave PIX no WhatsApp em instantes.</p>'}
      <p class="pix-valor">valor: <b>${fmt(u.total)}</b></p>
    </div>` : ''}`;
  const pe = `
    ${linkWa ? `<a class="cmd-btn verde" href="${linkWa}" target="_blank" rel="noopener"><span>${u.pag === 'pix' ? 'enviar comprovante' : 'falar com a casa'}</span><span>whatsapp →</span></a>` : ''}
    <button class="cmd-link" data-cmd-novo>voltar ao cardápio</button>`;
  return { linha: `acompanhando · ${agoraTxt()}`, corpo, pe };
}

// ═══════════════════════════════════════════════════════════════════════════
// EFEITOS — carimbo, aviso, texto de cartaz, caneta
// ═══════════════════════════════════════════════════════════════════════════
let toastT;
function toast(msg, tipo = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'aviso-topo on ' + tipo;
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}
// Carimbo que "bate" no item anotado
function carimbar(el, txt = 'anotado', cor = '') {
  if (!el || reduzMovimento()) return;
  const c = document.createElement('span');
  c.className = 'carimbo voo ' + cor; c.textContent = txt;
  el.appendChild(c);
  navigator.vibrate?.(15);
  setTimeout(() => c.remove(), 1500);
}
// Texto de cartaz: cada linha cresce até ocupar a largura do bloco
function encaixar(root = document) {
  const els = $$('.encaixa', root); if (!els.length) return;
  els.forEach(el => { el.style.fontSize = '100px'; });
  const medidas = els.map(el => {
    const pai = el.parentElement; const cs = getComputedStyle(pai);
    return [pai.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), el.getBoundingClientRect().width];
  });
  els.forEach((el, i) => {
    const [largura, w] = medidas[i];
    if (!largura || !w) return;
    const max = parseFloat(el.dataset.max) || 400;
    el.style.fontSize = Math.min(max, Math.floor(100 * largura / w * 10) / 10) + 'px';
  });
}
// Traço de caneta desenha quando entra na tela (uma vez só por traço)
const jaDesenhados = new Set();
let obsRab;
function observarRabiscos(root = document) {
  if (!root) return;
  if (!obsRab) obsRab = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('ver'); obsRab.unobserve(e.target);
    jaDesenhados.add(e.target.dataset.rid);
  }), { threshold: .8 });
  $$('.rab', root).forEach(r => {
    const dono = r.closest('[data-item],[data-abre],.rk-cab,.capa') ;
    r.dataset.rid = (dono?.dataset.item || dono?.dataset.abre || dono?.className || '') + (r.getAttribute('class') || '');
    if (reduzMovimento() || jaDesenhados.has(r.dataset.rid)) { r.classList.add('ver', 'ja'); return; }
    obsRab.observe(r);
  });
}
// Navegação fixa: marca a seção que está na tela
let obsSec;
function observarSecoes() {
  obsSec?.disconnect();
  obsSec = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.dataset.sec;
    $$('#trilhoIn a').forEach(a => a.classList.toggle('on', a.dataset.ir === id));
    const ativo = $(`#trilhoIn a[data-ir="${id}"]`);
    const trilho = $('#trilhoIn');
    if (ativo) trilho.scrollTo({ left: ativo.offsetLeft - (trilho.clientWidth - ativo.offsetWidth) / 2, behavior: 'smooth' });
  }), { rootMargin: '-40% 0px -55% 0px' });
  $$('#menu .sec').forEach(s => obsSec.observe(s));
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN (igual v2)
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
function admFechar() { $('#adm').hidden = true; ADM.edit = null; if (!S.cmdAberta) document.body.classList.remove('travado'); }
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
          ${linha('“Vai bem junto”', conta('combina_mostrado'), conta('combina_aceito'), somaOrigem('combina'))}
          ${linha('Oferta rápida', conta('oferta_mostrada'), conta('oferta_aceita'), somaOrigem('oferta_rapida'))}
          ${linha('“Libera o frete”', null, aceitosOrigem('libera_frete'), somaOrigem('libera_frete'), 'na comanda')}
          ${linha('Sugestões da casa', null, aceitosOrigem('vai_bem'), somaOrigem('vai_bem'), 'na comanda')}
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
  if (error) return toast('erro ao salvar: ' + error.message, 'erro');
  linhas.forEach(l => { S.info[l.chave] = l.valor; });
  renderTopo(); renderInfo(); renderRodape(); renderAba();
  toast('configurações salvas', 'ok');
}
async function admToggle(chave, atual, msgs) {
  const novo = !atual;
  const { error } = await sb.from('info_restaurante').upsert({ chave, valor: String(novo) }, { onConflict: 'chave' });
  if (error) return toast('erro: ' + error.message, 'erro');
  S.info[chave] = String(novo); renderTopo(); renderInfo(); admRender();
  toast(novo ? msgs[0] : msgs[1], 'ok');
}
async function admPatch(id, patch) {
  const r = S.rows.find(x => x.id === id); if (!r) return;
  const antes = { ...r }; Object.assign(r, patch);
  renderTudo(); admRender();
  const { error } = await sb.from('produtos').update(patch).eq('id', id);
  if (error) { Object.assign(r, antes); renderTudo(); admRender(); toast('erro: ' + error.message, 'erro'); }
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
  if (!nome || !categoria || !(preco >= 0)) return toast('preencha nome, categoria e preço', 'erro');
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
    toast('produto salvo', 'ok');
  } catch (e) {
    console.error(e); btn.disabled = false; btn.textContent = 'Salvar';
    toast('erro ao salvar: ' + (e.message || e), 'erro');
  }
}
async function admExcluir() {
  const r = ADM.edit;
  if (!confirm(`Excluir "${r.nome}" do cardápio?\n\nDica: se for só temporário, prefira desligar o interruptor.`)) return;
  const { error } = await sb.from('produtos').delete().eq('id', r.id);
  if (error) {
    if (/foreign key|violates/i.test(error.message)) { await admPatch(r.id, { disponivel: false }); ADM.edit = null; admRender(); return toast('esse produto já tem pedidos, então foi desativado em vez de excluído', 'ok'); }
    return toast('erro: ' + error.message, 'erro');
  }
  S.rows = S.rows.filter(x => x.id !== r.id); ADM.edit = null;
  renderTudo(); admRender(); toast('produto excluído', 'ok');
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
    if ('admLoja' in d) return admToggle('loja_aberta', lojaAberta(), ['loja aberta', 'loja fechada']);
    if ('admAlcool' in d) return admToggle('oferecer_alcool', oferecerAlcool(), ['sugestões de cerveja ligadas', 'sugestões de cerveja desligadas']);
    if ('admSalvarCfg' in d) return admSalvarCfg();
    if ('admEquipe' in d) { try { aparelhoEquipe() ? localStorage.removeItem('chopp_equipe') : localStorage.setItem('chopp_equipe', '1'); } catch { /* ok */ } t.classList.toggle('on', aparelhoEquipe()); return toast(aparelhoEquipe() ? 'este aparelho não conta nas métricas' : 'este aparelho volta a contar', 'ok'); }
  });
  adm.addEventListener('input', debounce(e => {
    if (e.target.id === 'admBusca') { ADM.busca = e.target.value; const pos = e.target.selectionStart; admRender(); const i = $('#admBusca'); i.focus(); i.setSelectionRange(pos, pos); }
  }, 200));
  adm.addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (e.target.id === 'admFoto' && f) { admGuardarForm(); Object.assign(ADM.edit, { _arquivo: f, _semFoto: false, _preview: URL.createObjectURL(f) }); admRender(); }
    if (e.target.id === 'admVideo' && f) {
      if (f.size > C.VIDEO_MAX_MB * 1024 * 1024) { e.target.value = ''; return toast(`vídeo muito grande (máx. ${C.VIDEO_MAX_MB} MB)`, 'erro'); }
      admGuardarForm(); Object.assign(ADM.edit, { _arquivoV: f, _semVideo: false, _previewV: URL.createObjectURL(f) }); admRender();
    }
    if (e.target.name === 'categoria') $('#admNovaCat').hidden = e.target.value !== '__nova';
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTOS
// ═══════════════════════════════════════════════════════════════════════════
const ALVOS = [
  '#capaPlay', '[data-ir]', '[data-anotar]', '[data-tam]', '[data-opc]', '[data-sem]', '[data-pdq]', '[data-obs]', '[data-junto]', '[data-pos-fim]', '[data-fechar-item]',
  '[data-add]', '[data-balde]', '[data-mais-pid]', '[data-menos-pid]', '[data-toque]', '[data-abre]',
  '[data-acompanhar]', '[data-repetir]',
  '[data-cmd-fechar]', '[data-cmd-checkout]', '[data-cmd-voltar]', '[data-cmd-novo]', '[data-q]', '[data-sug]', '[data-tipo]', '[data-pag]', '[data-bump]', '#ckFinalizar', '[data-copiar]',
].join(',');

function fonteDe(el) { return el.closest('.capa') ? 'destaque' : el.closest('.ranking') ? 'mais_pedidos' : S.busca ? 'busca' : 'cardapio'; }

function eventos() {
  const abrirBusca = () => { $('#busca').hidden = false; $('#buscaInput').focus(); };
  const fecharBusca = () => { $('#busca').hidden = true; $('#buscaInput').value = ''; S.busca = ''; renderMenu(); };
  $('#btnBusca').addEventListener('click', () => ($('#busca').hidden ? abrirBusca() : fecharBusca()));
  $('#buscaFechar').addEventListener('click', fecharBusca);
  $('#buscaInput').addEventListener('input', debounce(e => {
    S.busca = e.target.value; S.aberto = null; S.pd = null; S.pos = null; renderMenu();
    const y = $('#menu').getBoundingClientRect().top + scrollY - 60;
    if (scrollY < y - 200 || scrollY > y) scrollTo({ top: y, behavior: 'smooth' });
  }, 180));

  document.addEventListener('click', async e => {
    if (e.target.closest('#adm, #admSenha')) return;
    const b = e.target.closest(ALVOS); if (!b) return;
    const d = b.dataset;

    if (b.id === 'capaPlay') {
      e.stopPropagation();
      const v = $('#capaVideo'); v?.play().then(() => v.closest('.capa-midia')?.classList.remove('precisa-toque')).catch(() => {});
      return;
    }
    if (d.ir) {
      e.preventDefault();
      const s = $('#sec-' + d.ir); if (s) rolarAte(s);
      return;
    }
    // ── painel do item ──
    if ('anotar' in d) return anotar(b);
    if (d.tam || d.opc || d.sem || d.pdq) {
      if (!S.pd) return;
      S.pd.obs = $('#pdObs')?.value ?? S.pd.obs;
      if (d.tam) {
        if ('up' in d) { S.pd.upgradeClicado = true; rastrear('upgrade_tamanho', { produto: S.pd.g.nome, valor: r2(S.pd.vs[+d.tam].efetivo - S.pd.vs[S.pd.idx].efetivo) }); }
        S.pd.idx = +d.tam;
      } else if (d.opc) S.pd.opc[+d.opc] = d.val;
      else if (d.sem) S.pd.sem.has(d.sem) ? S.pd.sem.delete(d.sem) : S.pd.sem.add(d.sem);
      else if (d.pdq) S.pd.qtd = Math.max(1, Math.min(50, S.pd.qtd + +d.pdq));
      refreshItem(S.pd.g.key);
      return;
    }
    if ('obs' in d) {
      if (!S.pd) return;
      S.pd.obsAberta = true;
      refreshItem(S.pd.g.key);
      $('#pdObs')?.focus({ preventScroll: true });
      return;
    }
    if (d.junto) {
      const r = S.porId.get(d.junto); if (!r || !S.pos) return;
      const nome = nomeBonito(parseNome(r.nome).base);
      if (S.pos.aceitos.has(r.id)) {
        const it = S.carrinho.find(i => i.pid === r.id && i.origem === 'combina' && !i.obs);
        if (it) mudarQtd(it.k, -1);
        S.pos.aceitos.delete(r.id);
      } else {
        const antes = totais();
        addItem(itemRapido(r, 1, 'combina'));
        S.pos.aceitos.add(r.id);
        rastrear('combina_aceito', { produto: nome, valor: efetivo(r) });
        avisarFrete(antes);
      }
      refreshItem(S.pos.key);
      return;
    }
    if ('posFim' in d) return fecharItem(S.pos?.key || S.aberto);
    if ('fecharItem' in d) return fecharItem();

    // ── cardápio ──
    if (d.add) {
      e.stopPropagation();
      const g = S.grupos.find(x => x.key === d.add); if (!g) return;
      if (g.secao === 'marmitex' && !marmitexAgora()) return toast(`marmitex só das ${C.MARMITEX.inicio}h às ${C.MARMITEX.fim}h`, 'erro');
      const fonte = fonteDe(b);
      if (fonte === 'destaque') rastrear('destaque_clique', { produto: g.nome });
      if (g.simples && g.disponiveis[0]) return addRapido(g.disponiveis[0], { fonte });
      return abrirItem(g.key, fonte, fonte !== 'cardapio' && fonte !== 'busca');
    }
    if (d.balde) { const r = S.porId.get(d.balde); if (r) { addRapido(r, { qtd: 6, combina: false, origem: 'latas6' }); toast('6 latas na comanda', 'ok'); } return; }
    if (d.maisPid) { const it = S.carrinho.find(i => i.pid === d.maisPid && !i.obs); return it && mudarQtd(it.k, 1); }
    if (d.menosPid) { const it = S.carrinho.find(i => i.pid === d.menosPid && !i.obs); return it && mudarQtd(it.k, -1); }
    if ('toque' in d) {
      const key = b.closest('[data-item]')?.dataset.item; if (!key) return;
      if (S.aberto === key) return fecharItem(key);
      return abrirItem(key, fonteDe(b));
    }
    if (d.abre) {
      const fonte = fonteDe(b);
      if (fonte === 'destaque') rastrear('destaque_clique', { produto: S.grupos.find(x => x.key === d.abre)?.nome });
      return abrirItem(d.abre, fonte, true);
    }
    if ('acompanhar' in d) { const u = ls('chopp_ultimo', null); return u && abrirStatus(u); }
    if ('repetir' in d) return repetirPedido();

    // ── comanda ──
    if ('cmdFechar' in d) return fecharComanda();
    if ('cmdCheckout' in d) return abrirCheckout();
    if ('cmdVoltar' in d) { lerCampos(); S.cmd = 'lista'; return renderComanda(); }
    if ('cmdNovo' in d) { if (S.canalPedido) { sb.removeChannel(S.canalPedido); S.canalPedido = null; } S.cmd = 'lista'; return S.cmdAberta ? fecharComanda() : renderComanda(); }
    if (d.q) return mudarQtd(d.k, +d.q);
    if (d.sug) {
      const r = S.porId.get(d.sug); if (!r) return;
      const antes = totais();
      addItem(itemRapido(r, 1, 'fecha' in d ? 'libera_frete' : 'vai_bem'), false);
      renderAba(); atualizarMenu(); renderComanda(); avisarFrete(antes);
      return;
    }
    if (d.tipo || d.pag || 'bump' in d) {
      const ck = S.ck; if (!ck) return;
      lerCampos();
      if (d.tipo) ck.tipo = d.tipo;
      else if (d.pag) ck.pag = d.pag;
      else {
        const r = S.porId.get(ck.bumpPid); if (!r) return;
        if (ck.bumpOn) { const it = S.carrinho.find(i => i.pid === r.id && !i.obs); if (it) { it.qtd -= 1; if (it.qtd <= 0) S.carrinho = S.carrinho.filter(i => i !== it); salvarCarrinho(); renderAba(); atualizarMenu(); } ck.bumpOn = false; rastrear('oferta_desmarcada', { produto: nomeBonito(parseNome(r.nome).base) }); }
        else { addItem(itemRapido(r, 1, 'oferta_rapida'), false); renderAba(); atualizarMenu(); ck.bumpOn = true; rastrear('oferta_aceita', { produto: nomeBonito(parseNome(r.nome).base), valor: efetivo(r) }); }
      }
      renderComanda();
      if (d.pag === 'dinheiro') $('#ckTroco')?.focus({ preventScroll: true });
      return;
    }
    if (b.id === 'ckFinalizar') return finalizar();
    if (d.copiar) {
      try { await navigator.clipboard.writeText(d.copiar); b.textContent = 'copiado ✓'; toast('chave pix copiada', 'ok'); }
      catch { const r = document.createRange(); r.selectNodeContents($('#pixChave')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('segure para copiar a chave'); }
    }
  });

  $('#menu').addEventListener('input', e => { if (e.target.id === 'pdObs' && S.pd) S.pd.obs = e.target.value; });
  $('#comanda').addEventListener('input', e => {
    if (e.target.id === 'ckTel') { const p = e.target.selectionStart, antes = e.target.value.length; e.target.value = mascaraTel(e.target.value); const dif = e.target.value.length - antes; e.target.setSelectionRange(p + dif, p + dif); }
    e.target.closest('.ck-campo')?.classList.remove('erro');
  });

  $('#aba').addEventListener('click', () => abrirComanda('lista'));
  $('#veu').addEventListener('click', () => fecharComanda());
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#adm').hidden) { if (ADM.edit) { ADM.edit = null; admRender(); } else admFechar(); return; }
    if (S.cmdAberta) return fecharComanda();
    if (S.aberto) fecharItem();
  });

  addEventListener('resize', debounce(() => {
    encaixar();
    if (desktop() && S.cmdAberta) {
      S.cmdAberta = false;
      $('#comanda').classList.remove('on'); $('#veu').classList.remove('on');
      document.body.classList.remove('travado'); $('#aba').classList.remove('some');
    }
    renderComanda();
  }, 160));

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
  renderAba(); renderComanda();
  try { await carregar(); }
  catch (e) {
    console.error(e);
    $('#menu').innerHTML = `<div class="erro-carga"><p class="mao">ops — o cardápio não carregou.</p><p>confere sua internet.</p><button class="cmd-btn" onclick="location.reload()"><span>tentar de novo</span><span>↻</span></button></div>`;
    return;
  }
  agrupar();
  renderTopo(); renderInfo(); renderRodape(); renderCapa(); renderRanking(); renderMenu();
  validarCarrinho(); renderAba(); renderComanda();
  renderRetorno();
  tempoReal();
  document.fonts?.ready.then(() => encaixar());
  rastrear('visita', { tela: innerWidth < 760 ? 'celular' : 'computador', ref: document.referrer ? new URL(document.referrer).hostname : '' });
  if (location.hash === '#admin') admAbrirSenha();
}
document.addEventListener('DOMContentLoaded', init);
