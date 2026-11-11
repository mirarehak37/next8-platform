import { prisma } from "@/lib/prisma";

export const SLIPPING_ACTIVITY_DAYS = 21;
const DAY = 1000 * 60 * 60 * 24;

export type SlippingReason = { kind: "overdue" | "quiet"; label: string };

export async function loadSlippingDeals(dealScope: Record<string, unknown>, tenantId: string) {
  const now = Date.now();
  const deals = await prisma.deal.findMany({
    where: { ...dealScope, status: "open" },
    include: {
      stage: { select: { name: true, probability: true, isWon: true, isLost: true } },
      company: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });
  if (deals.length === 0) return [];

  const lastActivity = await prisma.activity.groupBy({
    by: ["subjectId"],
    where: { tenantId, subjectType: "deal", subjectId: { in: deals.map((d) => d.id) } },
    _max: { activityAt: true },
  });
  const lastById = new Map(lastActivity.map((a) => [a.subjectId, a._max.activityAt]));

  return deals
    .map((deal) => {
      const last = lastById.get(deal.id) ?? deal.updatedAt;
      const quietDays = Math.floor((now - new Date(last).getTime()) / DAY);
      const reasons: SlippingReason[] = [];
      if (deal.expectedCloseDate && deal.expectedCloseDate.getTime() < now - DAY) {
        const days = Math.floor((now - deal.expectedCloseDate.getTime()) / DAY);
        reasons.push({ kind: "overdue", label: `Termín uzavření před ${days} dny` });
      }
      if (quietDays > SLIPPING_ACTIVITY_DAYS) {
        reasons.push({ kind: "quiet", label: `Bez aktivity ${quietDays} dní` });
      }
      return { deal, reasons, quietDays, lastActivityAt: last };
    })
    .filter((row) => row.reasons.length > 0)
    .sort((a, b) => b.deal.value - a.deal.value);
}

export function quarterOf(date: Date) {
  return { year: date.getFullYear(), quarter: Math.floor(date.getMonth() / 3) + 1 };
}

export function quarterRange(year: number, quarter: number) {
  const start = new Date(year, (quarter - 1) * 3, 1);
  const end = new Date(year, quarter * 3, 1);
  return { start, end };
}

export function quarterKey(year: number, quarter: number) {
  return `${year}-Q${quarter}`;
}

export function parseQuarterKey(key: string | undefined) {
  const match = key?.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return null;
  return { year: Number(match[1]), quarter: Number(match[2]) };
}
