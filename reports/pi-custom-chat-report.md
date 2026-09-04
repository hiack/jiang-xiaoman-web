# Pi Custom Chat Window Implementation Report

Date: 2026-09-04
Branch: `feature/custom-chat-window` (worktree `custom-chat-window`)
Executed by: Pi Coding Agent, tasks 1–7 of `docs/superpowers/plans/2026-09-04-custom-chat-window.md`

## What was delivered

The cross-origin Dify iframe was replaced with the approved custom light
“满糖” chat window:

- **江小满 messages** render on the left with the existing portrait thumbnail.
- **User messages** render on the right with the approved anonymous short-haired
  male avatar (`public/images/user-avatar-anonymous-short-hair.png`).
- Chat uses the existing light palette; Dify black UI, platform menus, bot icon,
  token usage, latency, like/dislike and copy controls are gone.
- Hero and the 46/54 desktop layout are preserved; mobile stacks vertically
  with a sticky composer and no horizontal overflow.
- Messages are rendered as plain React text nodes; `<script>` payloads are never
  executed and no response HTML is injected.
- A Vercel Node function (`api/chat.ts`) proxies Dify streaming chat using a
  server-side `DIFY_API_KEY` (never requested, stored or committed). The proxy
  validates origin/body, and forwards only allow-listed SSE events with only the
  fields the UI needs; upstream internals and error text never cross it.
- The original Dify chat page survives only as an auxiliary “直接打开原对话” link.
- The frontend is static-safe: it only knows the public proxy URL and a stable
  anonymous user id; conversation state lives only in browser localStorage.
- No real Dify API key exists anywhere in this repository or its history.

## Files changed

Task 1 — avatar + config
- `public/images/user-avatar-anonymous-short-hair.png` (approved source copied)
- `src/config/content.ts`, `src/config/content.test.ts`

Task 2 — SSE parser
- `src/chat/types.ts`, `src/chat/sse.ts`, `src/chat/sse.test.ts`

Task 3 — client + session state
- `src/chat/chatClient.ts`, `src/chat/chatClient.test.ts`
- `src/hooks/useChatSession.ts`, `src/hooks/useChatSession.test.tsx`

Task 4 — branded conversation UI
- `src/components/MessageBubble.tsx`, `MessageBubble.test.tsx`
- `src/components/ChatComposer.tsx`, `ChatComposer.test.tsx`
- `src/components/ChatPanel.tsx`, `ChatPanel.test.tsx` (replaced iframe panel)
- `src/styles.css` (approved visual system)
- `src/config/content.ts` (obsolete `chatUrl` removed after callers migrated)
- `src/hooks/useChatSession.ts` (additive `apiUrl` option, used by ChatPanel)
- `src/App.test.tsx` (dropped iframe-title expectation)

Task 5 — secret-safe Vercel proxy
- `api/chat.ts` (handler), `api/chat-core.ts`, `api/chat-core.test.ts`
- `package.json`, `package-lock.json` (`@vercel/node@12.0.0` dev dep)
- `tsconfig.node.json` (includes `api/**/*.ts`, `types: ["node"]`)

Task 6 — deployment prep (no secret)
- `.env.example` (created; names only, empty values)
- `vercel.json` (maxDuration 60, no-store header)
- `.github/workflows/deploy-pages.yml` (injects only `VITE_CHAT_API_URL`)
- `scripts/verify-dist.mjs` (requires avatar asset, `和江小满聊天`, fallback URL)

Task 7 — E2E + report
- `e2e/home.spec.ts` (proxy-mocked, replaced iframe spec)
- `playwright.config.ts` (local non-secret `VITE_CHAT_API_URL` for E2E mode)
- `reports/pi-custom-chat-report.md` (this file)

## Verification matrix (exact results)

| Command | Result |
| --- | --- |
| `npm test` | Vitest: **12 files passed, 54 tests passed, 0 failures** |
| `npm run check` | `tsc -b` exit **0** |
| `npm run build` | Vite build **succeeded** (26 modules, 200.72 kB JS) |
| `npm run verify:dist` | Output ends **`VERIFY_DIST_PASS files=5`** |
| `npm run test:e2e` | Playwright: **7 passed, 3 skipped** (project-conditional), 0 failed — desktop two-column, mobile stacked, no iframe, no horizontal overflow, no platform text, send/stream/reset flow, both avatar assets |
| `git diff --check` | Clean (`DIFF_CHECK_OK`) |
| `git status --short` | Clean after final commit |
| Secret scan `rg ... 'Bearer\s+[A-Za-z0-9._-]{16,}\|DIFY_API_KEY\s*=\s*[^\s#]+' .` | **No matches** (rg exit 1). Only references are docs, an empty `.env.example` assignment, and verifier regexes. Test key is unmistakably fake: `app-fake-key-abcdef0123456789-never-real`. |

Required UI markers verified by tests: no `与江小满对话` iframe title; avatar alt
text `江小满` → `jiang-xiaoman-original.png` and `你` →
`user-avatar-anonymous-short-hair.png`; no `Token/耗时/点赞/Dify 测试替身`;
`aria-label="和江小满聊天"`; button `发送`; fallback `直接打开原对话` →
`https://udify.app/chat/pNigFJHwFSH5pgcY`. Required CSS values present:
`.message-row--user { flex-direction: row-reverse; }`,
assistant bubble `#fff`/`#493530` with 5px bottom-left radius, user bubble
`#60798d`/`#fff` with 5px bottom-right radius, 38px round avatars,
`.message-bubble { max-width: 72%; white-space: pre-wrap; overflow-wrap: anywhere; }`,
82% bubble width at ≤800px, sticky composer on mobile.

## Commits

1. `1e1dd43` feat: add approved anonymous user avatar
2. `f93fdfa` feat: add safe Dify stream parser
3. `abe165a` feat: add custom chat session flow
4. `3443df8` feat: replace Dify iframe with branded chat window
5. `76f22bf` feat: add secure Dify streaming proxy
6. `4b5fa43` chore: prepare secure chat deployment
7. (pending) test: verify custom chat without secrets

Each task followed red–green TDD: a failing focused test was run first, then the
minimum implementation, then green, then a commit.

## Deviations from the plan (all additive, no requirement removed)

1. **`src/App.test.tsx` updated in Task 4** — not in the plan file map, but it
   asserted the old iframe title and would have broken the full suite.
2. **`playwright.config.ts` sets a local, non-secret `VITE_CHAT_API_URL`**
   (`http://127.0.0.1:4173`) for the E2E dev server so the chat window runs in
   the “configured” state and can be exercised against the mocked `/api/chat`.
3. **Hook signature extended** to `useChatSession(apiUrl?: string)` (additive);
   no-arg calls still use `siteContent.chatApiUrl`.
4. **Old `chatUrl` config property was retained until Task 4**, when the last
   caller (ChatPanel) migrated, then removed; grep confirms no references remain.
5. **`.env.example` was created** (the file did not exist).
6. **Proxy filters SSE events server-side** to allow-listed events with only the
   needed fields (defense in depth beyond the client normalizer).
7. **`npm install -D @vercel/node@12.0.0`** reported `5 vulnerabilities`
   (2 moderate, 3 high) in the dependency tree audit; private repo, no real key
   involved — flagged for review, then **fixed in the follow-up below**
   (dependency removed, audit total 0).

## Follow-up: remove vulnerable type-only dependency

Date: 2026-09-04
Branch: `feature/custom-chat-window` (worktree `custom-chat-window`)
Executed by: Pi Coding Agent, `pi_custom_chat_audit_fix` task

### Finding

- `npm ci` reported **5 vulnerabilities** (2 moderate, 3 high).
- `npm audit --json` traced every finding to the direct devDependency
  `@vercel/node@12.0.0` and its transitive tree: `@vercel/static-config`,
  `ajv`, `path-to-regexp`, and `undici`.

### Root cause

- `api/chat.ts` imported `@vercel/node` **only for TypeScript types**
  (`VercelRequest`, `VercelResponse`) via `import type`. At runtime Vercel
  Node Functions supply the actual request/response objects; the handler never
  imports or calls anything from the package at runtime.
- Because the package was still a declared devDependency, its full transitive
  tree (including a nested `typescript`, `es-module-lexer`, `ajv`,
  `path-to-regexp`, `undici`, …) entered `package-lock.json` and the audit.

### Change

1. **Removed `@vercel/node` from `package.json` and `package-lock.json`** with
   the package manager: `npm uninstall --save-dev @vercel/node`
   (110 packages removed, `found 0 vulnerabilities`).
2. **Replaced the type-only import in `api/chat.ts`** with small local
   structural interfaces describing only the members this handler reads and
   writes:
   - `ChatRequest` — `headers.origin`, `method`, `body`.
   - `ChatResponse` — `status`, `json`, `setHeader`, `write`, `flushHeaders`,
     `end`.
   No replacement package was added. Runtime logic types that remain (`fetch`,
   `Response`, `ReadableStream`, `RequestInit`) come from `@types/node` and
   its `undici-types`, which stay as devDependencies (audit-clean).
3. **Default handler signature preserved**: `handler(req, res): Promise<void>`
   stays structurally assignable to Vercel's Node Function handler
   (`VercelApiHandler`); proxy behavior is unchanged.

No Dify key was requested or used, and no push/deploy/GitHub/remote changes
were made.

### Verification (exact fresh results, after the fix)

| Command | Result |
| --- | --- |
| `npm audit --json` | `vulnerabilities` empty — **total 0** (0 critical/high/moderate/low) |
| `npm test` | Vitest: **12 files passed, 54 tests passed, 0 failures** |
| `npm run check` | `tsc -b` exit **0** |
| `npm run build` | Vite build **succeeded** (26 modules, 200.72 kB JS) |
| `npm run verify:dist` | **`VERIFY_DIST_PASS files=5`** (exit 0) |
| `npm run test:e2e` | Playwright: **7 passed, 3 skipped** (project-conditional), 0 failed |
| `git diff --check` | **Clean** (exit 0) |
| `git status --short` | Clean after final commit |

### Files changed

- `package.json` — removed `@vercel/node` devDependency.
- `package-lock.json` — regenerated without `@vercel/node` and its transitive
  tree.
- `api/chat.ts` — replaced the `@vercel/node` type-only import with local
  `ChatRequest`/`ChatResponse` structural interfaces.
- `reports/pi-custom-chat-report.md` — this section.

## Deployment prerequisites (secret phase — outside this agent's scope)

1. Deploy `api/` to Vercel and set **`DIFY_API_KEY` as a Vercel Secret** in the
   secure UI — this is the only place a real key ever lives.
2. Add a GitHub repository **variable** `VITE_CHAT_API_URL` = the public Vercel
   proxy URL (no trailing slash) so Pages builds inject it; the Pages workflow
   never references `DIFY_API_KEY`.
3. Confirm the proxy origin allow-list matches the real public site origin
   (currently `https://hiack.github.io` plus local `127.0.0.1`/`localhost:4173`).
4. Push `main` to deploy Pages; run one public smoke message and confirm a fresh
   session works after refresh.

## Boundaries respected

No GitHub calls, no push, no deploy, no remote changes, no Dify app/workflow/
prompt/model/knowledge-base changes, no browser-held key, no message-content
persistence, and the public production site was not touched.

READY_FOR_SECRET_SETUP: true — no real Dify API key was requested, stored, or committed.

## Follow-up: fix Vercel runtime crash ERR_MODULE_NOT_FOUND

Date: 2026-09-05
Branch: `feature/custom-chat-window` (worktree `custom-chat-window`)
Executed by: Pi Coding Agent, runtime-error fix task

### Reproduction (real production logs)

Two production deployments of `jiang-xiaoman-web-proxy` (both Ready, build
succeeded) crashed on **every** request. `vercel logs` shows:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/api/chat-core'
imported from /var/task/api/chat.js
```

The crash hit both `OPTIONS /api/chat` (23:52:41) and `POST /api/chat`
(23:52:42) — i.e. the function module failed to load before the handler ran.

### Root cause

Vercel zero-config Node functions compile **each `api/*.ts` file into its own
standalone lambda** (the deployment contained three: `api/chat`,
`api/chat-core`, `api/chat-core.test`). Because `package.json` has
`"type": "module"`, the emitted `/var/task/api/chat.js` is ESM and keeps the
source-level relative import `'./chat-core'` — without a `.js` extension.
Node ESM does not do extension resolution, so the sibling module can never
load; the whole class of "function file imports sibling module" is unsafe on
this pipeline regardless of whether the sibling is traced into the lambda.

### Change

1. **`api/chat.ts` is now fully self-contained.** The `chat-core.ts` helpers
   (`MAX_QUERY_LENGTH`, `validateBody`, `isAllowedOrigin`,
   `createDifyRequest`, `publicError`, `ChatValidationError`) were merged
   into the single function file and remain exported for tests. A comment at
   the top of the file documents the packaging rule so the layout cannot
   silently regress.
2. **`api/chat-core.ts` deleted; `api/chat-core.test.ts` moved to
   `api-tests/chat.test.ts`** (imports `../api/chat`). Rationale: every
   `.ts` file under `api/` ships as a serverless function — `chat-core` and
   `chat-core.test` lambdas were deployed as junk endpoints — and Vercel's
   local `vercel build` also rejects test files under `api/`.
3. **Added 7 handler regression tests** (origin rejection, OPTIONS
   preflight, 405, 503 without secret, 400 invalid body before upstream,
   401 upstream mapped to public copy, SSE stream normalization) that pin
   the module-load surface of the deployed entry point.
4. **`.gitignore` reordered**: `.vercel` and `.env*` (Vercel CLI writes
   `.env.local` containing tokens after login/link) are ignored while
   `!.env.example` stays effective.

### Verification (fresh results after the fix)

| Command | Result |
| --- | --- |
| `npm test` | Vitest: **12 files passed, 61 tests passed, 0 failures** |
| `npm run check` | `tsc -b` exit **0** |
| `npm run build` | Vite build **succeeded** |
| `npm run verify:dist` | **`VERIFY_DIST_PASS files=5`** |
| `npm run test:e2e` | Playwright: **7 passed, 3 skipped**, 0 failed |
| `git diff --check` | Clean |
| Local `npx vercel build` | Still errors on Windows CLI with the repo TS 7 devDependency ("TypeScript did not emit an output") — pre-existing local-CLI quirk; the Linux cloud build emits lambdas normally (both crashed deployments built Ready), so cloud parity is unaffected |
| Live production deploy | Post-fix smoke: see below |

### Files changed

- `api/chat.ts` — self-contained handler (merged `chat-core.ts`, local
  import removed, header comment documents the packaging rule).
- `api/chat-core.ts` — deleted.
- `api/chat-core.test.ts` — moved to `api-tests/chat.test.ts`.
- `api-tests/chat.test.ts` — moved tests + 7 new handler regression tests.
- `tsconfig.node.json` — includes `api-tests/**/*.ts`.
- `.gitignore` — `.vercel`/`.env*` ignored, `!.env.example` last.
- `reports/pi-custom-chat-report.md` — this section.

### Live verification

Redeployed the fix to Vercel production (`jiang-xiaoman-web-proxy-8it36rny7`,
Ready, single `api/chat` lambda) and exercised the deployed endpoint with
`Origin: https://hiack.github.io`:

| Request | Result |
| --- | --- |
| `OPTIONS /api/chat` | **204** (preflight passes) |
| `POST` with `Origin: https://evil.example` | **403** `来源不受支持。` |
| `POST` with empty query | **400** `请求内容无效。` |
| `POST` valid body | **401** `对话服务配置异常，请稍后再试。` (public copy of upstream Dify 401; no internals leaked) |

`vercel logs` after the smoke run shows only the four request lines with **no
error entries** — the pre-fix crashes (`ERR_MODULE_NOT_FOUND` on OPTIONS and
POST) are gone. The proxy itself is fixed; note that Dify currently rejects
the stored `DIFY_API_KEY` with 401 (key added interactively on 2026-09-04
23:51), so until a valid key is set, real conversations still return the
public "配置异常" message. No code change is needed for that — re-add the
secret with `vercel env add DIFY_API_KEY production --sensitive` and redeploy.
