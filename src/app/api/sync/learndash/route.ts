import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncLearnDashEnrollments } from "@/lib/integrations/wordpress/learndash";

export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  const page = Number(new URL(request.url).searchParams.get("page") ?? "1");

  try {
    const result = await syncLearnDashEnrollments(createServiceRoleClient(), { page });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "LearnDash sync failed" },
      { status: 500 },
    );
  }
}
