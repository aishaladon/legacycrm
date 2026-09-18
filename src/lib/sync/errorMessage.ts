/**
 * Supabase (PostgrestError) and googleapis errors are plain objects with a
 * `.message`, not `Error` instances, so `err instanceof Error` misses them
 * and hides the real cause behind a generic fallback. This checks for a
 * `.message` string before giving up.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
}
