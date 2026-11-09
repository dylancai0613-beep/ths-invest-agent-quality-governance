import test from 'node:test';
import assert from 'node:assert/strict';
import { queryIfind } from '../lib/integrations/ifind.ts';

const config = { IFIND_MCP_TOKEN: 'test-only-never-a-real-secret' };
const query = { symbol: '300033.SZ', date: '2026-11-06', field: 'close' };
function mockTransport({ sse = false, businessCode = 1 } = {}) {
  const calls = [];
  const transport = async (url, options) => {
    assert.equal(new URL(url).hostname, 'api-mcp.51ifind.com');
    const rpc = JSON.parse(options.body); calls.push(rpc);
    if (rpc.method !== 'initialize') assert.equal(options.headers['Mcp-Session-Id'], 'test-session');
    if (rpc.method === 'initialize') return Response.json({ result: {} }, { headers: { 'mcp-session-id': 'test-session' } });
    if (rpc.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (rpc.method === 'tools/list') return Response.json({ result: { tools: [{ name: 'get_stock_performance' }] } });
    const result = { result: { content: [{ type: 'text', text: JSON.stringify({ code: businessCode, data: { answer: 'test data' } }) }] } };
    return sse ? new Response(`event: message\ndata: ${JSON.stringify(result)}\n\n`) : Response.json(result);
  };
  return { transport, calls };
}
test('unconfigured service does not call the network', async () => {
  const result = await queryIfind({}, query, () => { throw new Error('must not call'); });
  assert.equal(result.status, 'not_configured');
});
test('MCP initialization, session propagation and actual call are performed', async () => {
  const mock = mockTransport(); const result = await queryIfind(config, query, mock.transport);
  assert.equal(result.status, 'retrieved');
  assert.deepEqual(mock.calls.map(c => c.method), ['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
  assert.equal(mock.calls[3].params.name, 'get_stock_performance');
  assert.match(result.query, /2026-11-06/); assert.ok(result.retrievedAt);
  assert.ok(!JSON.stringify(result).includes(config.IFIND_MCP_TOKEN));
});
test('SSE response is parsed', async () => {
  assert.equal((await queryIfind(config, query, mockTransport({ sse: true }).transport)).status, 'retrieved');
});
test('HTTP success with a business error is not a retrieved fact', async () => {
  await assert.rejects(queryIfind(config, query, mockTransport({ businessCode: -1 }).transport), /业务错误/);
});
test('unsupported symbols and invalid calendar dates are rejected before network calls', async () => {
  const noNetwork = () => { throw new Error('network should not be reached'); };
  await assert.rejects(queryIfind(config, { ...query, symbol: 'arbitrary' }, noNetwork), /允许列表/);
  await assert.rejects(queryIfind(config, { ...query, date: '2026-02-31' }, noNetwork), /日期无效/);
});
