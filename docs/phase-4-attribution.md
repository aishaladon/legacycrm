# Phase 4 — Attribution (UTM tags + Bitly)

The original Architecture & Build Plan document (uploaded once, at the very
start of this project) referenced "Bitly attribution wiring" as Phase 4 but
was never saved into this repo — only referenced from chat. Its exact
original scope is unrecoverable. This doc reconstructs the plan from a
2026-09-21 conversation and is the real spec going forward. **Any future
planning document must be saved here immediately, not left in chat memory.**

## Goal

Know which specific marketing effort (platform, post, or campaign) actually
turned into a real contact or paying customer — not just which posts get
clicks/impressions. This is the same thing GoHighLevel did for Aisha before
this CRM replaced it.

## The mechanism: UTM tags, not Bitly links

The real attribution mechanism is UTM query parameters
(`utm_source`, `utm_medium`, `utm_campaign`, optionally `utm_content`)
appended to any link — not Bitly itself. This matters because of a real
platform constraint: Instagram and TikTok don't render links as clickable
inside post captions at all. Only the bio link and the Story "link sticker"
are clickable there. YouTube descriptions, Facebook posts, LinkedIn posts,
blog posts, and email all do support per-post clickable links.

UTM tags work everywhere a link is clickable at all, since they're just
text added to the URL — no per-post short link is required for them to
work. Bitly becomes an optional layer on top: shortening a UTM-tagged URL
for a cleaner share, plus Bitly's own click-count analytics as a bonus
signal. The actual contact-level attribution comes from capturing the UTM
tags, not from Bitly's click tracking.

## How it connects to what's already built

`contacts.lead_source_platform` and `contacts.lead_source_post` already
exist in the schema (`0001_init_schema.sql`) and are set only once, at
contact creation (`findOrCreateContactByEmail` in `src/lib/crm/contacts.ts`)
— currently always empty because nothing populates them.

The missing piece: capturing UTM tags from the URL when someone lands on
the site, carrying them through to the moment they actually convert (fill
a form, buy something), and passing them into contact creation so they
land in those two fields.

That capture point is the native "Get in touch" form — which is Phase 5,
not a separate later phase. **Phase 4 and Phase 5 are one connected piece
of work**, not sequential: there's no attribution to wire until there's a
form to capture it at.

## Practical link strategy by platform

- **Instagram / TikTok bio link:** one landing page with a button per
  offer (Book, Consulting, Retreat, Course, Get in Touch). Each button
  carries its own UTM tags (and can be Bitly-shortened) — gives
  "which offer," not "which specific post."
- **Instagram / TikTok Stories:** the link sticker carries its own
  distinct trackable link — full per-Story attribution is possible.
- **YouTube, Facebook, LinkedIn, blog, email:** full per-post UTM-tagged
  (optionally Bitly-shortened) links work normally.

## Open questions / not yet decided

- Whether to use Bitly's own custom domain for shortened links, or Bitly's
  default `bit.ly` domain.
- Exact UTM tagging convention (naming for `utm_campaign` per post/stream).
- Whether Bitly click analytics get pulled into the CRM at all (e.g. via
  the Windsor.ai Bitly connector, if one exists) or stay purely inside
  Bitly's own dashboard as a secondary signal, separate from the
  contact-level attribution described above.

## Credentials

Bitly is connected via the claude.ai MCP connector (account: "Love
Changing The World LLC", `aisha@lovechangingtheworld.org`) for use in this
chat session only — same as Windsor.ai, this does not give the deployed
app access. The deployed app will need its own Bitly **Generic Access
Token** (from bitly.com/settings/api), set as an env var, once Phase 4/5
implementation actually begins.
