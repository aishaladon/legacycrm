import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { errorMessage } from "@/lib/sync/errorMessage";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncGmailInteractions } from "@/lib/integrations/google/gmail";

export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  const ownEmail = process.env.OWNER_EMAIL;
  if (!ownEmail) {
    return NextResponse.json({ error: "OWNER_EMAIL is not configured." }, { status: 500 });
  }

  const params = new URL(request.url).searchParams;
  const maxThreads = params.get("maxThreads") ? Number(params.get("maxThreads")) : undefined;
  const sinceDays = params.get("sinceDays") ? Number(params.get("sinceDays")) : undefined;

  try {
    const result = await syncGmailInteractions(createServiceRoleClient(), {
      ownEmail,
      maxThreads,
      sinceDays,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err) },
      { status: 500 },
    );
  }
}
