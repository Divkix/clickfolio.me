# Disposable-email check is fail-open

Only an explicit `APIError` from the `databaseHooks.user.create.before` hook blocks signup. KV/network errors let signup through (availability over strictness); email verification is the safety net.
