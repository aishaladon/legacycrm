import "server-only";

/**
 * Every address that counts as "this is Aisha, not a contact" — used by
 * Gmail and Calendar sync so neither ever creates a contact for her own
 * mailboxes. OWNER_EMAIL is the primary; OWNER_EMAIL_ALIASES (comma-
 * separated) covers the rest (her signature line uses
 * emailme@aishaladon.com in addition to OWNER_EMAIL) without needing a
 * code change to add more later.
 */
export function getOwnEmailAliases(): string[] {
  return (process.env.OWNER_EMAIL_ALIASES ?? "emailme@aishaladon.com")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}
