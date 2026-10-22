/** First-party UI transport. This function is self-contained for the Vercel ESM builder. */
interface RequestLike { method?: string; headers: Record<string, string | string[] | undefined>; body: unknown }
interface ResponseLike {
  status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void;
  write(chunk: string): boolean; flushHeaders(): void; end(): void; on?(event: string, callback: () => void): void;
}
const ORIGINS = ['https://training.tangzhaochu.com'];
const IDS = /^[a-zA-Z0-9_-]{1,64}$/;
const ERROR = '对话暂时没有回应，请稍后重新发送。';
const attempts = new Map<string, { count: number; until: number }>();

export function validateNutritionBody(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
  const body = value as Record<string, unknown>;
  if (typeof body.query !== 'string' || !body.query.trim() || body.query.length > 2000) throw new Error('invalid');
  if (typeof body.user !== 'string' || !IDS.test(body.user)) throw new Error('invalid');
  if (body.conversation_id !== undefined && (typeof body.conversation_id !== 'string' || !IDS.test(body.conversation_id))) throw new Error('invalid');
  return { inputs: {}, query: body.query.trim(), user: body.user, response_mode: 'streaming', ...(body.conversation_id ? { conversation_id: body.conversation_id } : {}) };
}

/** Best-effort per-instance limiter, not an account-wide quota or identity control. */
function allowAttempt(req: RequestLike) {
  const address = req.headers['x-vercel-forwarded-for'];
  const ip = typeof address === 'string' ? address.slice(0, 128) : 'unknown';
  const now = Date.now();
  for (const [key, item] of attempts) if (item.until < now) attempts.delete(key);
  const item = attempts.get(ip) || { count: 0, until: now + 60_000 };
  if (attempts.size >= 2000 && !attempts.has(ip)) return false;
  attempts.set(ip, item); item.count += 1;
  return item.count <= 12;
}

export function normalizeNutritionEvent(raw: string) {
  const text = raw.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
  if (!text || text === '[DONE]') return null;
  let event: Record<string, unknown>;
  try { event = JSON.parse(text); } catch { return null; }
  if (!event || typeof event !== 'object') return null;
  if ((event.event === 'message' || event.event === 'agent_message') && typeof event.answer === 'string') return { event: 'message', answer: event.answer };
  if (event.event === 'message_end' && typeof event.conversation_id === 'string' && IDS.test(event.conversation_id)) return { event: 'message_end', conversation_id: event.conversation_id };
  if (event.event === 'error') return { event: 'error', message: ERROR };
  return null;
}

async function pipeNutrition(body: ReadableStream<Uint8Array>, res: ResponseLike) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let pending = '', total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done }).replace(/\r/g, '');
      let boundary = pending.indexOf('\n\n');
      while (boundary >= 0) {
        const event = normalizeNutritionEvent(pending.slice(0, boundary)); pending = pending.slice(boundary + 2);
        if (event) { const text = `data: ${JSON.stringify(event)}\n\n`; total += text.length; if (total > 131072) throw new Error('limit'); res.write(text); }
        boundary = pending.indexOf('\n\n');
      }
      if (pending.length > 65536) throw new Error('limit');
      if (chunk.done) break;
    }
    const event = normalizeNutritionEvent(pending);
    if (event) res.write(`data: ${JSON.stringify(event)}\n\n`);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

async function respondNutrition(body: ReturnType<typeof validateNutritionBody>, res: ResponseLike) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 50_000);
  res.on?.('close', () => controller.abort());
  try {
    const upstream = await fetch('https://api.dify.ai/v1/chat-messages', { method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.NUTRITION_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!upstream.ok || !upstream.body) { res.status(upstream.status === 429 ? 429 : 502).json({ message: ERROR }); return; }
    res.status(200); res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.flushHeaders();
    try { await pipeNutrition(upstream.body, res); } catch { res.write(`data: ${JSON.stringify({ event: 'error', message: ERROR })}\n\n`); }
    res.end();
  } catch { res.status(502).json({ message: ERROR }); } finally { clearTimeout(timer); }
}

export default async function nutritionHandler(req: RequestLike, res: ResponseLike) {
  const origin = req.headers.origin;
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (typeof origin !== 'string' || !ORIGINS.includes(origin)) { res.status(403).json({ message: '来源不受支持。' }); return; }
  res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ message: '请求方式不受支持。' }); return; }
  if (!process.env.NUTRITION_API_KEY) { res.status(503).json({ message: '对话服务准备中，请稍后再来。' }); return; }
  let body: ReturnType<typeof validateNutritionBody>;
  try { body = validateNutritionBody(req.body); } catch { res.status(400).json({ message: '请检查消息内容。' }); return; }
  if (!allowAttempt(req)) { res.status(429).json({ message: '请稍后再试。' }); return; }
  await respondNutrition(body, res);
}
