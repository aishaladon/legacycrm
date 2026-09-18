import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { errorMessage } from "@/lib/sync/errorMessage";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncGmailInteractions } from "@/lib/integrations/google/gmail";
import { syncCalendarInteractions } from "@/lib/integrations/google/calendar";
import { syncMeetTranscripts } from "@/lib/integrations/google/drive";
import { syncWooCommerceOrders } from "@/lib/integrations/wordpress/woocommerce";
import { syncLearnDashEnrollments } from "@/lib/integrations/wordpress/learndash";

/**
 * Runs every Phase 2 sync in sequence and reports per-source results,
 * rather than failing the whole run on one source's error — a WordPress
 * outage shouldn't block the Gmail sync, and vice versa.
 */
export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  const ownEmail = process.env.OWNER_EMAIL;
  const supabase = createServiceRoleClient();

  const sources: Record<string, () => Promise<unknown>> = {
    gmail: () => {
      if (!ownEmail) throw new Error("OWNER_EMAIL is not configured.");
      return syncGmailInteractions(supabase, { ownEmail });
    },
    calendar: () => {
      if (!ownEmail) throw new Error("OWNER_EMAIL is not configured.");
      return syncCalendarInteractions(supabase, { ownEmail });
    },
    meet: () => {
      if (!ownEmail) throw new Error("OWNER_EMAIL is not configured.");
      return syncMeetTranscripts(supabase, { ownEmail });
    },
    woocommerce: () => syncWooCommerceOrders(supabase, {}),
    learndash: () => syncLearnDashEnrollments(supabase, {}),
  };

  const results: Record<string, { ok: true; data: unknown } | { ok: false; error: string }> = {};

  for (const [name, run] of Object.entries(sources)) {
    try {
      results[name] = { ok: true, data: await run() };
    } catch (err) {
      results[name] = { ok: false, error: errorMessage(err) };
    }
  }

  return NextResponse.json(results);
}
