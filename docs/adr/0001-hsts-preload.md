# Enable HSTS preload site-wide (2-year max-age)

The unified `SECURITY_HEADERS` sends `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` on every response. We chose `preload` deliberately: it commits the `clickfolio.me` apex **and every subdomain** to HTTPS-only in browsers' hardcoded lists. This is slow to reverse (removal from the preload list propagates over weeks/months), so any future non-HTTPS subdomain must reopen this decision.
