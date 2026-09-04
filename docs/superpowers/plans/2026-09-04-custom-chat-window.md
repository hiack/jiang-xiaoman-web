# Jiang Xiaoman Custom Chat Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cross-origin Dify iframe with a branded, accessible, two-avatar chat UI that talks to Dify through a secret-safe Vercel proxy.

**Architecture:** The React frontend owns rendering and session state and communicates only with a configurable proxy URL. A Vercel Node function validates origin/input, adds the server-side Dify bearer key, and streams only allowed SSE events. The first implementation phase uses mocked network responses and must not require or contain a real key.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest, Testing Library, Playwright, Vercel Node Functions, Dify Chat Messages SSE API.

---

## File map

- Create `public/images/user-avatar-anonymous-short-hair.png`: approved user avatar.
- Modify `src/config/content.ts`: avatar and proxy configuration.
- Create `src/chat/types.ts`: frontend message and stream event types.
- Create `src/chat/sse.ts`: dependency-free SSE decoder.
- Create `src/chat/chatClient.ts`: proxy request and allowed-event normalization.
- Create `src/hooks/useChatSession.ts`: message/session state machine.
- Create `src/components/MessageBubble.tsx`: one safe message row.
- Create `src/components/ChatComposer.tsx`: validated input and send controls.
- Replace `src/components/ChatPanel.tsx`: custom chat window.
- Modify `src/styles.css`: approved light “满糖” conversation design.
- Create `api/chat.ts`: Vercel proxy handler.
- Create `api/chat-core.ts`: testable validation and Dify request helpers.
- Modify `tsconfig.node.json`: include API and tests.
- Modify `package.json` and `package-lock.json`: add `@vercel/node` and verification scripts.
- Modify `.env.example`: document non-secret frontend endpoint and server secret name.
- Modify `.github/workflows/deploy-pages.yml`: inject the public proxy URL from a repository variable.
- Modify `scripts/verify-dist.mjs`: scan for secrets and require the custom UI marker.
- Replace `e2e/home.spec.ts`: test the custom window on desktop and mobile.

### Task 1: Add the approved avatar and public configuration

**Files:**
- Create: `public/images/user-avatar-anonymous-short-hair.png`
- Modify: `src/config/content.ts`
- Modify: `src/config/content.test.ts`

- [ ] **Step 1: Write failing configuration tests**

Add assertions that `siteContent.userAvatarUrl` ends in `images/user-avatar-anonymous-short-hair.png`, `siteContent.chatApiUrl` reads `VITE_CHAT_API_URL` and defaults to an empty string, and the original Dify URL remains only as the fallback link.

```ts
expect(siteContent.userAvatarUrl).toContain('images/user-avatar-anonymous-short-hair.png')
expect(siteContent.chatFallbackUrl).toBe('https://udify.app/chat/pNigFJHwFSH5pgcY')
expect(typeof siteContent.chatApiUrl).toBe('string')
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/config/content.test.ts`

Expected: FAIL because `userAvatarUrl`, `chatFallbackUrl`, and `chatApiUrl` are missing.

- [ ] **Step 3: Copy the approved asset and implement configuration**

Copy the approved short-haired anonymous avatar supplied in the execution prompt to `public/images/user-avatar-anonymous-short-hair.png`. Add:

```ts
userAvatarUrl: `${import.meta.env.BASE_URL}images/user-avatar-anonymous-short-hair.png`,
chatApiUrl: (import.meta.env.VITE_CHAT_API_URL ?? '').replace(/\/$/, ''),
chatFallbackUrl: 'https://udify.app/chat/pNigFJHwFSH5pgcY',
```

Remove the old `chatUrl` property after all callers migrate.

- [ ] **Step 4: Run the focused test and confirm green**

Run: `npm test -- src/config/content.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add public/images/user-avatar-anonymous-short-hair.png src/config/content.ts src/config/content.test.ts
git commit -m "feat: add approved anonymous user avatar"
```

### Task 2: Parse Dify SSE safely

**Files:**
- Create: `src/chat/types.ts`
- Create: `src/chat/sse.ts`
- Create: `src/chat/sse.test.ts`

- [ ] **Step 1: Write failing parser tests**

Cover chunks split mid-line, blank-line event boundaries, `ping` skipping, JSON parse failure isolation, and final buffer flushing. Use this public contract:

```ts
export type AllowedStreamEvent =
  | { event: 'delta'; answer: string }
  | { event: 'done'; conversationId: string }
  | { event: 'error'; message: string }

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>>
```

Test input:

```ts
const source = [
  'data: {"event":"message","answer":"你",
  '好"}\n\n',
  'event: ping\n\n',
  'data: {"event":"message_end","conversation_id":"conv-1"}\n\n',
]
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/chat/sse.test.ts`

Expected: FAIL because the parser module does not exist.

- [ ] **Step 3: Implement the dependency-free parser**

Use `TextDecoder`, accumulate text until `\n\n`, read only `data:` lines, ignore empty and `[DONE]` payloads, and catch malformed JSON without emitting it. Do not evaluate HTML or scripts.

- [ ] **Step 4: Run the focused test and confirm green**

Run: `npm test -- src/chat/sse.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/chat/types.ts src/chat/sse.ts src/chat/sse.test.ts
git commit -m "feat: add safe Dify stream parser"
```

### Task 3: Add the proxy client and chat session state machine

**Files:**
- Create: `src/chat/chatClient.ts`
- Create: `src/chat/chatClient.test.ts`
- Create: `src/hooks/useChatSession.ts`
- Create: `src/hooks/useChatSession.test.tsx`

- [ ] **Step 1: Write failing client tests**

Define this client contract:

```ts
export interface SendChatInput {
  apiUrl: string
  query: string
  user: string
  conversationId?: string
  signal?: AbortSignal
}

export async function* sendChatMessage(input: SendChatInput): AsyncGenerator<AllowedStreamEvent>
```

Assert that the client posts JSON to `${apiUrl}/api/chat`, throws a typed configuration error for an empty URL, maps `message` and `agent_message` to `delta`, maps `message_end` to `done`, and maps upstream `error` to the safe public message.

- [ ] **Step 2: Write failing hook tests**

Mock `sendChatMessage`. Assert optimistic user rendering, assistant streaming concatenation, send locking, retained input after failure, persisted anonymous user ID, persisted conversation ID, and reset behavior. Use localStorage keys `jiang-xiaoman-user-v1` and `jiang-xiaoman-conversation-v1`.

- [ ] **Step 3: Run focused tests and confirm red**

Run: `npm test -- src/chat/chatClient.test.ts src/hooks/useChatSession.test.tsx`

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement the client and hook**

Use these public hook values:

```ts
export interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  status: 'complete' | 'streaming' | 'error'
}

export interface ChatSession {
  messages: ChatMessage[]
  draft: string
  isSending: boolean
  error: string
  setDraft(value: string): void
  send(): Promise<void>
  retry(): Promise<void>
  reset(): void
}
```

Create IDs with `crypto.randomUUID()` when available and a timestamp/random fallback in tests. Abort active work on unmount and reset. Never store message contents in localStorage.

- [ ] **Step 5: Run focused tests and confirm green**

Run: `npm test -- src/chat/chatClient.test.ts src/hooks/useChatSession.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/chat src/hooks/useChatSession.ts src/hooks/useChatSession.test.tsx
git commit -m "feat: add custom chat session flow"
```

### Task 4: Replace the iframe with the approved conversation UI

**Files:**
- Create: `src/components/MessageBubble.tsx`
- Create: `src/components/MessageBubble.test.tsx`
- Create: `src/components/ChatComposer.tsx`
- Create: `src/components/ChatComposer.test.tsx`
- Replace: `src/components/ChatPanel.tsx`
- Replace: `src/components/ChatPanel.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Assert:

```ts
expect(screen.queryByTitle('与江小满对话')).not.toBeInTheDocument()
expect(screen.getByRole('img', { name: '江小满' })).toHaveAttribute('src', expect.stringContaining('jiang-xiaoman-original.png'))
expect(screen.getByRole('img', { name: '你' })).toHaveAttribute('src', expect.stringContaining('user-avatar-anonymous-short-hair.png'))
expect(screen.queryByText(/Token|耗时|点赞|Dify 测试替身/)).not.toBeInTheDocument()
```

Test Enter to send, Shift+Enter to keep a newline, whitespace-only blocking, disabled send while streaming, safe plain-text rendering of `<script>alert(1)</script>`, reset confirmation copy, retry, and fallback-link visibility when service is unconfigured.

- [ ] **Step 2: Run focused tests and confirm red**

Run: `npm test -- src/components/MessageBubble.test.tsx src/components/ChatComposer.test.tsx src/components/ChatPanel.test.tsx`

Expected: FAIL against the old iframe panel.

- [ ] **Step 3: Implement the components**

Render message text as a React text node. Use one `<ol aria-live="polite">` for messages, one `<textarea aria-label="和江小满聊天">`, and a button named `发送`. Give each avatar meaningful alt text and keep the original Dify URL only in an auxiliary `直接打开原对话` link.

- [ ] **Step 4: Apply the approved visual system**

Replace iframe-only rules with `.chat-window`, `.message-list`, `.message-row--assistant`, `.message-row--user`, `.message-bubble`, `.typing-indicator`, and `.chat-composer`. Required values:

```css
.message-row--user { flex-direction: row-reverse; }
.message-row--assistant .message-bubble { background: #fff; color: #493530; border-bottom-left-radius: 5px; }
.message-row--user .message-bubble { background: #60798d; color: #fff; border-bottom-right-radius: 5px; }
.message-avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
.message-bubble { max-width: 72%; white-space: pre-wrap; overflow-wrap: anywhere; }
```

At `max-width: 800px`, set bubble max width to `82%`, keep the composer sticky within the conversation column, and preserve the existing hero behavior.

- [ ] **Step 5: Run focused tests and confirm green**

Run: `npm test -- src/components/MessageBubble.test.tsx src/components/ChatComposer.test.tsx src/components/ChatPanel.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components src/styles.css
git commit -m "feat: replace Dify iframe with branded chat window"
```

### Task 5: Build the secret-safe Vercel proxy

**Files:**
- Create: `api/chat-core.ts`
- Create: `api/chat-core.test.ts`
- Create: `api/chat.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.node.json`

- [ ] **Step 1: Add server typings**

Run: `npm install -D @vercel/node@12.0.0`

Then include `api/**/*.ts` in `tsconfig.node.json` and add `"types": ["node"]` to its compiler options.

- [ ] **Step 2: Write failing proxy-core tests**

Test these exports:

```ts
export const MAX_QUERY_LENGTH = 4000
export function isAllowedOrigin(origin: string | undefined, allowed: string[]): boolean
export function validateBody(value: unknown): { query: string; user: string; conversationId?: string }
export function createDifyRequest(body: ReturnType<typeof validateBody>, apiKey: string): RequestInit
export function publicError(status: number): { status: number; message: string }
```

Cover missing/invalid body, 4001-character query, invalid user ID, exact origin matching, bearer header creation, and safe mappings for 401/403/429/5xx. Assert that serialized public errors never contain the supplied fake key.

- [ ] **Step 3: Run the focused test and confirm red**

Run: `npm test -- api/chat-core.test.ts`

Expected: FAIL because the proxy core does not exist.

- [ ] **Step 4: Implement the proxy core and handler**

Allowed production origin: `https://hiack.github.io`. Allowed local origins: `http://127.0.0.1:4173` and `http://localhost:4173`. The handler must:

```ts
if (req.method === 'OPTIONS') return res.status(204).end()
if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })
if (!process.env.DIFY_API_KEY) return res.status(503).json({ message: '对话服务尚未完成配置。' })
```

Post to `https://api.dify.ai/v1/chat-messages` with `response_mode: 'streaming'`, `inputs: {}`, and the validated fields. Pipe `text/event-stream` chunks without logging body or headers. Set `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and the exact allowed `Access-Control-Allow-Origin` value.

- [ ] **Step 5: Run the focused test and confirm green**

Run: `npm test -- api/chat-core.test.ts`

Expected: PASS.

- [ ] **Step 6: Run type checking**

Run: `npm run check`

Expected: exit 0.

- [ ] **Step 7: Commit**

```powershell
git add api package.json package-lock.json tsconfig.node.json
git commit -m "feat: add secure Dify streaming proxy"
```

### Task 6: Prepare deployment without adding a secret

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `scripts/verify-dist.mjs`
- Create: `vercel.json`

- [ ] **Step 1: Update environment documentation**

`.env.example` must contain names only, never a real value:

```dotenv
VITE_CHAT_API_URL=
DIFY_API_KEY=
```

Add `vercel.json`:

```json
{
  "functions": { "api/chat.ts": { "maxDuration": 60 } },
  "headers": [{ "source": "/api/(.*)", "headers": [{ "key": "Cache-Control", "value": "no-store" }] }]
}
```

- [ ] **Step 2: Inject only the public proxy URL into Pages builds**

Set job-level environment in `.github/workflows/deploy-pages.yml`:

```yaml
env:
  VITE_CHAT_API_URL: ${{ vars.VITE_CHAT_API_URL }}
```

Do not reference `DIFY_API_KEY` in the Pages workflow.

- [ ] **Step 3: Strengthen distribution verification**

Require `user-avatar-anonymous-short-hair.png`, the text `和江小满聊天`, and the approved fallback URL. Retain the existing secret patterns. Do not add a guessed Dify-key pattern and never hard-code the real key in the verifier.

- [ ] **Step 4: Run build and distribution checks**

Run: `npm run build && npm run verify:dist`

Expected: build succeeds and output ends with `VERIFY_DIST_PASS`.

- [ ] **Step 5: Commit**

```powershell
git add .env.example .github/workflows/deploy-pages.yml scripts/verify-dist.mjs vercel.json
git commit -m "chore: prepare secure chat deployment"
```

### Task 7: Browser tests and keyless handoff report

**Files:**
- Replace: `e2e/home.spec.ts`
- Create: `reports/pi-custom-chat-report.md`

- [ ] **Step 1: Replace iframe E2E tests with proxy-mocked tests**

Route `**/api/chat` and fulfill a deterministic SSE response containing `message` chunks and `message_end`. Assert desktop two-column layout, mobile stacked layout, both real avatar assets, no iframe, no horizontal overflow, send flow, streaming completion, and reset.

```ts
await page.route('**/api/chat', route => route.fulfill({
  status: 200,
  contentType: 'text/event-stream',
  body: 'data: {"event":"message","answer":"我在呢。"}\n\ndata: {"event":"message_end","conversation_id":"conv-e2e"}\n\n',
}))
```

- [ ] **Step 2: Run the entire verification matrix**

Run in order:

```powershell
npm test
npm run check
npm run build
npm run verify:dist
npm run test:e2e
git diff --check
git status --short
```

Expected: all commands exit 0; Vitest has no failures; Playwright desktop/mobile cases pass; only the planned report may remain untracked before its commit.

- [ ] **Step 3: Scan for secrets**

Run:

```powershell
rg -n --hidden -g '!node_modules/**' -g '!dist/**' -g '!.git/**' 'Bearer\s+[A-Za-z0-9._-]{16,}|DIFY_API_KEY\s*=\s*[^\s#]+' .
```

Expected: no real bearer value and no non-empty `DIFY_API_KEY`; occurrences in test fixtures and verifier regexes must use unmistakably fake values.

- [ ] **Step 4: Write the Pi report**

Record files changed, commands and exact pass counts, commits, known deployment prerequisites, and this blocking line verbatim:

`READY_FOR_SECRET_SETUP: true — no real Dify API key was requested, stored, or committed.`

- [ ] **Step 5: Commit**

```powershell
git add e2e/home.spec.ts reports/pi-custom-chat-report.md
git commit -m "test: verify custom chat without secrets"
```

## Execution stop condition

Stop after Task 7. Do not push the feature branch, deploy Vercel, create environment variables, request the Dify API Key, or change the production GitHub Pages site. Return control to Codex for independent review and the separate secret-entry step.
