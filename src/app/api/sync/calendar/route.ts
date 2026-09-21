import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { errorMessage } from "@/lib/sync/errorMessage";
import { getOwnEmailAliases } from "@/lib/sync/ownEmail";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncCalendarInteractions } from "@/lib/integrations/google/calendar";

export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  const ownEmail = process.env.OWNER_EMAIL;
  if (!ownEmail) {
    return NextResponse.json({ error: "OWNER_EMAIL is not configured." }, { status: 500 });
  }

  try {
    const result = await syncCalendarInteractions(createServiceRoleClient(), {
      ownEmail,
      ownEmailAliases: getOwnEmailAliases(),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err) },
      { status: 500 },
    );
  }
}
