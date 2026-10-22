import { afterEach, expect, test, vi } from 'vitest';
import handler, { normalizeNutritionEvent, validateNutritionBody } from '../api/nutrition';
afterEach(() => { delete process.env.NUTRITION_API_KEY; vi.unstubAllGlobals(); });
const origin = 'https://training.tangzhaochu.com';
const request = (body: unknown = { query: '虚构案例：晚餐', user: 'test-user' }, source = origin, method = 'POST') => ({ method, headers: { origin: source, 'x-vercel-forwarded-for': 'test-' + crypto.randomUUID() }, body });
function response() {
  return { code: 0, body: undefined as unknown, headers: {} as Record<string, string>, written: '', ended: false,
    status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; },
    setHeader(key: string, value: string) { this.headers[key] = value; }, write(text: string) { this.written += text; return true; },
    flushHeaders() {}, end() { this.ended = true; } };
}
test('strips unrelated inputs and bounds query/ids', () => {
  expect(validateNutritionBody({ query: '  虚构案例  ', user: 'visitor', profile: 'never-send', inputs: { injected: true } })).toEqual({ query: '虚构案例', user: 'visitor', response_mode: 'streaming', inputs: {} });
  for (const body of [null, [], { query: '', user: 'x' }, { query: 'x'.repeat(2001), user: 'x' }, { query: 'x', user: 'bad id' }, { query: 'x', user: 'u', conversation_id: 'bad/id' }]) expect(() => validateNutritionBody(body)).toThrow();
});
test('normalizes only public fields and removes workflow/error internals', () => {
  expect(normalizeNutritionEvent('data: {"event":"message","answer":"示例","secret":"never"}')).toEqual({ event: 'message', answer: '示例' });
  expect(normalizeNutritionEvent('data: {"event":"workflow_started","secret":"never"}')).toBeNull();
  expect(JSON.stringify(normalizeNutritionEvent('data: {"event":"error","message":"private"}'))).not.toContain('private');
});
test('rejects foreign origins and accepts exact-origin preflight', async () => {
  const bad = response(); await handler(request(undefined, origin + '.evil.test'), bad); expect(bad.code).toBe(403);
  const good = response(); await handler(request(undefined, origin, 'OPTIONS'), good); expect(good.code).toBe(204); expect(good.headers['Access-Control-Allow-Origin']).toBe(origin);
});
test('fails closed without nutrition key even when companion key exists', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const res = response(); await handler(request(), res); expect(res.code).toBe(503); expect(fetcher).not.toHaveBeenCalled();
});
test('forwards synthetic text with the dedicated server credential and streams safe fields', async () => {
  process.env.NUTRITION_API_KEY = 'test-only-not-real';
  const fetcher = vi.fn().mockResolvedValue(new Response('data: {"event":"message","answer":"虚构回复","metadata":{"private":true}}\n\ndata: {"event":"message_end","conversation_id":"conv-example"}\n\n'));
  vi.stubGlobal('fetch', fetcher);
  const res = response(); await handler(request(), res);
  expect(res.code).toBe(200); expect(res.written).toContain('虚构回复'); expect(res.written).not.toMatch(/metadata|private|test-only/);
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only-not-real');
});
test('hides upstream error details and bounds repeated requests per instance', async () => {
  process.env.NUTRITION_API_KEY = 'test-only-not-real';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private upstream detail', { status: 401 })));
  const req = request(); let last = response();
  for (let n = 0; n < 13; n++) { last = response(); await handler(req, last); }
  expect(last.code).toBe(429); expect(JSON.stringify(last)).not.toContain('private upstream');
});
