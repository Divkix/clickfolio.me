<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Clickfolio. Client-side tracking is initialized via `instrumentation-client.ts` (Next.js 15.3+ pattern) with a reverse proxy through `/ingest` to avoid ad blockers. Users are identified on every page load via a `PostHogIdentifier` client component that calls `posthog.identify()` with stable user IDs and person properties (email, name), and calls `posthog.reset()` on sign-out. Server-side events are captured via `posthog-node` in critical API routes with `flushAt: 1` / `flushInterval: 0` to ensure events flush before the Cloudflare Worker terminates.

| Event name | Description | File |
|---|---|---|
| `resume_uploaded` | User successfully uploads a PDF resume to R2 temporary storage | `components/FileDropzone.tsx` |
| `resume_upload_failed` | User's resume upload attempt failed with an error | `components/FileDropzone.tsx` |
| `resume_claimed` | Authenticated user claims a previously uploaded resume and triggers AI parsing | `app/api/resume/claim/route.ts` |
| `resume_claim_cached` | Resume claim resolved from cache (same PDF uploaded before), skipping AI parsing | `app/api/resume/claim/route.ts` |
| `onboarding_completed` | User completes the wizard by setting handle, privacy settings, and theme | `app/api/wizard/complete/route.ts` |
| `theme_changed` | User selects a new resume template theme from the dashboard or wizard | `app/api/resume/update-theme/route.ts` |
| `resume_parse_retried` | User manually retries parsing a failed resume | `app/api/resume/retry/route.ts` |
| `handle_changed` | User updates their public profile handle (username) | `app/api/profile/handle/route.ts` |
| `account_deleted` | User permanently deletes their account and all associated data | `app/api/account/delete/route.ts` |
| `sign_up_completed` | User successfully creates a new account via email/password sign-up | `components/auth/SignUpForm.tsx` |
| `sign_in_completed` | User successfully signs in to their account via email/password | `components/auth/SignInForm.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics (wizard)](https://us.posthog.com/project/506984/dashboard/1830926)
- **Insight**: [Resume upload to onboarding funnel (wizard)](https://us.posthog.com/project/506984/insights/YMx0Wquc)
- **Insight**: [Sign-ups and sign-ins over time (wizard)](https://us.posthog.com/project/506984/insights/064UPt0h)
- **Insight**: [Resume uploads vs upload failures (wizard)](https://us.posthog.com/project/506984/insights/KdX0Z1bZ)
- **Insight**: [Theme adoption breakdown (wizard)](https://us.posthog.com/project/506984/insights/pRvDLfPf)
- **Insight**: [Account deletions (wizard)](https://us.posthog.com/project/506984/insights/2tN1cFJq)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `PostHogIdentifier` component handles this via `useSession()` on every page load, but verify it fires correctly for Google OAuth sign-ins (which bypass `SignInForm`).

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
