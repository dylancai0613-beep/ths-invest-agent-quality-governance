import { env } from "cloudflare:workers";
import { isIfindConfigured, queryIfind, supportedQueries, verifyIfindClose, type IfindConfig } from "@/lib/integrations/ifind";
import historicalSnapshot from "@/data/snapshots/ifind-close-20261106.json";

export const dynamic = "force-dynamic";
const recentCalls = new Map<string, number>();
function config() { return env as unknown as IfindConfig; }
function reply(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
export async function GET() {
  return reply({ configured: isIfindConfigured(config()), source: "iFinD MCP", supported: supportedQueries, historicalSnapshotAvailable: true, notice: "凭证仅保留在服务端；历史查询并非实时行情推送。网络查询失败时可主动选择已保存历史证据，不会静默替换。" });
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ status: "error", notice: "不接受跨站查询请求" }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return reply({ status: "error", notice: "输入过长" }, 413);
  const key = request.headers.get("oai-authenticated-user-id") || request.headers.get("cookie")?.slice(0, 200) || request.headers.get("cf-connecting-ip") || "local-demo";
  const now = Date.now();
  if (now - (recentCalls.get(key) ?? 0) < 5000) return reply({ status: "error", notice: "查询过于频繁，请稍后重试" }, 429);
  if (recentCalls.size > 1000) recentCalls.clear();
  recentCalls.set(key, now);
  try {
    const raw = await request.text();
    if (raw.length > 2048) return reply({ status: "error", notice: "输入过长" }, 413);
    let input;
    try { input = JSON.parse(raw); } catch { return reply({ status: "error", notice: "请求必须是有效 JSON 对象" }, 400); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return reply({ status: "error", notice: "查询格式错误" }, 400);
    if (!["300033.SZ", "300059.SZ", "600519.SH"].includes(input.symbol) || input.field !== "close" || typeof input.date !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(input.date)) return reply({ status: "error", notice: "仅接受允许列表内证券、明确交易日期和 close 字段。" }, 400);
    const query = { symbol: input.symbol, date: input.date, field: input.field };
    if (input.claimValue !== undefined && (typeof input.claimValue !== "number" || !Number.isFinite(input.claimValue) || input.claimValue < 0 || input.claimValue > 1e9 || input.claimUnit !== "元")) return reply({ status: "error", notice: "待核验数值必须为非负有限数，且单位为元。" }, 400);
    if (input.mode !== undefined && input.mode !== "historical_snapshot" && input.mode !== "online") return reply({ status: "error", notice: "未知查询模式" }, 400);
    if (input.mode === "historical_snapshot") {
      if (query.symbol !== historicalSnapshot.symbol || query.date !== historicalSnapshot.date || query.field !== historicalSnapshot.field) return reply({ status: "error", notice: "没有这组证券、日期和字段的已保存历史证据。" }, 400);
      const result = { status: "historical_snapshot", provenance: "historical_snapshot", source: historicalSnapshot.source, query: historicalSnapshot.query, retrievedAt: historicalSnapshot.retrievedAt, servedAt: new Date().toISOString(), content: historicalSnapshot.content, notice: `这是 ${historicalSnapshot.retrievedAt} 实际 iFinD 查询后保存的历史证据，本次没有调用外部行情接口。仅支持该证券、交易日与不复权收盘价。` };
      return reply(typeof input.claimValue === "number" ? { ...result, verification: await verifyIfindClose(result, query, input.claimValue, input.claimUnit) } : result);
    }
    const result = await queryIfind(config(), query);
    if (result.status === "retrieved" && typeof input.claimValue === "number") return reply({ ...result, verification: await verifyIfindClose(result, query, input.claimValue, input.claimUnit) });
    return reply(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据查询失败";
    // Only application-controlled diagnostics are public; no raw upstream payloads.
    const safe = /^(iFinD|数据服务|当前账户|只支持|查询日期)/.test(message) ? message : "数据查询失败，请稍后重试；未给出核验结论。";
    return reply({ status: "error", source: "iFinD MCP", notice: safe }, 502);
  }
}
