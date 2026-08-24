import { prisma } from "./prisma";

export async function getOverdueOrderIds(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM replacement_orders
    WHERE status::text <> 'closed'
      AND updated_at < NOW() - INTERVAL '24 hours'
  `;

  return new Set(rows.map((row) => row.id));
}
