import "server-only";

import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { findOrCreateContactByEmail } from "@/lib/crm/contacts";
import { upsertInteractionBySourceRef } from "@/lib/crm/interactions";
import { getGoogleAuthClient } from "./auth";
import { isLikelyAutomatedSender } from "./contactFilters";

type Supabase = SupabaseClient<Database>;

/**
 * Handles "Jane Doe <jane@example.com>" and bare "jane@example.com" as two
 * separate patterns rather than one regex with an optional bracket — a
 * single combined pattern lets the greedy display-name group backtrack
 * into a bare address with no brackets to anchor against (confirmed by
 * testing: "aishaladon@gmail.com" alone parsed as email "n@gmail.com",
 * silently corrupting every thread where a header had no display name).
 */
function parseAddress(headerValue: string) {
  const trimmed = headerValue.trim();

  const bracketed = trimmed.match(/^(?:"?([^"<]*)"?\s*)?<([^<>\s]+@[^<>\s]+)>$/);
  if (bracketed) {
    const [, name, email] = bracketed;
    return { name: name?.trim() || undefined, email: email.toLowerCase() };
  }

  const bare = trimmed.match(/^([^<>\s]+@[^<>\s]+)$/);
  if (bare) return { name: undefined, email: bare[1].toLowerCase() };

  return null;
}

/**
 * Splits a header like `To`/`Cc` into individual addresses, respecting
 * commas inside a quoted display name (`"Doe, Jane" <jane@x.com>, b@y.com`).
 * Needed because a real "To" header is very often more than one recipient
 * (CC'd colleague, a group send) — the original single-address regex
 * would just fail to match the whole header and silently drop the
 * interaction entirely, even though a real reply-worthy thread existed.
 */
function splitAddressList(headerValue: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of headerValue) {
    if (char === '"') inQuotes = !inQuotes;
    if (char === "," && !inQuotes) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseAddressList(headerValue: string | undefined) {
  if (!headerValue) return [];
  return splitAddressList(headerValue)
    .map(parseAddress)
    .filter((a): a is NonNullable<ReturnType<typeof parseAddress>> => a !== null);
}

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

export type GmailSyncResult = { threadsProcessed: number; interactionsUpserted: number };

/**
 * Syncs recent Gmail threads into `interactions`, resolving the other
 * party's email into a `contacts` row. Excludes Promotions/Social/Updates
 * — Gmail's own classifier already sorts most automated notifications
 * into Updates, so this is the cheapest, most reliable filter available
 * before the defensive isLikelyAutomatedSender check below runs.
 */
export async function syncGmailInteractions(
  supabase: Supabase,
  opts: { sinceDays?: number; ownEmail: string; maxThreads?: number; ownEmailAliases?: string[] },
): Promise<GmailSyncResult> {
  const sinceDays = opts.sinceDays ?? 30;
  const maxThreads = opts.maxThreads ?? 100;
  const auth = getGoogleAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const ownEmails = new Set(
    [opts.ownEmail, ...(opts.ownEmailAliases ?? [])].map((e) => e.toLowerCase()),
  );

  const afterDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;

  const list = await gmail.users.threads.list({
    userId: "me",
    q: `-category:promotions -category:social -category:updates after:${afterStr}`,
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
      metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
    });

    const messages = thread.data.messages ?? [];
    if (messages.length === 0) continue;

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const headers = firstMessage.payload?.headers;

    const fromHeader = getHeader(headers, "From");
    const from = fromHeader ? parseAddress(fromHeader) : null;
    const other =
      from && ownEmails.has(from.email)
        ? [...parseAddressList(getHeader(headers, "To")), ...parseAddressList(getHeader(headers, "Cc"))].find(
            (a) => !ownEmails.has(a.email),
          )
        : from;
    if (!other || ownEmails.has(other.email) || isLikelyAutomatedSender(other.email)) continue;

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
