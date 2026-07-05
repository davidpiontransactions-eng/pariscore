---
Task ID: OPENAPI-1
Agent: full-stack-developer
Task: Add public API documentation with OpenAPI/Swagger to the SetPoint Next.js 16 app

Work Log:
- Read existing project context:
  - `src/lib/tennis-data.ts` — types: `Surface`, `Player`, `H2HMatch`, `MatchStats`, `BookmakerOdd`, `TennisMatch` (+ `OddsSummary` shape inline), and the `MATCHES` mock (m1/m2/m3).
  - `src/lib/prediction/elo-history.ts` — `EloHistoryPoint`, `PlayerEloHistory` types and the `/api/tennis/elo-history` response contract.
  - All 7 API route handlers:
    - `GET /api/tennis/prematch` (cache 60s, source cache|mock|odds-api)
    - `GET /api/tennis/elo-history?matchId=` (400 if missing, 404 if not found)
    - `POST /api/push/subscribe` (PushSubscription body, 201, dedupes by endpoint)
    - `POST /api/push/test` (ValueBetAlert body, 503 if no VAPID, 400 if no subs)
    - `POST /api/email/subscribe` ({email}, 201, idempotent)
    - `POST /api/email/unsubscribe` ({email}, 200, idempotent)
    - `POST /api/email/test` (ValueBetAlert body, 200 with mode smtp|console)
  - `src/app/layout.tsx` — confirmed the singleton-dialog mount pattern (PrivacyDialog, BankrollDialog, AboutDialog mounted under SentryErrorBoundary).
  - `src/app/page.tsx` — footer structure with `tPrivacy("footer.manageCookies")` + `tAbout("trigger")` buttons.
  - `src/components/privacy-dialog.tsx` + `about-dialog.tsx` — singleton `openFn` ref pattern + `react-hooks/set-state-in-effect` workaround note (only write to module-scoped `openFn` in effect, never `setState`).
  - `src/messages/fr.json` + `en.json` — `about` is the last namespace, ends at line ~378.
  - `eslint.config.mjs` — `react-hooks/set-state-in-effect` is NOT explicitly disabled (kept on); most other rules off.

- Created `public/openapi.json` — valid OpenAPI 3.1.0 spec:
  - `openapi: "3.1.0"`, `info` (title, version 1.0.0, description, contact, license), 2 servers (production `https://setpoint.example`, local `http://localhost:3000`), 3 tags (tennis, push, email with descriptions).
  - 20 reusable schemas in `components/schemas`: `Surface`, `Form`, `Player`, `H2HMatch`, `MatchStats`, `BookmakerOdd`, `OddsSummary`, `TennisMatch`, `PrematchResponse`, `EloHistoryPoint`, `PlayerEloHistory`, `EloHistoryResponse`, `PushSubscription`, `PushSubscribeResponse`, `ValueBetAlert`, `PushTestResponse`, `EmailSubscription`, `EmailSubscribeResponse`, `EmailTestResponse`, `ErrorResponse`.
  - All schemas mirror the TypeScript types in `src/lib/tennis-data.ts` and `src/lib/prediction/elo-history.ts` (field names, optionality via `required` arrays, enums for `Surface` and `Form`, 2-tuple for `ic`).
  - OpenAPI 3.1 conventions used: `type: ["integer", "null"]` for nullable `expirationTime` (no `nullable: true`), `format: "date-time"` / `"uri"` / `"email"`, `minimum`/`maximum` as numbers.
  - 7 paths, each with `tags`, `summary`, `description`, `operationId`, request params/body, and `200`/`201` + `400` + `500` responses with `application/json` examples pulled from real mock data.
  - 38 internal `$ref` links — all resolve (verified with a Node walker script).

- Created `src/components/api-docs-dialog.tsx` — singleton dialog, custom OpenAPI rendering (NO Swagger UI React):
  - `openApiDocsDialog()` singleton exported (module-level `openFn` ref, set in effect, cleaned up on unmount — mirrors `PrivacyDialog`/`AboutDialog`).
  - Dialog `max-w-3xl`, `ScrollArea` body, `max-h-[90vh]`.
  - Title from `t("title")` → FR "Documentation API" / EN "API Documentation".
  - Fetches `/openapi.json` lazily on first open (deferred `setLoading(true)` to a microtask to comply with `react-hooks/set-state-in-effect`); caches the parsed spec in component state.
  - Groups endpoints by first tag, ordered Tennis → Push → Email (then any other tag), with locale-aware section labels.
  - Per-endpoint card: method badge (GET=blue `bg-blue-500/15 text-blue-600`, POST=green `bg-emerald-500/15 text-emerald-600`), monospace path, summary + description, parameters table (Name/In/Type/Required), request body example, generated `curl` command with copy-to-clipboard button (per-card copied state, 1.5s revert), response example (first 2xx status).
  - Curl generator substitutes query params from example values and includes `-H 'Content-Type: application/json' -d '{...}'` for POST endpoints with a body example.
  - "Télécharger OpenAPI" / "Download OpenAPI" download link (`<a href="/openapi.json" download>`) at the top of the dialog body.
  - Loading spinner (`Loader2`), error state (rose-tinted box).

- Mounted the dialog in `src/app/layout.tsx` (next to `PrivacyDialog`, `BankrollDialog`, `AboutDialog`).

- Added the trigger button in the footer of `src/app/page.tsx`:
  - Imported `Code` icon from lucide-react.
  - Imported `openApiDocsDialog` from `@/components/api-docs-dialog`.
  - Added `const tApiDocs = useTranslations("apiDocs")` hook.
  - Inserted a new `<button onClick={openApiDocsDialog}>` between the "Comment ça marche ?" button and the live-data status `<p>`, with `<Code className="h-3 w-3" />` icon + `tApiDocs("trigger")` ("API") label and the `·` separator.

- Added `apiDocs` namespace to both i18n files:
  - `src/messages/fr.json` — title "Documentation API", subtitle "Intégrez SetPoint à vos outils", trigger "API", downloadSpec "Télécharger OpenAPI", copyCurl "Copier curl", copied "Copié !", endpoints "Endpoints", parameters "Paramètres", response "Réponse", example "Exemple".
  - `src/messages/en.json` — title "API Documentation", subtitle "Integrate SetPoint into your tools", trigger "API", downloadSpec "Download OpenAPI", copyCurl "Copy curl", copied "Copied!", endpoints "Endpoints", parameters "Parameters", response "Response", example "Example".

- Verification:
  - `bun run lint` → 0 errors, 0 warnings (initial run flagged `react-hooks/set-state-in-effect` on the synchronous `setLoading(true)` in the fetch effect; fixed by deferring to `await Promise.resolve()` before any setState, mirroring the A/B-test assignment pattern already used in `page.tsx`).
  - `curl http://localhost:3000/openapi.json` → HTTP 200, 35996 bytes, `application/json; charset=UTF-8`, parses cleanly with `openapi: "3.1.0"`, 7 paths, 20 schemas.
  - `curl http://localhost:3000/` → HTTP 200, HTML contains "Documentation API" (FR default locale) and the new `openApiDocsDialog` trigger wired via the `apiDocs` translations.
  - Manual OpenAPI 3.1 structural validation via Node script: 0 errors (all operations have `responses` with `description`, all query params have `schema`, all `requestBody` have `content`, all schema `type` values are valid JSON-Schema types, all `$ref` targets resolve).
  - No compile errors in `dev.log` after the edits; existing routes still 200.

Summary:
- 5 files touched (1 created spec, 1 created component, 3 modified): `public/openapi.json` (new), `src/components/api-docs-dialog.tsx` (new), `src/app/layout.tsx` (mounted dialog), `src/app/page.tsx` (footer link + import), `src/messages/fr.json` + `src/messages/en.json` (apiDocs namespace).
- 7 endpoints documented (2 tennis, 2 push, 3 email), each with query/body params + 200/201/400/500 responses + examples.
- Lint: 0 errors, 0 warnings.
- `/openapi.json` served at HTTP 200 from the dev server, valid OpenAPI 3.1.0 JSON.
- Dialog opens from the new "API" footer link (Code icon, between "Comment ça marche ?" and the live-data status); renders all 7 endpoints grouped by tag, with copy-to-clipboard curl and a download link for the raw spec.
- Zero new runtime dependencies — pure custom rendering (no swagger-ui-react / redoc).
