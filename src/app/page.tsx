import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABLES = [
  "contacts",
  "interactions",
  "pipeline",
  "projects_tasks",
  "payments",
  "campaigns",
] as const;

async function getTableCounts() {
  const supabase = createServiceRoleClient();

  const counts = await Promise.all(
    TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return { table, count: error ? null : count, error: error?.message };
    }),
  );

  return counts;
}

export default async function Home() {
  let counts: Awaited<ReturnType<typeof getTableCounts>> | null = null;
  let connectionError: string | null = null;

  try {
    counts = await getTableCounts();
  } catch (err) {
    connectionError =
      err instanceof Error ? err.message : "Unknown Supabase connection error";
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-8 py-16 px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Legacy CRM
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Phase 1 — repo + schema. Six tables live on Supabase; integration
            modules (Gmail, Google Meet, WordPress) land in Phase 2.
          </p>
        </div>

        {connectionError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-medium">Supabase connection not configured</p>
            <p className="mt-1">{connectionError}</p>
            <p className="mt-1">
              Set <code>SUPABASE_URL</code> and{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>.env.local</code>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {counts?.map(({ table, count, error }) => (
              <div
                key={table}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {table}
                </p>
                <p className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
                  {error ? "—" : count}
                </p>
                {error && (
                  <p className="mt-1 text-xs text-red-600">{error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
