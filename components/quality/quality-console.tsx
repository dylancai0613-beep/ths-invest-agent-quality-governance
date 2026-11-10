"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ManualRevision from "./manual-revision";
import type { QualityApiState, QualityCase, EvalRun, RunItem, ReviewDecision, SkillInfo } from "@/lib/quality/types";
import { Activity, AlertCircle, AlertTriangle, ArrowRight, Check, CircleHelp, Clock3, Download, FileJson2, FlaskConical, Gauge, Layers3, LoaderCircle, Microscope, PanelRightClose, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Upload, Wrench, X, Zap } from "lucide-react";

type Section = "overview" | "runs" | "reviews" | "tools";
type BehaviorEvent = { id: string; caseId: string; type: "answer_view" | "evidence_view" | "answer_copy" | "reevaluate" | "regenerate"; createdAt: string };
type RegressionRow = { id: string; runId: string; caseId: string; addedAt: string; candidateVersionId?: string; evaluationVersionId?: string; caseSnapshot?: Omit<QualityCase, "answers">; answerText?: string; findings?: RunItem["findings"] };
type UiState = QualityApiState & { behaviorEvents?: BehaviorEvent[]; skills?: SkillInfo[]; regressionCases?: RegressionRow[] };
const intentNames: Record<string, string> = { fact_query: "事实查询", knowledge: "知识解释", market_event: "行情解读", comparison: "产品比较", suitability: "适配咨询" };
const statusNames: Record<string, string> = { pass: "通过", fail: "不通过", pending_verification: "待核验", needs_review: "需复核", idle: "未评测" };
const severityNames: Record<string, string> = { critical: "严重", high: "高", medium: "中", low: "低" };
const decisionNames: Record<string, string> = { confirmed: "确认问题", false_positive: "判为误报", needs_evidence: "补充证据" };
const example = { dataset: { cases: [{ caseId: "import-demo-001", question: "示例：基金甲最近一期收益率是多少？", intent: "fact_query", askedAt: "2026-11-09T09:00:00+08:00", kyc: { profileId: "anon-import-demo", experience: "beginner", riskTolerance: "medium", horizonMonths: 12, liquidityNeed: "low", purpose: "学习" }, synthetic: true, expectedChecks: ["来源与统计期间明确"], evidence: [], answers: { "candidate-a": { text: "请填写候选 A 回答。", generatedAt: "2026-11-09T09:01:00+08:00", provenance: "preset" } } }] } };

export default function QualityConsole() {
  const [state, setState] = useState<UiState | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [selected, setSelected] = useState<{ run: EvalRun; item: RunItem; c: Omit<QualityCase, "answers"> } | null>(null);
  const [versionId, setVersionId] = useState("");
  const [query, setQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<"import" | null>(null);
  const [importText, setImportText] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const behaviorQueue = useRef<Promise<void>>(Promise.resolve());
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [ifindInfo, setIfindInfo] = useState<{ configured?: boolean; source?: string; historicalSnapshotAvailable?: boolean; supported?: { symbol: string; date: string; field: string }[] } | null>(null);
  const [ifindResult, setIfindResult] = useState<{ status: string; provenance?: string; servedAt?: string; error?: string; query?: unknown; retrievedAt?: string; source?: string; content?: { type: string; text: string }[]; notice?: string; verification?: { status: "MATCH" | "MISMATCH" | "UNVERIFIED"; claimedValue: number; referenceValue: number | null; unit: string; symbol: string; date: string; adjustment: string; evidenceId: string; reason: string } } | null>(null);
  const [ifindClaim, setIfindClaim] = useState("");
  const [judgeInfo, setJudgeInfo] = useState<{ configured?: boolean; model?: string; notice?: string } | null>(null);
  const [judgeResult, setJudgeResult] = useState<{ status: string; model?: string; skillVersion?: string; createdAt?: string; result?: { overallStatus: string; summary: string; findings: { dimension: string; severity: string; quote: string; reason: string; evidenceIds: string[]; requiresReview: true }[] }; notice?: string } | null>(null);

  const notify = (text: string, error = false) => { setToast({ text, error }); window.setTimeout(() => setToast(null), 3800); };
  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/quality", { cache: "no-store" });
      if (!response.ok) throw new Error(`读取评测台失败（${response.status}）`);
      const data = await response.json() as UiState;
      setState(data);
      setSelectedRunId((current) => current && data.runs.some((r) => r.id === current) ? current : data.runs[0]?.id ?? "");
      setVersionId((current) => current && data.versions.some((v) => v.id === current) ? current : data.versions[0]?.id ?? "");
    } catch (err) { notify(err instanceof Error ? err.message : "暂时无法读取评测数据", true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { let active = true; fetch("/api/tools/ifind", { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); return await r.json() as { configured?: boolean; source?: string; historicalSnapshotAvailable?: boolean; supported?: { symbol: string; date: string; field: string }[] }; }).then((d) => { if (active) setIfindInfo(d); }).catch(() => { if (active) setIfindInfo({ configured: false, historicalSnapshotAvailable: false }); }); fetch("/api/tools/judge", { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); return await r.json() as { configured?: boolean; model?: string; notice?: string }; }).then((d) => { if (active) setJudgeInfo(d); }).catch(() => { if (active) setJudgeInfo({ configured: false }); }); return () => { active = false; }; }, []);

  async function act(action: string, payload: Record<string, unknown> = {}, opts: { quiet?: boolean; success?: string } = {}) {
    setBusy(action);
    try {
      const response = await fetch("/api/quality", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const body = await response.json().catch(() => ({})) as { error?: string; message?: string } & Partial<UiState>;
      if (!response.ok) throw new Error(body.error || body.message || `操作失败（${response.status}）`);
      setState(body as UiState);
      if (action === "reset") {
        setSelectedRunId(""); setSelectedCaseIds([]);
        setVersionId(body.versions?.[0]?.id ?? "");
      }
      if (opts.success) notify(opts.success);
      return body as UiState;
    } catch (err) { notify(err instanceof Error ? err.message : "操作失败，请稍后重试", true); return null; }
    finally { setBusy(""); }
  }

  if (loading && !state) return <div className="loading"><LoaderCircle className="spin" size={17} style={{ marginRight: 8 }} />正在加载质检台…</div>;
  const safeState = state ?? { cases: [], versions: [], evaluationVersions: [], runs: [], reviews: [], feedback: [], behaviorEvents: [], regressionCases: [], tools: [], skills: [] } as UiState;
  const versions = safeState.versions ?? [];
  const cases = safeState.cases ?? [];
  const runs = safeState.runs ?? [];
  const latestRun = runs[0];
  const taskRun = runs.find((r) => r.id === selectedRunId) ?? latestRun;
  const taskItems = new Map<string, { run: EvalRun; item: RunItem }>((taskRun?.items ?? []).map((item) => [item.caseId, { run: taskRun!, item }]));
  const activeVersion = versions.find((v) => v.id === versionId) ?? versions[0];
  const latestItems = new Map<string, { run: EvalRun; item: RunItem }>();
  for (const r of runs) for (const item of r.items) if (!latestItems.has(item.caseId)) latestItems.set(item.caseId, { run: r, item });
  const taskCaseRecords = taskRun?.caseSnapshots?.length ? taskRun.caseSnapshots.map((snapshot) => ({ ...snapshot, answers: cases.find((c) => c.caseId === snapshot.caseId)?.answers ?? {} } as QualityCase)) : cases;
  const reviewQueue = cases.map((c) => ({ c, result: latestItems.get(c.caseId) })).filter(({ result }) => result && result.item.reviewStatus === "pending" && result.item.findings.some((f) => f.reviewRequired));
  const reviewCount = reviewQueue.length;
  const shownCases = taskCaseRecords.filter((c) => {
    const it = taskItems.get(c.caseId)?.item;
    return (intentFilter === "all" || c.intent === intentFilter) && (statusFilter === "all" || (it?.overallStatus ?? "idle") === statusFilter) && (!query || `${c.question} ${c.caseId}`.toLowerCase().includes(query.toLowerCase()));
  });
  const intentSummary = Object.keys(intentNames).map((id) => ({ id, name: intentNames[id], count: cases.filter((c) => c.intent === id).length, fails: cases.filter((c) => c.intent === id && ["fail", "needs_review"].includes(latestItems.get(c.caseId)?.item.overallStatus ?? "")).length }));
  const passN = latestRun?.items.filter((i) => i.overallStatus === "pass").length ?? 0;
  const failN = latestRun?.items.filter((i) => i.overallStatus === "fail" || i.overallStatus === "needs_review").length ?? 0;
  const pendingN = latestRun?.items.filter((i) => i.overallStatus === "pending_verification").length ?? 0;
  const getCase = (id: string) => cases.find((c) => c.caseId === id);
  const selectedStoredAnswer = selected ? getCase(selected.c.caseId)?.answers[selected.run.candidateVersionId] : undefined;
  const selectedAnswerGeneratedAt = selected && selectedStoredAnswer && selectedStoredAnswer.text === selected.item.answerText ? selectedStoredAnswer.generatedAt : undefined;
  const openCase = (c: QualityCase | Omit<QualityCase, "answers">, res?: { run: EvalRun; item: RunItem }) => {
    if (res) {
      const snapshot = res.run.caseSnapshots?.find((entry) => entry.caseId === c.caseId);
      setSelected({ c: snapshot ?? c as Omit<QualityCase, "answers">, run: res.run, item: res.item });
      void recordBehavior(c.caseId, "answer_view");
    } else setSelected(null);
    setReviewNote(""); setJudgeResult(null); setShowEvidence(false);
  };
  async function recordBehavior(caseId: string, type: BehaviorEvent["type"]) {
    behaviorQueue.current = behaviorQueue.current.then(async () => { await act("record_behavior", { caseId, type }); }).catch(() => {});
    await behaviorQueue.current;
  }
  async function copySelectedAnswer() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(displayText(selected.item.answerText)); await recordBehavior(selected.c.caseId, "answer_copy"); notify("回答已复制。", false); }
    catch { notify("复制失败，请检查浏览器权限。", true); }
  }

  async function evaluateVersion(id: string, success = "规则评测已完成，结果已刷新。", requestedIds?: string[]) {
    const available = cases.filter((c) => c.answers[id]?.text?.trim()).map((c) => c.caseId);
    const caseIds = (requestedIds ?? available.slice(0, 20)).filter((caseId) => available.includes(caseId));
    if (!caseIds.length) { notify("此版本没有已保存回答，无法运行评测。", true); return; }
    if (caseIds.length > 20) { notify("单次最多可评测 20 条，请减少所选案例。", true); return; }
    const result = await act("evaluate", { versionId: id, caseIds }, { success });
    if (result?.runs?.[0]) { setSelectedRunId(result.runs[0].id); setSection("runs"); }
  }
  async function evaluate() {
    if (!activeVersion) { notify("当前没有候选回答版本", true); return; }
    await evaluateVersion(activeVersion.id);
  }
  async function evaluateSelectedCases() {
    if (!activeVersion) { notify("当前没有候选回答版本", true); return; }
    if (!selectedCaseIds.length) { notify("请先勾选要运行的案例", true); return; }
    await evaluateVersion(activeVersion.id, `已完成 ${selectedCaseIds.length} 条案例的规则评测。`, selectedCaseIds);
    setSelectedCaseIds([]);
  }
  async function submitReview(decision: ReviewDecision) {
    if (!selected || !reviewNote.trim()) { notify("请填写复核理由后再提交", true); return; }
    const result = await act("review", { runId: selected.run.id, caseId: selected.c.caseId, decision, note: reviewNote.trim() }, { success: "复核记录已保存。" });
    if (result) { setSelected(null); setReviewNote(""); }
  }
  async function addRegression(runId: string, caseId: string) {
    await act("add_regression", { runId, caseId }, { success: "已加入回归案例集。" });
  }
  function downloadRegression() {
    setBusy("export");
    void fetch("/api/quality", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "export" }) }).then(async (response) => {
      const data = await response.json() as { error?: string; schemaVersion?: string; exportedAt?: string; regressionCases?: RegressionRow[] }; if (!response.ok) throw new Error(data.error || "回归集导出失败");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "已确认问题回归集.json"; a.click(); URL.revokeObjectURL(url); notify("回归集 JSON 已导出。");
    }).catch((err) => notify(err instanceof Error ? err.message : "回归集导出失败", true)).finally(() => setBusy(""));
  }
  async function resetDemo() {
    const confirmed = window.confirm("重置当前会话演示数据？这会清空本会话的评测运行、复核、反馈和回归记录，并恢复 20 条预置测试案例。其他会话不受影响。");
    if (confirmed) await act("reset", {}, { success: "当前会话已重置，已恢复 20 条预置案例。" });
  }
  async function importData() {
    try { const dataset = JSON.parse(importText); const result = await act("import", { dataset }, { success: "问答集已导入。" }); if (result) { setModal(null); setImportText(""); } }
    catch (err) { if (!(err instanceof SyntaxError)) notify("导入失败", true); else notify("JSON 格式有误，请检查后重试。", true); }
  }
  async function probe(toolId: string) { await act("probe", { toolId, scenario: "timeout" }, { success: "探测完成，状态已刷新。" }); }
  async function generate(c: Pick<QualityCase, "caseId">, version?: string, keepAnswerOpen = false) {
    const res = await act("generate", { caseId: c.caseId, versionId: version });
    if (res) {
      const generated = res.versions.find((v) => !versions.some((known) => known.id === v.id));
      if (generated) {
        setVersionId(generated.id);
        const evaluated = await act("evaluate", { versionId: generated.id, caseIds: [c.caseId] }, { success: "模型修订已生成并完成单案例规则复测。" });
        const run = evaluated?.runs[0];
        const item = run?.items.find((entry) => entry.caseId === c.caseId);
        if (run && item) {
          setSelectedRunId(run.id); setSection("runs");
          if (keepAnswerOpen) {
            const snapshot = run.caseSnapshots.find((entry) => entry.caseId === c.caseId);
            if (snapshot) setSelected({ c: snapshot, run, item });
          } else setSelected(null);
        }
      } else notify("候选回答已生成，但未能识别新版本。", true);
    }
  }
  async function reviseSelected(text: string, note: string) {
    if (!selected) return;
    const caseId = selected.c.caseId;
    const result = await act("revise", { caseId, sourceVersionId: selected.run.candidateVersionId, answerText: text, note, reevaluate: true });
    if (!result) return;
    const revision = result.versions.find(v => !versions.some(old => old.id === v.id));
    if (!revision) return;
    setVersionId(revision.id);
    const evaluated = (result.runs ?? []).find((run) => run.candidateVersionId === revision.id && run.items.some((item) => item.caseId === caseId));
    if (evaluated) { setSelected(null); setSelectedRunId(evaluated.id); setSection("runs"); notify("人工修订已保存并完成规则复测。", false); }
    else notify("修订已保存，但服务未返回单案例复测结果。", true);
  }
  async function ifindQuery(mode: "online" | "historical_snapshot" = "online") {
    setBusy("ifind");
    try { const r = await fetch("/api/tools/ifind", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbol: "300033.SZ", date: "2026-11-06", field: "close", ...(mode === "historical_snapshot" ? { mode } : {}), ...(ifindClaim.trim() ? { claimValue: Number(ifindClaim), claimUnit: "元" } : {}) }) }); const d = await r.json() as NonNullable<typeof ifindResult>; setIfindResult(d); if (!r.ok) notify(d.error || d.notice || "iFinD查询失败", true); else notify(d.notice || "iFinD查询返回完成"); }
    catch (err) { notify(err instanceof Error ? err.message : "iFinD服务暂不可用", true); }
    finally { setBusy(""); }
  }
  async function judgeCase(c: Pick<QualityCase, "caseId">, version?: string) {
    setBusy("judge");
    try { const r = await fetch("/api/tools/judge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: c.caseId, versionId: version }) }); const d = await r.json() as NonNullable<typeof judgeResult>; setJudgeResult(d); if (!r.ok) notify(d.notice || "AI辅助评测暂不可用", true); else notify(d.notice || "AI辅助建议已返回"); }
    catch (err) { notify(err instanceof Error ? err.message : "AI辅助评测暂不可用", true); }
    finally { setBusy(""); }
  }
  function exportRun(run: EvalRun) { const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `quality-run-${run.id}.json`; a.click(); URL.revokeObjectURL(url); }
  function downloadExample() { const blob = new Blob([JSON.stringify(example, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "投资问答集导入示例.json"; a.click(); URL.revokeObjectURL(url); }
  function downloadIfind() { if (!ifindResult) return; const blob = new Blob([JSON.stringify({ status: ifindResult.status, provenance: ifindResult.provenance, servedAt: ifindResult.servedAt, query: ifindResult.query, retrievedAt: ifindResult.retrievedAt, source: ifindResult.source, content: ifindResult.content, verification: ifindResult.verification, notice: ifindResult.notice, error: ifindResult.error }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `ifind-${ifindResult.verification?.evidenceId || "query"}.json`; a.click(); URL.revokeObjectURL(url); }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={19} strokeWidth={2.2} /></div><div><strong>投研回答质检台</strong><small>RESEARCH QA WORKSPACE</small></div></div>
      <div className="nav-label">工作空间</div>
      <nav className="nav-list">
        {([ ["overview", Gauge, "概览"], ["runs", Layers3, "评测任务"], ["reviews", ShieldCheck, "人工复核"], ["tools", Wrench, "工具与 Skills"] ] as const).map(([id, Icon, label]) => <button key={id} aria-label={label} className={`nav-item ${section === id ? "active" : ""}`} onClick={() => setSection(id)}><Icon size={16} /><span>{label}</span>{id === "reviews" && reviewCount > 0 && <i className="count">{reviewCount}</i>}</button>)}
      </nav>
      <div className="side-bottom"><div className="env"><div className="env-head"><i className="dot" />演示环境 <span style={{ marginLeft: "auto", color: "#81999a" }}>v0.8</span></div><p>数据集与行情快照均为合成演示数据</p></div><div className="user"><div className="avatar">研</div><div><b>研究质量团队</b><span>评测工作区</span></div></div></div>
    </aside>
    <main className="main"><div className="topbar"><div className="crumb"><span>工作空间</span><span>/</span><b>{({ overview: "概览", runs: "评测任务", reviews: "人工复核", tools: "工具与 Skills" })[section]}</b></div><div className="top-actions"><div className="top-chip"><span className="dot" />规则评测已就绪</div><button aria-label="刷新数据" className="top-icon" title="刷新数据" onClick={() => void refresh(true)}><RefreshCw size={14} /></button></div></div>
      <div className="content"><div className="page-head"><div><div className="eyebrow"><span className="dot" />质量治理 · 工作台</div><h1>{({ overview: "投研回答质量，一屏掌握", runs: "评测任务", reviews: "人工复核队列", tools: "工具与 Skills" })[section]}</h1><p>{section === "overview" ? "从规则评测、证据核验到人工复核，持续把每条投资回答变成可追溯的质量记录。" : section === "tools" ? "查看外部数据连接、运行探测，并了解当前生效的评测规则。" : "查看每条问答的评测结果、证据依据与复核状态。"}</p></div>{section === "runs" && <div className="actions"><button className="btn" onClick={() => setModal("import")}><Upload />导入问答集</button>{taskRun && <button className="btn" onClick={() => exportRun(taskRun)}><Download />导出结果</button>}<button disabled={!!busy} className="btn primary" onClick={() => void evaluate()}>{busy === "evaluate" ? <LoaderCircle className="spin" /> : <FlaskConical />}开始规则评测</button></div>}</div>
        <div className="notice"><CircleHelp size={15} /><span><strong>演示数据：</strong>本工作台用于展示质检流程，不代表真实来源或实时行情。</span></div>
        {section === "overview" && <>
          <div className="stats">
            <Stat Icon={Layers3} title="测试总数" value={cases.length} note={`${safeState.regressionCases?.length ?? 0} 条已确认回归样例`} />
            <Stat Icon={Activity} title="最近评测" value={latestRun ? `${latestRun.items.length} 条` : "—"} note={latestRun ? new Date(latestRun.createdAt).toLocaleString("zh-CN", { hour12: false }) : "尚未运行评测"} />
            <Stat Icon={AlertTriangle} title="问题与待核验" value={latestRun ? failN + pendingN : "—"} note={latestRun ? `不通过/需复核 ${failN} · 待核验 ${pendingN}` : "运行评测后显示"} />
            <Stat Icon={ShieldCheck} title="待人工复核" value={reviewCount} note={`已标记待人工确认的案例`} accent />
          </div>
            <div className="grid-main"><div className="card"><div className="card-head"><div><div className="card-title">最近一次规则评测</div><div className="card-sub">{latestRun ? `${new Date(latestRun.createdAt).toLocaleString("zh-CN", { hour12: false })}` : "完成一次评测后，这里会汇总真实规则执行结果"}</div></div>{latestRun && <button className="btn small" onClick={() => { setSection("runs"); }}>查看任务 <ArrowRight size={12} /></button>}</div><div className="card-body">{latestRun ? <><div className="run-row"><div className="run-emblem"><Microscope /></div><div className="run-copy"><b>确定性规则运行完成</b><span>{latestRun.items.length} 条案例 · 规则集 {safeState.evaluationVersions?.find((v) => v.id === latestRun.evaluationVersionId)?.name ?? "当前版本"}</span></div><div className="run-number"><b>{latestRun.items.length}</b><span>已评测案例</span></div></div><div className="mini-bar"><span className="bar-pass" style={{ width: `${100 * passN / Math.max(1, latestRun.items.length)}%` }} /><span className="bar-fail" style={{ width: `${100 * failN / Math.max(1, latestRun.items.length)}%` }} /><span className="bar-pending" style={{ width: `${100 * pendingN / Math.max(1, latestRun.items.length)}%` }} /></div><div className="run-legend"><span><i className="legend-dot" style={{ background: "#47ae8f" }} />通过 {passN}/{latestRun.items.length}</span><span><i className="legend-dot" style={{ background: "#d86b5f" }} />不通过/复核 {failN}/{latestRun.items.length}</span><span><i className="legend-dot" style={{ background: "#dba74e" }} />待核验 {pendingN}/{latestRun.items.length}</span></div><div className="section-label">按问答意图分布</div><div className="progress-list">{intentSummary.map((x) => <div className="progress-line" key={x.id}><span>{x.name}</span><div className="progress-track"><i style={{ width: `${100 * x.count / Math.max(1, cases.length)}%` }} /></div><strong>{x.count} 条</strong></div>)}</div></> : <div className="empty"><strong>还没有评测运行</strong>已准备好 {cases.length} 条问答，前往评测任务即可开始检查。<div style={{ marginTop: 14 }}><button className="btn primary" onClick={() => setSection("runs")}>查看评测任务 <ArrowRight size={13} /></button></div></div>}</div></div>
            <div className="right-stack"><div className="card review-card"><div className="card-head"><div><div className="card-title">待处理队列</div><div className="card-sub">需人工检查的案例</div></div><div className="review-total">{reviewCount}</div></div><div className="card-body">{reviewQueue.slice(0, 3).map(({ c, result }) => <div className="queue-item" key={c.caseId} onClick={() => { if (result) openCase(c, result); setSection("reviews"); }}><i className="queue-bullet" /><div className="queue-copy"><b>{displayText(c.question)}</b><span>{c.caseId} · {intentNames[c.intent]}</span></div><ArrowRight className="queue-arrow" /></div>)}{reviewCount === 0 && <div className="empty" style={{ padding: "18px 5px" }}>当前没有待处理项目</div>}<button className="btn small" style={{ width: "100%", marginTop: 8 }} onClick={() => setSection("reviews")}>打开复核队列 <ArrowRight size={12} /></button></div></div>
              </div></div><div className="card" style={{ marginTop: 14 }}><div className="card-head"><div><div className="card-title">问答速览</div><div className="card-sub">{latestRun ? "点击案例行查看问答详情、证据和人工复核操作" : "先运行评测，再查看问答与判断依据"}</div></div><button className="btn small" onClick={() => setSection("runs")}>查看全部 <ArrowRight size={12} /></button></div><div className="table-wrap"><CaseTable cases={cases.slice(0, 5)} items={latestItems} onOpen={(c) => { const r = latestItems.get(c.caseId); openCase(c, r); }} /></div></div>
        </>}
        {section === "runs" && <>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">所有测评任务</div>
                <div className="card-sub">本会话共 {runs.length} 次规则测评；选择一条查看对应结果</div>
              </div>
            </div>
            <div className="card-body">
              {runs.length ? <div className="run-history-list">
                {runs.map((run, index) => {
                  const passed = run.items.filter((item) => item.overallStatus === "pass").length;
                  const issues = run.items.filter((item) => item.overallStatus === "fail" || item.overallStatus === "needs_review").length;
                  const pending = run.items.filter((item) => item.overallStatus === "pending_verification").length;
                  return <button key={run.id} type="button" className={`run-history-item ${taskRun?.id === run.id ? "selected" : ""}`} aria-pressed={taskRun?.id === run.id} onClick={() => { setSelectedRunId(run.id); setVersionId(run.candidateVersionId); setSelectedCaseIds([]); }}>
                    <span className="run-history-copy">
                      <b>第 {runs.length - index} 次规则测评</b>
                      <span>{new Date(run.createdAt).toLocaleString("zh-CN", { hour12: false })} · {run.items.length} 条问答</span>
                      <small>通过 {passed} · 问题 {issues} · 待核验 {pending}</small>
                    </span>
                    <span className={`run-history-state ${run.status === "partial" ? "partial" : ""}`}>{run.status === "partial" ? "部分完成" : "已完成"}<ArrowRight size={13} /></span>
                  </button>;
                })}
              </div> : <div className="empty"><strong>还没有测评任务</strong>开始规则测评后，每次运行都会显示在这里。</div>}
            </div>
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-head"><div><div className="card-title">测评结果</div><div className="card-sub">{taskRun ? `${new Date(taskRun.createdAt).toLocaleString("zh-CN", { hour12: false })} · ${taskRun.items.length} 条问答` : `${cases.length} 条待检查问答`}</div></div></div>
            <div className="card-body">
              <div className="tabs"><button className="tab active">测评结果 <i className="pill">{shownCases.length}</i></button><button className="tab" onClick={() => setSection("reviews")}>待人工复核 <i className="pill">{reviewCount}</i></button></div>
              <div className="filters"><div className="search-wrap"><Search /><input className="search" placeholder="搜索问题或案例 ID" value={query} onChange={(e) => setQuery(e.target.value)} /></div><select className="filter" value={intentFilter} onChange={(e) => setIntentFilter(e.target.value)}><option value="all">全部意图</option>{Object.entries(intentNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select className="filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">全部状态</option>{Object.entries(statusNames).filter(([id]) => id !== "idle").map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button className="btn small primary" onClick={() => void evaluateSelectedCases()} disabled={!selectedCaseIds.length || !!busy}><FlaskConical size={12} />运行所选 {selectedCaseIds.length}/20</button><button className="btn small" onClick={() => setSelectedCaseIds(shownCases.slice(0, 20).filter((c) => c.answers[versionId]?.text?.trim()).map((c) => c.caseId))}>选择当前筛选</button><button className="btn small" onClick={() => setSelectedCaseIds([])} disabled={!selectedCaseIds.length}>清除选择</button><span style={{ marginLeft: "auto", color: "var(--muted-foreground)", fontSize: 9 }}>结果数 {shownCases.length}/{cases.length}</span></div>
              <CaseTable cases={shownCases} items={taskItems} selectable checkedIds={selectedCaseIds} answerVersionId={versionId} onToggle={(id) => setSelectedCaseIds((current) => current.includes(id) ? current.filter((v) => v !== id) : current.length >= 20 ? (notify("单次最多勾选 20 条案例", true), current) : [...current, id])} onOpen={(c) => { const r = taskItems.get(c.caseId); openCase(c, r); }} />
            </div>
          </div>
        </>}{section === "reviews" && <>
          <div className="grid-main">
            <div className="card"><div className="card-head"><div><div className="card-title">待复核案例</div><div className="card-sub">复核结论与自动规则结果分别保存</div></div><span className="tag">{reviewQueue.length} 条待处理</span></div><div className="card-body">{reviewQueue.length ? <div className="table-wrap"><table className="case-table"><thead><tr><th>案例 / 意图</th><th>评测状态</th><th>问题数</th><th></th></tr></thead><tbody>{reviewQueue.map(({ c, result }) => <tr key={c.caseId} onClick={() => result && openCase(c, result)}><td><div className="case-id">{c.caseId} · {intentNames[c.intent]}</div><span className="case-question">{displayText(c.question)}</span></td><td><Status status={result?.item.overallStatus} /></td><td>{result?.item.findings.length ?? 0}</td><td><ArrowRight size={13} /></td></tr>)}</tbody></table></div> : <div className="empty"><strong>当前没有待复核案例</strong>运行评测后，高风险或待确认结果会显示在这里。</div>}</div></div>
            <div className="card"><div className="card-head"><div><div className="card-title">用户行为反馈</div><div className="card-sub">工作台实际记录的查看、复制与复测操作；不代表用户意见。</div></div></div><div className="card-body">{safeState.behaviorEvents?.length ? safeState.behaviorEvents.slice(0, 12).map((event) => <div className="queue-item" key={event.id}><i className="queue-bullet" /><div className="queue-copy"><b>{{ answer_view: "打开回答详情", evidence_view: "查看判断依据", answer_copy: "复制回答", reevaluate: "重新评测", regenerate: "生成修订回答" }[event.type]}</b><span>{event.caseId} · {displayText(getCase(event.caseId)?.question ?? "该案例不在当前列表中")} · {new Date(event.createdAt).toLocaleString("zh-CN", { hour12: false })}</span></div></div>) : <div className="empty"><strong>暂无已记录的工作台行为</strong>打开回答、查看判断依据或复制回答后，会在此显示匿名操作记录。</div>}</div></div>
          </div>
          <div className="card" style={{ marginTop: 14 }}><div className="card-head"><div><div className="card-title">已确认问题 · 回归集</div><div className="card-sub">确认问题可加入固定回归案例，后续运行用于检查是否复发。</div></div><button className="btn small" disabled={!safeState.regressionCases?.length || !!busy} onClick={downloadRegression}><Download size={12} />导出回归 JSON</button></div><div className="card-body"><div style={{ marginBottom: 13 }}>{safeState.reviews.filter((r) => r.decision === "confirmed").length ? safeState.reviews.filter((r) => r.decision === "confirmed").map((review) => { const regressionExists = (safeState.regressionCases ?? []).some((item) => item.caseId === review.caseId && item.runId === review.runId); return <div className="queue-item" key={review.id}><i className="queue-bullet" /><div className="queue-copy"><b>{displayText(getCase(review.caseId)?.question ?? review.caseId)}</b><span>{review.caseId} · {review.note} · {new Date(review.createdAt).toLocaleString("zh-CN", { hour12: false })}</span></div><button className="btn small" disabled={regressionExists || !!busy} onClick={() => void addRegression(review.runId, review.caseId)}>{regressionExists ? "已加入回归集" : "加入回归集"}</button></div>; }) : <div className="empty" style={{ padding: 12 }}>暂无已确认的问题案例。请先在详情抽屉完成“确认问题”复核。</div>}</div><div className="section-label" style={{ marginTop: 4 }}>回归案例库 · {safeState.regressionCases?.length ?? 0}</div>{safeState.regressionCases?.length ? safeState.regressionCases.map((item) => <div className="queue-item" key={item.id}><i className="queue-bullet" /><div className="queue-copy"><b>{displayText(item.caseSnapshot?.question ?? getCase(item.caseId)?.question ?? item.caseId)}</b><span>{item.caseId} · 加入于 {new Date(item.addedAt).toLocaleString("zh-CN", { hour12: false })}</span></div></div>) : <div style={{ color: "#8c999a", fontSize: 10 }}>尚无回归案例</div>}</div></div>
        </>}        {section === "tools" && <div className="grid-main"><div className="card"><div className="card-head"><div><div className="card-title">数据工具连接</div><div className="card-sub">可用范围与连接状态透明展示</div></div><button className="btn small" onClick={() => void refresh(true)}><RefreshCw size={12} />刷新状态</button></div><div className="card-body"><div className="tool-grid">{safeState.tools.filter((t) => t.id !== "real-ifind").map((t) => <div className="tool-card" key={t.id}><div className="tool-top"><b>{t.name}</b><span className={`tool-status ${t.status === "not_configured" || t.status === "simulated_timeout" ? "off" : ""}`}><i className="dot" style={{ background: t.status === "snapshot" || t.status === "configured" ? "#4ab28f" : "#d6a147" }} />{t.status === "snapshot" ? "合成快照可用" : t.status === "configured" ? "已配置" : t.status === "simulated_timeout" ? "模拟超时" : "未配置"}</span></div><p>{t.description}</p>{t.id === "timeout-probe" ? <button className="btn small" onClick={() => void probe(t.id)} disabled={!!busy}>{busy === "probe" ? <LoaderCircle className="spin" size={12} /> : <Zap size={12} />}演示超时</button> : t.id === "external-model" ? <button className="btn small" onClick={() => void probe(t.id)} disabled={!!busy}>{busy === "probe" ? <LoaderCircle className="spin" size={12} /> : <ShieldCheck size={12} />}检查配置</button> : null}</div>)}{ifindInfo && <div className="tool-card" style={{ gridColumn: "1 / -1", borderColor: "var(--border)", background: "var(--card)" }}><div className="tool-top"><b>iFinD 行情查询</b><span className={`tool-status ${ifindInfo.configured ? "" : "off"}`}><i className="dot" style={{ background: ifindInfo.configured ? "#4ab28f" : "#d6a147" }} />{ifindInfo.configured ? "已配置" : "服务端未配置"}</span></div><p>查询 300033.SZ 于 2026-11-06 的收盘价。原始数据仅供人工核验，查询结果不会自动写入回答评测或判定回答正确。</p><label className="field-label" style={{ marginTop: 8 }}>待核验的回答数值（元，可选）</label><input className="field" inputMode="decimal" placeholder="留空时仅查询 iFinD" value={ifindClaim} onChange={(e) => setIfindClaim(e.target.value)} /><div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}><button className="btn small primary" onClick={() => void ifindQuery("online")} disabled={!!busy || (!!ifindClaim.trim() && !Number.isFinite(Number(ifindClaim)))}>{busy === "ifind" ? <LoaderCircle size={12} className="spin" /> : <Search size={12} />}在线查询{ifindClaim.trim() ? "并核验" : ""}</button>{ifindInfo.historicalSnapshotAvailable && <button className="btn small" onClick={() => void ifindQuery("historical_snapshot")} disabled={!!busy || (!!ifindClaim.trim() && !Number.isFinite(Number(ifindClaim)))}><Clock3 size={12} />使用历史证据核验</button>}</div>{ifindResult && <div style={{ marginTop: 13, padding: 11, background: "var(--background-raised)", borderRadius: 7, border: "1px solid #e3ece9" }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#637577", marginBottom: 7 }}><b>{ifindResult.status === "historical_snapshot" ? "已保存历史证据｜非本次在线查询" : ifindResult.status === "retrieved" ? "在线查询已返回" : ifindResult.status === "not_configured" ? "未配置" : "在线查询异常"}</b><span>{ifindResult.source} {ifindResult.retrievedAt ? `· 原始查询时间 ${new Date(ifindResult.retrievedAt).toLocaleString("zh-CN", { hour12: false })}` : ""}{ifindResult.servedAt ? ` · 本次提供时间 ${new Date(ifindResult.servedAt).toLocaleString("zh-CN", { hour12: false })}` : ""}</span></div>{ifindResult.verification && <div style={{ marginBottom: 8, padding: "8px 9px", borderRadius: 6, background: ifindResult.verification.status === "MATCH" ? "#eaf7f0" : ifindResult.verification.status === "MISMATCH" ? "#fff0ee" : "#fff7e8", color: ifindResult.verification.status === "MATCH" ? "#347e61" : ifindResult.verification.status === "MISMATCH" ? "#a74e45" : "#966d2c", fontSize: 9 }}><b>{ifindResult.verification.status === "MATCH" ? "数值匹配" : ifindResult.verification.status === "MISMATCH" ? "数值不匹配" : "待核验"}</b>　回答值 {ifindResult.verification.claimedValue} {ifindResult.verification.unit} · 来源值 {ifindResult.verification.referenceValue ?? "—"} {ifindResult.verification.unit}<div style={{ marginTop: 4 }}>来源：{ifindResult.verification.symbol} · {ifindResult.verification.date} · {ifindResult.verification.adjustment} · 证据 {ifindResult.verification.evidenceId}</div><div style={{ marginTop: 3 }}>{ifindResult.verification.reason}</div></div>}{ifindResult.error && <p style={{ margin: "0 0 7px", color: "#a74e45", fontSize: 9 }}>{ifindResult.error}</p>}{ifindResult.notice && <p style={{ margin: "0 0 7px", color: "#738384", fontSize: 9 }}>{ifindResult.notice}</p>}<pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0, fontSize: 9, color: "#40575a", maxHeight: 180, overflow: "auto" }}>{ifindResult.content?.map((c) => c.text).join("\n") || JSON.stringify(ifindResult.query ?? ifindResult, null, 2)}</pre><button className="btn small" style={{ marginTop: 8 }} onClick={downloadIfind}><Download size={11} />下载查询 JSON</button></div>}</div>}</div><div className="notice" style={{ marginTop: 12, marginBottom: 0 }}><Sparkles size={14} /><span>AI 语义评测：{judgeInfo?.configured ? `已配置 · ${judgeInfo.model || "模型可用"}` : "未配置"}。</span></div><div className="notice" style={{ marginTop: 12, marginBottom: 0 }}><AlertCircle size={14} /><span>工具探测的模拟异常仅验证错误路径，不代表真实数据源故障。合成证据快照和 iFinD 查询结果彼此独立。</span></div></div></div><div className="card"><div className="card-head"><div><div className="card-title">生效中的 Skills</div><div className="card-sub">规则定义、版本及适用范围</div></div><Sparkles size={15} color="#6b9f94" /></div><div className="card-body">{(safeState.skills ?? safeState.evaluationVersions?.flatMap((ev) => ev.rules.map((rule, i) => ({ id: `${ev.id}-${i}`, name: rule, version: ev.skillVersion, description: ev.name }))) ?? []).map((s) => <div className="skill-row" key={s.id}><div className="skill-icon"><Sparkles size={13} /></div><div><b>{s.name}</b><small>{s.description || "评测规则与检查标准"}</small></div><span className="skill-version">{s.version || s.status || "已启用"}</span></div>)}{!safeState.skills?.length && !safeState.evaluationVersions?.length && <div className="empty">暂无 Skills 数据</div>}<div className="notice" style={{ marginTop: 12, marginBottom: 0 }}><ShieldCheck size={14} /><span>规则负责可重复的字段和数字检查；{judgeInfo?.configured ? "模型语义评测已配置。" : "模型语义评测尚未配置。"}</span></div><button className="btn small danger" style={{ marginTop: 14 }} disabled={!!busy} onClick={() => void resetDemo()}><RefreshCw size={12} />重置本会话演示数据</button></div></div></div>}
      </div>
    </main>

    {toast && <div className={`toast ${toast.error ? "error" : ""}`}><span>{toast.error ? "操作未完成 · " : "已完成 · "}</span>{toast.text}</div>}
    {modal === "import" && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><div className="modal"><div className="modal-head"><h2>导入问答集</h2><button aria-label="关闭对话框" className="top-icon" onClick={() => setModal(null)}><X size={14} /></button></div><div className="modal-body"><p style={{ margin: "0 0 12px" }}>导入 JSON 问答数据。支持包含 <code>cases</code> 数组的数据集对象；案例和证据均按演示数据处理。</p><button className="btn small" onClick={downloadExample}><FileJson2 size={12} />下载格式示例</button><textarea className="field" style={{ height: 220, resize: "vertical", marginTop: 10, fontFamily: "ui-monospace,monospace", fontSize: 10 }} placeholder="粘贴 JSON，或选择文件…" value={importText} onChange={(e) => setImportText(e.target.value)} /><label className="btn small" style={{ marginTop: 9, display: "inline-flex" }}><Upload size={12} />选择 JSON 文件<input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(setImportText); }} /></label></div><div className="modal-foot"><button className="btn" onClick={() => setModal(null)}>取消</button><button className="btn primary" onClick={() => void importData()} disabled={!importText.trim() || !!busy}>{busy === "import" ? <LoaderCircle className="spin" /> : <Upload />}导入问答集</button></div></div></div>}    {selected && <><div className="drawer-shade" onClick={() => setSelected(null)} /><aside className="drawer"><div className="drawer-head"><div><h2>问答详情</h2><small>{selected.c.caseId} · {intentNames[selected.c.intent]} · {statusNames[selected.item.overallStatus]} · 演示数据</small></div><button aria-label="关闭详情抽屉" className="top-icon" onClick={() => setSelected(null)}><PanelRightClose size={15} /></button></div><div className="drawer-content">
      <div className="detail-card"><h3>用户问题</h3><p className="question-text">{displayText(selected.c.question)}</p><div className="answer-panel"><div className="answer-heading"><h3>{selected.item.answerProvenance === "manual" ? "人工修订回答" : "AI回答"}</h3>{selected.item.answerProvenance === "generated" && <span className="tag">模型现场生成</span>}</div>{selected.item.answerProvenance === "preset" ? <div className="answer-unavailable"><div><strong>尚无此问题的模型回答</strong><p>当前记录仅用于验证规则流程，不会作为真实 AI 回答展示。</p></div><button className="btn small primary" disabled={!!busy} onClick={() => void generate(selected.c, selected.run.candidateVersionId, true)}>{busy === "generate" ? <LoaderCircle className="spin" size={12} /> : <Sparkles size={12} />}生成 AI 回答并复测</button></div> : <><p className="answer-text">{displayText(selected.item.answerText)}</p><button className="btn small" onClick={() => void copySelectedAnswer()}>复制回答</button></>}</div>{selected.c.eventContext?.length ? <div className="detail-card"><h3>事件时间</h3>{selected.c.eventContext.map((event) => <div className="finding" key={event.id}><b>{displayText(event.title)}</b><p>发生：{new Date(event.occurredAt).toLocaleString("zh-CN", { hour12: false })} · 公开：{new Date(event.publishedAt).toLocaleString("zh-CN", { hour12: false })}</p><p>{displayText(event.summary)}</p><p>来源：{event.synthetic ? "www.sample.com" : event.source} · 问答时间：{new Date(selected.c.askedAt).toLocaleString("zh-CN", { hour12: false })} · 回答生成：{selectedAnswerGeneratedAt ? new Date(selectedAnswerGeneratedAt).toLocaleString("zh-CN", { hour12: false }) : "历史记录未保存生成时间"}</p><span className="tag">合成演示事件</span></div>)}</div> : null}</div>
      <div className="detail-card"><h3>匿名 KYC 画像</h3><div className="kyc-grid"><Kyc label="投资经验" value={selected.c.kyc.experience === "beginner" ? "初级" : selected.c.kyc.experience === "experienced" ? "有经验" : "未提供"} /><Kyc label="风险承受" value={riskLabel(selected.c.kyc.riskTolerance)} /><Kyc label="投资期限" value={selected.c.kyc.horizonMonths ? `${selected.c.kyc.horizonMonths} 个月` : "未提供"} /><Kyc label="流动性需求" value={riskLabel(selected.c.kyc.liquidityNeed)} /><Kyc label="资金用途" value={selected.c.kyc.purpose || "未提供"} /></div></div>
      <div className="detail-card"><h3>问题片段与规则判断 <span className="tag">{selected.item.findings.length} 项</span></h3>{selected.item.findings.length ? selected.item.findings.map((f) => <div className="finding" key={f.id}><div><b>{f.dimension}</b><span className="tag">{severityNames[f.severity]} · {f.status === "fail" ? "命中" : "待核验"}</span></div>{f.quote && <p><span className="quote">{displayText(f.quote)}</span></p>}<p><b>原因候选 · 待人工确认：</b>{displayText(f.reason)}</p></div>) : <p>当前没有发现问题片段。</p>}</div>
      <ManualRevision key={selected.run.id + selected.c.caseId} answer={selected.item.answerProvenance === "preset" ? "" : displayText(selected.item.answerText)} disabled={!!busy} onSave={reviseSelected} />
      <div className="detail-card"><h3>AI 辅助复核</h3><p>AI 建议需人工核验，独立展示，不并入规则评测指标。</p>{judgeResult?.result && <div><b>{displayText(judgeResult.result.summary)}</b><span className="tag">{statusNames[judgeResult.result.overallStatus] || judgeResult.result.overallStatus}</span>{judgeResult.result.findings.map((f, i) => <div className="finding" key={`${f.dimension}-${i}`}><b>{f.dimension} · {severityNames[f.severity] || f.severity}</b>{f.quote && <p><span className="quote">{displayText(f.quote)}</span></p>}<p><b>建议原因 · 待人工确认：</b>{displayText(f.reason)}</p></div>)}</div>}{judgeResult?.notice && <p>{judgeResult.notice}</p>}<button className="btn small" disabled={!!busy || !judgeInfo?.configured} onClick={() => void judgeCase(selected.c, selected.run.candidateVersionId)}>{busy === "judge" ? <LoaderCircle size={12} className="spin" /> : <Sparkles size={12} />}运行 AI 辅助复核</button></div>
      <div className="detail-card"><h3>判断依据</h3><button className="btn small" aria-expanded={showEvidence} onClick={() => { const next = !showEvidence; setShowEvidence(next); if (next) void recordBehavior(selected.c.caseId, "evidence_view"); }}>{showEvidence ? "收起判断依据" : "查看判断依据"} · {selected.c.evidence.length} 条</button>{showEvidence && (selected.c.evidence.length ? <div className="table-wrap"><table className="evidence"><thead><tr><th>指标</th><th>值</th><th>时间</th><th>来源</th></tr></thead><tbody>{selected.c.evidence.map((e) => <tr key={e.id}><td>{displayText(e.claim)}</td><td>{e.value} {e.unit}</td><td title={`信息发布：${e.publishedAt.slice(0, 10)}`}>{e.period}</td><td>{e.synthetic ? "www.sample.com" : e.source}</td></tr>)}</tbody></table></div> : <p>此案例没有配置判断依据快照。</p>)}</div>
      <div className="review-form"><h3>人工复核 <span className="tag">自动评测：{statusNames[selected.item.overallStatus]}</span></h3><label className="field-label" style={{ marginTop: 4 }}>复核理由（必填）</label><textarea className="field" style={{ height: 72, resize: "vertical" }} placeholder="说明确认依据、误报原因或需要补充的证据…" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} /><div className="review-actions"><button className="btn small primary" onClick={() => void submitReview("confirmed")} disabled={!reviewNote.trim() || !!busy}><Check size={12} />确认问题</button><button className="btn small" onClick={() => void submitReview("false_positive")} disabled={!reviewNote.trim() || !!busy}>判为误报</button><button className="btn small" onClick={() => void submitReview("needs_evidence")} disabled={!reviewNote.trim() || !!busy}>要求补充证据</button><button className="btn small" onClick={() => void generate(selected.c, selected.run.candidateVersionId)} disabled={!!busy}><Sparkles size={12} />生成 AI 修订回答</button></div></div>
    </div></aside></>}
  </div>;
}

function Stat({ Icon, title, value, note, accent = false }: { Icon: typeof Gauge; title: string; value: string | number; note: string; accent?: boolean }) { return <div className="stat"><div className="stat-top"><span>{title}</span><span className={`stat-icon ${accent ? "accent" : ""}`}><Icon /></span></div><div className="stat-value">{value}</div><div className="stat-foot">{note}</div></div>; }
function Status({ status }: { status?: string }) { return <span className={`status ${status ?? "idle"}`}>{statusNames[status ?? "idle"] ?? "未评测"}</span>; }
function CaseTable({ cases, items, onOpen, selectable = false, checkedIds = [], onToggle, answerVersionId }: { cases: QualityCase[]; items: Map<string, { run: EvalRun; item: RunItem }>; onOpen: (c: QualityCase) => void; selectable?: boolean; checkedIds?: string[]; onToggle?: (caseId: string) => void; answerVersionId?: string }) { return <div className="table-wrap"><table className="case-table"><thead><tr>{selectable && <th style={{ width: 34 }}>选</th>}<th>问答</th><th>意图</th><th>质量状态</th><th>问题数</th><th></th></tr></thead><tbody>{cases.map((c) => { const result = items.get(c.caseId); const hasAnswer = !answerVersionId || !!c.answers[answerVersionId]?.text?.trim(); return <tr key={c.caseId} onClick={() => onOpen(c)}>{selectable && <td onClick={(e) => e.stopPropagation()}><input aria-label={`选择 ${c.caseId}`} title={hasAnswer ? `选择 ${c.caseId}` : "此版本尚无此案例的回答"} type="checkbox" disabled={!hasAnswer} checked={checkedIds.includes(c.caseId)} onChange={() => onToggle?.(c.caseId)} /></td>}<td><div className="case-id">{c.caseId}</div><span className="case-question">{displayText(c.question)}</span></td><td><span className="tag">{intentNames[c.intent]}</span></td><td><Status status={result?.item.overallStatus} /></td><td>{result?.item.findings.length ?? "—"}</td><td><ArrowRight size={13} color="#9ba6a6" /></td></tr>; })}</tbody></table>{cases.length === 0 && <div className="empty"><strong>没有匹配的案例</strong>调整筛选条件，或导入新的问答数据。</div>}</div>; }
function displayText(value: string) { return value.replaceAll("虚构基金", "基金").replaceAll("虚构公司", "公司").replaceAll("虚构产品", "产品").replaceAll("虚构情景", "示例情景").replaceAll("合成证据快照", "判断依据"); }
function Kyc({ label, value }: { label: string; value: string }) { return <div className="kyc"><small>{label}</small><b>{value}</b></div>; }
function riskLabel(value: "low" | "medium" | "high" | null) { return value === "low" ? "低" : value === "medium" ? "中" : value === "high" ? "高" : "未提供"; }
