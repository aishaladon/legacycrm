import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { findOrCreateContactByEmail } from "@/lib/crm/contacts";
import { upsertBookPurchaseRow } from "@/lib/crm/pipeline";
import { getWordPressClient } from "./client";

type Supabase = SupabaseClient<Database>;

type WooOrder = {
  id: number;
  status: string;
  date_created_gmt: string;
  total: string;
  billing: { first_name?: string; last_name?: string; email?: string };
};

const PAID_STATUSES = new Set(["completed", "processing"]);

export type WooCommerceSyncResult = { ordersChecked: number; pipelineRowsUpserted: number };

/**
 * WooCommerce's `_gmt` fields are documented UTC but come back without a
 * "Z" suffix (e.g. "2026-01-01T12:30:00"). JavaScript's Date parser treats
 * an ISO string with no timezone marker as local time, not UTC — on a
 * server not running in UTC, `new Date(order.date_created_gmt)` would
 * silently shift the time. Appending "Z" before parsing makes the UTC
 * interpretation explicit rather than relying on the runtime's default.
 * Never actually exercised against a real order yet (the store has had
 * zero orders through every test so far), so this couldn't have been
 * caught by testing — only by reading WooCommerce's own field docs.
 */
function normalizeGmtDate(gmtDate: string): string {
  const withZ = gmtDate.endsWith("Z") ? gmtDate : `${gmtDate}Z`;
  return new Date(withZ).toISOString();
}

/**
 * Book purchases only — the build plan's one WooCommerce integration
 * point. Every paid order becomes its own `book` pipeline row (a
 * transaction log, not a funnel), deduped on the WooCommerce order id.
 */
export async function syncWooCommerceOrders(
  supabase: Supabase,
  opts: { sinceDays?: number; perPage?: number },
): Promise<WooCommerceSyncResult> {
  const sinceDays = opts.sinceDays ?? 30;
  const after = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const wp = getWordPressClient();

  const orders = await wp.get<WooOrder[]>("/wc/v3/orders", {
    after,
    per_page: opts.perPage ?? 50,
    orderby: "date",
    order: "asc",
  });

  let pipelineRowsUpserted = 0;

  for (const order of orders) {
    if (!PAID_STATUSES.has(order.status) || !order.billing.email) continue;

    const contact = await findOrCreateContactByEmail(supabase, {
      email: order.billing.email,
      fullName: [order.billing.first_name, order.billing.last_name].filter(Boolean).join(" ") || undefined,
    });

    await upsertBookPurchaseRow(supabase, {
      contactId: contact.id,
      value: Number(order.total),
      purchasedDate: normalizeGmtDate(order.date_created_gmt),
      externalRef: `woocommerce:${order.id}`,
    });
    pipelineRowsUpserted += 1;
  }

  return { ordersChecked: orders.length, pipelineRowsUpserted };
}
