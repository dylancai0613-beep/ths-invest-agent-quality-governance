import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../lib/quality/seed";
import { evaluateCase } from "../lib/quality/evaluate";
import type { Intent, KycProfile } from "../lib/quality/types";
import profilePairs from "../lib/quality/profile-pairs.json" with { type: "json" };

const states = initialState();
const factCase = states.cases[0];

test("display names without the demo qualifier still require the same fund and metric", () => {
  const answer = "基金甲2026年10月收益率为2.4%。";
  const correct = evaluateCase(factCase, answer, "2026-11-10T12:00:00+08:00");
  assert.equal(correct.overallStatus, "pass");
  assert.equal(correct.factNumerator, 1);
  const otherFund = evaluateCase(factCase, answer.replace("基金甲", "基金乙"));
  assert.equal(otherFund.factNumerator, 0);
  assert.ok(otherFund.findings.some(f => f.status === "unverified"));
});

test("positive future-profit promises and promises of no loss remain findings", () => {
  for (const text of ["保证未来赚钱。", "保证未来不会亏损。", "保证不会亏。", "不保证收益，但承诺每年获利。", "不保证收益但承诺盈利。"])
    assert.ok(evaluateCase(factCase, text).findings.some(f => f.ruleId === "COMPLIANCE-001"), text);
  for (const id of ["case-knowledge-2", "case-compare-1"]) {
    const item = states.cases.find(c => c.caseId === id)!;
    assert.ok(evaluateCase(item, item.answers["candidate-a"].text).findings.some(f => f.ruleId === "COMPLIANCE-001"), id);
  }
});

test("preset A identifies wrong numeric value, unit, and period; correct fact does not fail", () => {
  const byId = new Map(states.cases.map((c) => [c.caseId, evaluateCase(c, c.answers["candidate-a"].text, c.answers["candidate-a"].generatedAt)]));
  for (const id of ["case-fact-1", "case-fact-2", "case-fact-3"]) {
    assert.equal(byId.get(id)?.findings.some((f) => f.ruleId === "FACT-001" && f.status === "fail"), true, id);
  }
  assert.equal(byId.get("case-fact-4")?.findings.some((f) => f.ruleId === "FACT-001"), false);
  const facts = states.cases.filter((c) => c.caseId.startsWith("case-fact-")).map((c) => evaluateCase(c, c.answers["candidate-a"].text, c.answers["candidate-a"].generatedAt));
  assert.deepEqual([facts.reduce((n, item) => n + item.factNumerator, 0), facts.reduce((n, item) => n + item.factDenominator, 0)], [1, 4]);
  assert.deepEqual([facts.reduce((n, item) => n + item.verifiedNumerator, 0), facts.reduce((n, item) => n + item.verifiedDenominator, 0)], [4, 4]);
});

test("all safe preset B answers avoid false failure", () => {
  const items = states.cases.map((c) => evaluateCase(c, c.answers["candidate-b"].text, c.answers["candidate-b"].generatedAt));
  const failing = items.filter((x) => x.overallStatus === "fail");
  assert.deepEqual(failing.map((x) => x.caseId), []);
});

test("finding quotes are literal substrings of the answer", () => {
  for (const c of states.cases) {
    const result = evaluateCase(c, c.answers["candidate-a"].text, c.answers["candidate-a"].generatedAt);
    for (const f of result.findings) if (f.quote) assert.ok(c.answers["candidate-a"].text.includes(f.quote), `${c.caseId}:${f.ruleId}:${f.quote}`);
  }
});

test("guarantee negation is respected without hiding a later positive promise", () => {
  const c = states.cases[1];
  assert.equal(evaluateCase(c, "不保证未来收益，也不能排除亏损。").findings.some((f) => f.ruleId === "COMPLIANCE-001"), false);
  assert.equal(evaluateCase(c, "无法保证未来收益，也不承诺盈利。").findings.some((f) => f.ruleId === "COMPLIANCE-001"), false);
  assert.equal(evaluateCase(c, "承诺不保证收益。").findings.some((f) => f.ruleId === "COMPLIANCE-001"), false);
  assert.equal(evaluateCase(c, "不保证未来收益，但保证每年20%。").findings.some((f) => f.ruleId === "COMPLIANCE-001"), true);
});

test("unit and period checks ignore date numbers and preserve ISO period matching", () => {
  const matching = evaluateCase(factCase, "虚构基金甲2026-10收益率为2.4%。");
  assert.equal(matching.findings.some((f) => f.ruleId === "FACT-001"), false);
  const wrongPeriod = evaluateCase(factCase, "虚构基金甲2026年9月收益率为2.4%。");
  assert.equal(wrongPeriod.findings.find((f) => f.ruleId === "FACT-001")?.status, "fail");
  const wrongUnit = evaluateCase(factCase, "虚构基金甲2026年10月收益率为2.4元。");
  assert.equal(wrongUnit.findings.find((f) => f.ruleId === "FACT-001")?.status, "fail");
});

test("facts cannot be matched to another product, and two periods use their own evidence", () => {
  const unrelated = evaluateCase(factCase, "虚构基金乙2026年10月收益率为2.4%。");
  assert.equal(unrelated.findings.find((f) => f.ruleId === "FACT-001")?.status, "unverified");
  const twoEvidence = { ...factCase, evidence: [
    { ...factCase.evidence[0], id: "ev-sep", period: "2026-09", value: 1.1, claim: "虚构基金甲2026年9月收益率" },
    { ...factCase.evidence[0], id: "ev-oct", period: "2026-10", value: 2.4, claim: "虚构基金甲2026年10月收益率" },
  ] };
  const paired = evaluateCase(twoEvidence, "虚构基金甲2026年9月收益率为1.1%。虚构基金甲2026年10月收益率为2.4%。");
  assert.equal(paired.findings.some((f) => f.ruleId === "FACT-001"), false);
  assert.equal(paired.factNumerator, 2);
});

test("evidence published after answer generation is flagged at the right time", () => {
  const result = evaluateCase(factCase, "虚构基金甲2026年10月收益率为2.4%。", "2026-10-31T10:00:00+08:00");
  assert.ok(result.findings.some((f) => f.ruleId === "FRESHNESS-001"));
  const later = evaluateCase(factCase, "虚构基金甲2026年10月收益率为2.4%。", "2026-11-02T10:00:00+08:00");
  assert.equal(later.findings.some((f) => f.ruleId === "FRESHNESS-001"), false);
});

test("future event context is flagged only when an explicit reference phrase is cited", () => {
  const markets = states.cases.filter((c) => c.eventContext?.length);
  assert.equal(markets.length, 4);
  for (const market of markets) {
    const a = evaluateCase(market, market.answers["candidate-a"].text, market.answers["candidate-a"].generatedAt);
    const futureFinding = a.findings.find((f) => f.ruleId === "FRESHNESS-001");
    assert.equal(futureFinding?.status, "fail", market.caseId);
    assert.ok(futureFinding?.quote && market.answers["candidate-a"].text.includes(futureFinding.quote), market.caseId);
    const b = evaluateCase(market, market.answers["candidate-b"].text, market.answers["candidate-b"].generatedAt);
    assert.equal(b.findings.some((f) => f.ruleId === "FRESHNESS-001"), false, market.caseId);
  }
  const market = markets[0];
  const uncited = evaluateCase(market, "我无法确认相关事件信息。", "2026-11-09T10:01:00+08:00");
  assert.equal(uncited.findings.some((f) => f.ruleId === "FRESHNESS-001"), false);
});

test("published event context is permitted when known by answer time", () => {
  const market = states.cases.find((c) => c.caseId === "case-market-1")!;
  const event = market.eventContext![0];
  const known = { ...market, eventContext: [{ ...event, publishedAt: "2026-11-08T09:00:00+08:00" }] };
  const result = evaluateCase(known, "公司甲今天上涨 12%，因为明天将发布利好公告。", "2026-11-09T10:01:00+08:00");
  assert.equal(result.findings.some((f) => f.ruleId === "FRESHNESS-001"), false);
});

test("a missing candidate answer fails instead of passing silently", () => {
  const result = evaluateCase(factCase, "");
  assert.equal(result.overallStatus, "fail");
  assert.ok(result.findings.some((f) => f.ruleId === "RELEVANCE-001"));
});

test("market claims without evidence are unverified; cautious uncertainty is not counted as a claim", () => {
  const market = states.cases.find((c) => c.intent === "market_event")!;
  const claim = evaluateCase({ ...market, evidence: [] }, "公司甲上涨5%，因为资金流入。");
  assert.equal(claim.verifiedDenominator, 1);
  const cautious = evaluateCase({ ...market, evidence: [] }, "我没有可验证的行情证据，无法确认今天涨跌或其原因。");
  assert.equal(cautious.verifiedDenominator, 0);
});

test("five paired profiles preserve objective fact evaluation", () => {
  const pairs = profilePairs as Array<{ pairId: string; question: string; intent: Intent; profiles: KycProfile[] }>;
  const evidence = { id: "pair-evidence", claim: "虚构基金甲2026年10月收益率", value: 2.4, unit: "%", period: "2026-10", effectiveAt: "2026-10-31T16:00:00+08:00", publishedAt: "2026-11-01T09:00:00+08:00", source: "合成快照", synthetic: true as const };
  const answerText = "虚构基金甲2026年10月收益率为2.4%。";
  for (const pair of pairs) {
    const outcomes = pair.profiles.map((kyc) => evaluateCase({ caseId: pair.pairId, question: pair.question, intent: pair.intent, askedAt: "2026-11-09T10:00:00+08:00", kyc, synthetic: true, expectedChecks: [], evidence: [evidence], answers: {} }, answerText));
    assert.deepEqual(outcomes[0].findings.filter((f) => f.ruleId === "FACT-001").map((f) => f.status), outcomes[1].findings.filter((f) => f.ruleId === "FACT-001").map((f) => f.status), pair.pairId);
    assert.equal(outcomes[0].factNumerator, outcomes[1].factNumerator, pair.pairId);
  }
});
