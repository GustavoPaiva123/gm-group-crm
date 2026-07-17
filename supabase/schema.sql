-- ============================================================================
-- GM Group — CRM · Esquema de banco de dados (Supabase / PostgreSQL)
-- Etapa 2: estrutura do banco. Ainda NÃO conectado ao frontend.
--
-- Como executar:
--   1. Abra o projeto no Supabase → SQL Editor
--   2. Cole este arquivo inteiro e rode
--   3. Ele é idempotente na criação de tipos/tabelas (usa IF NOT EXISTS onde
--      o Postgres permite); rodar do zero em um projeto novo é seguro.
--
-- RLS (Row Level Security): propositalmente NÃO habilitado ainda.
-- Isso será configurado na etapa de autenticação (Etapa 3), quando existirem
-- usuários reais para definir as políticas de acesso.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- TIPOS (ENUMs) — conjuntos fixos de valores, refletindo os status já usados
-- no protótipo (colunas do Kanban, status de proposta, etc.)
-- ----------------------------------------------------------------------------

do $$ begin
  create type lead_status as enum (
    'novo', 'primeiro_contato', 'respondeu', 'reuniao',
    'proposta', 'negociacao', 'fechado', 'perdido'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type cliente_status as enum ('ativo', 'em_risco', 'inativo', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type proposta_status as enum ('rascunho', 'enviada', 'negociacao', 'aprovada', 'perdida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type follow_up_status as enum ('pendente', 'concluido', 'reagendado');
exception when duplicate_object then null; end $$;


-- ----------------------------------------------------------------------------
-- USUARIOS — time comercial do GM Group.
-- O id é uuid de propósito: na Etapa 3 (autenticação), cada linha aqui vai
-- corresponder a um usuário em auth.users do Supabase (mesmo id).
-- ----------------------------------------------------------------------------

create table if not exists usuarios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text not null unique,
  papel       text not null default 'comercial',
  created_at  timestamptz not null default now()
);

comment on table usuarios is 'Time comercial do GM Group. Id será espelhado em auth.users na Etapa 3.';


-- ----------------------------------------------------------------------------
-- SERVICOS — catálogo dos serviços do GM Group (Tráfego pago, IA para
-- atendimento, Automação comercial, etc.). Existir como catálogo evita
-- texto livre divergente ("Trafego Pago" vs "tráfego pago") e permite
-- relatórios por serviço no futuro.
-- ----------------------------------------------------------------------------

create table if not exists servicos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  created_at  timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- LEADS — funil comercial (pipeline Kanban).
-- convertido_em_cliente_id é adicionado depois via ALTER TABLE, porque
-- clientes ainda não existe neste ponto do script (referência circular
-- leads <-> clientes, resolvida abaixo).
-- ----------------------------------------------------------------------------

create table if not exists leads (
  id                  uuid primary key default gen_random_uuid(),
  empresa             text not null,
  contato             text not null,
  whatsapp            text,
  instagram           text,
  email               text,
  cidade              text,
  estado              char(2),
  segmento            text,
  origem              text,
  status              lead_status not null default 'novo',
  responsavel_id      uuid references usuarios(id),
  valor_estimado      numeric(12,2),
  observacoes         text,
  ultimo_contato_em   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column leads.responsavel_id is 'Comercial responsável pelo lead (FK -> usuarios).';
comment on table leads is
  'Próximo follow-up NÃO fica armazenado aqui: é derivado da tabela follow_ups '
  '(o pendente mais próximo). Evita duas fontes de verdade para a mesma data.';


-- ----------------------------------------------------------------------------
-- CLIENTES — base de clientes ativos.
-- lead_origem_id preserva de qual lead este cliente veio (histórico e
-- métricas de conversão do funil), mas pode ser nulo se o cliente for
-- cadastrado diretamente, sem passar pelo funil de leads.
-- ----------------------------------------------------------------------------

create table if not exists clientes (
  id                  uuid primary key default gen_random_uuid(),
  lead_origem_id      uuid references leads(id),
  nome                text not null,
  contato_principal   text,
  whatsapp            text,
  instagram           text,
  email               text,
  cidade              text,
  estado              char(2),
  segmento            text,
  status              cliente_status not null default 'ativo',
  valor_mensal        numeric(12,2),
  data_inicio         date,
  proxima_renovacao   date,
  observacoes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Fecha a referência circular: um lead pode apontar para o cliente em que
-- se transformou.
alter table leads
  add column if not exists convertido_em_cliente_id uuid references clientes(id);

comment on column leads.convertido_em_cliente_id is
  'Preenchido pela função converter_lead_em_cliente(). O lead NUNCA é '
  'apagado ao converter — fica como registro histórico do funil.';


-- ----------------------------------------------------------------------------
-- LEAD_SERVICOS / CLIENTE_SERVICOS — relação muitos-para-muitos com o
-- catálogo de serviços (um lead/cliente pode ter vários serviços de
-- interesse/contratados; um serviço pode estar em vários leads/clientes).
-- ----------------------------------------------------------------------------

create table if not exists lead_servicos (
  lead_id     uuid not null references leads(id) on delete cascade,
  servico_id  uuid not null references servicos(id) on delete restrict,
  primary key (lead_id, servico_id)
);

create table if not exists cliente_servicos (
  cliente_id  uuid not null references clientes(id) on delete cascade,
  servico_id  uuid not null references servicos(id) on delete restrict,
  primary key (cliente_id, servico_id)
);


-- ----------------------------------------------------------------------------
-- PROPOSTAS — sempre ligada a um lead e/ou a um cliente.
-- Os dois FKs são opcionais individualmente, mas o CHECK garante que pelo
-- menos um esteja preenchido (proposta "solta" não é permitida).
-- ----------------------------------------------------------------------------

create table if not exists propostas (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references leads(id),
  cliente_id   uuid references clientes(id),
  titulo       text not null,
  valor        numeric(12,2) not null,
  status       proposta_status not null default 'rascunho',
  enviada_em   date,
  valida_ate   date,
  observacoes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint propostas_vinculo_check check (lead_id is not null or cliente_id is not null)
);


-- ----------------------------------------------------------------------------
-- FOLLOW_UPS — tarefas comerciais. Ligadas a lead ou a cliente (ex.: um
-- follow-up de renovação de contrato pertence ao cliente, não a um lead).
-- ----------------------------------------------------------------------------

create table if not exists follow_ups (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references leads(id),
  cliente_id   uuid references clientes(id),
  titulo       text not null,
  data_hora    timestamptz not null,
  status       follow_up_status not null default 'pendente',
  observacoes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint follow_ups_vinculo_check check (lead_id is not null or cliente_id is not null)
);


-- ----------------------------------------------------------------------------
-- TIMELINE_EVENTOS — histórico de interações. Diferente de propostas/
-- follow-ups, aqui o CHECK exige EXATAMENTE um dos dois vínculos: um evento
-- de timeline pertence à história de um lead OU de um cliente, nunca dos
-- dois ao mesmo tempo (evita ambiguidade sobre "de quem é esse evento").
-- ----------------------------------------------------------------------------

create table if not exists timeline_eventos (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references leads(id),
  cliente_id    uuid references clientes(id),
  tipo          text not null,
  descricao     text,
  ocorrido_em   timestamptz not null default now(),
  criado_por    uuid references usuarios(id),
  created_at    timestamptz not null default now(),
  constraint timeline_vinculo_check check (
    (lead_id is not null and cliente_id is null) or
    (lead_id is null and cliente_id is not null)
  )
);


-- ----------------------------------------------------------------------------
-- ÍNDICES — nas colunas usadas para filtrar/agrupar no Kanban, follow-ups
-- e telas de detalhe (FKs e colunas de status/data).
-- ----------------------------------------------------------------------------

create index if not exists idx_leads_status              on leads(status);
create index if not exists idx_leads_responsavel          on leads(responsavel_id);
create index if not exists idx_clientes_status            on clientes(status);
create index if not exists idx_clientes_lead_origem       on clientes(lead_origem_id);
create index if not exists idx_propostas_lead             on propostas(lead_id);
create index if not exists idx_propostas_cliente          on propostas(cliente_id);
create index if not exists idx_propostas_status           on propostas(status);
create index if not exists idx_followups_lead             on follow_ups(lead_id);
create index if not exists idx_followups_cliente          on follow_ups(cliente_id);
create index if not exists idx_followups_status_data      on follow_ups(status, data_hora);
create index if not exists idx_timeline_lead              on timeline_eventos(lead_id);
create index if not exists idx_timeline_cliente           on timeline_eventos(cliente_id);
create index if not exists idx_timeline_ocorrido_em       on timeline_eventos(ocorrido_em desc);


-- ----------------------------------------------------------------------------
-- updated_at automático em qualquer UPDATE
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

drop trigger if exists trg_clientes_updated_at on clientes;
create trigger trg_clientes_updated_at before update on clientes
  for each row execute function set_updated_at();

drop trigger if exists trg_propostas_updated_at on propostas;
create trigger trg_propostas_updated_at before update on propostas
  for each row execute function set_updated_at();

drop trigger if exists trg_followups_updated_at on follow_ups;
create trigger trg_followups_updated_at before update on follow_ups
  for each row execute function set_updated_at();


-- ----------------------------------------------------------------------------
-- CONVERSÃO DE LEAD EM CLIENTE
--
-- Centralizada como função no banco (em vez de lógica espalhada no
-- frontend) para garantir que a conversão sempre acontece da mesma forma,
-- não importa se for chamada pela tela do CRM, por uma automação n8n ou
-- pelo SQL Editor.
--
-- O que a função faz:
--   1. Cria a linha em `clientes` a partir dos dados do lead
--   2. Copia os serviços de interesse do lead para os serviços do cliente
--   3. Marca o lead como convertido (convertido_em_cliente_id)
--   4. Registra um evento na timeline do novo cliente
--   5. NÃO apaga o lead — ele continua existindo com status 'fechado',
--      preservado para relatórios de conversão do funil
--
-- É chamável via RPC do Supabase a partir do frontend:
--   supabase.rpc('converter_lead_em_cliente', { p_lead_id: leadId })
-- ----------------------------------------------------------------------------

create or replace function converter_lead_em_cliente(p_lead_id uuid)
returns uuid as $$
declare
  v_lead      leads%rowtype;
  v_cliente_id uuid;
begin
  select * into v_lead from leads where id = p_lead_id;

  if not found then
    raise exception 'Lead % não encontrado', p_lead_id;
  end if;

  if v_lead.convertido_em_cliente_id is not null then
    return v_lead.convertido_em_cliente_id;
  end if;

  insert into clientes (
    lead_origem_id, nome, contato_principal, whatsapp, instagram,
    email, cidade, estado, segmento, valor_mensal, data_inicio, observacoes
  ) values (
    v_lead.id, v_lead.empresa, v_lead.contato, v_lead.whatsapp, v_lead.instagram,
    v_lead.email, v_lead.cidade, v_lead.estado, v_lead.segmento, v_lead.valor_estimado,
    current_date, v_lead.observacoes
  )
  returning id into v_cliente_id;

  insert into cliente_servicos (cliente_id, servico_id)
  select v_cliente_id, servico_id from lead_servicos where lead_id = v_lead.id
  on conflict do nothing;

  update leads set convertido_em_cliente_id = v_cliente_id where id = v_lead.id;

  insert into timeline_eventos (cliente_id, tipo, descricao, criado_por)
  values (
    v_cliente_id,
    'Convertido de lead',
    'Cliente criado a partir do lead "' || v_lead.empresa || '"',
    v_lead.responsavel_id
  );

  return v_cliente_id;
end;
$$ language plpgsql security definer;

comment on function converter_lead_em_cliente is
  'Converte um lead em cliente de forma controlada. Chamar manualmente '
  '(RPC) ou automaticamente via trigger — ver trg_leads_auto_convert, '
  'deixado comentado abaixo até decisão confirmada com o usuário.';


-- ----------------------------------------------------------------------------
-- (OPCIONAL, DESATIVADO) Conversão automática quando um lead vira "fechado"
--
-- Deixado comentado de propósito: decisão de UX pendente de confirmação.
-- Se ativado, todo lead que mudar de status para 'fechado' vira cliente
-- automaticamente, sem clique extra. A alternativa é manter manual — um
-- botão "Converter em cliente" na tela de detalhe do lead, dando controle
-- explícito sobre o momento da conversão (ex.: revisar valor mensal antes).
-- ----------------------------------------------------------------------------

-- create or replace function trg_auto_convert_lead()
-- returns trigger as $$
-- begin
--   if new.status = 'fechado' and (old.status is distinct from 'fechado') then
--     perform converter_lead_em_cliente(new.id);
--   end if;
--   return new;
-- end;
-- $$ language plpgsql;
--
-- create trigger trg_leads_auto_convert after update on leads
--   for each row execute function trg_auto_convert_lead();


-- ----------------------------------------------------------------------------
-- Seed mínimo do catálogo de serviços, refletindo os serviços já usados
-- no protótipo (App.jsx). Pode ser editado livremente depois.
-- ----------------------------------------------------------------------------

insert into servicos (nome) values
  ('Tráfego pago'),
  ('Social media'),
  ('IA para atendimento'),
  ('Automação comercial'),
  ('Automação interna'),
  ('Dashboard sob medida')
on conflict (nome) do nothing;
