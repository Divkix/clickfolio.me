export function isLocalEnvironment(): boolean {
  const appUrl = process.env.APP_URL || "";
  return appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
}
