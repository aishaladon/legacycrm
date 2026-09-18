import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncGmailInteractions } from "@/lib/integrations/google/gmail";

export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  const ownEmail = process.env.OWNER_EMAIL;
  if (!ownEmail) {
    return NextResponse.json({ error: "OWNER_EMAIL is not configured." }, { status: 500 });
  }

  try {
    const result = await syncGmailInteractions(createServiceRoleClient(), { ownEmail });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gmail sync failed" },
      { status: 500 },
    );
  }
}
