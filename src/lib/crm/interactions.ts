import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, TablesInsert } from "@/lib/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Every sync (Gmail, Calendar, Meet) re-runs over a recent window, so
 * interactions are keyed on `source_ref` (a Gmail message id, Calendar
 * event id, Drive file id) to stay idempotent — re-syncing never
 * duplicates a row.
 *
 * The check-then-insert below isn't atomic. `interactions.source_ref` has
 * a unique constraint (migration 0005) as the real guarantee; if two
 * syncs race on the same source_ref (e.g. Calendar and Meet-transcript
 * sync both touching the same event around the same time) and the insert
 * loses that race, fall back to updating the row the other call just
 * created instead of failing.
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

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: winner, error: refetchError } = await supabase
        .from("interactions")
        .select("id")
        .eq("source_ref", row.source_ref)
        .single();
      if (refetchError) throw refetchError;
      const { error: updateError } = await supabase
        .from("interactions")
        .update(row)
        .eq("id", winner.id);
      if (updateError) throw updateError;
      return winner.id;
    }
    throw insertError;
  }
  return created.id;
}
