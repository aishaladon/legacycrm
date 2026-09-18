import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, TablesInsert } from "@/lib/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Every sync (Gmail, Calendar, Meet) re-runs over a recent window, so
 * interactions are keyed on `source_ref` (a Gmail message id, Calendar
 * event id, Drive file id) to stay idempotent — re-syncing never
 * duplicates a row.
 */
export async function upsertInteractionBySourceRef(
  supabase: Supabase,
  row: TablesInsert<"interactions"> & { source_ref: string },
) {
  const { data: existing, error: findError } = await supabase
    .from("interactions")
    .select("id")
    .eq("source_ref", row.source_ref)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error: updateError } = await supabase
      .from("interactions")
      .update(row)
      .eq("id", existing.id);
    if (updateError) throw updateError;
    return existing.id;
  }

  const { data: created, error: insertError } = await supabase
    .from("interactions")
    .insert(row)
    .select("id")
    .single();
  if (insertError) throw insertError;
  return created.id;
}
