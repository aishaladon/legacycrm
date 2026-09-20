import { NextResponse } from "next/server";

import { requireSyncSecret } from "@/lib/sync/auth";
import { errorMessage } from "@/lib/sync/errorMessage";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { importNovoPayments } from "@/lib/import/novo";

export async function POST(request: Request) {
  const unauthorized = requireSyncSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const csvText = await file.text();
    const result = await importNovoPayments(createServiceRoleClient(), csvText);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
