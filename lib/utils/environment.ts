/**
 * Detect local environment via BETTER_AUTH_URL.
 * More robust than NODE_ENV checks since wrangler preview/build
 * bakes NODE_ENV=production at compile time, but BETTER_AUTH_URL
 * is a runtime binding that reliably indicates local vs production.
 */
export function isLocalEnvironment(): boolean {
  const authUrl = process.env.BETTER_AUTH_URL || "";
  return authUrl.includes("localhost") || authUrl.includes("127.0.0.1");
}
