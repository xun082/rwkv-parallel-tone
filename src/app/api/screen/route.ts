import { getServerSensitiveGuard } from "@/lib/sensitive-guard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 输入敏感词预检：只回传 { blocked } 布尔值，词表始终留在服务端。
 * 前端在发送前调用，命中则不进入生成流程。
 */
export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ blocked: false });
  }

  const text =
    typeof json === "object" && json !== null && typeof (json as { text?: unknown }).text === "string"
      ? (json as { text: string }).text
      : "";
  if (!text) {
    return Response.json({ blocked: false });
  }

  return Response.json({ blocked: getServerSensitiveGuard().isSensitive(text) });
}
