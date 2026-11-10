/** Actual runtime-model acceptance. Optional hosted access arrives only on hidden stdin. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
let token = '';
const publicAccess = process.argv.includes('--public');
const hosted = publicAccess || process.argv.includes('--hosted');
const base = hosted ? 'https://invest-agent-quality-lab.opalescentdisco1.chatgpt.site' : 'http://127.0.0.1:5173';
if (hosted && !publicAccess) token = await new Promise(resolve => {
  let text = ''; const tty = process.stdin.isTTY;
  if (tty) process.stdin.setRawMode(true);
  process.stderr.write('Ready for existing Site service access on hidden stdin.\n');
  process.stdin.setEncoding('utf8'); process.stdin.resume();
  const read = chunk => { text += chunk; if (/[\r\n]/.test(text)) { process.stdin.off('data', read); if (tty) process.stdin.setRawMode(false); process.stdin.pause(); resolve(text.trim()); } };
  process.stdin.on('data', read);
});
let cookie = ''; const results = [], evidence = {}; let initial, generated, evaluated;
async function request(path, body) {
  const r = await fetch(base + path, { method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(60000), headers: { ...(token ? { 'OAI-Sites-Authorization': `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const next = r.headers.getSetCookie().find(value => value.startsWith('quality_session=')); if (next) cookie = next.split(';')[0];
  const text = await r.text(); let data; try { data = JSON.parse(text); } catch { data = { notice: 'Non-JSON response' }; }
  assert.equal(r.status, 200, JSON.stringify({ status: r.status, notice: data.notice, error: data.error })); return data;
}
async function check(name, fn) { try { await fn(); results.push({ name, status: 'pass' }); console.log(`PASS ${name}`); } catch (e) { const reason = token ? String(e.message).split(token).join('[redacted]') : String(e.message); results.push({ name, status: 'fail', reason }); console.log(`FAIL ${name}: ${reason}`); } }
await check('runtime model configuration is available without a key in the response', async () => { const d = await request('/api/tools/judge'); assert.equal(d.configured, true); assert.ok(d.model); assert.ok(!('MODEL_API_KEY' in d)); evidence.configuration = d; });
await check('real model generates an independent persisted answer version', async () => {
  initial = await request('/api/quality'); const caseId = initial.cases[0].caseId;
  const d = await request('/api/quality', { action: 'generate', caseId, versionId: 'candidate-b' });
  generated = d.versions.find(v => !initial.versions.some(old => old.id === v.id)); assert.ok(generated);
  const answer = d.cases.find(c => c.caseId === caseId).answers[generated.id]; assert.equal(answer.provenance, 'generated'); assert.ok(answer.text.length > 20);
  assert.deepEqual(d.cases[0].answers['candidate-a'], initial.cases[0].answers['candidate-a']);
  const stored = await request('/api/quality'); assert.ok(stored.versions.some(v => v.id === generated.id));
  evidence.generated = { version: generated, caseId, answer };
});
await check('generated answer can be evaluated with rule evidence and kept in history', async () => {
  assert.ok(generated); const d = await request('/api/quality', { action: 'evaluate', versionId: generated.id, caseIds: [initial.cases[0].caseId] });
  evaluated = d.runs[0]; assert.equal(evaluated.items.length, 1); assert.equal(evaluated.items[0].answerProvenance, 'generated'); evidence.ruleRun = evaluated;
});
await check('real AI judge returns validated evidence-linked advisory without changing rule scores', async () => {
  assert.ok(generated); const d = await request('/api/tools/judge', { caseId: initial.cases[0].caseId, versionId: generated.id });
  assert.equal(d.status, 'completed'); assert.ok(d.result.summary); assert.ok(Array.isArray(d.result.findings));
  const state = await request('/api/quality'); assert.deepEqual(state.runs.find(r => r.id === evaluated.id), evaluated); evidence.judge = d;
});
mkdirSync('artifacts', { recursive: true });
writeFileSync(`artifacts/model-${publicAccess ? 'public' : hosted ? 'hosted' : 'local'}-results.json`, JSON.stringify({ executedAt: new Date().toISOString(), target: base, access: publicAccess ? 'anonymous public access, no bearer token or login; fresh cookie session' : hosted ? 'existing owner service access; browser audience validated separately' : 'fresh local session', scope: 'one actual generation and one actual semantic assessment; not a model performance benchmark', results, evidence }, null, 2));
console.log(`${results.filter(r => r.status === 'pass').length}/${results.length} live model checks passed.`);
if (results.some(r => r.status === 'fail')) process.exitCode = 1;
