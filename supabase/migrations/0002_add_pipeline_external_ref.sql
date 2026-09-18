-- Lets a transaction-log-style pipeline row (book purchases) be deduped
-- across repeated syncs by the source system's own id (WooCommerce order
-- id). Funnel streams (consulting/retreat/course) don't need this — they
-- dedupe via "find the contact's open row for this stream" instead.
alter table pipeline add column external_ref text;

create unique index pipeline_income_stream_external_ref_key
  on pipeline (income_stream, external_ref)
  where external_ref is not null;
