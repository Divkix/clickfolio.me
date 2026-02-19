/**
 * Sync disposable email domain blocklist from GitHub to KV.
 *
 * Called by:
 * - worker.ts scheduled handler (cron)
 * - /api/cron/sync-disposable-domains route handler (manual trigger)
 *
 * Source: https://github.com/disposable-email-domains/disposable-email-domains
 */

const BLOCKLIST_URL =
  "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf";

const MINIMUM_DOMAIN_COUNT = 1000;

export interface SyncResult {
  ok: boolean;
  domainCount: number;
  timestamp: string;
}

export async function syncDisposableDomains(kv: KVNamespace): Promise<SyncResult> {
  const response = await fetch(BLOCKLIST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch disposable domain blocklist: HTTP ${response.status}`);
  }

  const text = await response.text();
  const domains = text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line !== "" && !line.startsWith("#"));

  if (domains.length < MINIMUM_DOMAIN_COUNT) {
    throw new Error(
      `Sanity check failed: only ${domains.length} domains parsed (minimum ${MINIMUM_DOMAIN_COUNT})`,
    );
  }

  await kv.put("disposable-domains", JSON.stringify(domains));

  return {
    ok: true,
    domainCount: domains.length,
    timestamp: new Date().toISOString(),
  };
}
