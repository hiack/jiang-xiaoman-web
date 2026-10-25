import { afterEach, expect, test, vi } from 'vitest';
import handler, { calculateFacts, validatePriorities, validateReview } from '../api/nutrition-review';

const owner = 'ea5d8a37-cc11-4d89-afd2-4ce0eb8e937c';
const input = { version: 1, goal: { kcal: 2000, protein: 100, carbs: 250, fat: 66.6666666667 }, items: [
  { meal: 0, status: 'eaten', grams: 150, per100: { kcal: 200, protein: 10, carbs: 20, fat: 8 }, estimated: true, carbBasis: 'available' },
  { meal: 1, status: 'planned', grams: 100, per100: { kcal: 130, protein: 2.38, carbs: 28.6, fat: .21 }, estimated: false, carbBasis: 'total' },
] };
function response() {
  return { code: 200, data: null as unknown, headers: {} as Record<string,string>, status(code: number) { this.code = code; return this; }, json(value: unknown) { this.data = value; }, setHeader(name: string, value: string) { this.headers[name] = value; }, end() {} };
}
const request = (body: unknown = input, method = 'POST') => ({ method, body, headers: { origin: 'https://training.tangzhaochu.com', authorization: 'Bearer ' + 'a'.repeat(64) } });
function configure() { process.env.NUTRITION_REVIEW_ENABLED = 'true'; process.env.NUTRITION_OWNER_ACCOUNT_ID = owner; process.env.NUTRITION_AUTH_URL = 'https://auth.test'; process.env.NUTRITION_API_KEY = 'fixture-never-real'; }
afterEach(() => { for (const key of ['NUTRITION_REVIEW_ENABLED', 'NUTRITION_OWNER_ACCOUNT_ID', 'NUTRITION_AUTH_URL', 'NUTRITION_API_KEY']) delete process.env[key]; vi.unstubAllGlobals(); });

test('testComputesFactsAndSeparatesPlanswhenReviewUsesClosedInput', () => {
  const facts = calculateFacts(validateReview(input));
  expect(facts.eaten).toEqual({ kcal: 300, protein: 15, carbs: 30, fat: 12 });
  expect(facts.planned.kcal).toBe(130);
  expect(facts.findings).toEqual(['coverage', 'estimated', 'protein_remaining', 'planned_separate']);
});
test.each([{ ...input, user: 'spoof' }, { ...input, goal: { ...input.goal, kcal: Number.NaN } }, { ...input, items: [] }, { ...input, items: Array(61).fill(input.items[0]) }, { ...input, items: [{ ...input.items[0], name: 'private' }] }, { ...input, items: [{ ...input.items[0], grams: 0 }] }])('testRejectsExtraAndInvalidDatawhenPreparingReview %#', (value) => {
  expect(() => validateReview(value)).toThrow();
});
test.each(['{"priorities":["invented_diagnosis"]}', '{"priorities":["coverage"],"kcal":9999}', '{"priorities":["coverage","coverage"]}', '请通过跳餐补偿。'])('testRejectsUncontractedModelOutputwhenAnswerIs%s', (answer) => {
  expect(() => validatePriorities(answer, ['coverage'])).toThrow();
});
test('testMakesNoNetworkCallwhenPersonalAccountIsNotEnabled', async () => {
  const network = vi.fn(); vi.stubGlobal('fetch', network); const res = response();
  await handler(request(), res); expect(res.code).toBe(503); expect(network).not.toHaveBeenCalled();
});
test('testUsesVerifiedIdentityAndComputedFactswhenOwnerRequestsReview', async () => {
  configure(); const network = vi.fn().mockResolvedValueOnce(Response.json({ accountId: owner }))
    .mockResolvedValueOnce(Response.json({ answer: '{"priorities":["estimated","coverage"]}', conversation_id: 'review-one' }));
  vi.stubGlobal('fetch', network); const res = response(); await handler(request(), res);
  expect(res.code).toBe(200); expect(res.data).toMatchObject({ priorities: ['estimated', 'coverage'], conversation_id: 'review-one' });
  const upstream = JSON.parse(network.mock.calls[1][1].body);
  expect(upstream.user).toMatch(/^nutrition-[a-f0-9]{48}$/); expect(upstream.user).not.toContain(owner);
  expect(upstream.query).not.toContain('per100'); expect(upstream.query).not.toContain('grams');
  expect(network.mock.calls[1][1].headers.Authorization).toBe('Bearer fixture-never-real');
  expect(JSON.stringify(res.data)).not.toContain('fixture-never-real');
});
test.each([401, 403, 429])('testStopsBeforeModelwhenAuthorizationReturns%i', async (status) => {
  configure(); const network = vi.fn().mockResolvedValue(new Response('private detail', { status }));
  vi.stubGlobal('fetch', network); const res = response(); await handler(request(), res);
  expect(res.code).toBe(status); expect(network).toHaveBeenCalledTimes(1); expect(JSON.stringify(res.data)).not.toContain('private detail');
});
test('testDeletesOnlyVerifiedOwnersConversationwhenUpstreamAcceptsDeletion', async () => {
  configure(); const network = vi.fn().mockResolvedValueOnce(Response.json({ accountId: owner })).mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', network); const res = response(); await handler(request({ conversation_id: 'review-one' }, 'DELETE'), res);
  expect(res.data).toEqual({ accepted: true, scope: 'conversation-api', fullErasureVerified: false });
  expect(JSON.parse(network.mock.calls[0][1].body)).toEqual({ operation: 'delete' });
  expect(JSON.parse(network.mock.calls[1][1].body).user).toMatch(/^nutrition-/);
});
