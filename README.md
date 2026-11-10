# 投资 Agent 回答质量与个性化治理平台

为投资 AI 产品、运营和复核人员提供可追溯的回答质检：导入问答、执行规则、核对证据、人工复核、修改回答、复测和版本比较。

## 运行与验证状态

网站：[投研回答质检台](https://invest-agent-quality-lab.opalescentdisco1.chatgpt.site)。当前线上为第 9 版，公开访问；部署代码提交 `e3656faf87e8532d86b8852a8460d6aa10211426`，部署状态 succeeded。当前“AI回答”会隐藏预置案例文本，允许按当前问题现场生成与复测；否定承诺句不会被简单关键词规则误判为收益保证。

- 第 9 版增量通过 TypeScript 检查、生产构建和线上单案例生成/复测。完整测试套件本轮没有重跑；此前版本的单元、接口、模型及浏览器验证记录见 `docs/test-results.md` 与 `artifacts/`，各结果以对应提交和记录范围为准。
- 线上数据库已实际保存评测、复核、行为反馈、回归快照和人工修订记录；历史运行按会话保留。
- 已接入 DeepSeek deepseek-flash；既有本地与线上案例完成真实生成、规则复测和语义 judge。仅为限定案例端到端验收，不代表模型整体质量。
- 本地 iFinD 实际查询成功；云端在线查询观察到HTTP522（应用返回502），原因尚未确定。线上可以主动选择已保存历史证据核验，界面明确显示原始查询时间，不会自动替换或冒充在线查询。

所有预置投资问答、画像、基金数据和事件上下文均为合成。iFinD历史证据是实际返回值，与合成案例分开。数值202.7元只对应300033.SZ、2026-11-06、不复权收盘价、人民币元，不能外推为其他日期或投资结论。

## 主链路

1. 在概览了解状态，在评测任务导入问答或执行规则评测。
2. 查看相关性、事实、时效、画像、合规与隐私线索及其原文和证据。
3. 填写复核原因，确认问题、判为误报或要求补充证据。
4. 处理用户反馈，将已确认案例加入去重回归集并导出。
5. 预置规则记录不会冒充现场 AI 回答；详情内可按当前问题调用已配置模型生成回答并自动复测，也可人工修订后复测；历史运行保留。
6. 在人工复核中查看判断依据和匿名用户行为反馈；行为线索不直接决定回答正确与否。

## 目录

```text
app/                         页面入口与 /api/quality、/api/tools/*
components/quality/          工作台、证据抽屉、人工修订表单
lib/quality/                 类型、合成案例、规则评测、Skill配置
lib/integrations/            iFinD HTTP MCP、限定数字核验、模型judge
skills/*/                   SKILL.md、rubric.json、examples.json
data/demo/                   合成导入模板
data/snapshots/              实际iFinD历史返回（非本次在线查询）
db/、drizzle/                D1表结构与不可重复执行的建表迁移
tests/、scripts/             测试、启动、配置与密钥检查
docs/                        方案、字段、规则、边界、AI记录与验收说明
artifacts/                   脱敏验证记录与实际操作截图
```

## 本地启动

使用Node.js24与npm。在本项目目录执行：

```powershell
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_mighty_sabretooth.sql
.\scripts\dev-local.ps1
```

迁移只对全新的本地D1执行一次，已创建quality_sessions后不要重复建表。现有项目依赖和本地数据库均已就绪，可直接执行启动脚本。默认地址http://127.0.0.1:5173。首次运行若npm未在PATH中，本机启动脚本会复用D盘npm入口。

```powershell
npm test
npm run typecheck
npm run test:api
```

接口测试需要本地服务正在运行；会创建独立测试会话。npm start用于已构建Worker的本地预览。源码仓库不得包含node_modules、.dev.vars、运行数据库或真实密钥。

## AI与Skills

采用固定流程，不要求自主规划Agent。五项确定性检查由TypeScript执行，并静态载入rubric.json规则编号；SKILL.md与examples.json供审阅和后续模型扩展。意图使用案例字段，case-diagnosis是规范资产。AI judge加载七项rubric，检查结构、原文引用与证据ID；结果是独立的待人工确认建议，不覆盖规则指标。

服务端可配置MODEL_API_BASE、MODEL_API_KEY、MODEL_NAME，调用兼容/chat/completions接口。用户输入不能指定服务地址。密钥放本地被忽略的.dev.vars或Sites秘密配置；不要通过聊天、浏览器字段、源码传递密钥。模型未配置时界面如实显示。

## 数据工具与边界

iFinD凭证为IFIND_MCP_TOKEN。可用scripts/configure-ifind-local.cjs从已有且获准使用的配置写入本地.dev.vars。在线请求和历史证据模式分开操作；历史模式仅支持上述固定证券/日期/字段，保留retrievedAt和servedAt。返回行日期优先，无行日期时要求明确参数日期；日期冲突、缺失和含混均待核验。

画像可以改变解释深度与适配性判断，不能改变相同主体、期间、单位和时点的事实。FRESHNESS检查区分事件发生、公开和回答生成时间。规则只提供风险线索，不构成金融或法律合规认证。

一次评测最多20条、导入最多50条、会话运行最多20次、状态上限1.5MB。分母为零显示不适用；指标只覆盖配置证据和已识别主张，不代表所有事实。详见docs/known-limitations.md。

## 源码仓库

GitHub：<https://github.com/dylancai0613-beep/ths-invest-agent-quality-governance>。仓库目前为私有；需要评审直接浏览仓库时，应先授予评审账号访问权限，或由项目所有者决定是否公开。交付目录另含不带密钥的源码 ZIP。

## 交付材料

D盘交付目录：`D:\Codex\outputs\同花顺笔试_第二题`。包含源码归档、方案、AI记录、测试报告、133 秒操作截图演示视频和必要证据。视频有中文说明、无配音，明确为实际操作截图整理，非连续录屏。提交包小于 30MB；不自动提交招聘网站。

## 界面迭代

深色主题和简化布局的范围见 docs/ui-simplification.md。概览保留；导入、导出和规则评测操作集中在评测任务。版本比较专页和手工意见反馈入口移除，底层历史仍保留。工具与Skills的功能结构本轮保持，后续另行讨论。
