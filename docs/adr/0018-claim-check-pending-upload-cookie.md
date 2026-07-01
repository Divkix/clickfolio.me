# Claim-check pattern (pending_upload signed cookie)

Anonymous uploads write to R2 `temp/` and set a signed `pending_upload` cookie (`lib/utils/pending-upload-cookie.ts`). This lets users upload BEFORE authenticating, then bind the temp R2 object to the new account on claim.
