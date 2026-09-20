import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { errorMessage } from "@/lib/sync/errorMessage";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncStripePayments, syncPayPalPayments } from "@/lib/integrations/windsor/payments";

/**
 * Runs Stripe and PayPal in sequence and reports both, rather than
 * failing the whole run if one source errors (e.g. Stripe not connected
 * yet shouldn't block PayPal).
 */
export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceRoleClient();
  const results: Record<string, { ok: true; data: unknown } | { ok: false; error: string }> = {};

  try {
    results.stripe = { ok: true, data: await syncStripePayments(supabase) };
  } catch (err) {
    results.stripe = { ok: false, error: errorMessage(err) };
  }

  try {
    results.paypal = { ok: true, data: await syncPayPalPayments(supabase) };
  } catch (err) {
    results.paypal = { ok: false, error: errorMessage(err) };
  }

  return NextResponse.json(results);
}
