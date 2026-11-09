# 架构说明

## 当前实现边界

应用使用 Sites Vinext、React、TypeScript 和 Cloudflare Worker。D1 通过 Drizzle 保存 `quality_sessions` 中的会话 JSON 快照。仓库的本地 D1 建表 SQL 为 `drizzle/0000_mighty_sabretooth.sql`。先前本地 build 和迁移已由负责人确认成功；代码随后有更新，最终提交版本需重跑 build；尚未发布到 Sites。

## Skills 与执行状态

七个 Skill 目录都有版本化 rubric。`lib/quality/rubrics.ts` 静态导入 JSON 并随 bundle 打包，但只有已实现的规则 IDs 会进入 active findings：relevance、fact、freshness、personalization、compliance。意图来自案例中已给定的字段，尚无运行时意图识别；case-diagnosis 仅为规范资产，不执行自动归因。AI 辅助复核是独立路径，模型没有配置前不运行。

## 时点上下文

QualityCase 可携带最多 3 条 eventContext，记录发生时间、公开时间、来源、摘要和允许匹配的 referencePhrases。当前预置行情事件全部是合成情景，不是真实新闻。确定性规则只有在答案命中参考短语且公开时间晚于回答生成时间时才标未来信息。

## 数据工具

- `snapshot-verifier`：只核对虚构合成证据快照。
- `timeout-probe`：展示模拟超时降级。
- `/api/tools/ifind`：经 iFinD MCP 查询允许列表内的证券、指定交易日收盘价。已留存 300033.SZ、2026-11-06、不复权、人民币元 202.7 元查询结果，以及和 210 元输入值比较为 MISMATCH 的案例。比对依赖证券、日期、复权方式、单位与来源；证据日期优先读取数据行内日期：须与目标日相符；如果响应参数是“最新”，但行内日期明确，则以行内日期为准。若行内日期与显式查询参数冲突，待核验。没有行内日期时，参数必须明确等于目标日；“最新”且无行内日期时待核验。一次历史行情核对不覆盖其他证券或事实，也不是实时推送。
- `/api/tools/judge`：服务端模型语义辅助复核；只使用服务端管理员配置，不修改确定性评测结果。当前模型未配置，已验证的协议/脱敏相关测试使用 mock，不是 live 调用。

## 请求与存储

`POST /api/quality` 处理导入、规则评测、复核、反馈、反馈处理、回归案例登记和导出。会话状态由 D1 保存并通过 HttpOnly `quality_session` cookie 分隔。本地 API 冒烟 15/15 通过，覆盖反馈处理、确认后加入去重回归集及历史 evidence snapshot；`artifacts/screenshots/overview.jpg` 留存概览图，但完整 UI 逐步流程尚无截图证据。

## 发布待办

Sites 尚未部署，因此没有公开评审 URL。部署后需验证 D1 binding/迁移、公开访问限制、iFinD 与模型是否配置、反馈/回归流程、新会话读取和交付材料。不要把本地 D1/外部账户权限推断为公网部署能力。





