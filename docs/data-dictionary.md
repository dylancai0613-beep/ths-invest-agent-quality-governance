# 数据字典

字段名以 lib/quality/types.ts 与 app/api/quality/route.ts 为当前代码契约；HTTP JSON 使用 camelCase。data/demo/import-template/cases.json 是可直接发送到 /api/quality 的示例请求（action=import、dataset.cases）。

| 对象 | 字段 | 含义 |
|---|---|---|
| QualityCase | caseId, question, intent, askedAt | 稳定案例标识、问题、五类意图和带时区提问时间 |
| KycProfile | profileId, experience, riskTolerance, horizonMonths, liquidityNeed, purpose | 匿名最小画像；未知值为 null，不推断 |
| EvidenceSnapshot | id, claim, value, unit, period, effectiveAt, publishedAt, source, synthetic | 证据快照；演示要求 synthetic=true，不代表真实行情 |
| EventContext | id, title, occurredAt, publishedAt, source, summary, synthetic, referencePhrases | 可选结构化热点上下文，最多 3 条；当前样例均为合成事件，不是真实新闻 |
| Answer | text, generatedAt, provenance | 回答、生成时间及 preset/generated 来源 |
| CandidateVersion | id, name, model, promptVersion, dataSnapshot, description | 候选回答版本元信息 |
| EvalVersion | id, name, skillVersion, rules | 评测版本和规则编号 |
| Finding | id, ruleId, dimension, severity, status, quote, reason, evidenceIds, reviewRequired | 一条问题或无法核验结果；不得将缺证据记成通过 |
| RunItem | overallStatus, findings, reviewStatus, factNumerator/Denominator, verifiedNumerator/Denominator | 单样本结果与分子分母 |
| Review | runId, caseId, decision, note, createdAt | 人工复核：confirmed / false_positive / needs_evidence |
| Feedback（旧接口兼容，界面不再收集手工意见） | id, caseId, kind, note, status, source, resolutionNote, resolvedAt, resolvedRunId | 状态 pending_review / confirmed / dismissed / needs_evidence；已确认反馈可链接到对应人工复核 |
| RegressionCase | id, runId, caseId, addedAt, candidateVersionId, evaluationVersionId, caseSnapshot, answerText, findings | 从已人工确认的问题运行中保存的回归快照 |
| ToolStatus | id, name, status, description | 工具状态；snapshot / simulated_timeout / configured / not_configured |
| SkillInfo | id, name, version, status, rules, description | status 为 executed 或 spec_only；前者表示规则代码实际挂载，后者仅有规范 |

## 状态与单位约定

意图：fact_query、knowledge、market_event、comparison、suitability。overallStatus：pass、fail、needs_review、pending_verification。finding status：fail 或 unverified。事件时效使用生成时间与 eventContext.publishedAt 比较，只有回答引用 referencePhrases 中的短语才触发未来信息线索。时间使用 ISO 8601 带时区格式；金融数值保留原单位、期间和有效时点。来源冲突或接口缺失时保留未核验，不要把它折算为准确率通过。

## 导入注意

导入端点要求 POST /api/quality，JSON 顶层包含 action: import 和 dataset.cases 数组；最多 50 条，caseId 不可重复。模板只示范 1 条，所有样例均为合成数据。校验失败时应收到结构化错误。



## iFinD 查询响应

/api/tools/ifind 返回的 retrieved 状态表示受控工具返回行情文本。页面可把用户输入的待核数值与返回价作一次限定比较；比较结果是独立记录，不会自动改写任意 evaluation run。证券 300033.SZ、日期 2026-11-06、不复权收盘价、人民币元的演示证据在 artifacts/ifind-local-result.json 与 artifacts/ifind-verification-result.json。返回行日期明确且匹配目标时可用；行日期与显式参数冲突时待核验。没有行日期时必须有匹配目标日的显式参数，“最新”或缺失时待核验。





## 匿名工作台行为

QualityState.behaviorEvents记录最近100条实际操作：id、caseId、type、createdAt。type为answer_view、evidence_view、answer_copy、regenerate、reevaluate。前三项来自对应界面动作，后两项由成功的服务端生成或复测记录。旧会话无字段时按空数组加载；不采集账号、设备指纹、页面外历史或额外自由文本。记录本演示工作台行为，不冒充生产投资用户反馈；行为不修改规则判断。
