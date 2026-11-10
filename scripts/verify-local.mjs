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
  assert.ok(Array.isArray(data.behaviorEvents)); assert.equal(data.behaviorEvents.length, 0);
});
await check('view and successful-copy behavior events persist in the current session', async () => {
  for (const type of ['answer_view', 'evidence_view', 'answer_copy']) {
    const { response, data } = await request({ action: 'record_behavior', caseId: state.cases[0].caseId, type });
    assert.equal(response.status, 200); assert.ok(data.behaviorEvents.some(e => e.caseId === state.cases[0].caseId && e.type === type));
  }
  const invalid = await request({ action: 'record_behavior', caseId: state.cases[0].caseId, type: 'regenerate' });
  assert.equal(invalid.response.status, 400);
  const refreshed = await request(); assert.equal(refreshed.data.behaviorEvents.length, 3);
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
  assert.ok(data.behaviorEvents.some(e => e.type === 'reevaluate' && runB.items.some(i => i.caseId === e.caseId)));
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
  const { runs, behaviorEvents } = await (await fetch(`${base}/api/quality`)).json(); assert.equal(runs.length, 0); assert.equal(behaviorEvents.length, 0);
});
await check('run evidence is a stable historical snapshot', async () => {
  const { data } = await request(); const persisted = data.runs.find(r => r.id === runA.id);
  assert.ok(persisted.caseSnapshots?.length); assert.deepEqual(persisted.caseSnapshots[0].evidence, state.cases[0].evidence);
  assert.equal(persisted.items[0].answerText, state.cases[0].answers['candidate-a'].text);
});
await check('an actual manual revision creates a new version and improves the selected answer without changing history', async () => {
  const fixed = '合成证据快照显示虚构基金甲在2026年10月收益率为2.4%。该数据仅用于演示。';
  const revision = await request({ action: 'revise', caseId: state.cases[0].caseId, sourceVersionId: 'candidate-a', answerText: fixed, note: '依据ev-case-fact-1更正错误数字，未使用外部模型。' });
  assert.equal(revision.response.status, 200);
  const version = revision.data.versions.find(v => v.sourceVersionId === 'candidate-a' && v.model.includes('人工修订')); assert.ok(version);
  const evaluated = await request({ action: 'evaluate', versionId: version.id, caseIds: [state.cases[0].caseId] });
  assert.equal(evaluated.response.status, 200); assert.equal(evaluated.data.runs[0].items[0].answerProvenance, 'manual'); assert.equal(evaluated.data.runs[0].items[0].overallStatus, 'pass');
  assert.equal(evaluated.data.runs.find(r => r.id === runA.id).items[0].answerText, runA.items[0].answerText);
});
await check('historical iFinD evidence is explicitly selected and retains the original retrieval timestamp', async () => {
  const response = await fetch(`${base}/api/tools/ifind`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'historical_snapshot', symbol: '300033.SZ', date: '2026-11-06', field: 'close', claimValue: 210, claimUnit: '元' }) });
  const data = await response.json(); assert.equal(response.status, 200); assert.equal(data.provenance, 'historical_snapshot'); assert.equal(data.status, 'historical_snapshot');
  assert.equal(data.verification.status, 'MISMATCH'); assert.equal(data.verification.referenceValue, 202.7); assert.notEqual(data.retrievedAt, data.servedAt);
});
await check('replacing an imported dataset clears behavior events for old case ids', async () => {
  const source = state.cases[0];
  const dataset = { cases: [{ ...source, synthetic: true }] };
  const { response, data } = await request({ action: 'import', dataset });
  assert.equal(response.status, 200); assert.equal(data.behaviorEvents.length, 0); assert.equal(data.cases.length, 1);
});
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/api-smoke-results.json', JSON.stringify({ executedAt: new Date().toISOString(), target: base, results }, null, 2));
console.log(`${results.filter(r => r.status === 'pass').length}/${results.length} checks passed.`);
if (results.some(r => r.status === 'fail')) process.exitCode = 1;
