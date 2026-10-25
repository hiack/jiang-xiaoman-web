import { createHash } from 'node:crypto';

type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };
type Item = { meal: number; status: 'planned' | 'eaten'; grams: number; per100: Nutrients; estimated: boolean; carbBasis: 'total' | 'available' | 'label' };
type Input = { version: 1; goal: Nutrients; items: Item[] };
type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body: unknown };
type Response = { status(code: number): Response; json(value: unknown): void; setHeader(name: string, value: string): void; end(): void };
const keys = ['kcal', 'protein', 'carbs', 'fat'] as const;
const originAllowed = 'https://training.tangzhaochu.com';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const exact = (value: Record<string, unknown>, names: string[]) => Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
const nutrients = (value: unknown, food: boolean): value is Nutrients => object(value) && exact(value, [...keys]) && keys.every((key) => finite(value[key], key === 'kcal' ? food ? 1000 : 4500 : food ? 100 : 1200));

/** Closed input contract prevents incidental identity, food names, and free text from being forwarded. */
export function validateReview(value: unknown): Input {
  if (!object(value) || !exact(value, ['version', 'goal', 'items']) || value.version !== 1 || !nutrients(value.goal, false) || value.goal.kcal < 1200 || !Array.isArray(value.items) || !value.items.length || value.items.length > 60) throw new Error('input');
  for (const item of value.items) {
    if (!object(item) || !exact(item, ['meal', 'status', 'grams', 'per100', 'estimated', 'carbBasis']) || !Number.isInteger(item.meal) || !finite(item.meal, 3) || !['eaten', 'planned'].includes(String(item.status)) || !finite(item.grams, 3000) || Number(item.grams) < .1 || !nutrients(item.per100, true) || typeof item.estimated !== 'boolean' || !['total', 'available', 'label'].includes(String(item.carbBasis))) throw new Error('input');
  }
  if (!value.items.some((item) => item.status === 'eaten')) throw new Error('input');
  return value as unknown as Input;
}

/** The model can order supported findings, but cannot supply nutrient figures or write records. */
export function calculateFacts(input: Input) {
  const eaten: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 }, planned = { ...eaten };
  for (const item of input.items) for (const key of keys) (item.status === 'eaten' ? eaten : planned)[key] += item.per100[key] * item.grams / 100;
  const consumed = input.items.filter((item) => item.status === 'eaten');
  const findings = ['coverage'];
  if (consumed.some((item) => item.estimated)) findings.push('estimated');
  if (new Set(consumed.map((item) => item.carbBasis)).size > 1) findings.push('mixed_carbs');
  if (eaten.kcal > input.goal.kcal) findings.push('energy_above');
  if (eaten.protein < input.goal.protein) findings.push('protein_remaining');
  if (input.items.some((item) => item.status === 'planned')) findings.push('planned_separate');
  const display = (value: Nutrients) => Object.fromEntries(keys.map((key) => [key, Math.round(value[key] * 10) / 10]));
  return { eaten: display(eaten), planned: display(planned), goal: input.goal, recordedMeals: [...new Set(consumed.map((item) => item.meal))], findings };
}

export function validatePriorities(answer: unknown, findings: string[]) {
  if (typeof answer !== 'string' || answer.length > 1500) throw new Error('output');
  const value = JSON.parse(answer);
  if (!object(value) || !exact(value, ['priorities']) || !Array.isArray(value.priorities) || !value.priorities.length || value.priorities.length > 3 || new Set(value.priorities).size !== value.priorities.length || !value.priorities.every((id) => typeof id === 'string' && findings.includes(id))) throw new Error('output');
  return value.priorities as string[];
}

function authBase() {
  const raw = process.env.NUTRITION_AUTH_URL, url = raw && new URL(raw);
  if (!url || url.protocol !== 'https:' || url.origin !== raw) throw new Error('config');
  return url.origin;
}

async function authorize(req: Request, operation: string) {
  const token = req.headers.authorization;
  if (typeof token !== 'string' || !/^Bearer [a-f0-9]{64}$/.test(token)) throw new Error('login');
  const response = await fetch(`${authBase()}/api/nutrition/permit`, { method: 'POST', headers: { Authorization: token, Origin: originAllowed, 'Content-Type': 'application/json' }, body: JSON.stringify({ operation }), redirect: 'error', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(response.status === 429 ? 'quota' : response.status === 401 ? 'login' : response.status === 403 ? 'forbidden' : 'auth');
  const result = await response.json();
  if (result.accountId !== process.env.NUTRITION_OWNER_ACCOUNT_ID) throw new Error('forbidden');
  return 'nutrition-' + createHash('sha256').update(result.accountId).digest('hex').slice(0, 48);
}

async function runReview(input: Input, user: string) {
  const facts = calculateFacts(input);
  const query = `NUTRITION_REVIEW_V1\n仅从 findings 中选择最多3个需要优先提醒的标识。只能返回JSON {"priorities":["标识"]}。不得增加数字、诊断、价格、遗漏食物推断或任何其他字段。事实由程序计算：${JSON.stringify(facts)}`;
  const response = await fetch('https://api.dify.ai/v1/chat-messages', { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${process.env.NUTRITION_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs: {}, query, user, response_mode: 'blocking', auto_generate_name: false }), signal: AbortSignal.timeout(35_000) });
  if (!response.ok) throw new Error('upstream');
  const result = await response.json();
  if (typeof result.conversation_id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(result.conversation_id)) throw new Error('upstream');
  return { facts, priorities: validatePriorities(result.answer, facts.findings), conversation_id: result.conversation_id };
}

async function deleteReview(value: unknown, user: string) {
  if (!object(value) || !exact(value, ['conversation_id']) || typeof value.conversation_id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value.conversation_id)) throw new Error('input');
  const response = await fetch(`https://api.dify.ai/v1/conversations/${value.conversation_id}`, { method: 'DELETE', redirect: 'error', headers: { Authorization: `Bearer ${process.env.NUTRITION_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user }), signal: AbortSignal.timeout(10_000) });
  if (response.status !== 204) throw new Error('upstream');
  return { accepted: true, scope: 'conversation-api', fullErasureVerified: false };
}

const errors: Record<string, [number, string]> = { login: [401, '请先登录个人使用账号。'], forbidden: [403, '当前仅向个人使用账号开放。'], quota: [429, '今日复盘调用次数已用完，请先使用本机复盘。'], input: [400, '请核对复盘内容。'] };
export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Origin');
  if (req.headers.origin !== originAllowed) { res.status(403).json({ message: '当前来源未开放。' }); return; }
  res.setHeader('Access-Control-Allow-Origin', originAllowed); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const configured = !!(process.env.NUTRITION_REVIEW_ENABLED === 'true' && process.env.NUTRITION_OWNER_ACCOUNT_ID && process.env.NUTRITION_AUTH_URL && process.env.NUTRITION_API_KEY);
  if (req.method === 'GET') { res.json({ configured }); return; }
  if (!['POST', 'DELETE'].includes(req.method ?? '')) { res.status(405).json({ message: '请求方式不受支持。' }); return; }
  if (!configured) { res.status(503).json({ message: '个人版 AI 尚待绑定登录账号，请先使用本机复盘。' }); return; }
  try {
    const input = req.method === 'POST' ? validateReview(req.body) : null;
    const user = await authorize(req, input ? 'review' : 'delete');
    res.json(input ? await runReview(input, user) : await deleteReview(req.body, user));
  } catch (cause) {
    const [status, message] = errors[cause instanceof Error ? cause.message : ''] ?? [502, 'AI 复盘暂时不可用，本机计算结果仍可查看。'];
    res.status(status).json({ message });
  }
}
