# 接手说明：回来后先做什么

按以下次序推进，避免先录演示再发现主链路没有证据：

1. 查看当前源码与 Git 工作区，和负责人确认尚未落地的实现，不覆盖其他人的并行更改。
2. 对照 skills/*/rubric.json、docs/evaluation-rules.md 与 Worker 的 TypeScript rule IDs，修正差异；确认 state.skills 的名字和版本能反映真实执行逻辑。
3. 最小闭环已由本地操作和截图覆盖：预置案例 → 规则评测 → 证据/待核验展示 → 人工复核 → 确认后加入回归集 → A/B 配对比较。A/B 是预置合成回答的规则结果；若模型服务未配置，不冒称 AI 评测。
4. 若用户决定启用真实模型，请由有权管理员通过安全 secret 配置 MODEL_API_BASE、MODEL_API_KEY、MODEL_NAME；目前保持未配置，不把 mock 当 live。
5. 已有 31/31 Node 24 测试、typecheck、15/15 API smoke 和先前 build 记录。最新源码变更后的最终 build 仍待确认；部署后按 docs/test-plan.md 补部署、UI 和交付包证据，不将 mock 写成 live。
6. v1 已部署，URL 为 https://invest-agent-quality-lab.opalescentdisco1.chatgpt.site（deployment appgdep_6af20b1fed1c819197cb3a6fb487ded4，commit d715065cc4888500a03171de4946c74a2195e630，revision 1）。owner-only，浏览器出现 ChatGPT 登录门；请由用户登录后验证评审访问，不能称匿名公开。受限线上 smoke 7/8，iFinD 查询 502 排查中；见 artifacts/hosted-smoke-results.json。v2 judge/UI 补丁仍需完整验证。
7. iFinD 日期依据与 mismatch 证据只适用于指定证券、日期、不复权、人民币元单项；eventContext 是合成情景。反馈处理→确认→回归集和任务历史已有 API smoke 与浏览器截图。后续重点核对部署结果、模型配置（如用户提供）和最终提交材料证据。
8. 视频已生成：D:\Codex\outputs\同花顺笔试_第二题\02_产品操作截图演示.mp4，99 秒，真实操作截图整理、非连续录屏；先完成 ffmpeg 解码检查，再决定是否重录。核对 ZIP <=30 MB，无密钥、隐私数据和临时状态；最终材料按 D 盘偏好保存。

当前文档没有给出完成声明；每项仅在取得实际证据后标记完成。











