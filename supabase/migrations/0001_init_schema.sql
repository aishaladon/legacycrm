-- Legacy CRM — initial schema
-- Six core tables per Architecture & Build Plan (2026-09-17):
-- contacts, interactions, pipeline, projects_tasks, payments, campaigns
-- Single-tenant (one user: Aisha Abdul Rahman). RLS is enabled on every table
-- with no policies granted to anon/authenticated — all access goes through
-- the Next.js backend using the Supabase service-role key.

create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────────────────

create type income_stream as enum ('consulting', 'retreat', 'course', 'book');

create type interaction_type as enum ('email', 'call', 'meeting', 'whatsapp', 'form', 'other');

create type payment_source as enum ('stripe', 'paypal', 'novo');

create type task_status as enum ('todo', 'in_progress', 'done');

create type campaign_status as enum ('draft', 'scheduled', 'sent');

-- ── contacts ─────────────────────────────────────────────────────────────

create table contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  tags text[] not null default '{}',
  lead_source_platform text,
  lead_source_post text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_email_idx on contacts (email);
create index contacts_lead_source_platform_idx on contacts (lead_source_platform);

-- ── interactions ─────────────────────────────────────────────────────────
-- Every email, call, meeting, and WhatsApp touch. Populated from Gmail
-- threads and Google Meet transcripts (auto-saved to Drive) in Phase 2.

create table interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  type interaction_type not null,
  occurred_at timestamptz not null default now(),
  subject text,
  summary text,
  transcript text,
  transcript_drive_url text,
  source_ref text,
  created_at timestamptz not null default now()
);

create index interactions_contact_id_idx on interactions (contact_id);
create index interactions_occurred_at_idx on interactions (occurred_at);

-- ── pipeline ─────────────────────────────────────────────────────────────
-- One row per income-stream engagement. Stage is validated per stream
-- against the confirmed stage lists rather than a single shared enum,
-- since each income stream has its own funnel.

create table pipeline (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  income_stream income_stream not null,
  stage text not null,
  value numeric(12, 2),
  expected_date date,
  actual_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_stage_valid_for_stream check (
    (income_stream = 'consulting' and stage in ('Lead', 'Discovery Call booked', 'Active', 'Past'))
    or (income_stream = 'retreat' and stage in ('Inquiry', 'Deposit paid', 'Booked', 'Attended'))
    or (income_stream = 'course' and stage in ('Registered', 'Enrolled', 'Completed'))
    or (income_stream = 'book' and stage in ('Purchased'))
  )
);

create index pipeline_contact_id_idx on pipeline (contact_id);
create index pipeline_income_stream_stage_idx on pipeline (income_stream, stage);

-- ── projects_tasks ───────────────────────────────────────────────────────
-- The Notion replacement: projects, tasks, status, notes.

create table projects_tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts (id) on delete set null,
  title text not null,
  notes text,
  status task_status not null default 'todo',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_tasks_contact_id_idx on projects_tasks (contact_id);
create index projects_tasks_status_idx on projects_tasks (status);

-- ── payments ─────────────────────────────────────────────────────────────
-- Stripe/PayPal (via Windsor.ai read access) and Novo (manual monthly CSV
-- import), tied to a contact.

create table payments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  product_service text,
  source payment_source not null,
  external_id text,
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index payments_contact_id_idx on payments (contact_id);
create index payments_source_idx on payments (source);
create unique index payments_source_external_id_key
  on payments (source, external_id)
  where external_id is not null;

-- ── campaigns / campaign_sends ───────────────────────────────────────────
-- campaigns: WhatsApp templates (Kora Line community model).
-- campaign_sends: each send to a contact, plus the social post/platform
-- that drove that contact in — the join the build plan describes as
-- "campaigns ... plus the social post/platform that drove each contact in".

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_body text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  message_body text,
  social_platform text,
  social_post_url text,
  status campaign_status not null default 'draft',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index campaign_sends_campaign_id_idx on campaign_sends (campaign_id);
create index campaign_sends_contact_id_idx on campaign_sends (contact_id);

-- ── updated_at triggers ──────────────────────────────────────────────────

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_set_updated_at before update on contacts
  for each row execute function set_updated_at();
create trigger pipeline_set_updated_at before update on pipeline
  for each row execute function set_updated_at();
create trigger projects_tasks_set_updated_at before update on projects_tasks
  for each row execute function set_updated_at();
create trigger campaigns_set_updated_at before update on campaigns
  for each row execute function set_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────
-- Single internal user, accessed only through the Next.js backend via the
-- service-role key (which bypasses RLS). Enable RLS with no grants so the
-- anon/publishable key has no table access if ever exposed client-side.

alter table contacts enable row level security;
alter table interactions enable row level security;
alter table pipeline enable row level security;
alter table projects_tasks enable row level security;
alter table payments enable row level security;
alter table campaigns enable row level security;
alter table campaign_sends enable row level security;
