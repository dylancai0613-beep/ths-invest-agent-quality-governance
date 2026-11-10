# 测试与验证记录

更新日期：2026-11-10（Asia/Shanghai）。本地功能已通过单元/协议测试、API smoke 和手工浏览器走查。v1 已部署，但站点为 owner-only 且浏览器要求登录；线上受限 smoke 为 7/8，iFinD 查询 502 正在排查。请注意下列通过结果所对应的代码版本。

| 项目 | 实际结果 | 证据或边界 |
|---|---|---|
| 单元与协议测试 | 31/31 通过 | `artifacts/unit-test-results.json`；Node 24。覆盖 iFinD 日期来源、未来事件上下文、事实口径、画像不变、承诺表达、模型 judge mock 与脱敏等。无 live model 调用。 |
| TypeScript 类型检查 | 通过 | 负责人确认 `npm run typecheck` 通过。 |
| 生产构建与 secret scan | 已通过 | Source helper 对推送版本 `d715065cc4888500a03171de4946c74a2195e630` 完成 test → typecheck → production build → secret scan。之后又有 judge/UI 补丁，v2 仍需再次运行完整流程。 |
| D1 本地迁移 | 已执行成功 | 使用 `drizzle/0000_mighty_sabretooth.sql`。受限线上 smoke 已验证案例加载和 A/B 评测保存；不等于用户登录后的独立验收。 |
| API smoke | 15/15 通过 | `artifacts/api-smoke-results.json`；target `http://127.0.0.1:5173`；时间 2026-11-09T18:01:07.851Z（北京时间 2026-11-10 02:01:07）。含反馈处理、确认后去重加入回归集、未确认拦截和历史快照。 |
| 浏览器操作走查 | 已完成并留图 | `artifacts/screenshots/01-overview.jpg` 至 `10-mobile.jpg`：概览、评测、回答证据、人工复核、确认后回归集、版本比较、iFinD 核验、超时、事件时点、移动端。 |
| A/B 合成演示结果 | 同一 20 条案例中 A 有 13 条规则失败，B 有 0 条 | 见 `06-comparison.jpg`。这些是预置合成候选答案与确定性规则的结果，不是模型性能提升，也不是现场 AI 评测。 |
| 事实核验指标单测 | 配置 claim 4/4 核验，1/4 匹配 | 明确的单位/期间/数值错误记为核验后不匹配；缺失/歧义保持 unverified。分母只包括配置 evidence claims 与被规则识别的无证据行情主张，不代表通用事实抽取。 |
| iFinD 查询与数值对照 | 300033.SZ，2026-11-06，不复权收盘价 202.7 元；210 元输入得到 MISMATCH | `artifacts/ifind-local-result.json`、`artifacts/ifind-verification-result.json`。仅覆盖该证券、日期、字段、复权方式及人民币元单位，不等于全部回答事实已核验。 |
| 模型 live 调用 | 未执行 | 管理员模型配置未提供。模型协议/语义评测测试均使用 mock。 |
| v1 部署与受限线上 smoke | 部署 succeeded；7/8 通过 | `https://invest-agent-quality-lab.opalescentdisco1.chatgpt.site`；deployment `appgdep_6af20b1fed1c819197cb3a6fb487ded4`，commit `d715065cc4888500a03171de4946c74a2195e630`，env revision 1。见 `artifacts/hosted-smoke-results.json`。站点 owner-only，浏览器有 ChatGPT 登录门；未验证用户登录后的评审访问。iFinD 实际查询 502，排查中。 |
| 演示视频 | 已生成，待解码验证 | `D:\Codex\outputs\同花顺笔试_第二题\02_产品操作截图演示.mp4`，99 秒；由真实操作截图整理，非连续录屏。ffmpeg 解码检查待完成。 |
| 最终交付包 | pending | 生成 ZIP 后确认不超过 30 MB。 |
| lint | 未运行 | 不声称 lint 通过。 |

需补证：judge/UI 补丁后的 v2 完整验证链；用户登录后的评审访问；线上 iFinD 502 的原因与修复验证。模型配置与最终 ZIP 仍待提供/完成。





