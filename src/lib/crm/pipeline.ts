import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Enums } from "@/lib/types/database";

type Supabase = SupabaseClient<Database>;
type IncomeStream = Enums<"income_stream">;

// The stage that closes out an engagement for each stream. Once a pipeline
// row reaches it, the next sync for that contact/stream starts a new row
// instead of reopening the closed one. Book has no funnel (every purchase
// is its own transaction-log row), so it's excluded.
const FINAL_STAGE: Partial<Record<IncomeStream, string>> = {
  consulting: "Past",
  retreat: "Attended",
  course: "Completed",
};

/**
 * Finds the contact's open (not yet at its final stage) row for a stream,
 * or creates one at `initialStage`. Used by integrations that track a
 * contact's progress through a funnel (LearnDash course enrollment,
 * Calendar consultation bookings, etc.) rather than logging a one-off
 * transaction.
 */
export async function findOrCreateOpenPipelineRow(
  supabase: Supabase,
  params: {
    contactId: string;
    incomeStream: IncomeStream;
    initialStage: string;
    value?: number;
    expectedDate?: string;
  },
) {
  const finalStage = FINAL_STAGE[params.incomeStream];

  let query = supabase
    .from("pipeline")
    .select("*")
    .eq("contact_id", params.contactId)
    .eq("income_stream", params.incomeStream)
    .order("created_at", { ascending: false })
    .limit(1);

  if (finalStage) {
    query = query.neq("stage", finalStage);
  }

  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("pipeline")
    .insert({
      contact_id: params.contactId,
      income_stream: params.incomeStream,
      stage: params.initialStage,
      value: params.value,
      expected_date: params.expectedDate,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return created;
}

export async function advancePipelineStage(
  supabase: Supabase,
  pipelineId: string,
  stage: string,
  actualDate?: string,
) {
  const { error } = await supabase
    .from("pipeline")
    .update({ stage, actual_date: actualDate })
    .eq("id", pipelineId);
  if (error) throw error;
}

/**
 * Book purchases are a transaction log, not a funnel (per the build plan) —
 * every WooCommerce order becomes its own `Purchased` row rather than
 * updating a shared one. Deduped on (income_stream, external_ref) — pass
 * the WooCommerce order id as `externalRef` so re-syncing never duplicates
 * a purchase.
 */
export async function upsertBookPurchaseRow(
  supabase: Supabase,
  params: {
    contactId: string;
    value: number;
    purchasedDate: string;
    externalRef: string;
  },
) {
  const { error } = await supabase.from("pipeline").upsert(
    {
      contact_id: params.contactId,
      income_stream: "book",
      stage: "Purchased",
      value: params.value,
      actual_date: params.purchasedDate,
      external_ref: params.externalRef,
    },
    { onConflict: "income_stream,external_ref" },
  );
  if (error) throw error;
}
