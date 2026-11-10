import test from "node:test";
import assert from "node:assert/strict";
import { judgeAnswer, redactForModel } from "../lib/integrations/model-judge";
import { initialState } from "../lib/quality/seed";
const config = { MODEL_API_BASE: "https://model.example.invalid/v1", MODEL_API_KEY: "test-secret", MODEL_NAME: "test-model" };
const item = initialState().cases[0];
const valid = { overallStatus: "needs_review", summary: "测试语义建议", findings: [{ dimension: "factuality", severity: "high", quote: "", reason: "需对照证据", evidenceIds: [item.evidence[0].id] }] };
const respond = (result: unknown) => (async () => Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] })) as typeof fetch;
test("unconfigured semantic judge makes no network request", async () => {
  const result = await judgeAnswer({}, item, "candidate-a", (() => { throw new Error("no network"); }) as typeof fetch);
  assert.equal(result.status, "not_configured");
});
test("semantic judge redacts personal fields before model transmission", async () => {
  const fixture = structuredClone(item); fixture.question = "手机号13800000000，身份证110101199001011234，邮箱sample@example.com，请检查。";
  const transport = (async (_url: string | URL | Request, options?: RequestInit) => {
    const body = String(options?.body);
    for (const secret of ["13800000000", "110101199001011234", "sample@example.com"]) assert.ok(!body.includes(secret));
    assert.ok(body.includes("[手机号已脱敏]"));
    return Response.json({ choices: [{ message: { content: JSON.stringify(valid) } }] });
  }) as typeof fetch;
  const result = await judgeAnswer(config, fixture, "candidate-a", transport);
  assert.equal(result.status, "completed");
  assert.ok(!JSON.stringify(result).includes(config.MODEL_API_KEY));
});
test("invented evidence IDs are rejected", async () => {
  await assert.rejects(judgeAnswer(config, item, "candidate-a", respond({ ...valid, findings: [{ ...valid.findings[0], evidenceIds: ["nonexistent"] }] })), /不存在的证据/);
});
test("known event IDs can support retrospective timing review without being treated as contemporaneous knowledge", async () => {
  const market = initialState().cases.find(c => c.eventContext?.length)!;
  const eventId = market.eventContext![0].id;
  const result = await judgeAnswer(config, market, "candidate-a", respond({ ...valid, findings: [{ ...valid.findings[0], dimension: "freshness", evidenceIds: [eventId] }] }));
  assert.equal(result.status, "completed");
});
test("invented original-answer quotations are rejected", async () => {
  await assert.rejects(judgeAnswer(config, item, "candidate-a", respond({ ...valid, findings: [{ ...valid.findings[0], quote: "a fabricated quotation" }] })), /无法.*定位/);
});
test("malformed model structure does not become a completed judgement", async () => {
  await assert.rejects(judgeAnswer(config, item, "candidate-a", respond({ score: 100 })), /结构不符合/);
});
test("a model cannot return pass while also reporting unresolved findings", async () => {
  await assert.rejects(judgeAnswer(config, item, "candidate-a", respond({ ...valid, overallStatus: "pass" })), /结构不符合/);
});
test("redaction handles adjacent Chinese text and long account-like numbers", () => {
  assert.equal(redactForModel("电话13800000000，卡号6222021234567890123"), "电话[手机号已脱敏]，卡号[长数字已脱敏]");
});
