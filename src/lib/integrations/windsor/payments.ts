import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { findOrCreateContactByEmail } from "@/lib/crm/contacts";
import { upsertPayment } from "@/lib/crm/payments";
import { getWindsorClient } from "./client";

type Supabase = SupabaseClient<Database>;

type StripeTransactionRow = {
  transaction__id: string;
  transaction__amount: number;
  transaction__currency: string;
  transaction__email: string | null;
  transaction__created: string;
  transaction__status: string;
  transaction__description?: string | null;
};

export type StripeSyncResult = { transactionsChecked: number; paymentsUpserted: number };

/**
 * Verified against Windsor.ai's stripe connector schema. Not yet verified
 * against a real transaction (the connected account had none at build
 * time) — the field names are confirmed correct via get_fields, but
 * amount's unit (dollars vs cents) couldn't be confirmed against real
 * data. Recheck this once real Stripe transactions exist.
 */
export async function syncStripePayments(
  supabase: Supabase,
  opts: { datePreset?: string } = {},
): Promise<StripeSyncResult> {
  const windsor = getWindsorClient();

  const rows = await windsor.getData<StripeTransactionRow>({
    connector: "stripe",
    fields: [
      "transaction__id",
      "transaction__amount",
      "transaction__currency",
      "transaction__email",
      "transaction__created",
      "transaction__status",
      "transaction__description",
    ],
    datePreset: opts.datePreset ?? "last_2years",
  });

  let paymentsUpserted = 0;

  for (const row of rows) {
    if (row.transaction__status !== "succeeded" || !row.transaction__email) continue;
    if (!(row.transaction__amount > 0)) continue;

    const contact = await findOrCreateContactByEmail(supabase, { email: row.transaction__email });

    await upsertPayment(supabase, {
      contact_id: contact.id,
      amount: row.transaction__amount,
      currency: row.transaction__currency?.toUpperCase() ?? "USD",
      product_service: row.transaction__description ?? null,
      source: "stripe",
      external_id: row.transaction__id,
      paid_at: row.transaction__created,
    });
    paymentsUpserted += 1;
  }

  return { transactionsChecked: rows.length, paymentsUpserted };
}

type PayPalTransactionRow = {
  transactions__transaction_id: string;
  transactions__transaction_info: {
    transaction_id: string;
    transaction_amount?: { currency_code: string; value: string };
    transaction_status?: string;
    transaction_initiation_date?: string;
    transaction_subject?: string;
  };
  transactions__payer_info: {
    email_address?: string;
    payer_name?: { alternate_full_name?: string; given_name?: string; surname?: string };
  };
};

export type PayPalSyncResult = { transactionsChecked: number; paymentsUpserted: number };

/**
 * Verified against real transaction data. PayPal's Transaction Search API
 * returns every ledger event, not just customer payments — outgoing
 * purchases, bank withdrawals, and internal fee transfers all come back
 * with negative amounts or no payer email. Filtering to
 * (amount > 0 AND a payer email is present) isolates real incoming
 * customer payments, confirmed against a live pull of 27 transactions.
 */
export async function syncPayPalPayments(
  supabase: Supabase,
  opts: { datePreset?: string } = {},
): Promise<PayPalSyncResult> {
  const windsor = getWindsorClient();

  const rows = await windsor.getData<PayPalTransactionRow>({
    connector: "paypal_transaction",
    fields: [
      "transactions__transaction_id",
      "transactions__transaction_info",
      "transactions__payer_info",
    ],
    datePreset: opts.datePreset ?? "last_2years",
  });

  let paymentsUpserted = 0;

  for (const row of rows) {
    const info = row.transactions__transaction_info;
    const payer = row.transactions__payer_info;
    const amount = Number(info.transaction_amount?.value ?? 0);

    if (!(amount > 0) || !payer.email_address) continue;

    const contact = await findOrCreateContactByEmail(supabase, {
      email: payer.email_address,
      fullName: payer.payer_name?.alternate_full_name,
    });

    await upsertPayment(supabase, {
      contact_id: contact.id,
      amount,
      currency: info.transaction_amount?.currency_code ?? "USD",
      product_service: info.transaction_subject ?? null,
      source: "paypal",
      external_id: row.transactions__transaction_id,
      paid_at: info.transaction_initiation_date ?? new Date().toISOString(),
    });
    paymentsUpserted += 1;
  }

  return { transactionsChecked: rows.length, paymentsUpserted };
}
