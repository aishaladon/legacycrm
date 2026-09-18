import "server-only";

import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { findOrCreateContactByEmail } from "@/lib/crm/contacts";
import { upsertInteractionBySourceRef } from "@/lib/crm/interactions";
import { getGoogleAuthClient } from "./auth";

type Supabase = SupabaseClient<Database>;

function parseAddress(headerValue: string | undefined) {
  if (!headerValue) return null;
  // "Jane Doe <jane@example.com>" or bare "jane@example.com"
  const match = headerValue.match(/^(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/);
  if (!match) return null;
  const [, name, email] = match;
  return { name: name?.trim() || undefined, email: email.toLowerCase() };
}

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

export type GmailSyncResult = { threadsProcessed: number; interactionsUpserted: number };

/**
 * Syncs recent Gmail threads into `interactions`, resolving the other
 * party's email into a `contacts` row. Excludes Promotions/Social so
 * newsletters and notifications don't pollute the conversation log.
 */
export async function syncGmailInteractions(
  supabase: Supabase,
  opts: { sinceDays?: number; ownEmail: string; maxThreads?: number },
): Promise<GmailSyncResult> {
  const sinceDays = opts.sinceDays ?? 30;
  const maxThreads = opts.maxThreads ?? 100;
  const auth = getGoogleAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const afterDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;

  const list = await gmail.users.threads.list({
    userId: "me",
    q: `-category:promotions -category:social after:${afterStr}`,
    maxResults: maxThreads,
  });

  const threads = list.data.threads ?? [];
  let interactionsUpserted = 0;

  for (const threadRef of threads) {
    if (!threadRef.id) continue;

    const thread = await gmail.users.threads.get({
      userId: "me",
      id: threadRef.id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "Date"],
    });

    const messages = thread.data.messages ?? [];
    if (messages.length === 0) continue;

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const headers = firstMessage.payload?.headers;

    const from = parseAddress(getHeader(headers, "From"));
    const to = parseAddress(getHeader(headers, "To"));
    const other = from?.email === opts.ownEmail.toLowerCase() ? to : from;
    if (!other) continue;

    const contact = await findOrCreateContactByEmail(supabase, {
      email: other.email,
      fullName: other.name,
    });

    const occurredAt = lastMessage.internalDate
      ? new Date(Number(lastMessage.internalDate)).toISOString()
      : new Date().toISOString();

    await upsertInteractionBySourceRef(supabase, {
      contact_id: contact.id,
      type: "email",
      subject: getHeader(headers, "Subject") ?? null,
      summary: lastMessage.snippet ?? null,
      occurred_at: occurredAt,
      source_ref: `gmail:${thread.data.id}`,
    });
    interactionsUpserted += 1;
  }

  return { threadsProcessed: threads.length, interactionsUpserted };
}
