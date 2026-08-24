/**
 * Environment detection utilities.
 *
 * Detects local environment via APP_URL rather than NODE_ENV,
 * which is more reliable because wrangler preview/build bakes
 * NODE_ENV=production at compile time.
 */

/**
 * Detect local environment via APP_URL.
 * More robust than NODE_ENV checks since wrangler preview/build
 * bakes NODE_ENV=production at compile time, but APP_URL
 * is a runtime binding that reliably indicates local vs production.
 */
export function isLocalEnvironment(): boolean {
  const appUrl = process.env.APP_URL || "";
  return appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
}
