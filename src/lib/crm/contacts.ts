import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

type Supabase = SupabaseClient<Database>;

export type ContactSeed = {
  email: string;
  fullName?: string;
  phone?: string;
  leadSourcePlatform?: string;
  leadSourcePost?: string;
};

/**
 * Shared entry point for every integration: emails, calendar invites,
 * WooCommerce orders, and LearnDash enrollments all resolve to the same
 * `contacts` row by email rather than creating parallel records per source.
 * Lead source is only set on first creation — a later sync never overwrites
 * an already-attributed contact's lead source.
 *
 * The check-then-insert below isn't atomic, so two syncs racing to create
 * the same new contact at once (e.g. Gmail and Calendar sync both hitting
 * a brand-new client's email around the same time) could both pass the
 * "does this exist" check before either inserts. `contacts.email` has a
 * unique constraint (migration 0005) as the real guarantee; if the insert
 * loses that race, fall back to fetching the row the other call just
 * created instead of failing.
 */
export async function findOrCreateContactByEmail(
  supabase: Supabase,
  seed: ContactSeed,
) {
  const email = seed.email.trim().toLowerCase();

  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("contacts")
    .insert({
      email,
      full_name: seed.fullName?.trim() || email,
      phone: seed.phone,
      lead_source_platform: seed.leadSourcePlatform,
      lead_source_post: seed.leadSourcePost,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: winner, error: refetchError } = await supabase
        .from("contacts")
        .select("*")
        .eq("email", email)
        .single();
      if (refetchError) throw refetchError;
      return winner;
    }
    throw insertError;
  }
  return created;
}
