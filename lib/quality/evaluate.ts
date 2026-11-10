import type { Finding, QualityCase, RunItem } from "./types";
import { activeRuleIds } from "./rubrics";

function finding(ruleId: string, dimension: string, severity: Finding["severity"], status: Finding["status"], quote: string, reason: string, evidenceIds: string[] = [], reviewRequired = true): Finding {
  return { id: `${ruleId}-${crypto.randomUUID()}`, ruleId, dimension, severity, status, quote, reason, evidenceIds, reviewRequired };
}
type NumericMatch = { value: number; unit: string; quote: string; index: number };
function extractNumerics(text: string, expectedUnit?: string): NumericMatch[] {
  const unitPattern = expectedUnit === "%" ? "[%％]" : expectedUnit ? expectedUnit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "%|％|万元|亿元|元|倍|天|月|年";
  const re = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})`, "g");
  return Array.from(text.matchAll(re), (m) => ({ value: Number(m[1]), unit: m[2] === "％" ? "%" : m[2], quote: m[0], index: m.index ?? 0 }));
}
function month(text: string): string | null {
  const m = text.match(/(20\d{2})[-年]\s*(\d{1,2})月?/);
  return m ? `${m[1]}-${String(Number(m[2])).padStart(2, "0")}` : null;
}
function evidenceSentence(answer: string, claim: string, targetPeriod: string): { sentence: string; period: string | null; ambiguous: boolean } | null {
  // “虚构” is a demo qualifier, not part of the entity identifier shown in the UI.
  const entity = claim.match(/(?:基金|公司)[甲乙丙丁]/)?.[0];
  if (!entity) return null;
  const metric = claim.match(/收益率|净值|费用|涨幅|跌幅|风险等级|管理费/)?.[0];
  const sentences = answer.match(/[^。！？\n]+[。！？]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  let candidates = sentences.filter((s) => s.includes(entity) && (!metric || s.includes(metric)));
  if (!candidates.length) return null;
  const targetMonth = month(targetPeriod);
  const exactPeriod = candidates.filter((s) => month(s) === targetMonth);
  if (exactPeriod.length === 1) candidates = exactPeriod;
  else if (exactPeriod.length > 1) return { sentence: exactPeriod[0], period: targetMonth, ambiguous: true };
  else if (candidates.length !== 1) return { sentence: candidates[0], period: month(candidates[0]), ambiguous: true };
  const sentence = candidates[0];
  const periods = [...sentence.matchAll(/20\d{2}[-年]\s*\d{1,2}月?/g)];
  return { sentence, period: month(sentence), ambiguous: periods.length > 1 };
}

export function evaluateCase(item: QualityCase, answerText: string, answerGeneratedAt = item.askedAt): RunItem {
  const findings: Finding[] = [];
  if (!answerText.trim()) findings.push(finding("RELEVANCE-001", "relevance", "high", "fail", "", "候选版本缺少回答，无法评测。"));
  const guaranteeRe = /(?:保证|承诺)[^。！？；，\n]{0,14}?(?:收益|赚钱|盈利|获利|不亏|不会亏)|(?:稳赚|绝不亏|基本不会亏|不会亏|保证每年\s*\d+(?:\.\d+)?\s*[%％]?)/g;
  for (const match of answerText.matchAll(guaranteeRe)) {
    const quote = match[0]; const start = match.index ?? 0;
    const precedingText = answerText.slice(Math.max(0, start - 28), start);
    const precedingNegation = /(?:不|不能|不会|并非|无法|未能|未|不作出|不提供|不作|不能说|不能认为|不代表|不意味着)$/.test(precedingText.slice(-8));
    // A negation can govern a guarantee named after a short list, e.g.
    // “不存在保本或稳赚的承诺”。Limit this to the current clause so a later
    // positive claim such as “但稳赚 20%” still triggers the rule.
    const clausePrefix = precedingText.split(/[。！？；，,\n]/).at(-1)?.replace(/\s+/g, "") ?? "";
    const explicitlyDenied = /(?:不存在|没有|并无|暂无)[^。！？；，,\n]{0,12}$/.test(clausePrefix);
    const promiseNotToGuarantee = /^(?:保证|承诺)(?:不|不会|无法|不作出|不提供)(?:保证|承诺)/.test(quote);
    // Negation before the promise changes its meaning. "保证不亏" is still a promise;
    // the character 未 in 未来 must never be treated as a negation of 保证.
    if (!precedingNegation && !explicitlyDenied && !promiseNotToGuarantee) findings.push(finding("COMPLIANCE-001", "compliance", "critical", "fail", quote, "出现收益保证或淡化损失风险的表述；这是规则线索，需人工复核。"));
  }
  if (item.intent === "suitability" && (item.kyc.horizonMonths === null || !item.kyc.liquidityNeed) && /适合你|适合所有人|推荐/.test(answerText) && !/不适合|不推荐|不建议|不能判断|无法判断/.test(answerText)) {
    const quote = answerText.match(/适合你|适合所有人|推荐/)?.[0] ?? "";
    findings.push(finding("PERSONALIZATION-001", "personalization", "high", "fail", quote, "缺少必要的期限或流动性画像时直接给出适配结论。"));
  }
  if (item.intent === "suitability" && item.kyc.horizonMonths !== null && item.kyc.liquidityNeed === "high" && /长期封闭|封闭.{0,5}(?:产品|期)|无法赎回/.test(answerText) && /(?:适合|推荐|可以选择)/.test(answerText) && !/(?:不适合|不推荐|不建议|不能判断|无法判断)/.test(answerText)) {
    const quote = answerText.match(/长期封闭|封闭.{0,5}(?:产品|期)|无法赎回/)?.[0] ?? "";
    findings.push(finding("PERSONALIZATION-001", "personalization", "high", "fail", quote, "高流动性需求与推荐封闭/无法赎回产品的表述冲突。"));
  }
  let verifiedCount = 0;
  let matchingCount = 0;
  let extractedClaimCount = item.evidence.length;
  const usedEvidenceIds = new Set<string>();
  for (const ev of item.evidence) {
    const located = evidenceSentence(answerText, ev.claim, ev.period);
    if (!located) {
      findings.push(finding("FACT-001", "factuality", "medium", "unverified", "", "找不到与该证据对应的明确主体/指标陈述，不能将其他事实用于核验。", [ev.id]));
      continue;
    }
    const quote = located.sentence;
    const foundPeriod = located.period;
    if (located.ambiguous) {
      findings.push(finding("FACT-001", "factuality", "medium", "unverified", quote, "同一主体和指标对应多个数值或期间，无法无歧义地关联到该证据。", [ev.id]));
      continue;
    }
    const numeric = extractNumerics(quote, ev.unit);
    const wrongUnit = numeric.length ? [] : extractNumerics(quote).filter((n) => !(["年", "月", "天"].includes(n.unit) && ev.unit === "%"));
    if (foundPeriod === month(ev.period)) usedEvidenceIds.add(ev.id);
    if (wrongUnit.length === 1) {
      verifiedCount++;
      findings.push(finding("FACT-001", "factuality", "high", "fail", quote, `单位不一致：回答为 ${wrongUnit[0].unit}，证据为 ${ev.unit}。`, [ev.id]));
      continue;
    }
    if (numeric.length !== 1) {
      findings.push(finding("FACT-001", "factuality", "medium", "unverified", quote, numeric.length > 1 ? "同一句中有多个候选数值，无法与该证据唯一对应。" : foundPeriod && foundPeriod !== month(ev.period) ? `统计期间不匹配：回答 ${foundPeriod}，证据 ${ev.period}。` : "缺少可解析的匹配单位数值或期间，无法完成核验。", [ev.id]));
      continue;
    }
    if (!foundPeriod) {
      findings.push(finding("FACT-001", "factuality", "medium", "unverified", quote, `回答未注明统计期间；证据期间为 ${ev.period}。`, [ev.id]));
      continue;
    }
    if (foundPeriod !== month(ev.period)) {
      verifiedCount++;
      findings.push(finding("FACT-001", "factuality", "high", "fail", quote, `统计期间不匹配：回答 ${foundPeriod}，证据 ${ev.period}。`, [ev.id]));
      continue;
    }
    verifiedCount++;
    if (Math.abs(numeric[0].value - ev.value) <= 0.0001) matchingCount++;
    else findings.push(finding("FACT-001", "factuality", "high", "fail", quote, `数值不匹配：回答 ${numeric[0].quote}，证据 ${ev.value}${ev.unit}（${ev.period}）。`, [ev.id]));
  }
  for (const ev of item.evidence) {
    if (usedEvidenceIds.has(ev.id) && Date.parse(ev.publishedAt) > Date.parse(answerGeneratedAt)) {
      const quote = evidenceSentence(answerText, ev.claim, ev.period)?.sentence ?? "";
      findings.push(finding("FRESHNESS-001", "freshness", "high", "fail", quote, "引用证据的公开时间晚于回答生成时点，不能用于判断当时可知事实。", [ev.id]));
    }
  }
  for (const event of item.eventContext ?? []) {
    const citedPhrase = event.referencePhrases.find((phrase) => phrase && answerText.includes(phrase));
    if (citedPhrase && Date.parse(event.publishedAt) > Date.parse(answerGeneratedAt)) {
      findings.push(finding("FRESHNESS-001", "freshness", "high", "fail", citedPhrase, `回答引用的事件尚未公开：事件发生于 ${event.occurredAt}，公开时间为 ${event.publishedAt}，晚于回答生成时点。`, [event.id]));
    }
  }
  const marketClaim = /(?:上涨|下跌|涨幅|跌幅)\s*\d|(?:上涨|下跌).{0,24}(?:因为|导致|原因是).{0,24}(?:公告|业绩|资金|政策|消息|市场)/.test(answerText);
  if (item.intent === "market_event" && item.evidence.length === 0 && marketClaim) {
    extractedClaimCount++;
    findings.push(finding("FACT-001", "factuality", "medium", "unverified", answerText.match(/[^。！？\n]*(?:上涨|下跌|涨幅|跌幅)[^。！？\n]*/)?.[0] ?? "", "行情/事件断言没有可用证据快照，无法核验事实或因果关系。"));
  }
  const unrelated = /(?:今天天气|菜谱|足球比分|电影票|航班延误)/.test(answerText);
  const investmentTerms = /(?:基金|股票|风险|收益|净值|投资|期限|流动性|行情|公告|产品|证据|无法确认|不能判断)/.test(answerText);
  if (unrelated && !investmentTerms) {
    const quote = answerText.match(/(?:今天天气|菜谱|足球比分|电影票|航班延误)/)?.[0] ?? "";
    findings.push(finding("RELEVANCE-001", "relevance", "high", "fail", quote, "回答明确转向与投资问题无关的主题。"));
  } else if ((item.intent === "knowledge" && !/(?:净值|收益率|资产价值|期间|比例)/.test(answerText)) || (item.intent === "comparison" && !/(?:风险|费用|期限|比较|资料|不能判断)/.test(answerText))) {
    findings.push(finding("RELEVANCE-001", "relevance", "low", "unverified", answerText.slice(0, 100), "启发式相关性检查未找到预期主题词，仅提示人工复核，不据此判定错误。"));
  }
  const pii = answerText.match(/(?:\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b)/);
  if (pii) findings.push(finding("PRIVACY-001", "privacy", "critical", "fail", pii[0], "检测到疑似手机号或身份证号格式，需停止外发并人工检查。"));
  const activeFindings = findings.filter((f) => activeRuleIds.has(f.ruleId));
  const status: RunItem["overallStatus"] = activeFindings.some((f) => f.status === "fail") ? "fail" : activeFindings.some((f) => f.status === "unverified") ? "pending_verification" : activeFindings.some((f) => f.reviewRequired) ? "needs_review" : "pass";
  return { caseId: item.caseId, answerText, answerProvenance: "preset", overallStatus: status, findings: activeFindings, reviewStatus: "pending", factNumerator: matchingCount, factDenominator: verifiedCount, verifiedNumerator: verifiedCount, verifiedDenominator: extractedClaimCount };
}
