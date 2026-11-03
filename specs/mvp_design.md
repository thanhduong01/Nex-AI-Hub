# Nex AI Hub — implementation design

## Accepted scope

Owner + five employees, Vercel deployment, Supabase PostgreSQL/Auth/Storage. Preserve the approved green/neutral prototype. Prepare code and setup instructions; the user has no Supabase project yet and has asked to configure it later. No live infrastructure, emails or paid AI requests are performed during development.

## Acceptance criteria

1. Email/password login persists across browser restarts for seven days from authentication. Refreshing tokens does not extend the absolute seven-day session. Logout and employee suspension invalidate Hub access on the next request.
2. Owner can read all workspace projects; only project creators/contributors can write. Employees cannot enumerate or export other projects, even with guessed IDs.
3. Project creation, sharing, archive, conversation creation/search/export, provider configuration, subscription records, team management and budget settings persist in PostgreSQL.
4. Chat uses OpenAI, Anthropic or Gemini server-side; request ID deduplicates retries, one active run per conversation, prompt saved before sending, streamed output checkpointed. Error/cancel leaves partial output and unresolved usage, never silently retries or switches provider.
5. Reservation and settlement are atomic across workspace/user limits. Unknown usage retains reserved funds. A run cannot bypass connection grants, model settings or budget checks.
6. Imports preview normalized JSON and ChatGPT/Claude exports, preserve unknown author, detect duplicates, and commit atomically. Unsupported sources have explicit instructions, not simulated success.
7. No credentials in client payloads/logs. Every mutation validates schema, origin and authorization. RLS covers every public data table. Service-role access is isolated to narrowly scoped provisioning/credential/run-finalization tasks.
8. Production build, typecheck, lint and meaningful unit/database tests pass. Live Supabase/Auth/SMTP/provider/deployment tests are explicitly pending external configuration.

## Frontend

Next.js App Router + React + TypeScript; server components for lists and metrics, small client forms/chat islands. Semantic HTML/CSS retains the prototype visual language; native dialogs, focus states, mobile navigation, empty/loading/error states. Server paginated queries, debounced search, text-first MVP and incremental streamed rendering keep payloads bounded. No fabricated dashboard data in production.

## Backend

Next.js route handlers/server actions on Vercel Node runtime. Supabase Auth via server-only HttpOnly cookies and SSR refresh proxy. PostgreSQL is the authority for workspace membership, project access, seven-day session gates, rate limits, runs and budget reservations. Private Supabase Storage files are served through authenticated routes. AI SDK adapters use fixed provider endpoints and owner-selected models/prices; no client-provided system messages/remote URLs. Text/Markdown attachments only for AI context in the initial implementation; arbitrary private files can be stored/downloaded but are not silently sent to models.

## Security checkpoint (before implementation)

- Auth: verified user claims plus DB membership/session expiry on every protected operation, short-lived Supabase access tokens, seven-day persistent HttpOnly/Secure/SameSite cookies, no public signup.
- Authorization: RLS + server guards; owner read scope distinct from contribution scope; no service-role generic query endpoint; cross-workspace FK validation.
- Inputs: shared Zod schemas and limits; UUID paths; parameterized Supabase queries; bounded bodies/files/history; safe redirect allowlist.
- Output: React text escaping/Markdown without raw HTML; no secret or internal error responses; private/no-store authenticated responses.
- CSRF: same-origin POST requests and Next server-action protections; GET routes are read-only.
- Secrets: AES-256-GCM encrypted provider keys, master key only in server env; public metadata separate from private ciphertext; no secrets in logs.
- Abuse: database-backed rate counters and atomic budget reservations; no automatic paid retry, no purchase/auto top-up.
- Audit: metadata-only project access/export, membership, provider and budget changes; no prompts, API keys or passwords.

## Implementation order

1. Application scaffold, typed schemas, error contracts, setup state.
2. SQL tables, RLS, sessions, transactional RPCs, indexes and integration tests.
3. Auth, workspace/project/team/provider actions and UI.
4. Streaming chat, cancellation, checkpoints, budget settlement; file/import/export flows.
5. Unit/database/API integration checks; security/QA review and production build.
6. Env template, bootstrap script, migration/deployment/runbook and honest readiness report.

## Performance and deployment decisions

Use one Vercel region near Supabase; configure after the database region is known. Avoid a permanent websocket server/worker for a six-user text-chat MVP. Use bounded HTTP streams with a shorter internal deadline than Vercel function duration; persist checkpoints and expose stale runs for reconciliation after interrupted invocations. Queries use indexes and pagination; per-request auth is memoized, data is never globally cached across identities. No remote font dependency at build time. Measure live latency after provisioning rather than claim an unmeasured p95.

## Reference baseline

- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/sessions
- https://nextjs.org/docs/app/guides/authentication
- https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text

Supabase session defaults are not a seven-day guarantee. Hub therefore enforces an absolute deadline in a private session table checked by RLS, independently of optional hosted Auth time-box settings.
