-- Uber Relatório — schema (rode no SQL Editor do Supabase)
create table if not exists lancamentos (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  tipo        text not null check (tipo in ('ganho','odometro','despesa','sessao_ini','sessao_fim','pausa_ini','pausa_fim')),
  valor       numeric,          -- R$ (ganho/despesa) ou km do odômetro (odometro/sessão)
  km          numeric,          -- km da corrida (opcional)
  passageiro  text,
  categoria   text,             -- despesa: combustivel, alimentacao...
  obs         text,
  origem      text not null default 'manual',   -- manual | whatsapp | uber
  ext_id      text unique,      -- id externo (dedupe whatsapp/uber)
  criado_em   timestamptz not null default now()
);
create index if not exists lancamentos_ts_idx on lancamentos (ts desc);

create table if not exists config (
  id    int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'
);
insert into config (id, dados) values (1, '{
  "meta_dia": 300, "meta_semana": 1800, "meta_sessao": 150,
  "horas_dia": 8, "dias_semana": 6, "custo_km": 0.45,
  "carros": [
    { "id": "c1", "nome": "Carro Principal", "placa": "ABC-1234", "custo_km": 0.45, "ativo": true }
  ],
  "carro_ativo_id": "c1"
}') on conflict (id) do nothing;

-- Acesso só pelo servidor (service role). Sem policies = navegador não acessa direto.
alter table lancamentos enable row level security;
alter table config enable row level security;

-- Se usar a chave anon no servidor (em vez da service role), libere o acesso:
-- create policy "api anon lancamentos" on lancamentos for all to anon using (true) with check (true);
-- create policy "api anon config" on config for all to anon using (true) with check (true);
