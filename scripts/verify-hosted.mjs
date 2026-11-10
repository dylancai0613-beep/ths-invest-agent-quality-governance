/** Owner-private hosted smoke test. Existing service access arrives on hidden stdin. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const input = await new Promise((resolve, reject) => {
  let value = ''; const terminal = process.stdin.isTTY;
  const finish = (error) => { process.stdin.removeListener('data', onData); if (terminal) process.stdin.setRawMode(false); process.stdin.pause(); error ? reject(error) : resolve(value); };
  const onData = chunk => { value += chunk; if (value.includes('\u0003')) finish(new Error('Cancelled')); else if (value.length > 16000) finish(new Error('Input too large')); else if (/[\r\n]/.test(value)) finish(); };
  if (terminal) process.stdin.setRawMode(true);
  process.stderr.write('Ready for existing Site service access on hidden stdin.\n');
  process.stdin.setEncoding('utf8'); process.stdin.on('data', onData); process.stdin.resume();
});
const { base, token, mode } = JSON.parse(input);
if (base !== 'https://invest-agent-quality-lab.opalescentdisco1.chatgpt.site' || typeof token !== 'string' || !token) throw new Error('Use the verified owned Site and its existing service-access credential.');
let cookie = ''; const results = []; let initial, runA, runB;
async function request(path, body) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', redirect: 'error', headers: { 'OAI-Sites-Authorization': `Bearer ${token}`, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  const next = response.headers.get('set-cookie'); if (next?.includes('quality_session=')) cookie = next.split(';')[0];
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { nonJson: true }; }
  return { response, data };
}
async function check(name, action) { try { await action(); results.push({ name, status: 'pass' }); console.log(`PASS ${name}`); } catch (e) { results.push({ name, status: 'fail', reason: String(e.message).split(token).join('[redacted]') }); console.log(`FAIL ${name}`); } }
if (mode === 'ifind-probe') {
  const r = await request('/api/tools/ifind', { symbol: '300033.SZ', date: '2026-11-06', field: 'close', claimValue: 210, claimUnit: '元' });
  mkdirSync('artifacts', { recursive: true }); writeFileSync('artifacts/ifind-hosted-probe.json', JSON.stringify({ httpStatus: r.response.status, ...r.data }, null, 2));
  console.log(JSON.stringify({ httpStatus: r.response.status, ...r.data })); process.exit(r.response.ok ? 0 : 1);
}
await check('hosted UI responds behind existing private access boundary', async () => { assert.equal((await request('/')).response.status, 200); });
await check('hosted D1 initialization and anonymous demo cases load', async () => { const r = await request('/api/quality'); assert.equal(r.response.status, 200); initial = r.data; assert.equal(initial.cases.length, 20); assert.ok(cookie); });
await check('hosted A/B evaluations execute and persist', async () => {
  const ids = initial.cases.slice(0, 4).map(c => c.caseId);
  const a = await request('/api/quality', { action: 'evaluate', versionId: 'candidate-a', caseIds: ids }); assert.equal(a.response.status, 200); runA = a.data.runs[0];
  const b = await request('/api/quality', { action: 'evaluate', versionId: 'candidate-b', caseIds: ids }); assert.equal(b.response.status, 200); runB = b.data.runs[0];
  assert.equal(runA.items.length, 4); assert.equal(runB.items.length, 4);
  assert.equal(runA.items.reduce((n, i) => n + i.factNumerator, 0), 1); assert.equal(runB.items.reduce((n, i) => n + i.factNumerator, 0), 4);
  assert.equal((await request('/api/quality')).data.runs.length, 2);
});
await check('hosted review and regression snapshots are saved', async () => {
  const reviewed = await request('/api/quality', { action: 'review', runId: runA.id, caseId: runA.items[0].caseId, decision: 'confirmed', note: '线上自动验收：对照合成证据确认数值差异。' }); assert.equal(reviewed.response.status, 200);
  const reg = await request('/api/quality', { action: 'add_regression', runId: runA.id, caseId: runA.items[0].caseId }); assert.equal(reg.response.status, 200); assert.equal(reg.data.regressionCases.length, 1);
});
await check('hosted feedback resolution is persisted', async () => {
  const submitted = await request('/api/quality', { action: 'feedback', caseId: runA.items[0].caseId, kind: 'fact_error', note: '线上自动验收反馈' }); assert.equal(submitted.response.status, 200);
  const resolved = await request('/api/quality', { action: 'resolve_feedback', feedbackId: submitted.data.feedback[0].id, decision: 'confirmed', note: '对照证据已确认，纳入后续回归。' }); assert.equal(resolved.response.status, 200); assert.notEqual(resolved.data.feedback[0].status, 'pending_review');
});
await check('hosted iFinD server secret is configured without exposing its value', async () => { const r = await request('/api/tools/ifind'); assert.equal(r.response.status, 200); assert.equal(r.data.configured, true); assert.ok(!JSON.stringify(r.data).includes(token)); });
if (mode !== 'core') await check('hosted iFinD performs a real dated query and explicit numeric verification', async () => {
  const r = await request('/api/tools/ifind', { symbol: '300033.SZ', date: '2026-11-06', field: 'close', claimValue: 210, claimUnit: '元' });
  assert.equal(r.response.status, 200); assert.equal(r.data.status, 'retrieved'); assert.ok(r.data.verification?.evidenceId); assert.ok(['MATCH', 'MISMATCH', 'UNVERIFIED'].includes(r.data.verification.status));
  mkdirSync('artifacts', { recursive: true }); writeFileSync('artifacts/ifind-hosted-verification.json', JSON.stringify(r.data, null, 2));
});
await check('hosted historical evidence mode is explicit and verifies the saved dated response', async () => {
  const r = await request('/api/tools/ifind', { mode: 'historical_snapshot', symbol: '300033.SZ', date: '2026-11-06', field: 'close', claimValue: 210, claimUnit: '元' });
  assert.equal(r.response.status, 200); assert.equal(r.data.status, 'historical_snapshot'); assert.equal(r.data.provenance, 'historical_snapshot'); assert.equal(r.data.verification.status, 'MISMATCH'); assert.equal(r.data.verification.referenceValue, 202.7);
});
await check('hosted manual revision and re-evaluation preserve the original version', async () => {
  const r = await request('/api/quality', { action: 'revise', caseId: initial.cases[0].caseId, sourceVersionId: 'candidate-a', answerText: '合成证据快照显示虚构基金甲在2026年10月收益率为2.4%，仅用于演示。', note: '线上验收：按合成证据修改数字并复测。' }); assert.equal(r.response.status, 200);
  const v = r.data.versions.find(v => v.sourceVersionId === 'candidate-a' && v.model.includes('人工修订')); assert.ok(v);
  const evaluated = await request('/api/quality', { action: 'evaluate', versionId: v.id, caseIds: [initial.cases[0].caseId] }); assert.equal(evaluated.response.status, 200);
  assert.equal(evaluated.data.runs[0].items[0].answerProvenance, 'manual'); assert.equal(evaluated.data.runs[0].items[0].overallStatus, 'pass'); assert.equal(evaluated.data.runs.find(x => x.id === runA.id).items[0].overallStatus, 'fail');
});
await check('unconfigured hosted model remains explicit', async () => { const r = await request('/api/tools/judge'); assert.equal(r.response.status, 200); assert.equal(r.data.configured, false); });
mkdirSync('artifacts', { recursive: true });
writeFileSync(mode === 'core' ? 'artifacts/hosted-core-results.json' : 'artifacts/hosted-smoke-results.json', JSON.stringify({ executedAt: new Date().toISOString(), target: base, access: 'existing owner-private service access; not anonymous browser access', scope: mode === 'core' ? 'Core product, historical evidence and manual revision; live upstream availability is separately recorded in ifind-hosted-probe.json' : 'Full test including live upstream availability', results, runIds: [runA?.id, runB?.id] }, null, 2));
console.log(`${results.filter(r => r.status === 'pass').length}/${results.length} hosted checks passed.`);
if (results.some(r => r.status === 'fail')) process.exitCode = 1;
