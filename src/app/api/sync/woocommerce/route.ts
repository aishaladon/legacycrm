import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncWooCommerceOrders } from "@/lib/integrations/wordpress/woocommerce";

export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await syncWooCommerceOrders(createServiceRoleClient(), {});
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "WooCommerce sync failed" },
      { status: 500 },
    );
  }
}
