// Server-side stub for @zxcvbn-ts/core.
// PasswordInput.tsx ("use client") imports checkPasswordStrength which dynamically
// imports @zxcvbn-ts/core. Next.js SSRs client components, pulling zxcvbn into the
// server bundle (1.73 MB). This stub provides the API surface so SSR doesn't crash,
// but the actual strength checking only runs client-side (in the browser onChange handler).

export class ZxcvbnFactory {
  check() {
    return {
      score: 0,
      feedback: { warning: "", suggestions: [] },
      crackTimes: {
        offlineSlowHashingXPerSecond: { base: 0, seconds: 0, display: "instant" },
      },
    };
  }
}
