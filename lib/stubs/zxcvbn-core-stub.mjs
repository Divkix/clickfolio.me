// Server-side stub for @zxcvbn-ts/core.
// PasswordInput.tsx ("use client") imports checkPasswordStrength which dynamically
// imports @zxcvbn-ts/core. Next.js SSRs client components, pulling zxcvbn into the
// server bundle (1.73 MB). This stub provides the API surface so SSR doesn't crash,
// but the actual strength checking only runs client-side (in the browser onChange handler).

export function zxcvbn(_password) {
  return {
    score: 0,
    feedback: { warning: "", suggestions: [] },
    crackTimesDisplay: { offlineSlowHashing1e4PerSecond: "instant" },
    crackTimesSeconds: { offlineSlowHashing1e4PerSecond: 0 },
  };
}

export class ZxcvbnOptions {
  static setOptions() {}
}

export const zxcvbnOptions = new ZxcvbnOptions();
