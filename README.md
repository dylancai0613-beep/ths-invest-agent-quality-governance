# 投资 Agent 回答质量与个性化治理平台

面向投资 AI 产品团队的回答质检工作台：对预置问答执行确定性规则，展示证据与待核验项，记录人工复核，并比较回答版本。所有预置案例和快照为合成数据，不代表真实证券或产品。

## 当前状态（2026-11-10）

- Sites Vinext + React/TypeScript、Cloudflare Worker + D1 架构已完成本地构建并由负责人确认；D1 本地迁移已执行。之后代码仍有更新，最终提交版本需再做一次 build 并留证。
- `npm test`：Node 24 环境下 29 条测试通过；`npm run typecheck` 通过。`npm run test:api` 的本地 API 冒烟记录见 `artifacts/api-smoke-results.json`，15/15 通过，目标为 `http://127.0.0.1:5173`。
- 本地初步浏览器主流程已走过；`artifacts/screenshots/overview.jpg` 留存概览截图，但尚无每个交互步骤的逐屏证据。
- iFinD MCP 有真实查询记录，限于允许列表证券、指定交易日、不复权收盘价、人民币元。`artifacts/ifind-local-result.json` 记录 300033.SZ 在 2026-11-06 的 202.7 元；`artifacts/ifind-verification-result.json` 将用户提供的 210 元与 202.7 元比较，给出 MISMATCH。该结果仅证明这一条限定数值主张，不代表实时推送或普遍事实核验能力。该查询的验证口径以返回行内明确日期为优先；若行内日期与显式参数冲突则待核验。无行日期时参数必须明确匹配目标日，“最新”或缺失时待核验。
- 模型服务尚未配置。仅有 mock 协议、脱敏和证据拒绝相关测试；没有 live model 调用，不能称已完成实际模型评测或生成。
- 网站尚未部署，没有可提供的公开评审 URL。反馈处理、确认后加入回归集（含重复登记拦截）和历史运行快照已有 API smoke 验收；完整 UI 操作仍需保存逐步截图。

事实准确率只对已明确核验的配置 evidence claim 计算：单位/期间明确不匹配属于已核验但不匹配；缺少期间或证据歧义属于未核验。核验覆盖率以配置的 evidence claim 数为分母，并不表示系统已覆盖所有回答事实或完成通用主张抽取。详细记录见 `docs/test-results.md` 和 `docs/known-limitations.md`。

## 技术结构与 Skills

- Sites Vinext + React + TypeScript；Cloudflare Worker 提供 API；D1 保存会话快照。
- Skills 的 `rubric.json` 静态打包，决定有效 rule IDs；其中 relevance、fact、freshness、personalization、compliance 有确定性代码实现。行情事件样例用结构化 `eventContext` 记录发生/公开时间、来源和可引用短语，当前种子里的事件全部是合成情景，不是真实新闻。`intent-router` 使用输入案例的既定意图，不做模型意图识别；`case-diagnosis` 是规范资产，当前不执行自动归因。`SKILL.md` 与 `examples.json` 是规范说明和样例。
- 当前模型配置为空。只由管理员在服务端配置 `MODEL_API_BASE`、`MODEL_API_KEY` 和 `MODEL_NAME`，通过 OpenAI 兼容 `/chat/completions` 调用；用户不能传入任意地址。
- iFinD 行情查询经 `POST /api/tools/ifind`。若回答中给出待核数值，界面可将其与工具返回值作限定比较；核验依据须逐项检查证券代码、查询日（优先看返回数据行的日期；若行内无日期，则要求工具参数明确指定查询日）、不复权方式、人民币元单位和来源。若行内明确日期与目标日期一致，可依据行日期；行内日期与显式查询参数互相冲突时待核验。若行内没有日期，则必须有与目标日一致的显式参数；参数为“最新”且无行内日期时待核验。查询成功不等于其他事实已核验。

## 本地启动（PowerShell）

Node.js 建议使用 24（最低要求见 package.json）。在项目目录执行：

```powershell
npm run install:ci
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --file drizzle/0000_mighty_sabretooth.sql
.\scripts\dev-local.ps1
```

D1 SQL 迁移对每个新的本地 D1 状态执行一次；已创建 `quality_sessions` 表后不要重复执行同一建表 SQL。开发脚本默认启动 5173 端口，可用 `-Port 5174` 指定端口。首次安装请不要和其他依赖安装任务并行运行。

项目验证命令：

```powershell
npm test
npm run test:api
npm run typecheck
```

`npm run test:api` 需要本地站点在 5173 端口可访问；通过后生成或更新 `artifacts/api-smoke-results.json`。构建预览可在 build 后执行 `npm start`。

## 本地 iFinD 配置

若已拥有并获准使用 iFinD MCP 配置，可在本机运行：

```powershell
node scripts/configure-ifind-local.cjs <mcp_config.json的绝对路径>
```

脚本只把凭证写入 git 忽略的 `.dev.vars`，不会打印凭证。不要把 `.dev.vars`、模型密钥或真实用户数据提交到仓库。此脚本不等于部署端已配置 iFinD。

## 文档与交付

- 方案和实际状态：`docs/product-plan.md`
- 架构、字段与规则：`docs/architecture.md`、`docs/data-dictionary.md`、`docs/evaluation-rules.md`
- 测试计划与实际记录：`docs/test-plan.md`、`docs/test-results.md`
- AI 协作记录、限制和交接顺序：`docs/ai-usage-and-validation.md`、`docs/known-limitations.md`、`docs/handoff.md`
- Skill 规范：`skills/`
- 可直接提交的导入请求样例：`data/demo/import-template/cases.json`

单次同步评测最多 20 条、导入最多 50 条、单会话运行历史最多 20 条；会话数据大小上限为 1.5 MB。最终提交 ZIP 需不超过 30 MB。交付文件优先放在 `D:\Codex\outputs`，临时文件放在 `D:\Codex\work`。部署和评审仍需用户提供或授予 Sites 发布/访问权限；如要启用模型语义辅助复核，需由有权管理员配置模型服务地址、密钥和模型名。不要在聊天中发送密钥。




