# Legacy CRM

Internal CRM for Aisha Abdul Rahman — one contact record per person across
four income streams (Book, Consulting, Retreat, Course), replacing Notion and
GoHighLevel. See the [Architecture & Build Plan](#build-plan) this repo is
built against for the full spec.

Stack: Next.js (App Router, TypeScript, Tailwind) + Supabase (Postgres).
Deployed as a Node app on Hostinger (Standard plan) at `crm.aishaladon.com`.
Credentials (Supabase service-role key, WordPress application password,
eventually a WhatsApp API key) live server-side only — never in the browser.

## Status: Phase 3 — Payments

- [x] **Phase 1** — Next.js app scaffolded; Supabase schema migrated
      (`contacts`, `interactions`, `pipeline`, `projects_tasks`, `payments`,
      `campaigns` + `campaign_sends`) to project `legacy-crm`
      (`aherxqnaufiaotspzrbn`), RLS enabled everywhere, generated types,
      Supabase clients, `/` dashboard shell
- [x] **Phase 2** — sync modules pulling Gmail threads, Calendar events,
      Meet transcripts, WooCommerce orders, and LearnDash enrollments into
      the database (`src/lib/integrations/`), exposed as protected
      `/api/sync/*` routes (`src/app/api/sync/`) — see
      [Integrations](#integrations) below. **Confirmed live** on
      `crm.aishaladon.com`.
- [x] **Phase 3** — Stripe/PayPal payments sync via Windsor.ai
      (`src/lib/integrations/windsor/`) and a Novo CSV importer
      (`src/lib/import/novo.ts`, upload UI at `/import/novo`). PayPal
      verified against real transaction data; Stripe isn't in use yet
      (empty account, schema-verified only) — will start working
      automatically once real transactions exist. Novo's column-detection
      logic isn't yet verified against a real export.
- [ ] Phase 4 — Bitly attribution wiring
- [ ] Phase 5 — Automation chain (contact creation → WhatsApp welcome) +
      native "Get in touch" form + one-time Airtable import
- [ ] Phase 6 — Dashboard reports/segments

## Deployment

Live at `crm.aishaladon.com`, hosted on Hostinger (Standard plan, Node.js
App feature). Two things this host required that a typical Next.js
deploy doesn't:

- **`next.config.js`, not `.ts`** — the host's glibc predates what
  Next.js 16's native config-compiler binary needs, so a `.ts` config
  (which gets compiled through that binary) fails to load. A plain JS
  config needs no compile step.
- **`next build --webpack`** (see `package.json` scripts) — Turbopack,
  Next 16's default bundler, also needs a native binary this host can't
  load; Next's own docs confirm WASM fallback doesn't support Turbopack.
  Webpack does the same job without a native dependency.
- **Tailwind v3, not v4** — v4's Rust engine (`@tailwindcss/oxide`,
  `lightningcss`) hit the identical native-binary problem during CSS
  processing. Downgraded to v3 (pure JS/PostCSS) to remove that whole
  class of failure rather than patching around it.

If redeploying on different hosting without this glibc constraint, all
three are safe to revert, but there's no real reason to.

## Schema

Six tables, one contact record linking everything:

| Table | Holds | Links |
| --- | --- | --- |
| `contacts` | Name, contact info, tags, lead source (platform + post) | core |
| `interactions` | Every email/call/meeting/WhatsApp touch, transcripts | → `contacts` |
| `pipeline` | One row per income-stream engagement + stage | → `contacts` |
| `projects_tasks` | Notion replacement: projects, tasks, status, notes | → `contacts` (optional) |
| `payments` | Stripe/PayPal/Novo transactions | → `contacts` (nullable — Novo bank rows land unattributed until matched) |
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
by the source system's own id), `0003_payments_contact_id_nullable.sql`
(Novo bank rows have no email to resolve to a contact at import time).

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
| Stripe (via Windsor.ai) | `.../windsor/payments.ts` | `payments` (source `stripe`, `contact_id` nullable) | **Verified against a real charge.** The connector's "transaction" table is Stripe Balance Transactions, not Charges — `status` means settlement state ("available"/"pending"), never "succeeded", so the original filter could never match real data. Now filters on `reporting_category === "charge"`. Not every charge carries a resolvable email (confirmed null on a real charge), so `contact_id` is nullable here too, same as Novo |
| PayPal (via Windsor.ai) | `.../windsor/payments.ts` | `payments` (source `paypal`) | **Confirmed live** on `crm.aishaladon.com` against real transaction history. PayPal's Transaction Search API returns every ledger event (withdrawals, fees, outgoing purchases too) — filtered to `amount > 0 AND payer email present` to isolate real incoming customer payments |
| Novo (manual CSV) | `src/lib/import/novo.ts` | `payments` (source `novo`, `contact_id: null`) | Upload at `/import/novo`. **Verified against a real Novo "Activities" export.** Only imports rows Novo tags `Category: Revenue`, and skips anything with "paypal" in the description — PayPal-to-Novo transfers are already recorded once by the PayPal sync, so importing the Novo-side deposit too would double-count that revenue (confirmed: every `PAYPAL TRANSFER` row's amount exactly matched a real PayPal withdrawal). Deduped on a hash of (date, description, amount) since bank exports have no stable transaction id. Zelle deposits haven't appeared in a sample export yet, so their description format is still unverified — flag if one imports incorrectly |

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
   between the deployed env and whatever calls `/api/sync/*` and
   `/api/import/*`.
4. **Windsor.ai** — connect Stripe and PayPal (slug `paypal_transaction`)
   once each at `https://onboard.windsor.ai/connect?connector=<slug>`,
   entering real API credentials directly on Windsor's form, never in
   chat or this repo. Then set `WINDSOR_API_KEY` from your Windsor.ai
   account settings — this is the deployed app's own key, separate from
   any claude.ai connector.

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
