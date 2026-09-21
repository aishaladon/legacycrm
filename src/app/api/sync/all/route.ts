import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { errorMessage } from "@/lib/sync/errorMessage";
import { getOwnEmailAliases } from "@/lib/sync/ownEmail";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncGmailInteractions } from "@/lib/integrations/google/gmail";
import { syncCalendarInteractions } from "@/lib/integrations/google/calendar";
import { syncMeetTranscripts } from "@/lib/integrations/google/drive";
import { syncWooCommerceOrders } from "@/lib/integrations/wordpress/woocommerce";
import { syncLearnDashEnrollments } from "@/lib/integrations/wordpress/learndash";
import { syncStripePayments, syncPayPalPayments } from "@/lib/integrations/windsor/payments";

/**
 * Runs every Phase 2 sync in parallel and reports per-source results,
 * rather than failing the whole run on one source's error — a WordPress
 * outage shouldn't block the Gmail sync, and vice versa.
 *
 * Was sequential (one source after another) until this produced a real
 * 504/redirect loop in production: several sources make many individual
 * external API calls each (Gmail up to 100, LearnDash up to 50), and
 * running all seven back-to-back in one request blew past the hosting's
 * reverse-proxy timeout. Running them in parallel instead makes total
 * wall-clock time roughly the slowest single source, not the sum of all
 * seven. Safe to do now that contacts.email and interactions.source_ref
 * both have real unique constraints with a catch-and-retry fallback
 * (migration 0005) — Calendar and Meet-transcript sync write the same
 * source_ref shape, and any source can create the same new contact, so
 * this would have been a real duplicate-row race before that fix.
 */
export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  const ownEmail = process.env.OWNER_EMAIL;
  const ownEmailAliases = getOwnEmailAliases();
  const supabase = createServiceRoleClient();

  const sources: Record<string, () => Promise<unknown>> = {
    gmail: () => {
      if (!ownEmail) throw new Error("OWNER_EMAIL is not configured.");
      return syncGmailInteractions(supabase, { ownEmail, ownEmailAliases });
    },
    calendar: () => {
      if (!ownEmail) throw new Error("OWNER_EMAIL is not configured.");
      return syncCalendarInteractions(supabase, { ownEmail, ownEmailAliases });
    },
    meet: () => {
      if (!ownEmail) throw new Error("OWNER_EMAIL is not configured.");
      return syncMeetTranscripts(supabase, { ownEmail });
    },
    woocommerce: () => syncWooCommerceOrders(supabase, {}),
    learndash: () => syncLearnDashEnrollments(supabase, {}),
    stripe: () => syncStripePayments(supabase),
    paypal: () => syncPayPalPayments(supabase),
  };

  const results: Record<string, { ok: true; data: unknown } | { ok: false; error: string }> = {};

  await Promise.all(
    Object.entries(sources).map(async ([name, run]) => {
      try {
        results[name] = { ok: true, data: await run() };
      } catch (err) {
        results[name] = { ok: false, error: errorMessage(err) };
      }
    }),
  );

  return NextResponse.json(results);
}
