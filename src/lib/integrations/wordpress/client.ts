import "server-only";

/**
 * Minimal WP REST client authenticated with a WordPress Application
 * Password (wp-admin > Users > Profile > Application Passwords). Works
 * against core `wp/v2` routes and — since the account used is an admin
 * with `manage_woocommerce` — the `wc/v3` and `ldlms/v2` routes too.
 */
export function getWordPressClient() {
  const baseUrl = process.env.WORDPRESS_URL;
  const username = process.env.WORDPRESS_APP_USERNAME;
  const appPassword = process.env.WORDPRESS_APP_PASSWORD;

  if (!baseUrl || !username || !appPassword) {
    throw new Error(
      "WORDPRESS_URL, WORDPRESS_APP_USERNAME, and WORDPRESS_APP_PASSWORD must be set to use WordPress integrations.",
    );
  }

  const authHeader = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;

  async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`/wp-json${path}`, baseUrl);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const res = await fetch(url, {
      headers: { Authorization: authHeader },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`WordPress REST request failed: GET ${url.pathname} → ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  return { get };
}
