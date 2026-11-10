export type Intent = "fact_query" | "knowledge" | "market_event" | "comparison" | "suitability";
export type ReviewDecision = "confirmed" | "false_positive" | "needs_evidence";
export type FindingStatus = "fail" | "unverified";
export type OverallStatus = "pass" | "fail" | "needs_review" | "pending_verification";

export interface KycProfile {
  profileId: string; experience: "beginner" | "experienced" | null;
  riskTolerance: "low" | "medium" | "high" | null; horizonMonths: number | null;
  liquidityNeed: "low" | "medium" | "high" | null; purpose: string | null;
}
export interface EvidenceSnapshot {
  id: string; claim: string; value: number; unit: string; period: string;
  effectiveAt: string; publishedAt: string; source: string; synthetic: true;
}
export interface EventContext {
  id: string; title: string; occurredAt: string; publishedAt: string; source: string;
  summary: string; synthetic: true; referencePhrases: string[];
}
export interface QualityCase {
  caseId: string; question: string; intent: Intent; askedAt: string; kyc: KycProfile;
  synthetic: true; expectedChecks: string[]; evidence: EvidenceSnapshot[]; eventContext?: EventContext[];
  answers: Record<string, { text: string; generatedAt: string; provenance: "preset" | "generated" | "manual" }>;
}
export interface CandidateVersion { id: string; name: string; model: string; promptVersion: string; dataSnapshot: string; description: string; sourceVersionId?: string; changeNote?: string; }
export interface EvalVersion { id: string; name: string; skillVersion: string; rules: string[]; }
export interface Finding {
  id: string; ruleId: string; dimension: string; severity: "critical" | "high" | "medium" | "low";
  status: FindingStatus; quote: string; reason: string; evidenceIds: string[]; reviewRequired: boolean;
}
export interface RunItem {
  caseId: string; answerText: string; answerProvenance: "preset" | "generated" | "manual";
  overallStatus: OverallStatus; findings: Finding[]; reviewStatus: "pending" | ReviewDecision;
  factNumerator: number; factDenominator: number; verifiedNumerator: number; verifiedDenominator: number;
}
export interface EvalRun { id: string; candidateVersionId: string; evaluationVersionId: string; createdAt: string; status: "completed" | "partial"; items: RunItem[]; caseSnapshots: Array<Omit<QualityCase, "answers">>; }
export interface Review { id: string; runId: string; caseId: string; decision: ReviewDecision; note: string; createdAt: string; feedbackId?: string; }
export type FeedbackDecision = "confirmed" | "dismissed" | "needs_evidence";
export interface Feedback { id: string; caseId: string; kind: string; note: string; status: "pending_review" | FeedbackDecision; createdAt: string; source: "synthetic_demo"; resolutionNote?: string; resolvedAt?: string; resolvedRunId?: string; }
export interface RegressionCase { id: string; runId: string; caseId: string; addedAt: string; candidateVersionId: string; evaluationVersionId: string; caseSnapshot: Omit<QualityCase, "answers">; answerText: string; findings: Finding[]; }
export interface ToolStatus { id: string; name: string; status: "snapshot" | "simulated_timeout" | "configured" | "not_configured"; description: string; }
export interface SkillInfo { id: string; name: string; version: string; status: "executed" | "spec_only"; rules: string[]; description?: string; }
export interface QualityState {
  cases: QualityCase[]; versions: CandidateVersion[]; evaluationVersions: EvalVersion[];
  runs: EvalRun[]; reviews: Review[]; feedback: Feedback[]; regressionCases: RegressionCase[]; tools: ToolStatus[]; skills: SkillInfo[];
}
export interface QualityApiState extends QualityState { sessionId?: string; }
