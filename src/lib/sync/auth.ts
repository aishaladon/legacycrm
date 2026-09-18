import "server-only";

import { NextResponse } from "next/server";

/**
 * Shared-secret guard for /api/sync/* routes. This is a solo-operator
 * internal tool with no user auth yet (Phase 6), but these routes run
 * real writes against live data on a public subdomain, so they can't be
 * left open. Callers pass `Authorization: Bearer <SYNC_SECRET>`.
 */
export function requireSyncSecret(request: Request): NextResponse | null {
  const expected = process.env.SYNC_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "SYNC_SECRET is not configured on the server." },
      { status: 500 },
    );
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
