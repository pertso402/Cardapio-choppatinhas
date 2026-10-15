# Choppatinhas — Cardápio digital

Cardápio online do Choppatinhas (Umuarama-PR). HTML/CSS/JS puro, sem build,
com dados e pedidos no Supabase (o mesmo banco do atendimento por WhatsApp e do
painel de pedidos).

| Pasta | O que é |
|---|---|
| `cardapio-v2/` | **Versão publicada.** Clara, foto em primeiro lugar, destaque em vídeo, checkout em página única, medição de resultados. |
| `cardapio/` | Versão 1 (tema escuro), mantida para comparação. |
| `supabase/` | SQL extra (tabela de métricas `eventos_cardapio`). |

## Publicar

Projeto na Vercel com **Root Directory = `cardapio-v2`**, sem comando de build.
Todo push na branch `main` publica sozinho.

## Rodar local

Qualquer servidor estático na pasta, por exemplo:

```bash
npx http-server cardapio-v2 -p 5175 -c-1
```

## Configuração

`cardapio-v2/config.js` — URL do Supabase, chave pública (anon), seções,
textos dos produtos, ranking "mais pedidos". Preços, fotos, vídeos,
disponibilidade e dados da loja são editados pelo painel da casa (engrenagem
no rodapé do cardápio).

## Cardápio v3: funcionamento automático

A versão v3 fica em `cardapio-v3/` e usa a mesma agenda do agente na chave
`info_restaurante.horarios_funcionamento`. O painel da loja permite editar a abertura
e o fechamento de cada dia; deixe ambos vazios nos dias fechados. O horário usa
sempre `America/Sao_Paulo`, inclusive para clientes em outros fusos. O botão de
pausa manual continua fechando a loja dentro do expediente.

Agenda inicial: segunda a sexta, 17h30 às 23h; sábado, 11h às 23h; domingo fechado.
O status se atualiza com a página aberta, ao voltar para a aba e em alterações
do Supabase. O checkout reconsulta a configuração antes de enviar; falhas de
consulta bloqueiam pedidos até a recuperação. O catálogo permanece visível.

Execute **uma vez** `supabase/003_horarios_funcionamento.sql` no SQL Editor
do mesmo Supabase do agente para gravar a agenda inicial e bloquear também no
banco pedidos novos fora do expediente. É a mesma migração `horarios.sql` do
agente: basta executar uma das cópias. Não reaplique depois de personalizar a agenda.

Para publicar esta versão, use Root Directory `cardapio-v3` na Vercel, sem build.
Teste a regra e o checkout com `node --test test/horarios.test.cjs` na raiz do repo.
