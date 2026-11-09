import test from "node:test";
import assert from "node:assert/strict";
import { verifyIfindClose, closePriceMatches } from "../lib/integrations/ifind";
const input = { symbol: "300033.SZ", date: "2026-11-06", field: "close" as const };
function fixture({ date = "20261106", symbol = "300033.SZ", adjustment = "不复权", value = "202.7" } = {}) {
  return { query: "限定口径测试查询", retrievedAt: "2026-11-09T12:22:00Z", content: [{ type: "text", text: JSON.stringify({ code: 1, data: { answer: `|证券代码|证券简称|收盘价|\n|---|---|---|\n|${symbol}|测试|${value}|`, indicators_params: { 收盘价: { 交易日期: date, 复权方式: adjustment } } } }) }] };
}
test("matching and mismatching close claims return evidence-linked results", async () => {
  const match = await verifyIfindClose(fixture(), input, 202.7, "元"), mismatch = await verifyIfindClose(fixture(), input, 210, "元");
  assert.equal(match.status, "MATCH"); assert.equal(mismatch.status, "MISMATCH");
  assert.equal(mismatch.referenceValue, 202.7); assert.equal(match.evidenceId, mismatch.evidenceId);
});
test("latest/other date, wrong symbol, other adjustment and missing price do not verify", async () => {
  for (const options of [{ date: "最新" }, { date: "20261105" }, { symbol: "600519.SH" }, { adjustment: "前复权" }, { value: "--" }]) {
    assert.equal((await verifyIfindClose(fixture(options), input, 202.7, "元")).status, "UNVERIFIED");
  }
});
test("unit mismatch does not pass numeric equality", async () => {
  assert.equal((await verifyIfindClose(fixture(), input, 202.7, "%")).status, "UNVERIFIED");
});
test("an explicit row date can disambiguate a relative latest parameter, but conflicting exact dates are rejected", async () => {
  const result = fixture({ date: "最新" });
  const data = JSON.parse(result.content[0].text);
  data.data.answer = "|证券代码|日期|收盘价|\n|---|---|---|\n|300033.SZ|20261106|202.7|";
  result.content[0].text = JSON.stringify(data);
  assert.equal((await verifyIfindClose(result, input, 202.7, "元")).status, "MATCH");
  data.data.indicators_params.收盘价.交易日期 = "20261105";
  result.content[0].text = JSON.stringify(data);
  assert.equal((await verifyIfindClose(result, input, 202.7, "元")).status, "UNVERIFIED");
});
test("the exact half-cent boundary does not flip because of binary floating-point rounding", () => {
  assert.equal(closePriceMatches(202.705, 202.7), false);
  assert.equal(closePriceMatches(202.695, 202.7), false);
  assert.equal(closePriceMatches(202.7049, 202.7), true);
  assert.equal(closePriceMatches(202.6951, 202.7), true);
  assert.equal(closePriceMatches(Number.NaN, 202.7), false);
});
