import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, TablesInsert } from "@/lib/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Deduped on (source, external_id) — see the unique index in
 * 0001_init_schema.sql. Safe to call repeatedly across syncs.
 */
export async function upsertPayment(
  supabase: Supabase,
  row: TablesInsert<"payments"> & { external_id: string },
) {
  const { error } = await supabase
    .from("payments")
    .upsert(row, { onConflict: "source,external_id" });
  if (error) throw error;
}
