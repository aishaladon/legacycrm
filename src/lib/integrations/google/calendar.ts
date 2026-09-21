import "server-only";

import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { findOrCreateContactByEmail } from "@/lib/crm/contacts";
import { upsertInteractionBySourceRef } from "@/lib/crm/interactions";
import { getGoogleAuthClient } from "./auth";
import { isLikelyAutomatedSender } from "./contactFilters";

type Supabase = SupabaseClient<Database>;

export type CalendarSyncResult = { eventsProcessed: number; interactionsUpserted: number };

/**
 * Syncs Calendar events (consultation bookings, client meetings) into
 * `interactions`, logged against every non-self, non-bot attendee.
 * Consultation booking → pipeline stage changes and the WhatsApp welcome
 * trigger are the automation chain (Phase 5) — this just logs the
 * meeting itself.
 *
 * ownEmailAliases matters here too, not just ownEmail: real production
 * data showed one of Aisha's own other addresses (emailme@aishaladon.com)
 * got synced as if it were a separate contact, because it was excluded
 * from Gmail's filter but not Calendar's — each sync needs the same full
 * list of "this is actually me" addresses.
 */
export async function syncCalendarInteractions(
  supabase: Supabase,
  opts: {
    sinceDays?: number;
    aheadDays?: number;
    ownEmail: string;
    maxEvents?: number;
    ownEmailAliases?: string[];
  },
): Promise<CalendarSyncResult> {
  const sinceDays = opts.sinceDays ?? 30;
  const aheadDays = opts.aheadDays ?? 14;
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  const ownEmails = new Set(
    [opts.ownEmail, ...(opts.ownEmailAliases ?? [])].map((e) => e.toLowerCase()),
  );

  const timeMin = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + aheadDays * 24 * 60 * 60 * 1000).toISOString();

  const list = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: opts.maxEvents ?? 100,
  });

  const events = list.data.items ?? [];
  let interactionsUpserted = 0;

  for (const event of events) {
    if (!event.id || event.status === "cancelled") continue;

    const attendees = (event.attendees ?? []).filter(
      (a) =>
        a.email &&
        !ownEmails.has(a.email.toLowerCase()) &&
        !a.resource &&
        !isLikelyAutomatedSender(a.email),
    );
    if (attendees.length === 0) continue;

    const occurredAt = event.start?.dateTime ?? event.start?.date ?? new Date().toISOString();

    for (const attendee of attendees) {
      if (!attendee.email) continue;
      const contact = await findOrCreateContactByEmail(supabase, {
        email: attendee.email,
        fullName: attendee.displayName ?? undefined,
      });

      await upsertInteractionBySourceRef(supabase, {
        contact_id: contact.id,
        type: "meeting",
        subject: event.summary ?? null,
        summary: event.description ?? null,
        occurred_at: new Date(occurredAt).toISOString(),
        source_ref: `gcal:${event.id}:${attendee.email.toLowerCase()}`,
      });
      interactionsUpserted += 1;
    }
  }

  return { eventsProcessed: events.length, interactionsUpserted };
}
