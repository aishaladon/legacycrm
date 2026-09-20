import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { upsertPayment } from "@/lib/crm/payments";
import { parseCsv } from "./csv";

type Supabase = SupabaseClient<Database>;

/**
 * Column headers this looks for, case-insensitively. Not yet verified
 * against a real Novo export (staying manual per the build plan, so no
 * live account to pull a sample from) — these match the shape of every
 * common business-bank CSV export (Date/Description/Amount, or separate
 * Debit/Credit columns). If a real Novo file uses different headers,
 * adjust the patterns below rather than the parsing logic itself.
 */
const DATE_HEADER = /date/i;
const DESCRIPTION_HEADER = /description|memo|payee|merchant/i;
const AMOUNT_HEADER = /^amount$/i;
const CREDIT_HEADER = /credit|deposit/i;
const DEBIT_HEADER = /debit|withdrawal/i;

function findColumn(headers: string[], pattern: RegExp): number {
  return headers.findIndex((h) => pattern.test(h.trim()));
}

export type NovoRow = { date: string; description: string; amount: number };

export function parseNovoCsv(csvText: string): NovoRow[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const headers = rows[0];
  const dateCol = findColumn(headers, DATE_HEADER);
  const descCol = findColumn(headers, DESCRIPTION_HEADER);
  const amountCol = findColumn(headers, AMOUNT_HEADER);
  const creditCol = findColumn(headers, CREDIT_HEADER);
  const debitCol = findColumn(headers, DEBIT_HEADER);

  if (dateCol === -1) {
    throw new Error(
      `Couldn't find a date column. Headers found: ${headers.join(", ")}`,
    );
  }
  if (amountCol === -1 && creditCol === -1 && debitCol === -1) {
    throw new Error(
      `Couldn't find an amount, credit, or debit column. Headers found: ${headers.join(", ")}`,
    );
  }

  const result: NovoRow[] = [];

  for (const row of rows.slice(1)) {
    const date = row[dateCol]?.trim();
    if (!date) continue;

    let amount: number;
    if (amountCol !== -1) {
      amount = Number(row[amountCol]?.replace(/[$,]/g, ""));
    } else {
      const credit = Number(row[creditCol]?.replace(/[$,]/g, "") || 0);
      const debit = Number(row[debitCol]?.replace(/[$,]/g, "") || 0);
      amount = credit - Math.abs(debit);
    }
    if (!Number.isFinite(amount)) continue;

    result.push({
      date,
      description: descCol !== -1 ? (row[descCol]?.trim() ?? "") : "",
      amount,
    });
  }

  return result;
}

export type NovoImportResult = { rowsChecked: number; paymentsUpserted: number };

/**
 * Only imports money IN (positive amounts) — Novo's export includes every
 * business expense too, which isn't what the `payments` table tracks.
 * Deduped on a hash of (date, description, amount), since bank exports
 * don't carry a stable external transaction id — re-importing the same
 * month's file twice won't create duplicates.
 */
export async function importNovoPayments(
  supabase: Supabase,
  csvText: string,
): Promise<NovoImportResult> {
  const rows = parseNovoCsv(csvText);
  let paymentsUpserted = 0;

  for (const row of rows) {
    if (!(row.amount > 0)) continue;

    const paidAt = new Date(row.date);
    if (Number.isNaN(paidAt.getTime())) continue;

    const dedupeKey = await hashRow(row);

    await upsertPayment(supabase, {
      contact_id: null,
      amount: row.amount,
      currency: "USD",
      product_service: row.description || null,
      source: "novo",
      external_id: dedupeKey,
      paid_at: paidAt.toISOString(),
    });
    paymentsUpserted += 1;
  }

  return { rowsChecked: rows.length, paymentsUpserted };
}

async function hashRow(row: NovoRow): Promise<string> {
  const data = new TextEncoder().encode(`${row.date}|${row.description}|${row.amount}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `novo:${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
