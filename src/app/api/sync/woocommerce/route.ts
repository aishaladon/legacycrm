import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { errorMessage } from "@/lib/sync/errorMessage";
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
      { error: errorMessage(err) },
      { status: 500 },
    );
  }
}
