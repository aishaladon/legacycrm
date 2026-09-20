-- Novo transactions come from a bank CSV, not a system with contact
-- emails — there's no reliable identity to resolve them to a contact_id
-- at import time. Make it nullable so they can land unattributed and be
-- matched to a contact later (dashboard reconciliation, Phase 6), rather
-- than forcing a fake or wrong match at import time.
alter table payments alter column contact_id drop not null;
