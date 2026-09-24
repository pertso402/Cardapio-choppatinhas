// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO — CHOPPATINHAS (Umuarama-PR)
// Tudo que é "da casa" fica aqui. Preços, disponibilidade, taxa, PIX etc. vêm
// do Supabase (tabelas produtos e info_restaurante) e mudam pelo admin.
// ═══════════════════════════════════════════════════════════════════════════

window.CHOPP = {
  SUPABASE_URL: 'https://cvukucgofhappavupaij.supabase.co',
  // anon key (pública por natureza). NUNCA colocar a service_role aqui.
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2dWt1Y2dvZmhhcHBhdnVwYWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNjUwNjQsImV4cCI6MjA5MjY0MTA2NH0.fKXQjSTaZ-qtToyPMoi50F6ADCPyNTLZWmPv8SqrTvU',

  CANAL: 'cardapio_digital',   // pedidos.canal — separa o cardápio do WhatsApp nas métricas
  BUCKET: 'produto-fotos',

  // Valores padrão se a chave não existir em info_restaurante
  DEFAULTS: {
    taxa_entrega: 6,
    pedido_minimo: 20,
    frete_gratis_acima: 120,
    tempo_entrega: '40–60 min',
    tempo_retirada: '~20 min',
    horario: 'Fecha às 22:30',
    avaliacao: '4,7',
  },

  // Horário do marmitex (hora local)
  MARMITEX: { inicio: 11, fim: 14 },

  // Ordem e rótulo das seções do cardápio.
  // "match" decide em qual seção cada produto cai (primeira regra que bater).
  SECOES: [
    { id: 'combos',  nome: 'Combos da Casa',   sub: 'Pratos completos, feitos para compartilhar',  icon: 'flame',   match: p => p.categoria === 'Porções' && /^combo/i.test(p.base) },
    { id: 'porcoes', nome: 'Porções',          sub: 'Todas acompanham o nosso molho branco',       icon: 'drum',    match: p => p.categoria === 'Porções' && !/^(arroz|salada|porção de batata frita|porção de polenta frita)$/i.test(p.base) },
    { id: 'pizzas',  nome: 'Pizzas',           sub: 'Até 2 sabores na mesma pizza',                icon: 'pizza',   match: p => p.categoria === 'Pizzas' },
    { id: 'lanches', nome: 'Lanches',          sub: 'Preparados na chapa, na hora do pedido',   icon: 'burger',  match: p => p.categoria === 'Lanches' },
    { id: 'acomp',   nome: 'Acompanhamentos',  sub: 'Para completar o seu pedido',                        icon: 'fries',   match: p => p.categoria === 'Porções' },
    { id: 'caldos',  nome: 'Caldos',           sub: 'Cremosos e encorpados, com carne seca',        icon: 'soup',    match: p => p.categoria === 'Caldos' },
    { id: 'marmitex',nome: 'Marmitex',         sub: 'Almoço das 11h às 14h',                       icon: 'box',     match: p => p.categoria === 'Marmitex' },
    { id: 'bebidas', nome: 'Bebidas',          sub: 'Sempre bem geladas',                         icon: 'beer',    match: p => p.categoria === 'Bebidas' },
    { id: 'outros',  nome: 'Mais delícias',    sub: '',                                            icon: 'star',    match: () => true },
  ],

  // Copy de desejo (linha em itálico). Chave = nome base (sem "(M)"/"(G)"), minúsculo.
  // Não substitui a descrição do banco — aparece junto, acima dela.
  COPY: {
    // ── Frango (nº1 da casa no Anota.ai) ──
    'frango frito especial':                   'Coxa e sobrecoxa ou só peito, empanado e frito na hora. Casquinha crocante, carne suculenta — o prato mais pedido da casa.',
    'combo frango c/batata':                   '1 kg do nosso frango crocante com 500 g de batata sequinha e o molho branco da casa. Pronto para compartilhar.',
    'combo frango com mandioca':               '1 kg de frango dourado com mandioca frita, macia por dentro, e o molho branco da casa. Uma combinação que é tradição aqui.',
    'combo frango frito especial c/ arroz e salada': 'O frango crocante da casa com arroz soltinho e salada fresca. Uma refeição completa, com gosto de comida bem feita.',
    // ── Carnes na chapa ──
    'combo picanha na chapa com mandioca':     'Picanha fatiada e selada na chapa na hora, com a capa de gordura dourada. Acompanha mandioca, cebola, torradas e molho branco.',
    'combo picanha completa com salada e arroz':'Nossa picanha na chapa com arroz, salada, mandioca e torradas. O prato para quando a ocasião pede o melhor.',
    'combo alcatra na chapa com mandioca e cebola': 'Alcatra em tiras selada na chapa com cebola, mandioca e torradas. Macia, bem temperada e cheia de sabor.',
    'combo alcatra completa com mandioca, arroz e salada': 'Alcatra na chapa com mandioca, arroz soltinho e salada fresca. Uma refeição farta e completa.',
    'combo costelinha de porco com mandioca':  'Costelinha de porco frita até dourar: crocante por fora, macia junto ao osso. Com mandioca e molho branco.',
    'combo costelinha de porco completa com arroz e salada': 'Nossa costelinha dourada com mandioca, arroz e salada. Farta, caseira e irresistível.',
    // ── Peixes ──
    'filé de tilápia':                         'Filés de tilápia empanados e fritos na hora — dourados por fora, macios por dentro. Acompanha molho branco.',
    'filé de tilápia completa com arroz e salada': 'Nossa tilápia empanada, crocante e macia, com arroz e salada. Um prato completo e leve.',
    'combo filé de tilápia grelhado com alcaparras': '600 g de tilápia grelhada com alcaparras. Leve e delicada, para quem prefere um prato mais leve sem abrir mão do sabor.',
    'combo filé de tilápia grelhado com alcaparras completa': 'Tilápia grelhada com alcaparras, arroz, salada e molho branco. Leve, elegante e completa.',
    'lambari frito':                           'Lambaris inteiros, fritos até ficarem bem crocantes. Um clássico da casa, ótimo para compartilhar.',
    // ── Porções ──
    'tábua de frios':                          'Mussarela, presunto, salame, palmito, azeitona, pepino e ovo de codorna, servidos em tábua. Para saborear com calma.',
    'porção de bolinho de bacalhau':           '16 bolinhos de bacalhau dourados — crocantes por fora, cremosos por dentro.',
    'porção de palmito':                       '400 g de palmito macio e delicado. Leve, fresco e sempre bem-vindo à mesa.',
    'porção de calabresa':                     'Calabresa fatiada e salteada com cebola, servida com torradas e molho branco. Aromática e cheia de sabor.',
    'porção de presunto e queijo':             'Presunto e queijo fatiados, servidos com generosidade. Simples, clássico e sempre certeiro.',
    'porção de polenta frita recheada':        'Polenta dourada e crocante, recheada com queijo que derrete a cada mordida.',
    'porção de salame':                        'Salame fatiado fino, de sabor marcante. Ideal para acompanhar uma bebida.',
    'porção de azeitona':                      '300 g de azeitonas. O acompanhamento clássico para abrir a refeição.',
    'batata c/bacon cheddar':                  '500 g de batata frita coberta de cheddar cremoso e bacon crocante. Difícil de dividir.',
    // ── Acompanhamentos ──
    'porção de batata frita':                  'Batata frita dourada e sequinha, no ponto certo de sal. O acompanhamento mais pedido da casa.',
    'porção de polenta frita':                 '500 g de polenta frita, crocante por fora e macia por dentro. Uma das favoritas dos nossos clientes.',
    'arroz':                                   'Arroz branco soltinho, 500 g. O complemento certo para os pratos e porções.',
    'salada':                                  'Alface, tomate e cebola fresquinhos. Leveza para equilibrar a refeição.',
    // ── Caldos ──
    'caldo de mandioca com carne seca':        'Caldo cremoso de mandioca com carne seca desfiada. Encorpado, quentinho e reconfortante.',
    'caldo de cabotiá com carne seca':         'Caldo aveludado de cabotiá com carne seca desfiada. Delicado e cheio de sabor.',
    // ── Lanches ──
    'x-tudo':                                  'Hambúrguer, bacon, ovo, frango, calabresa, presunto, mussarela, tomate e alface. O mais completo da casa.',
    'x-picanha':                               'Picanha, mussarela derretida, tomate e alface. O lanche mais nobre do cardápio.',
    'x-bacon':                                 'Hambúrguer suculento, bacon crocante e mussarela derretida, com tomate e alface.',
    'x-calabresa':                             'Hambúrguer com calabresa, presunto e mussarela, finalizado com tomate e alface.',
    'x-egg':                                   'Hambúrguer com ovo, mussarela derretida, tomate e alface. Clássico e bem servido.',
    'x-frango':                                'Frango, mussarela derretida, tomate e alface. Leve e saboroso.',
    'x-salada':                                'Hambúrguer, presunto e mussarela, com tomate e alface fresquinhos.',
    'hambúrguer':                              'Hambúrguer com mussarela derretida no pão macio. Simples e bem feito.',
    'misto quente':                            'Presunto e queijo derretido no pão, prensado na chapa.',
    'waffel especial':                         'Waffel dourado recheado com frango desfiado, milho, ervilha, palmito e mussarela.',
    'waffel simples':                          'Waffel dourado recheado com frango desfiado, milho, ervilha e mussarela.',
    // ── Bebidas ──
    'cerveja brahma':                          'Lata de 350 ml, bem gelada.',
    'cerveja skol':                            'Lata de 350 ml, bem gelada.',
    'guaraná antarctica':                      'Garrafa de 2 litros, bem gelada — rende para a mesa toda.',
    'guaraná zero lata':                       'Lata de 350 ml, gelada.',
    'pepsi lata':                              'Lata de 350 ml, gelada.',
    'sukita lata':                             'Lata de 350 ml, gelada.',
    'soda lata':                               'Lata de 350 ml, gelada.',
    'suco de maracujá polpa':                  'Suco de maracujá feito com polpa. Garrafa de 1 litro, refrescante.',
    'suco de acerola':                         'Suco de acerola, 1 litro. Refrescante e cheio de vitamina C.',
    'água com gás':                            'Garrafa de 500 ml.',
    'água sem gás':                            'Garrafa de 500 ml.',
    // ── Fora do cardápio hoje (desativados), mantidos caso voltem ──
    'filé mignon':                             'Filé na manteiga com catupiry. A pizza que vira assunto no dia seguinte.',
    'strogonoff de carne':                     'Strogonoff cremoso com batata palha sobre a pizza.',
    'à moda da casa':                          'Palmito, frango, calabresa, bacon e o melhor da casa numa pizza só.',
    'prestígio':                               'Chocolate, coco e leite condensado. Sobremesa em forma de pizza.',
    'sensação':                                'Chocolate com morango e leite moça.',
    'marmitas media e grande':                 'Comida caseira feita no dia. Você escolhe a carne.',
  },

  // Copy genérica por seção quando o produto não tem uma específica
  COPY_SECAO: {
    frango:  'Crocante por fora, suculento por dentro. Feito na hora.',
    combos:  'Preparado na hora e servido para compartilhar.',
    porcoes: 'Preparada na hora, acompanha o molho branco da casa.',
    pizzas:  'Borda dourada, queijo que estica.',
    lanches: 'Montado na chapa na hora do seu pedido.',
    acomp:   '',
    caldos:  'Quentinho e encorpado.',
    marmitex:'Comida caseira feita no dia.',
    bebidas: '',
  },

  // Opções obrigatórias por produto (nome base em minúsculo → grupos)
  OPCOES: {
    'frango frito especial': [{ titulo: 'Qual corte?', rotulo: 'Corte', itens: ['Coxa e sobrecoxa', 'Só peito'] }],
    'combo frango frito especial c/ arroz e salada': [{ titulo: 'Qual corte?', rotulo: 'Corte', itens: ['Coxa e sobrecoxa', 'Só peito'] }],
    'marmitas media e grande': [{ titulo: 'Escolha a carne', rotulo: 'Carne', itens: ['Filé de peito grelhado', 'Filé de tilápia frito', 'Frango chinquim frito', 'Bisteca bovina', 'Bisteca suína'] }],
  },

  // "Turbine seu pedido" (dentro do produto) e "Vai bem com isso" (carrinho)
  // NÃO usam mais uma lista fixa por seção — a lógica em app.js
  // (função `candidatosPara`) escolhe o complemento certo pra cada prato
  // (o que ele já inclui, o que combina de verdade) e reordena pelo que os
  // clientes da casa REALMENTE compram junto, usando o histórico de pedidos
  // (S.afinidade). Esta lista aqui é só a rede de segurança final, caso a
  // lógica específica não encontre nada.
  UPSELL_PADRAO: ['Cerveja Brahma', 'Porção De Batata Frita (M)', 'Guaraná Antarctica', 'Batata C/Bacon Cheddar', 'Porção De Calabresa (M)', 'Pepsi Lata'],

  // Bebida oferecida no último passo do checkout se o carrinho não tiver nenhuma.
  // Cerveja em lata entrega numa boa (não é chopp de torneira) — mas a casa
  // pode desligar sugestão de álcool no admin (Loja → "Sugerir cerveja/chopp"),
  // e aí a versão sem álcool entra no lugar.
  BEBIDA_ULTIMA_CHANCE: 'Cerveja Brahma',
  BEBIDA_ULTIMA_CHANCE_SEM_ALCOOL: 'Guaraná Antarctica',
};
