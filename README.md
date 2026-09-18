# Legacy CRM

Internal CRM for Aisha Abdul Rahman — one contact record per person across
four income streams (Book, Consulting, Retreat, Course), replacing Notion and
GoHighLevel. See the [Architecture & Build Plan](#build-plan) this repo is
built against for the full spec.

Stack: Next.js (App Router, TypeScript, Tailwind) + Supabase (Postgres).
Deployed as a Node app on Hostinger (Standard plan) at `crm.aishaladon.com`.
Credentials (Supabase service-role key, WordPress application password,
eventually a WhatsApp API key) live server-side only — never in the browser.

## Status: Phase 1 — Repo + schema

- [x] Next.js + TypeScript + Tailwind app scaffolded
- [x] Supabase schema migrated (`contacts`, `interactions`, `pipeline`,
      `projects_tasks`, `payments`, `campaigns` + `campaign_sends`) to
      project `legacy-crm` (`aherxqnaufiaotspzrbn`), with RLS enabled on
      every table
- [x] Generated TypeScript types from the live schema
      (`src/lib/types/database.ts`)
- [x] Supabase client libs (`src/lib/supabase/{client,server}.ts`) + `/`
      dashboard shell that confirms the DB connection by reading table counts
- [ ] Phase 2 — Gmail / Calendar / Meet transcripts / WordPress integration
      modules
- [ ] Phase 3 — Stripe/PayPal (via Windsor.ai) + Novo CSV import
- [ ] Phase 4 — Bitly attribution wiring
- [ ] Phase 5 — Automation chain (contact creation → WhatsApp welcome) +
      native "Get in touch" form + one-time Airtable import
- [ ] Phase 6 — Dashboard reports/segments

## Schema

Six tables, one contact record linking everything:

| Table | Holds | Links |
| --- | --- | --- |
| `contacts` | Name, contact info, tags, lead source (platform + post) | core |
| `interactions` | Every email/call/meeting/WhatsApp touch, transcripts | → `contacts` |
| `pipeline` | One row per income-stream engagement + stage | → `contacts` |
| `projects_tasks` | Notion replacement: projects, tasks, status, notes | → `contacts` (optional) |
| `payments` | Stripe/PayPal/Novo transactions | → `contacts` |
| `campaigns` / `campaign_sends` | WhatsApp templates and sends, plus the post/platform that drove each contact in | → `contacts` |

Pipeline `stage` is validated per income stream via a check constraint:

| Income stream | Stages |
| --- | --- |
| Consulting | Lead → Discovery Call booked → Active → Past |
| Retreat | Inquiry → Deposit paid → Booked → Attended |
| Course | Registered → Enrolled → Completed |
| Book | Purchased |

Migration source: `supabase/migrations/0001_init_schema.sql`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev
```

Required env vars (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public,
  safe for the browser.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-only. Pull the
  service-role secret from the
  [Supabase dashboard](https://supabase.com/dashboard/project/aherxqnaufiaotspzrbn/settings/api) —
  it's never committed or shared in chat.

Without the service-role key set, `/` still loads and reports the missing
connection instead of failing the build (see `src/app/page.tsx`).

## Regenerating types after a schema change

```bash
supabase gen types typescript --project-id aherxqnaufiaotspzrbn > src/lib/types/database.ts
```

(Or use the `generate_typescript_types` Supabase MCP tool from an agent
session with access to this project.)

## Build plan

This repo is built against `Legacy CRM — Architecture & Build Plan`
(2026-09-17). Key decisions baked into Phase 1:

- One person, four income streams, no business-entity split.
- One `contacts` table; stage tracking lives on `pipeline` rows, not on the
  contact directly.
- Payments: Windsor.ai read access for Stripe/PayPal (Phase 3); Novo via
  manual monthly CSV import.
- WhatsApp sending stays manual for now (Kora Line community model);
  automation comes later.
- Hosting: Node app on Hostinger Standard at `crm.aishaladon.com`.

## Repo

https://github.com/aishaladon/legacycrm
