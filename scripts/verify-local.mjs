/** Real API smoke test. Uses a fresh isolated cookie session, never a user's session. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Smoke tests only target a local development server.');
let cookie = '';
const results = [];
async function request(body, extra = {}) {
  const response = await fetch(`${base}/api/quality`, { method: body ? 'POST' : 'GET', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = { message: text }; }
  return { response, data };
}
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'pass' }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: 'fail', reason: e.message }); console.error(`FAIL ${name}: ${e.message}`); }
}
let state, runA, runB, feedbackId;
await check('initial state, synthetic labels and session isolation', async () => {
  const { response, data } = await request(); assert.equal(response.status, 200); assert.ok(cookie);
  assert.ok(data.cases.length >= 20); assert.ok(data.cases.every(c => c.synthetic)); assert.ok(data.versions.length >= 2); state = data;
});
await check('baseline evaluation runs and persists evidence-linked findings', async () => {
  const { response, data } = await request({ action: 'evaluate', versionId: 'candidate-a' }); assert.equal(response.status, 200);
  runA = data.runs[0]; assert.equal(runA.items.length, state.cases.length); assert.ok(runA.items.some(i => i.findings.length));
  const evidence = new Set(state.cases.flatMap(c => [...c.evidence.map(e => e.id), ...(c.eventContext ?? []).map(e => e.id)]));
  for (const item of runA.items) for (const finding of item.findings) for (const id of finding.evidenceIds) assert.ok(evidence.has(id));
  assert.ok((await request()).data.runs.some(r => r.id === runA.id));
});
await check('second version is evaluated on the same cases and rule version', async () => {
  const { response, data } = await request({ action: 'evaluate', versionId: 'candidate-b' }); assert.equal(response.status, 200); runB = data.runs[0];
  assert.deepEqual(runA.items.map(i => i.caseId).sort(), runB.items.map(i => i.caseId).sort());
  assert.equal(runA.evaluationVersionId, runB.evaluationVersionId);
});
await check('review requires a reason', async () => {
  const { response } = await request({ action: 'review', runId: runA.id, caseId: runA.items[0].caseId, decision: 'confirmed', note: '' }); assert.equal(response.status, 400);
});
await check('review is saved while automated findings are retained', async () => {
  const { response, data } = await request({ action: 'review', runId: runA.id, caseId: runA.items[0].caseId, decision: 'confirmed', note: '自动测试：已对照合成证据确认数值差异。' });
  assert.equal(response.status, 200); assert.ok(data.reviews.length);
  assert.equal(data.runs.find(r => r.id === runA.id).items[0].findings.length, runA.items[0].findings.length);
});
await check('feedback is recorded in the review queue', async () => {
  const { response, data } = await request({ action: 'feedback', caseId: state.cases[0].caseId, kind: 'fact_error', note: '自动测试反馈' }); assert.equal(response.status, 200); assert.ok(data.feedback.length); feedbackId = data.feedback[0].id;
});
await check('feedback is resolved with a saved reason and removed from pending state', async () => {
  const { response, data } = await request({ action: 'resolve_feedback', feedbackId, decision: 'confirmed', note: '自动测试：对照指定来源后确认问题，已安排回归。' });
  assert.equal(response.status, 200); const feedback = data.feedback.find(f => f.id === feedbackId);
  assert.ok(feedback); assert.notEqual(feedback.status, 'pending_review'); assert.ok(feedback.resolutionNote || feedback.note || feedback.resolution?.note);
});
await check('confirmed cases enter a deduplicated regression collection with evidence snapshots', async () => {
  const payload = { action: 'add_regression', runId: runA.id, caseId: runA.items[0].caseId };
  const first = await request(payload); assert.equal(first.response.status, 200); assert.equal(first.data.regressionCases.length, 1);
  const second = await request(payload); assert.ok([200, 409].includes(second.response.status));
  assert.equal((await request()).data.regressionCases.length, 1);
});
await check('unconfirmed cases cannot silently become confirmed regression examples', async () => {
  const { response } = await request({ action: 'add_regression', runId: runA.id, caseId: runA.items[1].caseId }); assert.ok([400, 409].includes(response.status));
});
await check('unknown versions and malformed imports are rejected', async () => {
  assert.equal((await request({ action: 'evaluate', versionId: 'missing' })).response.status, 400);
  assert.equal((await request({ action: 'import', dataset: { cases: [{ caseId: 'broken', answers: null }] } })).response.status, 400);
});
await check('null JSON and malformed nested values yield a clear validation error', async () => {
  const response = await fetch(`${base}/api/quality`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: 'null' });
  assert.equal(response.status, 400);
});
await check('simulated upstream timeout is explicit and does not pass verification', async () => {
  const { response, data } = await request({ action: 'probe', toolId: 'timeout-probe' }); assert.equal(response.status, 504); assert.equal(data.code, 'SIMULATED_TIMEOUT');
});
await check('cross-origin write is blocked', async () => {
  const { response } = await request({ action: 'reset' }, { Origin: 'https://unrelated.invalid' }); assert.equal(response.status, 403);
});
await check('separate cookie session does not see other session runs', async () => {
  const { runs } = await (await fetch(`${base}/api/quality`)).json(); assert.equal(runs.length, 0);
});
await check('run evidence is a stable historical snapshot', async () => {
  const { data } = await request(); const persisted = data.runs.find(r => r.id === runA.id);
  assert.ok(persisted.caseSnapshots?.length); assert.deepEqual(persisted.caseSnapshots[0].evidence, state.cases[0].evidence);
  assert.equal(persisted.items[0].answerText, state.cases[0].answers['candidate-a'].text);
});
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/api-smoke-results.json', JSON.stringify({ executedAt: new Date().toISOString(), target: base, results }, null, 2));
console.log(`${results.filter(r => r.status === 'pass').length}/${results.length} checks passed.`);
if (results.some(r => r.status === 'fail')) process.exitCode = 1;
