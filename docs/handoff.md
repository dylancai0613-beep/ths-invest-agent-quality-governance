# 接手说明：回来后先做什么

按以下次序推进，避免先录演示再发现主链路没有证据：

1. 查看当前源码与 Git 工作区，和负责人确认尚未落地的实现，不覆盖其他人的并行更改。
2. 对照 skills/*/rubric.json、docs/evaluation-rules.md 与 Worker 的 TypeScript rule IDs，修正差异；确认 state.skills 的名字和版本能反映真实执行逻辑。
3. 完成并启动一条真实可操作的最小闭环：预置案例 → 规则评测 → 证据/待核验展示 → 人工复核持久化 → A/B 配对比较。若模型服务没配置，用规则演示并明确标识，不冒称 AI 评测。
4. 若用户决定启用真实模型，请由有权管理员通过安全 secret 配置 MODEL_API_BASE、MODEL_API_KEY、MODEL_NAME；目前保持未配置，不把 mock 当 live。
5. 已有 29/29 Node 24 测试、typecheck、15/15 API smoke 和先前 build 记录。最新源码变更后的最终 build 仍待确认；部署后按 docs/test-plan.md 补部署、UI 和交付包证据，不将 mock 写成 live。
6. 先前本地 build 与 D1 建表迁移已由负责人确认；最新代码需最终 build。接下来需获得 Sites 发布权限，发布后保存脱敏截图、时间、公开 URL 和新会话访问证据。若评审站需登录，用户还需提供评审账号/授权方式。
7. 复核 iFinD 日期依据与 mismatch 证据，确认其只用于指定证券、日期、不复权、人民币元单项。行情事件 eventContext 目前是合成样例，勿当成真实新闻展示。补完反馈处理→确认→回归集、任务历史的操作证据；检查模型和数据权限。
8. 录制 docs/demo-script.md 对应的 120 秒视频；核对 ZIP <=30 MB，无密钥、隐私数据和临时状态；将最终材料按 D 盘偏好保存。

当前文档没有给出完成声明；每项仅在取得实际证据后标记完成。





