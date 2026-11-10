# 架构与执行路径

React/Vinext前端由Cloudflare Worker提供页面与API，Drizzle访问D1的quality_sessions表，以HttpOnly会话Cookie分隔演示记录。Schema-only迁移在部署时应用，本地新数据库只执行一次。会话JSON适合单人演示，不宣称支持复杂多用户并发审计。

固定工作流：导入与校验→依据意图加载规则→核对配置事实与事件时点→保存finding/证据/运行快照→人工复核→反馈处理→已确认回归集→修订回答并复测→配对比较。revise创建新的manual来源版本，generate只有服务端模型配置后才调用模型。历史运行保留原回答和案例快照。

skills/*/rubric.json静态载入有效规则编号；五项检查有确定性实现，意图来自输入标签，case-diagnosis是规范资产。AI judge是独立的辅助建议路径，校验结构、quote和证据ID；可看到事后材料但必须按answeredAt判断当时可知性。generate仅接收请求时已公开的事件。

/api/tools/ifind有online与historical_snapshot两种显式模式。后者使用data/snapshots中的实际保存返回，原始retrievedAt与本次servedAt分开；不自动降级。证券、日期、复权、数值口径无法明确匹配则不下结论。公开的原始价格样例是固定历史事实，不代表实时行情。云端在线观察到上游HTTP522，本地查询成功；不预设根因。

当前已部署，35项单元/协议、19项本地接口检查通过；历史线上核心9/9，新增线上真实模型4/4。站点已设为public（权限修订2）；匿名首页和/api/quality均返回200，浏览器免登录打开工作台，匿名真实模型主链路4/4通过。此前登录门在权限传播后消失。
