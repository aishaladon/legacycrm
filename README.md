# Legacy CRM

Internal CRM for Aisha Abdul Rahman — one contact record per person across
four income streams (Book, Consulting, Retreat, Course), replacing Notion and
GoHighLevel. See the [Architecture & Build Plan](#build-plan) this repo is
built against for the full spec.

Stack: Next.js (App Router, TypeScript, Tailwind) + Supabase (Postgres).
Deployed as a Node app on Hostinger (Standard plan) at `crm.aishaladon.com`.
Credentials (Supabase service-role key, WordPress application password,
eventually a WhatsApp API key) live server-side only — never in the browser.

## Status: Phase 2 — Integration modules

- [x] **Phase 1** — Next.js app scaffolded; Supabase schema migrated
      (`contacts`, `interactions`, `pipeline`, `projects_tasks`, `payments`,
      `campaigns` + `campaign_sends`) to project `legacy-crm`
      (`aherxqnaufiaotspzrbn`), RLS enabled everywhere, generated types,
      Supabase clients, `/` dashboard shell
- [x] **Phase 2** — sync modules pulling Gmail threads, Calendar events,
      Meet transcripts, WooCommerce orders, and LearnDash enrollments into
      the database (`src/lib/integrations/`), exposed as protected
      `/api/sync/*` routes (`src/app/api/sync/`) — see
      [Integrations](#integrations) below. **Not yet live**: needs Google
      OAuth credentials and the WordPress application password set as env
      vars before it can run against real data.
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

Migration source: `supabase/migrations/0001_init_schema.sql`,
`0002_add_pipeline_external_ref.sql` (adds `pipeline.external_ref` so a
transaction-log row, like a book purchase, can dedupe against repeat syncs
by the source system's own id).

## Integrations

Every integration resolves the other party to a `contacts` row by email
(`src/lib/crm/contacts.ts`) before writing — one contact record stays the
hub no matter which source touched it first.

| Source | Module | Writes to | Notes |
| --- | --- | --- | --- |
| Gmail | `src/lib/integrations/google/gmail.ts` | `interactions` (type `email`) | Excludes Promotions/Social; deduped on Gmail thread id |
| Google Calendar | `.../google/calendar.ts` | `interactions` (type `meeting`) | Logs every non-self attendee; one row per attendee |
| Google Meet transcripts | `.../google/drive.ts` | `interactions.transcript` | Matches a Meet event to the transcript Doc Drive saves afterward by time proximity, then enriches the same interaction row Calendar sync creates — best-effort, tighten once real transcripts exist |
| WooCommerce orders | `.../wordpress/woocommerce.ts` | `pipeline` (book stream, `Purchased`) | One row per paid order — a transaction log, not a funnel, per the build plan; deduped on WooCommerce order id |
| LearnDash enrollments | `.../wordpress/learndash.ts` | `pipeline` (course stream) | Confirmed against the live site's `ldlms/v2` namespace: no bulk "enrolled users" endpoint exists, so this pages through WordPress users and checks each one's course-progress — see the code comment for the scale caveat |

Each has a protected route under `src/app/api/sync/<source>/route.ts`
(`POST`, requires `Authorization: Bearer <SYNC_SECRET>`), plus
`/api/sync/all` to run every source in one call. These are meant to be
called manually for now or wired to a scheduled job later — Phase 5 is
where the automation chain (webhook/polling triggers) gets built.

**Before this can run against real data:**

1. **WordPress application password** — generate in wp-admin (Users >
   Profile > Application Passwords) for an admin account, set
   `WORDPRESS_APP_USERNAME` / `WORDPRESS_APP_PASSWORD`.
2. **Google OAuth credentials** — see
   [`docs/google-oauth-setup.md`](docs/google-oauth-setup.md) for the
   step-by-step (no coding required, ~10 minutes).
3. **`SYNC_SECRET`** — any random string (`openssl rand -hex 32`), matched
   between the deployed env and whatever calls `/api/sync/*`.

The "Get in touch" Google Form/Sheet mentioned in the build plan wasn't
found under aishaladon@gmail.com's Drive during setup — worth confirming
its owner/location before Phase 5 (it's being replaced by a native form
there anyway, so it only matters for the historical import).

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
