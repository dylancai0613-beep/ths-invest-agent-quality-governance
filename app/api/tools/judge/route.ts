import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { qualitySessions } from "@/db/schema";
import { initialState } from "@/lib/quality/seed";
import type { QualityState } from "@/lib/quality/types";
import { judgeAnswer, modelConfigured } from "@/lib/integrations/model-judge";
export const dynamic = "force-dynamic";
const calls = new Map<string, { count: number; started: number }>();
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() { return reply({ configured: modelConfigured(env), model: env.MODEL_NAME ?? null, notice: "模型仅收到脱敏后的必要问题、回答、画像与证据。" }); }
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ status: "error", notice: "不接受跨站写入请求" }, 403);
  if (!modelConfigured(env)) return reply({ status: "not_configured", notice: "服务端模型尚未配置，未执行 AI 语义评测。" }, 503);
  const session = request.headers.get("cookie")?.match(/(?:^|;\s*)quality_session=([a-zA-Z0-9-]{20,80})/)?.[1];
  if (!session) return reply({ status: "error", notice: "请先打开质检工作台建立会话" }, 401);
  const current = calls.get(session), now = Date.now();
  if (current && now - current.started < 3600000 && current.count >= 12) return reply({ status: "error", notice: "本会话的模型演示次数已用完，请稍后再试" }, 429);
  if (calls.size > 1000) calls.clear();
  calls.set(session, current && now - current.started < 3600000 ? { ...current, count: current.count + 1 } : { count: 1, started: now });
  try {
    const raw = await request.text(); if (raw.length > 2000) return reply({ status: "error", notice: "输入过长" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ status: "error", notice: "请求必须是有效 JSON 对象" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.caseId !== "string" || typeof body.versionId !== "string") return reply({ status: "error", notice: "缺少案例与版本标识" }, 400);
    const [row] = await getDb().select().from(qualitySessions).where(eq(qualitySessions.sessionId, session)).limit(1);
    const state: QualityState = row ? JSON.parse(row.stateJson) : initialState();
    const item = state.cases.find(c => c.caseId === body.caseId);
    if (!item || !item.answers[body.versionId]) return reply({ status: "error", notice: "案例或回答版本不存在" }, 404);
    return reply(await judgeAnswer(env, item, body.versionId));
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return reply({ status: "error", notice: /^(模型|管理员|所选)/.test(message) ? message : "AI 辅助复核失败或超时，原有评测结论未被修改。" }, 502);
  }
}
