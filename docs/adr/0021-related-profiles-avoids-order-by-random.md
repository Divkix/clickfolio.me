# getRelatedProfiles avoids ORDER BY random()

`getRelatedProfiles` (`lib/data/resume.ts`) COUNTs eligible public profiles, picks a random OFFSET into a stable `orderBy(user.handle)` window of 12, shuffles in-memory, and returns 3. `ORDER BY random()` isn't indexable on D1; a random OFFSET into an indexable ordering is cheap.
