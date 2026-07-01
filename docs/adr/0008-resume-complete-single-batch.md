# Resume-complete UPDATE + siteData upsert always in one db.batch()

The queue consumer always writes the resume-complete UPDATE and the siteData upsert in a single `db.batch()`. A crash between them would leave the resume `completed` with no siteData, which the idempotency guard then permanently skips — silent data loss.
