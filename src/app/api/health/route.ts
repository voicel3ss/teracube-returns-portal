import { prisma } from "@/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "reachable", service: "teracube-device-care" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", database: "unreachable", service: "teracube-device-care" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
