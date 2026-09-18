import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { errorMessage } from "@/lib/sync/errorMessage";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncMeetTranscripts } from "@/lib/integrations/google/drive";

export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  const ownEmail = process.env.OWNER_EMAIL;
  if (!ownEmail) {
    return NextResponse.json({ error: "OWNER_EMAIL is not configured." }, { status: 500 });
  }

  try {
    const result = await syncMeetTranscripts(createServiceRoleClient(), { ownEmail });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err) },
      { status: 500 },
    );
  }
}
