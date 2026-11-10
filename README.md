# 投资 Agent 回答质量与个性化治理平台

为投资 AI 产品、运营和复核人员提供可追溯的回答质检：导入问答、执行规则、核对证据、人工复核、修改回答、复测和版本比较。

## 运行与验证状态

网站：[投研回答质检台](https://invest-agent-quality-lab.opalescentdisco1.chatgpt.site)。站点已设为public（权限修订2）；匿名首页和/api/quality均返回200，浏览器免登录打开工作台，匿名真实模型主链路4/4通过。此前登录门在权限传播后消失。 当前模型功能验证基准为提交 `2e7dd10f00bff7ea695ded0a8a60d32902c8b9ad`（版本4），环境修订2。

- 34 项单元与协议测试通过；17 项本地接口检查通过；9 项拥有者服务访问下的线上核心检查通过。
- 生产构建、TypeScript 检查和密钥扫描通过。线上数据库已实际保存评测、复核、反馈、回归快照与人工修订结果。
- 浏览器实际完成“6.4%错误回答→人工改为2.4%→独立版本保存→复测通过→对照历史失败结果”。截图见 artifacts/screenshots/11 至14。
- 已接入 DeepSeek deepseek-flash；本地与线上均完成真实生成、独立版本保存、规则复测和语义judge，各4/4检查通过。证据见 artifacts/model-local-results.json 与 model-hosted-results.json；仅为限定案例端到端验收，不代表模型整体质量。
- 本地 iFinD 实际查询成功；云端在线查询观察到HTTP522（应用返回502），原因尚未确定。线上可以主动选择已保存历史证据核验，界面明确显示原始查询时间，不会自动替换或冒充在线查询。

所有预置投资问答、画像、基金数据和事件上下文均为合成。iFinD历史证据是实际返回值，与合成案例分开。数值202.7元只对应300033.SZ、2026-11-06、不复权收盘价、人民币元，不能外推为其他日期或投资结论。

## 主链路

1. 选择预置问答或导入匿名合成JSON，选择回答版本并评测。
2. 查看相关性、事实、时效、画像、合规与隐私线索及其原文和证据。
3. 填写复核原因，确认问题、判为误报或要求补充证据。
4. 处理用户反馈，将已确认案例加入去重回归集并导出。
5. 在详情内人工修订回答并复测，或配置模型后调用生成工具。原始版本与历史运行保留。
6. 在相同案例上比较两个已保存运行，单列未覆盖案例；待核验不算修复。

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

Sites私有Git： https://git.chatgpt-team.site/e8eae08c-0630-4fdc-b427-d5e3e4721d81/appgprj_6af1b8ba9528819190bced0d8e8c39b6.git 。访问需要拥有者授权；交付目录另含不带密钥的完整源码ZIP。

## 交付材料

D盘交付目录：D:\Codex\outputs\同花顺笔试_第二题。包含源码归档、方案、AI记录、测试报告、133秒操作截图演示视频和必要证据。视频有中文说明、无配音，明确为实际操作截图整理，非连续录屏。提交包需小于30MB；不自动提交招聘网站。
