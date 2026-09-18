import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database";

// Browser client: uses the publishable/anon key. RLS on every table has no
// grants, so this client has no table access on its own — it exists for
// future use (e.g. auth) but the dashboard reads/writes go through the
// server client below.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
