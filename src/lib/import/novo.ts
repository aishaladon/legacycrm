import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { upsertPayment } from "@/lib/crm/payments";
import { parseCsv } from "./csv";

type Supabase = SupabaseClient<Database>;

/**
 * Column headers this looks for, case-insensitively. Verified against a
 * real Novo "Activities" export: Date, Description, Amount, Note,
 * Check Number, Category. Category is what makes filtering reliable —
 * Novo tags real incoming client money as "Revenue" and everything else
 * (refunds, fee reimbursements, owner transfers, payroll deposits) with
 * other categories, which a bare amount > 0 check can't tell apart.
 */
const DATE_HEADER = /date/i;
const DESCRIPTION_HEADER = /description|memo|payee|merchant/i;
const AMOUNT_HEADER = /^amount$/i;
const CREDIT_HEADER = /credit|deposit/i;
const DEBIT_HEADER = /debit|withdrawal/i;
const CATEGORY_HEADER = /^category$/i;

function findColumn(headers: string[], pattern: RegExp): number {
  return headers.findIndex((h) => pattern.test(h.trim()));
}

export type NovoRow = { date: string; description: string; amount: number; category: string | null };

export function parseNovoCsv(csvText: string): NovoRow[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const headers = rows[0];
  const dateCol = findColumn(headers, DATE_HEADER);
  const descCol = findColumn(headers, DESCRIPTION_HEADER);
  const amountCol = findColumn(headers, AMOUNT_HEADER);
  const creditCol = findColumn(headers, CREDIT_HEADER);
  const debitCol = findColumn(headers, DEBIT_HEADER);
  const categoryCol = findColumn(headers, CATEGORY_HEADER);

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
      category: categoryCol !== -1 ? (row[categoryCol]?.trim() ?? "") : null,
    });
  }

  return result;
}

export type NovoImportResult = { rowsChecked: number; paymentsUpserted: number };

/**
 * Only imports rows Novo itself categorizes as "Revenue" (falls back to
 * any positive amount if a file has no Category column at all — better
 * than importing nothing, though less precise). A bare amount > 0 check
 * isn't enough: real Novo exports include refunds, fee reimbursements,
 * payroll deposits and owner transfers that are all positive but aren't
 * client payments.
 *
 * Also skips anything with "paypal" in the description — money PayPal
 * transfers into Novo was already recorded once by the PayPal sync
 * (source "paypal"); importing the Novo-side deposit too would double
 * the revenue for the same payment. Confirmed against a real export:
 * every "PAYPAL TRANSFER" row's amount matched a real PayPal withdrawal
 * exactly.
 *
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
    if (row.category !== null && row.category.toLowerCase() !== "revenue") continue;
    if (row.description.toLowerCase().includes("paypal")) continue;

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
