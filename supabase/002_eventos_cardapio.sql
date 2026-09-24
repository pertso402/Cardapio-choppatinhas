-- ═══════════════════════════════════════════════════════════════════════════
-- MEDIÇÃO DO CARDÁPIO DIGITAL — Choppatinhas
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- Pode rodar de novo sem medo (idempotente).
--
-- Guarda o que acontece no cardápio pra saber o que realmente sobe o ticket:
-- sugestão mostrada / aceita, oferta rápida, "libera o frete", tamanho maior,
-- cliques no vídeo em destaque e o pedido final com quanto veio de cada lugar.
-- Não guarda nome, telefone nem endereço — só um id aleatório de sessão.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.eventos_cardapio (
  id          bigint generated always as identity primary key,
  sessao      text not null check (char_length(sessao) <= 64),
  evento      text not null check (char_length(evento) <= 40),
  produto     text check (char_length(produto) <= 160),
  valor       numeric,
  pedido_id   uuid,
  dados       jsonb,
  versao      text check (char_length(versao) <= 10),
  created_at  timestamptz not null default now()
);

create index if not exists idx_eventos_cardapio_criado on public.eventos_cardapio (created_at desc);
create index if not exists idx_eventos_cardapio_evento on public.eventos_cardapio (evento, created_at desc);

alter table public.eventos_cardapio enable row level security;

-- O cardápio só INSERE; o painel da casa só LÊ. Ninguém edita nem apaga pela
-- chave pública (diferente das outras tabelas, que são totalmente abertas).
do $$ begin
  create policy eventos_cardapio_inserir on public.eventos_cardapio for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy eventos_cardapio_ler on public.eventos_cardapio for select using (true);
exception when duplicate_object then null; end $$;
