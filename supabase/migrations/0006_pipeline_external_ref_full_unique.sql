-- Same class of bug already fixed on payments in migration 0004: a
-- partial unique index (where external_ref is not null) doesn't satisfy
-- PostgREST's ON CONFLICT (income_stream, external_ref) upsert target —
-- Postgres requires an exact, non-partial unique constraint to match a
-- plain ON CONFLICT column list. upsertBookPurchaseRow (WooCommerce book
-- purchases) always sets external_ref to a real value, so a non-partial
-- index loses nothing. Found by code review before a real WooCommerce
-- order ever hit this path - the store has had zero orders through every
-- test so far, so this would have failed silently until then.
drop index pipeline_income_stream_external_ref_key;

create unique index pipeline_income_stream_external_ref_key
  on pipeline (income_stream, external_ref);
