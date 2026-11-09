import intentRouter from "../../skills/intent-router/rubric.json" with { type: "json" };
import relevance from "../../skills/relevance-check/rubric.json" with { type: "json" };
import factExtract from "../../skills/fact-extract/rubric.json" with { type: "json" };
import freshness from "../../skills/freshness-check/rubric.json" with { type: "json" };
import personalization from "../../skills/personalization-check/rubric.json" with { type: "json" };
import compliance from "../../skills/compliance-check/rubric.json" with { type: "json" };
import diagnosis from "../../skills/case-diagnosis/rubric.json" with { type: "json" };

export const rubrics = [intentRouter, relevance, factExtract, freshness, personalization, compliance, diagnosis] as const;
const executedSkillIds = new Set(["relevance-check", "fact-extract", "freshness-check", "personalization-check", "compliance-check"]);
export const activeRuleIds = new Set(rubrics.filter((rubric) => executedSkillIds.has(rubric.id)).flatMap((rubric) => rubric.rules.map((rule) => rule.id)));
export const skillCatalog = rubrics.map((rubric) => ({ id: rubric.id, name: rubric.id, version: rubric.version, status: executedSkillIds.has(rubric.id) ? "executed" as const : "spec_only" as const, rules: rubric.rules.map((rule) => rule.id) }));
