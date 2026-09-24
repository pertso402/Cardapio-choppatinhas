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
