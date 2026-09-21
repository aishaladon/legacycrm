import "server-only";

/**
 * Windsor.ai Connectors API client — direct REST access for the deployed
 * backend, separate from the claude.ai Windsor.ai connector used during
 * development (that one only works inside a Claude session).
 *
 * Verified endpoint shape: GET https://connectors.windsor.ai/{connector}
 * with api_key as a query parameter (header auth isn't supported).
 */
export function getWindsorClient() {
  const apiKey = process.env.WINDSOR_API_KEY;

  if (!apiKey) {
    throw new Error("WINDSOR_API_KEY must be set to use Windsor.ai integrations.");
  }

  async function getData<T>(params: {
    connector: string;
    fields: string[];
    datePreset?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<T[]> {
    const url = new URL(`https://connectors.windsor.ai/${params.connector}`);
    url.searchParams.set("api_key", apiKey!);
    url.searchParams.set("fields", params.fields.join(","));
    if (params.datePreset) url.searchParams.set("date_preset", params.datePreset);
    if (params.dateFrom) url.searchParams.set("date_from", params.dateFrom);
    if (params.dateTo) url.searchParams.set("date_to", params.dateTo);

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Windsor.ai request failed: GET /${params.connector} → ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 500)}` : ""}`,
      );
    }

    const json = (await res.json()) as { data?: T[]; error?: string };
    if (json.error) {
      throw new Error(`Windsor.ai error for /${params.connector}: ${json.error}`);
    }
    return json.data ?? [];
  }

  return { getData };
}
