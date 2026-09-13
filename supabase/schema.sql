-- ============================================================================
-- StatusPulse — schéma complet (PostgreSQL 15+ / Supabase)
--
-- Exécuter une seule fois :  psql "$DATABASE_URL" -f supabase/schema.sql
-- Le fichier est idempotent : il peut être rejoué sans casser l'existant.
--
-- Principe de sécurité : l'application se connecte avec le rôle propriétaire
-- (pooler Supabase, côté serveur uniquement). RLS est activé SANS policy sur
-- toutes les tables : si la clé anon fuite, elle ne lit rien. Le propriétaire
-- bypasse RLS, l'app continue de fonctionner.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
-- Les triggers sont créés sous condition d'absence, jamais par DROP puis
-- CREATE : DROP TRIGGER exige un verrou exclusif sur la table, qu'une base en
-- service peut refuser pendant de longues secondes. Rejouer ce fichier sur une
-- base déjà installée ne doit poser aucun verrou.
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- CATALOGUE DE SERVICES  (= surface SEO programmatique + objets surveillés)
-- ---------------------------------------------------------------------------
create table if not exists services (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,                 -- /status/<slug>
  name                 text not null,
  category             text not null,                        -- /categories/<category>
  description          text,
  homepage             text,
  status_page_url      text not null,
  feed_url             text not null,
  feed_kind            text not null default 'statuspage_v2'
                       check (feed_kind in ('statuspage_v2','atom','rss')),
  logo_domain          text,                                 -- favicon via Google s2
  is_active            boolean not null default true,

  -- État courant (dénormalisé pour servir les pages SEO en 1 requête)
  current_status       text not null default 'unknown'
                       check (current_status in ('operational','degraded','partial_outage',
                                                 'major_outage','maintenance','unknown')),
  current_status_since timestamptz not null default now(),
  last_incident_at     timestamptz,
  incident_count_90d   integer not null default 0,
  uptime_90d           numeric(6,3),

  -- Politesse HTTP + backoff adaptatif (résilience d'ingestion)
  http_etag            text,
  http_last_modified   text,
  consecutive_failures integer not null default 0,
  last_fetched_at      timestamptz,
  last_success_at      timestamptz,
  last_error           text,
  next_fetch_at        timestamptz not null default now(),

  watcher_count        integer not null default 0,           -- preuve sociale + priorisation
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists services_due_idx      on services (next_fetch_at) where is_active;
create index if not exists services_category_idx on services (category, name);
create index if not exists services_status_idx   on services (current_status) where is_active;
create index if not exists services_watchers_idx on services (watcher_count desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'services_updated_at' and not tgisinternal
  ) then
    create trigger services_updated_at before update on services
      for each row execute function set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- INCIDENTS normalisés (toutes sources confondues)
-- ---------------------------------------------------------------------------
create table if not exists incidents (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references services(id) on delete cascade,
  external_id   text not null,                               -- id fournisseur (dédupe)
  title         text not null,
  body          text,
  url           text,
  impact        text not null default 'minor'
                check (impact in ('none','minor','major','critical','maintenance')),
  state         text not null default 'investigating'
                check (state in ('investigating','identified','monitoring','resolved',
                                 'scheduled','completed')),
  is_resolved   boolean not null default false,
  started_at    timestamptz not null,
  resolved_at   timestamptz,
  content_hash  text not null,                               -- détecte les mises à jour
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (service_id, external_id)
);

create index if not exists incidents_service_time_idx on incidents (service_id, started_at desc);
create index if not exists incidents_open_idx         on incidents (started_at desc) where not is_resolved;
create index if not exists incidents_recent_idx       on incidents (started_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'incidents_updated_at' and not tgisinternal
  ) then
    create trigger incidents_updated_at before update on incidents
      for each row execute function set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- UTILISATEURS  (un lead = un user non vérifié : même table, un seul funnel)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id                     uuid primary key default gen_random_uuid(),
  email                  text not null,
  plan                   text not null default 'free' check (plan in ('free','pro','team')),
  plan_status            text not null default 'active'
                         check (plan_status in ('active','trialing','past_due','canceled','incomplete')),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  email_verified         boolean not null default false,
  digest_enabled         boolean not null default true,
  signup_source          text,                               -- 'status_page' | 'pricing' | ...
  signup_service_id      uuid references services(id) on delete set null,
  onboarding_sent_at     timestamptz,
  unsubscribed_at        timestamptz,
  last_seen_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists users_email_key on users (lower(email));
create index if not exists users_plan_idx on users (plan, plan_status);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'users_updated_at' and not tgisinternal
  ) then
    create trigger users_updated_at before update on users
      for each row execute function set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AUTH sans mot de passe : tokens à usage unique + sessions cookie
-- ---------------------------------------------------------------------------
create table if not exists auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,                           -- sha256(token), jamais le token
  purpose    text not null default 'login',
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_tokens_expiry_idx on auth_tokens (expires_at);

create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists sessions_expiry_idx on sessions (expires_at);

-- ---------------------------------------------------------------------------
-- SURVEILLANCE : qui suit quoi, et par quel canal
-- ---------------------------------------------------------------------------
create table if not exists watch_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  min_impact text not null default 'minor' check (min_impact in ('minor','major','critical')),
  created_at timestamptz not null default now(),
  unique (user_id, service_id)
);
create index if not exists watch_items_service_idx on watch_items (service_id);

create table if not exists alert_channels (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  kind            text not null check (kind in ('email','webhook','slack')),
  target          text not null,                             -- email | URL webhook/slack
  is_active       boolean not null default true,
  failure_count   integer not null default 0,
  last_error      text,
  last_success_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, kind, target)
);
create index if not exists alert_channels_user_idx on alert_channels (user_id) where is_active;

-- Compteur de watchers maintenu par trigger (preuve sociale sur les pages SEO)
create or replace function sync_watcher_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update services set watcher_count = watcher_count + 1 where id = new.service_id;
  elsif (tg_op = 'DELETE') then
    update services set watcher_count = greatest(watcher_count - 1, 0) where id = old.service_id;
  end if;
  return null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'watch_items_counter' and not tgisinternal
  ) then
    create trigger watch_items_counter after insert or delete on watch_items
      for each row execute function sync_watcher_count();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- OUTBOX D'ALERTES : découple la détection de l'envoi (retry + idempotence)
-- ---------------------------------------------------------------------------
create table if not exists alert_deliveries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  channel_id   uuid not null references alert_channels(id) on delete cascade,
  incident_id  uuid not null references incidents(id) on delete cascade,
  event_kind   text not null check (event_kind in ('opened','updated','resolved')),
  payload      jsonb not null,
  status       text not null default 'pending'
               check (status in ('pending','sending','sent','failed','dead','skipped')),
  attempts     integer not null default 0,
  scheduled_at timestamptz not null default now(),           -- délai du plan Free
  locked_at    timestamptz,
  sent_at      timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  unique (channel_id, incident_id, event_kind)               -- jamais deux fois la même alerte
);
create index if not exists alert_deliveries_due_idx on alert_deliveries (scheduled_at)
  where status = 'pending';
create index if not exists alert_deliveries_stuck_idx on alert_deliveries (locked_at)
  where status = 'sending';

-- ---------------------------------------------------------------------------
-- AGRÉGATS SEO : disponibilité journalière (alimente graphiques + rich data)
-- ---------------------------------------------------------------------------
create table if not exists service_daily_uptime (
  service_id       uuid not null references services(id) on delete cascade,
  day              date not null,
  downtime_minutes integer not null default 0,
  degraded_minutes integer not null default 0,
  incident_count   integer not null default 0,
  uptime_pct       numeric(6,3) not null default 100,
  primary key (service_id, day)
);
create index if not exists uptime_day_idx on service_daily_uptime (day desc);

-- ---------------------------------------------------------------------------
-- OBSERVABILITÉ : santé des jobs + alertes critiques (dédupliquées)
-- ---------------------------------------------------------------------------
create table if not exists cron_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  stats       jsonb not null default '{}'::jsonb,
  error       text
);
create index if not exists cron_runs_job_idx on cron_runs (job, started_at desc);

create table if not exists ops_events (
  id          uuid primary key default gen_random_uuid(),
  level       text not null check (level in ('info','warn','critical')),
  source      text not null,
  dedupe_key  text not null unique,                          -- inclut un bucket horaire
  message     text not null,
  context     jsonb not null default '{}'::jsonb,
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists ops_events_created_idx on ops_events (created_at desc);

-- Idempotence des webhooks Stripe (rejeux, doublons, retries Stripe)
create table if not exists stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now(),
  payload     jsonb
);

-- ---------------------------------------------------------------------------
-- Échelle de gravité : comparable en SQL (filtrage des alertes par seuil)
-- ---------------------------------------------------------------------------
create or replace function impact_rank(impact text) returns integer
language sql immutable as $$
  select case impact
           when 'critical' then 4
           when 'major'    then 3
           when 'minor'    then 2
           when 'maintenance' then 1
           else 0
         end
$$;

-- ---------------------------------------------------------------------------
-- FONCTIONS DE FILE : verrouillage concurrent-safe (SKIP LOCKED)
-- Plusieurs invocations de cron peuvent se chevaucher sans doublon ni blocage.
-- ---------------------------------------------------------------------------
create or replace function claim_services_for_fetch(batch_size integer)
returns setof services language plpgsql as $$
begin
  return query
  with picked as (
    select id from services
    where is_active and next_fetch_at <= now()
    order by watcher_count desc, next_fetch_at asc
    limit batch_size
    for update skip locked
  )
  update services s
     set next_fetch_at = now() + interval '4 minutes',       -- lease anti-doublon
         last_fetched_at = now()
    from picked p
   where s.id = p.id
  returning s.*;
end $$;

create or replace function claim_alert_deliveries(batch_size integer)
returns setof alert_deliveries language plpgsql as $$
begin
  return query
  with picked as (
    select id from alert_deliveries
    where status = 'pending' and scheduled_at <= now()
    order by scheduled_at asc
    limit batch_size
    for update skip locked
  )
  update alert_deliveries d
     set status = 'sending', locked_at = now(), attempts = d.attempts + 1
    from picked p
   where d.id = p.id
  returning d.*;
end $$;

-- ---------------------------------------------------------------------------
-- RLS : deny-all par défaut (l'app passe par le rôle propriétaire)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['services','incidents','users','auth_tokens','sessions',
                           'watch_items','alert_channels','alert_deliveries',
                           'service_daily_uptime','cron_runs','ops_events','stripe_events']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
