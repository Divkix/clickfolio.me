# Smart placement enabled

`placement.mode: "smart"` is set in `wrangler.jsonc`. The Worker is origin-bound (D1 / R2 / AI Gateway), not edge-latency-bound, so running near the bindings beats running near the user.
