# 评测规则与 Skill 映射

rubric.json 被 TypeScript 静态导入并随 Worker bundle 打包。当前 executed Skills：relevance-check、fact-extract、freshness-check、personalization-check、compliance-check。它们由确定性 TypeScript 代码执行，并受 active rule IDs 限制。`intent-router` 依赖输入案例里预设的 intent，不做识别；`case-diagnosis` 当前 `spec_only`，不会执行归因。

| Skill | 规则 ID | 当前执行状态 | 边界 |
|---|---|---|---|
| intent-router | INTENT-001 | spec_only | 使用导入案例已给定的 intent 字段，不识别或覆盖意图 |
| relevance-check | RELEVANCE-001 | executed | 确定性词项检查；未找到主题词会给 unverified，不是语义完整性证明 |
| fact-extract | FACT-001 | executed | 针对有对应主体和单位/期间的合成证据检查，不覆盖所有自由文本事实 |
| freshness-check | FRESHNESS-001 | executed | 证据快照关联到回答且公开时间晚于 generatedAt；结构化 eventContext 仅当答案命中 referencePhrases 且公开时间晚于 generatedAt 时触发。当前事件样例均为合成情景。
| personalization-check | PERSONALIZATION-001 | executed | 对画像缺失或有限短期/流动性约束做确定性检查，不是投资建议 |
| compliance-check | COMPLIANCE-001、PRIVACY-001 | executed | 规则线索触发复核；未命中不能证明法律合规 |
| case-diagnosis | DIAGNOSIS-001 | spec_only | 没有运行自动归因 |

AI 模型 judge 是独立辅助复核：必须先配置服务端模型，不替换规则 findings，输出由人工确认。当前只有 mock 协议/脱敏/证据拒绝测试，无 live 模型评测结论。

收益保证规则对“并不存在保本或稳赚的承诺”这类明确否定做有限的分句范围判断，避免把否定句误判为承诺；涉及转折、双重否定等复杂表达时仍需人工复核。

## 指标口径

- 事实准确率仅对已成功核验的证据事实计算：匹配数 / 已核验数；未核验另报。
- 核验覆盖率 = 已成功核验数 / evidence 中待核验数。无分母时显示不适用。
- 严重问题率 = 至少一个严重 finding 的有效回答 / 有效评测回答。
- 比例显示分子与分母；A/B 指标只对配对 caseId 计算，缺失样本单列。

合成小样本和规则启发式不能支撑全局准确率、模型排名或法律结论。


