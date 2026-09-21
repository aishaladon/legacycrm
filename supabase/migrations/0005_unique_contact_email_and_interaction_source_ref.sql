-- findOrCreateContactByEmail and upsertInteractionBySourceRef both do a
-- check-then-insert (select, then insert if not found) rather than a true
-- atomic upsert, and neither contacts.email nor interactions.source_ref
-- had a unique constraint backing that check. Two syncs racing to create
-- the same contact (e.g. Gmail and Calendar sync both processing the same
-- new client at once) could create duplicate contact rows, silently
-- breaking the "one contact record per person" guarantee the whole schema
-- is built around. Same risk for interactions on source_ref.
--
-- contacts.email: every current insert path always provides a real,
-- lowercased email (see findOrCreateContactByEmail), so a non-partial
-- unique index is safe. interactions.source_ref is nullable in principle,
-- so this stays partial — that's fine here since the application code
-- catches a unique-violation on insert and falls back to a lookup, rather
-- than relying on ON CONFLICT (partial indexes don't satisfy a plain
-- ON CONFLICT target — the same class of bug already fixed on payments
-- in migration 0004).
create unique index contacts_email_key on contacts (email);
create unique index interactions_source_ref_key
  on interactions (source_ref)
  where source_ref is not null;
