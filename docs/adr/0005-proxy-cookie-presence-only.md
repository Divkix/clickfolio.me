# proxy.ts does cookie-presence-only checks (no D1)

`proxy.ts` only checks that a session cookie is present at the edge for `/dashboard /edit /settings /waiting /wizard` — no D1, no signature/expiry validation. D1 is not available in proxy/middleware on Workers, so real enforcement is deferred to the page/API layers; the proxy is just a cheap edge bounce. A forged or expired-but-present cookie passes it.
