"use client";

import { useState } from "react";

export default function NovoImportPage() {
  const [secret, setSecret] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("loading");
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import/novo", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Import failed.");
        return;
      }

      setStatus("done");
      setMessage(
        `Checked ${data.rowsChecked} rows, imported ${data.paymentsUpserted} payments.`,
      );
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Import failed.");
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col gap-6 py-16 px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Import Novo transactions
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload your monthly Novo CSV export. Only deposits (money in) are
            imported — expenses are skipped. Safe to re-upload the same file;
            duplicates are automatically skipped.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Sync secret
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Novo CSV file
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </label>

          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {status === "loading" ? "Importing…" : "Import"}
          </button>
        </form>

        {message && (
          <p
            className={
              status === "error"
                ? "text-sm text-red-600"
                : "text-sm text-green-700 dark:text-green-400"
            }
          >
            {message}
          </p>
        )}
      </main>
    </div>
  );
}
