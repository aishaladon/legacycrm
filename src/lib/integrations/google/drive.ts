import "server-only";

import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { findOrCreateContactByEmail } from "@/lib/crm/contacts";
import { upsertInteractionBySourceRef } from "@/lib/crm/interactions";
import { getGoogleAuthClient } from "./auth";

type Supabase = SupabaseClient<Database>;

export type MeetTranscriptSyncResult = {
  meetEventsChecked: number;
  transcriptsMatched: number;
  interactionsUpserted: number;
};

/**
 * Meet transcripts (Docs Meet auto-saves to Drive) don't carry attendee
 * emails, so they can't be attributed to a contact on their own. This finds
 * past Calendar events that were actual Meet calls, matches each to the
 * transcript Doc Drive created closest afterward, and attaches the
 * transcript to the same interaction row the calendar sync creates
 * (`gcal:{eventId}:{attendeeEmail}`) rather than a new orphaned entry.
 *
 * Best-effort matching by time proximity — tighten if it misattributes
 * once real transcripts exist.
 */
export async function syncMeetTranscripts(
  supabase: Supabase,
  opts: { sinceDays?: number; ownEmail: string; maxEvents?: number },
): Promise<MeetTranscriptSyncResult> {
  const sinceDays = opts.sinceDays ?? 14;
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const drive = google.drive({ version: "v3", auth });

  const timeMin = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date().toISOString();

  const eventsList = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: opts.maxEvents ?? 50,
  });

  const meetEvents = (eventsList.data.items ?? []).filter(
    (e) => e.status !== "cancelled" && (e.hangoutLink || e.conferenceData?.conferenceId),
  );

  let transcriptsMatched = 0;
  let interactionsUpserted = 0;

  for (const event of meetEvents) {
    if (!event.id || !event.end?.dateTime) continue;

    const endTime = new Date(event.end.dateTime);
    const searchWindowEnd = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);

    const filesList = await drive.files.list({
      q: [
        "mimeType = 'application/vnd.google-apps.document'",
        "name contains 'Transcript'",
        "trashed = false",
        `createdTime > '${endTime.toISOString()}'`,
        `createdTime < '${searchWindowEnd.toISOString()}'`,
      ].join(" and "),
      fields: "files(id,name,createdTime,webViewLink)",
      orderBy: "createdTime",
      pageSize: 5,
    });

    const transcriptFile = filesList.data.files?.[0];
    if (!transcriptFile?.id) continue;
    transcriptsMatched += 1;

    const exportRes = await drive.files.export(
      { fileId: transcriptFile.id, mimeType: "text/plain" },
      { responseType: "text" },
    );
    const transcriptText = String(exportRes.data);

    const attendees = (event.attendees ?? []).filter(
      (a) => a.email && a.email.toLowerCase() !== opts.ownEmail.toLowerCase() && !a.resource,
    );

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
        transcript: transcriptText,
        transcript_drive_url: transcriptFile.webViewLink ?? null,
        occurred_at: new Date(event.start?.dateTime ?? endTime).toISOString(),
        source_ref: `gcal:${event.id}:${attendee.email.toLowerCase()}`,
      });
      interactionsUpserted += 1;
    }
  }

  return { meetEventsChecked: meetEvents.length, transcriptsMatched, interactionsUpserted };
}
