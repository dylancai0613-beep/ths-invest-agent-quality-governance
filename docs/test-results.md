# 测试与验证记录

更新日期：2026-11-10（Asia/Shanghai）。以下按仓库 artifacts 与负责人提供的执行记录整理；公开部署尚未完成。

| 项目 | 实际结果 | 证据或边界 |
|---|---|---|
| 单元与协议测试 | 29/29 通过 | `artifacts/unit-test-results.json`；Node 24 执行 `node scripts/test.mjs`。包含五组画像不变性、数值/单位/期间核验、证据主体关联、多个期间、回答/事件公开时点、iFinD 日期依据、AI judge mock 协议、脱敏和证据引用验证。没有 live model 调用。 |
| TypeScript 类型检查 | 通过 | 负责人报告执行 `npm run typecheck`；未保存独立控制台日志。 |
| Sites/Vinext 构建 | 先前本地构建通过；最终代码构建 pending | 负责人报告先前 build 成功；后续代码继续更新，需最终 build 再确认，当前无独立日志文件。 |
| D1 本地迁移 | 已成功执行 | 负责人确认将 `drizzle/0000_mighty_sabretooth.sql` 应用到本地 D1。完整服务重启后的持久性需以环境实际验证为准。 |
| 本地 API 冒烟 | 15/15 通过 | `artifacts/api-smoke-results.json`；target `http://127.0.0.1:5173`；记录时间 2026-11-09T17:53:50.620Z（北京时间 2026-11-10 01:53:50）。覆盖反馈处理、确认后加入去重回归集、未确认拦截、历史证据快照等。 |
| 事实核验指标单测 | 4/4 配置 evidence claims 覆盖，1/4 数值/单位/期间完全匹配 | `artifacts/unit-test-results.json` 的 quality 测试验证分子/分母。单位或期间明确错误算已核验不匹配；缺期间/证据歧义为 unverified。此分母仅是配置 evidence claims（及被识别的无证据行情主张），不代表自动抽取了答案中全部金融事实。 |
| iFinD 查询 | 返回 300033.SZ 在 2026-11-06 的不复权收盘价 202.7 元 | `artifacts/ifind-local-result.json`；2026-11-09T12:22:14Z。历史数据。 |
| iFinD 人工数值对照 | 输入 210 元 vs 返回 202.7 元：MISMATCH | `artifacts/ifind-verification-result.json`；2026-11-09T12:28:57Z。原始响应行包含日期 `20261106`，参数是“最新”；当前日期口径优先依据行日期。仅覆盖该单一证券、日期、不复权、人民币元收盘价。测试已覆盖日期行优先、显式日期冲突拒绝；无日期行且参数为“最新”不得核验。 |
| 浏览器走查 | 本地初步主流程已走查 | `artifacts/screenshots/overview.jpg` 保存概览截图；没有覆盖全部交互步骤的逐屏证据。 |
| 模型 live 调用 | 未执行 | 模型 API 未配置。mock 协议测试不证明真实模型评测或生成。 |
| 部署与新会话评审访问 | pending | Sites 尚未部署，没有公开 URL；需发布访问权限及部署后验证。 |
| 最终交付包大小 | pending | 需生成 ZIP 并确认 ≤30 MB。 |
| lint | 未运行 | 不声称 lint 通过。 |

本地启动、迁移和命令见 README。未获得的公网、live model 和最终打包证据保持 pending，等待负责人提供部署结果后再更新。


