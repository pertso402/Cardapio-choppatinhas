// ═══════════════════════════════════════════════════════════════════════════
// ARTE ILUSTRADA — substitui a foto enquanto o produto não tiver imagem_url.
// Cada função devolve um <svg> (viewBox 0 0 240 180). Escolha por palavra-chave
// no nome do produto. Quando o dono sobe a foto no admin, a foto assume.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  let seq = 0;
  const uid = () => 'a' + (++seq);

  // ── peças reutilizáveis ────────────────────────────────────────────────────
  const sombra = (cx = 120, cy = 150, rx = 86, ry = 12) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity=".35"/>`;

  const tabua = () => `
    ${sombra(120, 152, 96, 12)}
    <rect x="22" y="104" width="196" height="42" rx="18" fill="#5B3620"/>
    <rect x="22" y="98" width="196" height="40" rx="18" fill="#8A5634"/>
    <path d="M40 112h150M46 124h120" stroke="#6E4127" stroke-width="2" stroke-linecap="round" opacity=".6"/>
    <circle cx="206" cy="118" r="5" fill="#5B3620"/>`;

  const prato = (cor = '#EFE4D0') => `
    ${sombra(120, 150, 92, 12)}
    <ellipse cx="120" cy="124" rx="96" ry="30" fill="#CFC2AA"/>
    <ellipse cx="120" cy="120" rx="96" ry="30" fill="${cor}"/>
    <ellipse cx="120" cy="120" rx="74" ry="21" fill="none" stroke="#D9CCB3" stroke-width="2"/>`;

  const molhoBranco = (x, y) => `
    <ellipse cx="${x}" cy="${y + 8}" rx="17" ry="6" fill="#000" opacity=".25"/>
    <path d="M${x - 16} ${y - 4}h32l-3 12a13 5 0 0 1-26 0z" fill="#B23A2E"/>
    <ellipse cx="${x}" cy="${y - 4}" rx="16" ry="5.5" fill="#F7F1E3"/>
    <ellipse cx="${x - 4}" cy="${y - 5}" rx="5" ry="1.6" fill="#fff" opacity=".8"/>`;

  const coxa = (x, y, rot, s = 1) => `
    <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
      <rect x="16" y="-3.5" width="28" height="7" rx="3.5" fill="#F4E7CB"/>
      <circle cx="45" cy="-4.5" r="5.5" fill="#F4E7CB"/><circle cx="45" cy="4.5" r="5.5" fill="#F4E7CB"/>
      <path d="M-38 0c0-12 10-19 24-19 13 0 24 7 32 13 3 3 3 9 0 12-8 6-19 13-32 13-14 0-24-7-24-19z" fill="#B8641F"/>
      <path d="M-32-5c3-8 11-11 20-11 9 0 17 4 24 9" stroke="#E7A04A" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>
      <g fill="#7E3E12" opacity=".75"><circle cx="-20" cy="6" r="2.2"/><circle cx="-8" cy="11" r="1.8"/><circle cx="2" cy="4" r="2"/><circle cx="-28" cy="-2" r="1.6"/><circle cx="10" cy="9" r="1.6"/></g>
      <g fill="#F2B45C" opacity=".9"><circle cx="-14" cy="-3" r="1.6"/><circle cx="-2" cy="-8" r="1.4"/><circle cx="8" cy="-2" r="1.4"/></g>
    </g>`;

  const palito = (x, y, rot, cor = '#F2C45C', borda = '#D9973A', w = 9, h = 46) => `
    <g transform="translate(${x} ${y}) rotate(${rot})">
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3" fill="${cor}"/>
      <rect x="${-w / 2}" y="${-h / 2}" width="3" height="${h}" rx="1.5" fill="${borda}" opacity=".8"/>
    </g>`;

  const mandiocas = (cx, cy, n = 5) => {
    let s = '';
    for (let i = 0; i < n; i++) s += palito(cx - 26 + i * 13, cy + (i % 2) * 4, -70 + i * 8, '#F6D98A', '#DDB057', 13, 40);
    return s;
  };

  const salsinha = (pts) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#4F8A3A"/><circle cx="${x + 3}" cy="${y + 2}" r="1.6" fill="#6BAA48"/>`).join('');

  // ── ilustrações ────────────────────────────────────────────────────────────
  const A = {};

  A.frango = (o = {}) => {
    const id = uid();
    return `
    <defs><radialGradient id="${id}" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#E9C27A"/><stop offset="1" stop-color="#8B5A2B"/></radialGradient></defs>
    ${sombra(118, 152, 98, 13)}
    <path d="M24 104c0 28 42 46 96 46s96-18 96-46z" fill="#7A4A22"/>
    <path d="M24 104c0 28 42 46 96 46s96-18 96-46" fill="none" stroke="#5E3818" stroke-width="3"/>
    <path d="M40 118l14 22M62 124l8 22M88 128l4 22M116 130v22M144 128l-4 22M170 124l-8 22M194 118l-14 22" stroke="#5E3818" stroke-width="2" opacity=".6"/>
    <ellipse cx="120" cy="104" rx="96" ry="22" fill="url(#${id})"/>
    ${o.batata ? palito(64, 82, -18) + palito(78, 78, -6) + palito(160, 80, 14) + palito(172, 84, 24) + palito(92, 76, 4, '#F6CD6A') : ''}
    ${o.mandioca ? mandiocas(162, 84, 4) : ''}
    ${coxa(80, 96, -24, 1)}${coxa(140, 94, 200, 1)}${coxa(112, 80, -80, .95)}
    ${molhoBranco(204, 72)}`;
  };

  A.carne = (o = {}) => {
    const fatia = (x, y, rot) => `
      <g transform="translate(${x} ${y}) rotate(${rot})">
        <rect x="-11" y="-26" width="22" height="52" rx="6" fill="#6E2A1F"/>
        <rect x="-8" y="-20" width="16" height="40" rx="5" fill="${o.porco ? '#D98C6A' : '#B8483B'}"/>
        <rect x="-5" y="-14" width="10" height="28" rx="4" fill="${o.porco ? '#E9A987' : '#D2685A'}" opacity=".9"/>
        <rect x="-11" y="-30" width="22" height="9" rx="4" fill="#F2DDAE"/>
        <path d="M-9 -6h18M-9 6h18" stroke="#3E160F" stroke-width="2.4" opacity=".55"/>
      </g>`;
    return `
    ${tabua()}
    ${o.mandioca !== false ? mandiocas(176, 96, 4) : ''}
    ${fatia(62, 92, -14)}${fatia(86, 90, -8)}${fatia(110, 90, -2)}${fatia(134, 92, 4)}
    ${o.cebola ? `<g fill="none" stroke="#F3E3C4" stroke-width="4" opacity=".95"><ellipse cx="96" cy="112" rx="14" ry="7"/><ellipse cx="124" cy="114" rx="12" ry="6"/><ellipse cx="72" cy="114" rx="11" ry="5"/></g><g fill="none" stroke="#C98F4A" stroke-width="1.5"><ellipse cx="96" cy="112" rx="14" ry="7"/><ellipse cx="124" cy="114" rx="12" ry="6"/></g>` : ''}
    ${o.completa ? `<ellipse cx="40" cy="70" rx="24" ry="10" fill="#F7F3EA"/><g fill="#fff">${[...Array(10)].map((_, i) => `<ellipse cx="${24 + i * 3.4}" cy="${66 + (i % 3) * 3}" rx="2.4" ry="1.2"/>`).join('')}</g><circle cx="212" cy="70" r="10" fill="#5E9F3E"/><circle cx="202" cy="64" r="8" fill="#76B84E"/><circle cx="214" cy="60" r="5" fill="#D8412F"/>` : ''}
    ${molhoBranco(210, 132)}`;
  };

  A.peixe = (o = {}) => {
    const file = (x, y, rot) => `
      <g transform="translate(${x} ${y}) rotate(${rot})">
        <path d="M-40 0c6-14 26-20 44-16 18 3 32 10 36 16-4 6-18 13-36 16-18 4-38-2-44-16z" fill="${o.grelhado ? '#E7C08A' : '#C97C2C'}"/>
        <path d="M-30-4c10-8 26-10 40-6" stroke="${o.grelhado ? '#B07A3E' : '#EDB060'}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
        ${o.grelhado ? '<path d="M-18-10l-6 18M-4-12l-6 22M10-12l-6 22M24-8l-4 16" stroke="#8A5424" stroke-width="3" opacity=".7"/>' : '<g fill="#8A4A16" opacity=".6"><circle cx="-16" cy="4" r="2"/><circle cx="0" cy="-2" r="1.8"/><circle cx="14" cy="6" r="2"/><circle cx="-6" cy="8" r="1.6"/></g>'}
      </g>`;
    return `
    ${prato()}
    ${file(92, 112, -8)}${file(146, 108, 10)}${file(118, 96, -2)}
    <path d="M178 124a16 16 0 0 1 30 0z" fill="#F4D23C"/><path d="M181 124a13 13 0 0 1 24 0" fill="#FBEA8A"/>
    ${o.alcaparras ? '<g fill="#6E8B3D">' + [[96, 100], [112, 106], [132, 100], [150, 96], [124, 90], [104, 118]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('') + '</g>' : ''}
    ${salsinha([[70, 128], [160, 128], [120, 132]])}`;
  };

  A.lambari = () => {
    const peixinho = (x, y, rot) => `
      <g transform="translate(${x} ${y}) rotate(${rot})">
        <path d="M-28 0c8-10 30-12 44-4l12-8v24l-12-8c-14 8-36 6-44-4z" fill="#C98232"/>
        <circle cx="-18" cy="-2" r="2" fill="#3A1C08"/>
        <path d="M-6-6v12M2-6v12M10-5v10" stroke="#8A4E1A" stroke-width="1.6" opacity=".6"/>
      </g>`;
    return `${prato()}${peixinho(84, 118, -10)}${peixinho(122, 110, 8)}${peixinho(156, 120, -4)}${peixinho(106, 128, 14)}${peixinho(140, 100, -18)}
    <path d="M176 128a14 14 0 0 1 28 0z" fill="#F4D23C"/>${salsinha([[70, 108], [168, 106]])}`;
  };

  A.frios = (o = {}) => {
    const queijo = (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 0l14-8 14 8v14l-14 8-14-8z" fill="#E9B530"/><path d="M0 0l14-8 14 8-14 8z" fill="#F7D35A"/><circle cx="12" cy="10" r="2" fill="#C8921E"/></g>`;
    const salame = (x, y, r = 12) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#8E2A26"/><circle cx="${x}" cy="${y}" r="${r - 2}" fill="#B23A33"/><g fill="#F3D9C4">${[[-4, -3], [3, 2], [-2, 5], [5, -5], [0, -1]].map(([a, b]) => `<circle cx="${x + a}" cy="${y + b}" r="1.5"/>`).join('')}</g>`;
    const azeitona = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="7.5" fill="#3F4A1F"/><ellipse cx="${x - 2}" cy="${y - 3}" rx="1.8" ry="2.4" fill="#8A9A4A" opacity=".8"/>`;
    const presunto = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-16 4c0-12 32-12 32 0 0 8-32 8-32 0z" fill="#E7A2A0"/><path d="M-16 4c4-4 28-4 32 0" stroke="#F6D0CC" stroke-width="3" fill="none"/></g>`;
    const palmito = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-6" y="-12" width="12" height="26" rx="5" fill="#F3EAD2"/><ellipse cx="0" cy="-12" rx="6" ry="3" fill="#E3D6B3"/><circle cx="0" cy="-12" r="1.6" fill="#D6C595"/></g>`;
    const calab = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="9" fill="#7D2A1F"/><ellipse cx="${x}" cy="${y}" rx="8" ry="6.5" fill="#B5503B"/><g fill="#E8B99A"><circle cx="${x - 3}" cy="${y - 1}" r="1.2"/><circle cx="${x + 3}" cy="${y + 2}" r="1.2"/></g>`;
    const tipo = o.tipo || 'tabua';
    let miolo = '';
    if (tipo === 'tabua') miolo = queijo(48, 92) + queijo(70, 98) + salame(110, 104) + salame(134, 96, 11) + presunto(166, 104) + azeitona(92, 116) + azeitona(150, 120) + azeitona(186, 118) + queijo(176, 84);
    if (tipo === 'salame') miolo = salame(70, 104) + salame(94, 98) + salame(118, 106) + salame(142, 98) + salame(166, 106) + salame(118, 88, 10);
    if (tipo === 'azeitona') miolo = [[70, 108], [86, 102], [100, 112], [114, 104], [128, 112], [142, 102], [156, 110], [170, 104], [92, 92], [120, 92], [148, 92]].map(([x, y]) => azeitona(x, y)).join('');
    if (tipo === 'presunto') miolo = presunto(80, 104) + presunto(116, 96) + presunto(152, 106) + queijo(70, 84) + queijo(130, 108) + queijo(160, 80);
    if (tipo === 'palmito') miolo = palmito(76, 104) + palmito(96, 100) + palmito(116, 106) + palmito(136, 100) + palmito(156, 104) + azeitona(176, 114);
    if (tipo === 'calabresa') miolo = [[66, 106], [86, 98], [104, 110], [124, 100], [144, 110], [164, 100], [96, 88], [140, 88]].map(([x, y]) => calab(x, y)).join('') + '<g fill="none" stroke="#F3E3C4" stroke-width="3" opacity=".9"><ellipse cx="114" cy="118" rx="12" ry="5"/><ellipse cx="156" cy="120" rx="10" ry="4"/></g>';
    return `${tipo === 'tabua' ? tabua() : prato()}${miolo}`;
  };

  A.batata = (o = {}) => {
    let fritas = '';
    const cores = ['#F6CD6A', '#F2C45C', '#F8D77E'];
    for (let i = 0; i < 11; i++) fritas += palito(78 + i * 8.5, 64 + Math.abs(5 - i) * 3, -20 + i * 4, o.polenta ? '#EFC24E' : cores[i % 3], o.polenta ? '#C9921F' : '#D9973A', o.polenta ? 12 : 9, o.polenta ? 40 : 52);
    return `
    ${sombra(120, 154, 70, 11)}
    ${fritas}
    <path d="M70 86h100l-12 62H82z" fill="#B3121F"/>
    <path d="M70 86h100l-2 10H72z" fill="#8C0D18"/>
    <path d="M96 86l-4 62M120 86v62M144 86l4 62" stroke="#F6EBD4" stroke-width="7" opacity=".9"/>
    ${o.cheddar ? '<path d="M78 70c10 10 20-6 32 4s18-8 30 2 16-4 24 4c-6 10-80 10-86-10z" fill="#F29A1B"/><path d="M92 76c0 8-2 12 0 16M140 78c0 6 2 10 0 14" stroke="#F29A1B" stroke-width="6" stroke-linecap="round"/>' + '<g fill="#8E2A1C">' + [[96, 70], [112, 66], [128, 72], [146, 68], [104, 78], [136, 78]].map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="5" rx="1.5"/>`).join('') + '</g>' : ''}
    ${molhoBranco(196, 132)}`;
  };

  A.bolinho = () => {
    const bola = (x, y, r = 15) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#B8641F"/><circle cx="${x - 3}" cy="${y - 4}" r="${r - 5}" fill="#D4852F"/><g fill="#8A4814" opacity=".7"><circle cx="${x + 4}" cy="${y + 4}" r="1.8"/><circle cx="${x - 6}" cy="${y + 5}" r="1.5"/><circle cx="${x + 6}" cy="${y - 5}" r="1.4"/></g>`;
    return `${prato()}${bola(84, 118)}${bola(114, 122)}${bola(144, 118)}${bola(100, 100)}${bola(130, 100)}${bola(116, 84, 14)}${bola(164, 106, 13)}${bola(70, 104, 13)}
    <path d="M178 130a14 14 0 0 1 28 0z" fill="#F4D23C"/>${salsinha([[92, 136], [150, 136]])}`;
  };

  A.pizza = (o = {}) => {
    const doce = o.doce;
    const cx = 120, cy = 98, R = 76;
    let tops = '';
    const pts = [[-40, -20], [-10, -44], [26, -36], [46, -6], [30, 26], [-4, 40], [-38, 22], [0, 0], [-20, 6], [18, 10], [8, -20], [-28, -40]];
    pts.forEach(([x, y], i) => {
      if (doce) tops += i % 2 ? `<path d="M${cx + x} ${cy + y}c-5-6-10 2-6 8 3 4 6 3 6 3s3 1 6-3c4-6-1-14-6-8z" fill="#D8283B"/><path d="M${cx + x - 3} ${cy + y - 6}l3-4 3 4" stroke="#4F8A3A" stroke-width="2" fill="none"/>` : `<circle cx="${cx + x}" cy="${cy + y}" r="4" fill="#FFF6E0" opacity=".9"/>`;
      else tops += i % 3 === 0 ? `<circle cx="${cx + x}" cy="${cy + y}" r="8" fill="#A63A2E"/><circle cx="${cx + x}" cy="${cy + y}" r="6" fill="#C24B3B"/>` : i % 3 === 1 ? `<ellipse cx="${cx + x}" cy="${cy + y}" rx="4.5" ry="5.5" fill="#2F3A18"/><circle cx="${cx + x}" cy="${cy + y}" r="1.6" fill="#6F7F3A"/>` : `<path d="M${cx + x - 6} ${cy + y}q6-6 12 0" stroke="#4F8A3A" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    });
    return `
    <ellipse cx="${cx}" cy="${cy + 58}" rx="${R + 10}" ry="12" fill="#000" opacity=".35"/>
    <ellipse cx="${cx}" cy="${cy + 6}" rx="${R + 8}" ry="${R * .62 + 8}" fill="#3A2416"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R * .62}" fill="#C9772E"/>
    <ellipse cx="${cx}" cy="${cy - 2}" rx="${R - 8}" ry="${R * .62 - 7}" fill="${doce ? '#4A2515' : '#E0562F'}"/>
    <ellipse cx="${cx}" cy="${cy - 3}" rx="${R - 11}" ry="${R * .62 - 10}" fill="${doce ? '#5C2F1B' : '#F4C95D'}"/>
    ${doce ? `<path d="M${cx - 50} ${cy - 16}q20 12 40-2t40 4M${cx - 46} ${cy + 12}q24-10 46 2t38-4" stroke="#FFF1D6" stroke-width="3" fill="none" opacity=".85"/>` : `<g fill="#F9DD84" opacity=".8"><ellipse cx="${cx - 30}" cy="${cy - 10}" rx="14" ry="6"/><ellipse cx="${cx + 24}" cy="${cy + 14}" rx="16" ry="6"/></g>`}
    ${o.meio ? `<path d="M${cx} ${cy - R * .62}V${cy + R * .62}" stroke="#F6EBD4" stroke-width="2" stroke-dasharray="4 4" opacity=".7"/>` : ''}
    ${tops}
    <g stroke="#9B5A22" stroke-width="1.6" opacity=".55"><path d="M${cx} ${cy}L${cx - R + 8} ${cy - 8}M${cx} ${cy}L${cx + R - 8} ${cy + 8}M${cx} ${cy}L${cx - 20} ${cy + R * .6}M${cx} ${cy}L${cx + 20} ${cy - R * .6}"/></g>`;
  };

  A.lanche = (o = {}) => `
    ${sombra(120, 154, 78, 12)}
    <path d="M52 132h136a8 8 0 0 1-8 14H60a8 8 0 0 1-8-14z" fill="#C9822F"/>
    <path d="M50 120c20 10 120 10 140 0l-4 12H54z" fill="#6E3A1C"/>
    <rect x="50" y="108" width="140" height="18" rx="9" fill="#5A2E17"/>
    <path d="M56 110h128" stroke="#7A4221" stroke-width="3" opacity=".7"/>
    <path d="M46 104c10 10 20-2 30 6s18-6 28 2 18-6 28 2 18-8 28 0 16-4 22-10v6H46z" fill="#F3A91E"/>
    ${o.ovo ? '<ellipse cx="96" cy="98" rx="30" ry="9" fill="#FFF8EA"/><circle cx="96" cy="97" r="7" fill="#F4B521"/>' : ''}
    ${o.bacon ? '<path d="M60 98q14-8 28 0t28 0 28 0 28 0" stroke="#A8352A" stroke-width="7" fill="none"/><path d="M60 98q14-8 28 0t28 0 28 0 28 0" stroke="#E7A08A" stroke-width="2" fill="none"/>' : ''}
    <circle cx="80" cy="96" r="9" fill="#D8412F"/><circle cx="142" cy="96" r="9" fill="#D8412F"/><circle cx="112" cy="94" r="9" fill="#E24C38"/>
    <path d="M44 96c8-8 14 4 22-2s12 6 20-2 14 6 22-2 12 6 20-2 14 6 22-2 12 6 20-2 12 4 16 2" stroke="#5FA83E" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M48 90c0-40 38-54 72-54s72 14 72 54z" fill="#D88A34"/>
    <path d="M58 80c4-26 30-36 62-36" stroke="#F2B45C" stroke-width="8" fill="none" stroke-linecap="round" opacity=".7"/>
    <g fill="#FFF3D6">${[[84, 56], [104, 48], [128, 50], [150, 58], [96, 68], [120, 64], [142, 72], [166, 70], [74, 72]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="1.8" transform="rotate(${i * 25} ${x} ${y})"/>`).join('')}</g>`;

  A.waffel = () => `
    ${prato()}
    <rect x="62" y="80" width="116" height="60" rx="10" fill="#C9822F"/>
    <rect x="66" y="76" width="108" height="56" rx="10" fill="#E3A24A"/>
    <g stroke="#B56E22" stroke-width="4" opacity=".75"><path d="M84 78v52M102 78v52M120 78v52M138 78v52M156 78v52M68 94h104M68 112h104"/></g>
    <path d="M70 132q20 8 40 0t40 0 26 0" stroke="#F7E08A" stroke-width="6" fill="none" stroke-linecap="round"/>`;

  A.misto = () => `
    ${prato()}
    <path d="M70 132l50-48 50 48z" fill="#D9A45A"/><path d="M76 128l44-40 44 40z" fill="#F4DDB0"/>
    <path d="M78 122q42 10 84 0" stroke="#F4C542" stroke-width="7" fill="none"/><path d="M82 116q38 8 76 0" stroke="#E7A2A0" stroke-width="5" fill="none"/>
    <g stroke="#9A5E22" stroke-width="3" opacity=".7"><path d="M100 104l8 8M120 96l8 8M132 110l8 8"/></g>`;

  A.caldo = (o = {}) => {
    const id = uid();
    const cor = o.cabotia ? '#E89A2F' : '#EAD7A0';
    return `
    <defs><radialGradient id="${id}" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="${o.cabotia ? '#F6B955' : '#F6E8BE'}"/><stop offset="1" stop-color="${cor}"/></radialGradient></defs>
    ${sombra(120, 154, 80, 12)}
    <path d="M36 92c0 36 38 58 84 58s84-22 84-58z" fill="#3B2A1F"/>
    <path d="M36 92c0 36 38 58 84 58s84-22 84-58" fill="none" stroke="#5B4332" stroke-width="3"/>
    <path d="M52 110c10 20 36 30 68 30" stroke="#6E5240" stroke-width="4" fill="none" opacity=".6"/>
    <ellipse cx="120" cy="92" rx="84" ry="22" fill="#5B4332"/>
    <ellipse cx="120" cy="92" rx="76" ry="18" fill="url(#${id})"/>
    <g fill="#7A3A22">${[[92, 88], [112, 94], [132, 86], [150, 94], [104, 98], [142, 100], [124, 82]].map(([x, y]) => `<path d="M${x} ${y}l6-2 2 5-6 2z"/>`).join('')}</g>
    <g fill="#5FA83E">${[[98, 84], [128, 92], [152, 86], [116, 100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join('')}</g>
    <g stroke="#F6EBD4" stroke-width="4" fill="none" stroke-linecap="round" opacity=".35"><path d="M96 66c-8-10 8-16 0-28"/><path d="M122 62c-8-10 8-16 0-28"/><path d="M148 66c-8-10 8-16 0-28"/></g>`;
  };

  A.marmita = () => `
    ${sombra(120, 154, 92, 12)}
    <path d="M28 76h184l-12 70H40z" fill="#A9B0B7"/>
    <path d="M24 70h192v10H24z" fill="#D5DADF"/>
    <path d="M40 84h160l-9 54H49z" fill="#8E969E"/>
    <path d="M46 88h74v46H52z" fill="#F7F3EA"/>
    <g fill="#fff">${[...Array(14)].map((_, i) => `<ellipse cx="${54 + (i % 7) * 9}" cy="${96 + Math.floor(i / 7) * 14 + (i % 2) * 3}" rx="3" ry="1.5"/>`).join('')}</g>
    <path d="M122 88h74l-4 22h-70z" fill="#5A2E1B"/>
    <g fill="#3E1C10">${[...Array(10)].map((_, i) => `<ellipse cx="${130 + (i % 5) * 13}" cy="${96 + Math.floor(i / 5) * 8}" rx="4" ry="2.6"/>`).join('')}</g>
    <path d="M122 112h70l-5 26h-65z" fill="#C97C2C"/>
    <path d="M130 118c14-6 34-6 52 0" stroke="#EDB060" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="112" cy="128" r="7" fill="#5FA83E"/><circle cx="104" cy="124" r="5" fill="#76B84E"/><circle cx="114" cy="120" r="4" fill="#D8412F"/>`;

  A.arroz = () => `
    ${sombra(120, 152, 72, 11)}
    <path d="M52 96c0 30 30 50 68 50s68-20 68-50z" fill="#E9E1D2"/>
    <path d="M52 96c0 30 30 50 68 50s68-20 68-50" fill="none" stroke="#C9BBA2" stroke-width="3"/>
    <path d="M58 96c0-26 30-40 62-40s62 14 62 40z" fill="#FBF8F1"/>
    <g fill="#E5DDCB">${[...Array(26)].map((_, i) => `<ellipse cx="${70 + (i % 9) * 12}" cy="${66 + Math.floor(i / 9) * 10 + (i % 2) * 4}" rx="3.6" ry="1.8" transform="rotate(${i * 37} ${70 + (i % 9) * 12} ${66 + Math.floor(i / 9) * 10})"/>`).join('')}</g>`;

  A.salada = () => `
    ${sombra(120, 152, 72, 11)}
    <path d="M52 96c0 30 30 50 68 50s68-20 68-50z" fill="#3E6B3A"/>
    <path d="M60 94c4-20 20-34 40-30 10-12 34-12 44 0 20-4 36 10 38 30z" fill="#6BAA48"/>
    <path d="M70 90c6-12 18-18 30-14M120 72c10-6 24-4 32 6" stroke="#8FCB62" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="96" cy="84" r="11" fill="#D8412F"/><circle cx="96" cy="84" r="7" fill="#F06A4F"/>
    <circle cx="142" cy="86" r="10" fill="#D8412F"/><circle cx="142" cy="86" r="6" fill="#F06A4F"/>
    <g fill="none" stroke="#E9D3E6" stroke-width="3"><ellipse cx="120" cy="80" rx="12" ry="6"/><ellipse cx="164" cy="90" rx="9" ry="4"/></g>`;

  A.chopp = (o = {}) => {
    const id = uid();
    return `
    <defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#C9761A"/><stop offset=".45" stop-color="#F5A524"/><stop offset="1" stop-color="#B8661A"/></linearGradient></defs>
    ${sombra(112, 156, 60, 10)}
    <path d="M158 70h14a20 20 0 0 1 20 20v22a20 20 0 0 1-20 20h-14" fill="none" stroke="#E9DFC8" stroke-width="10" opacity=".55"/>
    <rect x="62" y="52" width="100" height="100" rx="10" fill="url(#${id})"/>
    <rect x="62" y="52" width="100" height="100" rx="10" fill="none" stroke="#FFF3D6" stroke-width="3" opacity=".45"/>
    <rect x="74" y="64" width="10" height="78" rx="5" fill="#FFE3A0" opacity=".45"/>
    <rect x="98" y="64" width="6" height="78" rx="3" fill="#FFE3A0" opacity=".25"/>
    <g fill="#FFE8B0" opacity=".7">${[[120, 130], [132, 110], [118, 96], [140, 124], [110, 116], [146, 92], [126, 80]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${1.6 + (i % 3)}"/>`).join('')}</g>
    <path d="M58 58c-6-18 10-26 22-20 4-14 26-16 34-4 10-10 32-6 34 8 14-2 22 14 14 24-4 8-14 8-18 4v16c0 6-8 6-8 0V74c-18 4-50 4-70-2-8 0-10-8-8-14z" fill="#FBF6EA"/>
    <g fill="#fff"><circle cx="86" cy="46" r="5"/><circle cx="118" cy="40" r="4"/><circle cx="146" cy="50" r="3"/></g>
    ${o.label ? `<text x="112" y="128" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="18" fill="#7A3E0A" opacity=".75">${o.label}</text>` : ''}`;
  };

  A.lata = (o = {}) => {
    const cor = o.cor || '#1B4FB8', faixa = o.faixa || '#fff';
    return `
    ${sombra(120, 156, 44, 9)}
    <rect x="86" y="34" width="68" height="118" rx="10" fill="${cor}"/>
    <ellipse cx="120" cy="36" rx="34" ry="8" fill="#C9CED3"/><ellipse cx="120" cy="36" rx="26" ry="5" fill="#9AA1A8"/>
    <rect x="86" y="140" width="68" height="12" rx="6" fill="#B5BBC1"/>
    <path d="M86 86c20-14 48 14 68 0v18c-20 14-48-14-68 0z" fill="${faixa}" opacity=".95"/>
    <rect x="94" y="44" width="8" height="94" rx="4" fill="#fff" opacity=".22"/>
    <g fill="#fff" opacity=".55">${[[132, 60], [140, 76], [128, 118], [144, 124], [110, 130]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="3"/>`).join('')}</g>
    ${o.label ? `<text x="120" y="${o.labelY || 72}" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="${o.labelSize || 15}" fill="${o.labelCor || '#fff'}" letter-spacing="1">${o.label}</text>` : ''}`;
  };

  A.garrafa = (o = {}) => {
    const cor = o.cor || '#1E7A3A';
    return `
    ${sombra(120, 156, 40, 9)}
    <path d="M108 20h24v26c0 8 20 18 20 40v58a10 10 0 0 1-10 10h-44a10 10 0 0 1-10-10V86c0-22 20-32 20-40z" fill="${cor}" opacity="${o.vidro ? .55 : 1}"/>
    <rect x="106" y="14" width="28" height="12" rx="3" fill="${o.tampa || '#D8412F'}"/>
    <rect x="88" y="92" width="64" height="36" fill="${o.rotulo || '#F6EBD4'}"/>
    <rect x="96" y="54" width="8" height="90" rx="4" fill="#fff" opacity=".25"/>
    ${o.label ? `<text x="120" y="116" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="13" fill="${o.labelCor || cor}">${o.label}</text>` : ''}`;
  };

  A.suco = (o = {}) => {
    const cor = o.cor || '#F4B521';
    return `
    ${sombra(120, 156, 46, 9)}
    <path d="M150 30l-18 40" stroke="#E23B3B" stroke-width="7" stroke-linecap="round"/>
    <path d="M78 50h84l-10 100H88z" fill="#F6EBD4" opacity=".25"/>
    <path d="M82 66h76l-8 82H90z" fill="${cor}"/>
    <path d="M84 66h72" stroke="#fff" stroke-width="4" opacity=".5"/>
    <rect x="92" y="72" width="8" height="70" rx="4" fill="#fff" opacity=".25"/>
    <g fill="#fff" opacity=".4">${[[118, 100], [130, 118], [110, 128], [136, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2"/>`).join('')}</g>
    <path d="M66 58a22 22 0 0 1 36-10" stroke="${o.fruta || '#F4D23C'}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  };

  // ── escolha por nome ───────────────────────────────────────────────────────
  function escolher(nome, secao) {
    const n = (nome || '').toLowerCase();
    if (secao === 'pizzas') return A.pizza({ doce: /prest[ií]gio|sensa[cç][aã]o|chocolate/.test(n) });
    if (/marmit/.test(n)) return A.marmita();
    if (/caldo/.test(n)) return A.caldo({ cabotia: /cabot/.test(n) });
    if (/waff/.test(n)) return A.waffel();
    if (/misto/.test(n)) return A.misto();
    if (/^x-|hamb[uú]rguer/.test(n)) return A.lanche({ bacon: /bacon|tudo/.test(n), ovo: /egg|tudo/.test(n) });
    if (/cerveja|chopp|skol|brahma/.test(n)) return A.chopp({ label: /skol/.test(n) ? 'SKOL' : /brahma/.test(n) ? 'BRAHMA' : '' });
    if (/pepsi/.test(n)) return A.lata({ cor: '#10307A', faixa: '#E23B3B', label: 'PEPSI' });
    if (/sukita/.test(n)) return A.lata({ cor: '#F07A12', faixa: '#FFF1D6', label: 'SUKITA' });
    if (/soda/.test(n)) return A.lata({ cor: '#2E9E4A', faixa: '#F4E04A', label: 'SODA' });
    if (/guaran[aá] zero/.test(n)) return A.lata({ cor: '#1A1A1A', faixa: '#2E9E4A', label: 'ZERO' });
    if (/h2oh/.test(n)) return A.garrafa({ cor: '#4FB8C9', vidro: true, tampa: '#2E9E4A', rotulo: '#F4E04A', label: 'H2OH!', labelCor: '#1E6A3A' });
    if (/guaran[aá]/.test(n)) return A.garrafa({ cor: '#1E7A3A', tampa: '#2E9E4A', rotulo: '#F6EBD4', label: 'GUARANÁ' });
    if (/[aá]gua/.test(n)) return A.garrafa({ cor: '#7FC6E8', vidro: true, tampa: /com g[aá]s/.test(n) ? '#D8412F' : '#1B4FB8', rotulo: '#E8F4FA', label: 'ÁGUA', labelCor: '#1B4FB8' });
    if (/suco/.test(n)) return A.suco(/acerola/.test(n) ? { cor: '#D8283B', fruta: '#E23B3B' } : { cor: '#F4B521', fruta: '#F6D24A' });
    if (/tilápia|tilapia/.test(n)) return A.peixe({ grelhado: /grelhad/.test(n), alcaparras: /alcaparra/.test(n) });
    if (/lambari/.test(n)) return A.lambari();
    if (/bacalhau/.test(n)) return A.bolinho();
    if (/picanha|alcatra/.test(n)) return A.carne({ cebola: /cebola/.test(n), completa: /complet/.test(n) });
    if (/costelinha/.test(n)) return A.carne({ porco: true, completa: /complet/.test(n) });
    if (/frango/.test(n) && secao !== 'lanches') return A.frango({ batata: /batata/.test(n), mandioca: /mandioca/.test(n) });
    if (/t[aá]bua/.test(n)) return A.frios({ tipo: 'tabua' });
    if (/salame/.test(n)) return A.frios({ tipo: 'salame' });
    if (/azeitona/.test(n)) return A.frios({ tipo: 'azeitona' });
    if (/presunto/.test(n)) return A.frios({ tipo: 'presunto' });
    if (/palmito/.test(n)) return A.frios({ tipo: 'palmito' });
    if (/calabresa/.test(n)) return A.frios({ tipo: 'calabresa' });
    if (/cheddar/.test(n)) return A.batata({ cheddar: true });
    if (/polenta/.test(n)) return A.batata({ polenta: true });
    if (/batata/.test(n)) return A.batata();
    if (/arroz/.test(n)) return A.arroz();
    if (/salada/.test(n)) return A.salada();
    if (secao === 'bebidas') return A.chopp();
    return A.frango();
  }

  window.ChoppArt = {
    svg(nome, secao, extra = '') {
      return `<svg class="art-svg ${extra}" viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${escolher(nome, secao)}</svg>`;
    },
    pizzaMeio() { return `<svg class="art-svg" viewBox="0 0 240 180" aria-hidden="true">${A.pizza({ meio: true })}</svg>`; },
  };
})();
