/** iFinD HTTP MCP adapter. The credential is server-only and never returned. */
export interface IfindConfig { IFIND_MCP_TOKEN?: string }
export interface IfindQuery { symbol: string; date: string; field: "close" }
const ENDPOINT = "https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp";
const SYMBOLS: Record<string, string> = { "300033.SZ": "同花顺", "300059.SZ": "东方财富", "600519.SH": "贵州茅台" };
export const supportedQueries = [{ symbol: "300033.SZ", date: "2026-11-06", field: "close" as const }];
export function isIfindConfigured(config: IfindConfig) { return Boolean(config.IFIND_MCP_TOKEN?.trim()); }

/** Compare the decimal values users see, without a floating-point threshold flip. */
export function closePriceMatches(claimed: number, reference: number): boolean {
  if (!Number.isFinite(claimed) || !Number.isFinite(reference) || claimed < 0 || reference < 0) return false;
  const ratio = (value: number): [bigint, bigint] => {
    const [mantissa, exponentText = "0"] = String(value).toLowerCase().split("e");
    const [whole, fraction = ""] = mantissa.split(".");
    const exponent = Number(exponentText) - fraction.length;
    const integer = BigInt(whole + fraction);
    return exponent >= 0 ? [integer * BigInt(10) ** BigInt(exponent), BigInt(1)] : [integer, BigInt(10) ** BigInt(-exponent)];
  };
  const [a, aScale] = ratio(claimed), [b, bScale] = ratio(reference);
  const delta = a * bScale - b * aScale;
  return (delta < BigInt(0) ? -delta : delta) * BigInt(200) < aScale * bScale;
}

function parseRpc(body: string): Record<string, any> {
  try { return JSON.parse(body); } catch { /* MCP may return server-sent events. */ }
  for (const line of body.split(/\r?\n/).filter(l => l.startsWith("data:")).reverse()) {
    try { const data = JSON.parse(line.slice(5).trim()); if (data.result || data.error) return data; } catch { /* ignore heartbeat */ }
  }
  throw new Error("数据服务返回了无法解析的响应");
}

export async function queryIfind(config: IfindConfig, input: IfindQuery, transport: typeof fetch = fetch) {
  if (!isIfindConfigured(config)) return { status: "not_configured" as const, source: "iFinD MCP", notice: "服务端尚未配置 IFIND_MCP_TOKEN；未发起外部查询。" };
  if (!SYMBOLS[input.symbol] || input.field !== "close" || !/^20\d{2}-\d{2}-\d{2}$/.test(input.date)) throw new Error("只支持允许列表内证券的指定日期收盘价查询");
  const date = new Date(`${input.date}T00:00:00+08:00`);
  if (!Number.isFinite(date.getTime()) || new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(date) !== input.date || input.date > new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date())) throw new Error("查询日期无效或尚未到来");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let session: string | null = null;
  async function rpc(method: string, params: unknown, id?: number) {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: config.IFIND_MCP_TOKEN! };
    if (session) headers["Mcp-Session-Id"] = session;
    const response = await transport(ENDPOINT, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, params }), signal: controller.signal });
    if (!response.ok) throw new Error(`iFinD 数据服务异常（HTTP ${response.status}）`);
    const returnedSession = response.headers.get("mcp-session-id");
    if (returnedSession) session = returnedSession;
    const body = await response.text();
    if (!body.trim()) return {};
    const result = parseRpc(body);
    if (result.error) throw new Error("iFinD 工具调用失败，请检查权限或稍后重试");
    return result;
  }
  try {
    await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "investment-quality-lab", version: "1.0.0" } }, 1);
    if (!session) throw new Error("iFinD 未返回会话标识");
    await rpc("notifications/initialized", {});
    const tools = await rpc("tools/list", {}, 2);
    if (!tools.result?.tools?.some((t: { name: string }) => t.name === "get_stock_performance")) throw new Error("当前账户没有所需股票行情工具权限");
    const query = `${SYMBOLS[input.symbol]}（${input.symbol}）${input.date}的不复权收盘价，单位人民币元，仅查询该交易日`;
    const response = await rpc("tools/call", { name: "get_stock_performance", arguments: { query } }, 3);
    if (response.result?.isError) throw new Error("数据工具报告查询失败");
    const content = (response.result?.content ?? []).filter((c: any) => c.type === "text" && typeof c.text === "string").map((c: any) => ({ type: "text", text: c.text.slice(0, 18000) }));
    if (!content.length) throw new Error("数据服务没有返回可展示的数据");
    // A successful HTTP/MCP transport does not imply business-level success.
    for (const item of content) {
      try { const data = JSON.parse(item.text); if (data.code !== undefined && data.code !== 1) throw new Error("数据服务返回业务错误"); } catch (e) { if (e instanceof Error && e.message === "数据服务返回业务错误") throw e; }
    }
    return { status: "retrieved" as const, source: "iFinD MCP", query, retrievedAt: new Date().toISOString(), content, notice: "这是实际工具返回值。核验前仍需检查返回的证券、日期、复权方式和单位；接口成功不等于回答中的事实已经通过核验。" };
  } catch (e) {
    if (controller.signal.aborted) throw new Error("iFinD 查询超时，事实保持待核验状态");
    throw e;
  } finally { clearTimeout(timer); }
}

/** Narrow verifier: only the explicitly queried A-share unadjusted close, never arbitrary text. */
export async function verifyIfindClose(result: { content: { type: string; text: string }[]; query: string; retrievedAt: string }, input: IfindQuery, claimedValue: number, claimUnit: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ input, query: result.query, content: result.content, retrievedAt: result.retrievedAt })));
  const evidenceId = "ifind-" + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
  const base = { claimedValue, referenceValue: null as number | null, unit: "元", symbol: input.symbol, date: input.date, adjustment: "不复权", evidenceId };
  if (claimUnit !== "元" || !Number.isFinite(claimedValue) || claimedValue < 0) return { ...base, status: "UNVERIFIED" as const, reason: "仅支持有限非负数值及人民币元口径，不能把其他单位自动换算为股价。" };
  const matched: number[] = [];
  const dateBases = new Set<string>();
  let dateConflict = false;
  for (const block of result.content) {
    let data: any;
    try { data = JSON.parse(block.text); } catch { continue; }
    if (data.code !== 1 || typeof data.data?.answer !== "string") continue;
    const params = data.data.indicators_params?.["收盘价"];
    if (params?.["复权方式"] !== "不复权") continue;
    const lines = data.data.answer.split(/\r?\n/).filter((l: string) => l.trim().startsWith("|"));
    const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map(s => s.trim());
    if (lines.length < 3) continue;
    const headers = cells(lines[0]);
    const symbolIndex = headers.findIndex(h => h === "证券代码"), valueIndex = headers.findIndex(h => h === "收盘价"), dateIndex = headers.findIndex(h => h === "日期" || h === "交易日期");
    if (symbolIndex < 0 || valueIndex < 0) continue;
    for (const line of lines.slice(2)) {
      const row = cells(line);
      if (row[symbolIndex] !== input.symbol) continue;
      const returnedDate = dateIndex >= 0 ? row[dateIndex] : params?.["交易日期"];
      if (String(returnedDate).replace(/[-/]/g, "") !== input.date.replace(/-/g, "")) continue;
      const parameterDate = String(params?.["交易日期"] ?? "").replace(/[-/]/g, "");
      if (dateIndex >= 0 && /^20\d{6}$/.test(parameterDate) && parameterDate !== input.date.replace(/-/g, "")) { dateConflict = true; continue; }
      const raw = row[valueIndex]?.replace(/,/g, "");
      if (!raw || !/^\d+(?:\.\d+)?$/.test(raw)) continue;
      const value = Number(raw); if (Number.isFinite(value)) { matched.push(value); dateBases.add(dateIndex >= 0 ? "返回数据行日期" : "返回指标参数日期"); }
    }
  }
  if (dateConflict) return { ...base, status: "UNVERIFIED" as const, reason: "返回数据行日期与明确的指标参数日期冲突，需要人工检查。" };
  if (!matched.length) return { ...base, status: "UNVERIFIED" as const, reason: "返回内容未同时明确匹配证券、交易日、不复权方式和数值，保留待核验。" };
  if (matched.some(value => value !== matched[0])) return { ...base, status: "UNVERIFIED" as const, reason: "同一查询返回多个冲突值，需要人工检查原始返回。" };
  // Prices are compared at a half-cent absolute tolerance; this tolerance is part of the displayed contract.
  const referenceValue = matched[0], match = closePriceMatches(claimedValue, referenceValue);
  return { ...base, referenceValue, status: match ? "MATCH" as const : "MISMATCH" as const, dateBasis: [...dateBases].join("、"), tolerance: "绝对误差小于0.005元", reason: `证券、不复权方式和${[...dateBases].join("、")}已匹配；按人民币元的限定查询合同比较数值，绝对误差须小于0.005元。此结论仅覆盖该条收盘价事实。` };
}
