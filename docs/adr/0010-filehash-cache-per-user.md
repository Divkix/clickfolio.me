# fileHash dedup/cache is per-user

The resume `fileHash` dedup/cache lookup is always scoped to the same `userId`, never cross-user. Security: never leak parsed content across users, while still saving a re-parse on identical re-uploads by the same user.
