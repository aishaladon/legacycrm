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

  if (insertError) throw insertError;
  return created;
}
