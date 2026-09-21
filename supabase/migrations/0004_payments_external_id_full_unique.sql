-- The partial unique index (`where external_id is not null`) doesn't
-- satisfy PostgREST's ON CONFLICT (source, external_id) upsert target —
-- Postgres requires an exact, non-partial unique constraint to match a
-- plain ON CONFLICT column list. Every writer (stripe, paypal, novo)
-- always sets external_id to a real value, so a non-partial index loses
-- nothing; NULLs are still treated as distinct for uniqueness either way.
drop index payments_source_external_id_key;

create unique index payments_source_external_id_key
  on payments (source, external_id);
