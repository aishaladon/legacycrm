import "server-only";

/**
 * Shared by Gmail and Calendar sync so both apply the identical rule for
 * "is this actually a person worth tracking as a CRM contact." Built from
 * real production data: 68 synced contacts were inspected and roughly 67
 * of them were not real leads — automated notifications, newsletters,
 * spam, and meeting-notetaker bots that got auto-added as attendees.
 *
 * This is a defensive pattern match, not a full classifier — it will not
 * catch spam using a plausible human name on an unfamiliar domain, and it
 * intentionally leaves ambiguous local parts like "info@"/"contact@"
 * alone since those are sometimes a real small business's only address.
 */
const AUTOMATED_LOCAL_PART =
  /(^|[.\-_])(no-?reply|do-?not-?reply|notifications?|notify|alerts?|newsletters?|digest|mailer|bounce|postmaster|updates?|marketing|unsubscribe)([.\-_]|\d*$)/i;

const BULK_MAIL_DOMAIN =
  /(^|\.)(substack\.com|beehiiv\.com|aliexpress\.com|ccsend\.com|mn\.co|constantcontact\.com|mailchimp\.com|sendgrid\.net|mailgun\.org)$/i;

/** Meeting-notetaker/assistant bots that get auto-added as calendar attendees. */
const MEETING_BOT_DOMAIN = /(^|\.)(fireflies\.ai|read\.ai|otter\.ai|fathom\.video|avoma\.com|gong\.io|chorus\.ai)$/i;

export function isLikelyAutomatedSender(email: string): boolean {
  const [localPart, domain] = email.toLowerCase().split("@");
  if (!domain) return false;
  return (
    AUTOMATED_LOCAL_PART.test(localPart ?? "") ||
    BULK_MAIL_DOMAIN.test(domain) ||
    MEETING_BOT_DOMAIN.test(domain)
  );
}
