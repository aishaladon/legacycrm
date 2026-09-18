import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { findOrCreateContactByEmail } from "@/lib/crm/contacts";
import { findOrCreateOpenPipelineRow, advancePipelineStage } from "@/lib/crm/pipeline";
import { getWordPressClient } from "./client";

type Supabase = SupabaseClient<Database>;

type WpUser = {
  id: number;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  roles: string[];
};

// Confirmed against the live site (ldlms/v2 namespace present): LearnDash
// has no bulk "enrolled users" endpoint per course, only a per-user
// course-progress collection. Exact field names on a *non-empty* entry
// weren't observable during setup (every probed user had `[]`), so this
// reads defensively across LearnDash's documented variants.
type CourseProgressEntry = {
  course_id?: number;
  id?: number;
  status?: string;
  course_status?: string;
  percentage?: number;
  progress_percentage?: number;
};

function stageFromProgress(entry: CourseProgressEntry): string {
  const status = (entry.status ?? entry.course_status ?? "").toLowerCase();
  const percentage = entry.percentage ?? entry.progress_percentage ?? 0;

  if (status.includes("complete") || percentage >= 100) return "Completed";
  if (status.includes("progress") || percentage > 0) return "Enrolled";
  return "Registered";
}

export type LearnDashSyncResult = {
  usersChecked: number;
  enrollmentsFound: number;
  pipelineRowsUpserted: number;
};

/**
 * Iterates WordPress "customer" users and checks each one's LearnDash
 * course-progress. There's no incremental "changed since" filter on this
 * endpoint, so `maxUsers` bounds each run — safe to call repeatedly on a
 * schedule to page through the full user base over time.
 */
export async function syncLearnDashEnrollments(
  supabase: Supabase,
  opts: { page?: number; perPage?: number; maxUsers?: number },
): Promise<LearnDashSyncResult> {
  const perPage = opts.perPage ?? 50;
  const wp = getWordPressClient();

  const users = await wp.get<WpUser[]>("/wp/v2/users", {
    context: "edit",
    per_page: perPage,
    page: opts.page ?? 1,
  });

  let enrollmentsFound = 0;
  let pipelineRowsUpserted = 0;

  for (const user of users.slice(0, opts.maxUsers ?? perPage)) {
    if (!user.email) continue;

    const progress = await wp.get<CourseProgressEntry[]>(
      `/ldlms/v2/users/${user.id}/course-progress`,
    );
    if (!progress || progress.length === 0) continue;
    enrollmentsFound += progress.length;

    const contact = await findOrCreateContactByEmail(supabase, {
      email: user.email,
      fullName: user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || undefined,
    });

    // The pipeline schema tracks one open row per (contact, stream) — see
    // findOrCreateOpenPipelineRow. With multiple courses in progress at
    // once this collapses to the furthest-along enrollment; fine for a
    // single-instructor course catalog, worth revisiting if that changes.
    const furthestStage = progress
      .map(stageFromProgress)
      .sort((a, b) => ["Registered", "Enrolled", "Completed"].indexOf(b) - ["Registered", "Enrolled", "Completed"].indexOf(a))[0];

    const row = await findOrCreateOpenPipelineRow(supabase, {
      contactId: contact.id,
      incomeStream: "course",
      initialStage: furthestStage,
    });

    if (row.stage !== furthestStage) {
      await advancePipelineStage(
        supabase,
        row.id,
        furthestStage,
        furthestStage === "Completed" ? new Date().toISOString() : undefined,
      );
    }
    pipelineRowsUpserted += 1;
  }

  return { usersChecked: users.length, enrollmentsFound, pipelineRowsUpserted };
}
