import { prisma } from "@/lib/prisma";
import { todayDateOnly } from "@/lib/format";
import { FOLLOW_UPS, type FollowUpKey, type FollowUpSettings } from "@/lib/follow-ups-meta";

export { FOLLOW_UPS, type FollowUpKey, type FollowUpSettings } from "@/lib/follow-ups-meta";

// Built-in follow-up automations. Each creates tasks when something happens, so nobody has to
// remember the next step. Settings live in FollowUpRule; a missing row means the defaults below.

export async function getFollowUpSettings(tenantId: string): Promise<FollowUpSettings> {
  const rows = await prisma.followUpRule.findMany({ where: { tenantId } });
  const row = (k: FollowUpKey) => rows.find((r) => r.key === k);
  const cfg = <T extends object>(k: FollowUpKey, d: T): T => ({ ...d, ...((row(k)?.config as Partial<T> | null) ?? {}) });
  return {
    lead_call: { isActive: row("lead_call")?.isActive ?? true, ...cfg("lead_call", { days: FOLLOW_UPS.lead_call.defaults.days as number }) },
    deal_onboarding: { isActive: row("deal_onboarding")?.isActive ?? true, ...cfg("deal_onboarding", { days: [...FOLLOW_UPS.deal_onboarding.defaults.days] as number[] }) },
    deal_renewal: { isActive: row("deal_renewal")?.isActive ?? true, ...cfg("deal_renewal", { daysBefore: FOLLOW_UPS.deal_renewal.defaults.daysBefore as number }) },
  };
}

const DAY = 86400000;
// Due dates are date-only (UTC midnight), like tasks created in the form.
const dueIn = (days: number, from = todayDateOnly()) => new Date(from.getTime() + Math.max(0, days) * DAY);

async function createTaskOnce(data: {
  tenantId: string; title: string; description?: string; assigneeId: string; creatorId: string; dueDate: Date;
  priority?: string; subjectType: string; subjectId: string;
}) {
  // Moving a deal to "Vyhráno" twice (or re-saving) must not duplicate the follow-ups.
  const exists = await prisma.task.findFirst({
    where: { tenantId: data.tenantId, subjectType: data.subjectType, subjectId: data.subjectId, title: data.title },
    select: { id: true },
  });
  if (exists) return;
  await prisma.task.create({ data: { ...data, priority: data.priority ?? "medium", status: "open" } });
}

export async function onLeadCreated(
  tenantId: string,
  lead: { id: string; firstName: string | null; lastName: string | null; companyName: string | null; ownerId: string; phone?: string | null },
  creatorId: string,
) {
  const s = (await getFollowUpSettings(tenantId)).lead_call;
  if (!s.isActive) return;
  const who = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.companyName || "nový lead";
  await createTaskOnce({
    tenantId, creatorId, assigneeId: lead.ownerId, dueDate: dueIn(s.days), priority: "high",
    title: `Zavolat: ${who}${lead.companyName && who !== lead.companyName ? ` (${lead.companyName})` : ""}`,
    description: lead.phone ? `Telefon: ${lead.phone}` : undefined,
    subjectType: "lead", subjectId: lead.id,
  });
}

export async function onDealWon(
  tenantId: string,
  deal: { id: string; name: string; ownerId: string; billingPeriod: string | null; closedAt: Date | null },
  creatorId: string,
) {
  const s = await getFollowUpSettings(tenantId);
  const base = todayDateOnly(deal.closedAt ?? new Date());
  if (s.deal_onboarding.isActive) {
    for (const d of [...new Set(s.deal_onboarding.days)].sort((a, b) => a - b)) {
      await createTaskOnce({
        tenantId, creatorId, assigneeId: deal.ownerId, dueDate: dueIn(d, base), subjectType: "deal", subjectId: deal.id,
        title: `Check-in po ${d} dnech – ${deal.name}`,
        description: "Jak klubu NEXT8 jde? Používají ho všichni hráči a trenér? Něco chybí? Zapište aktivitu.",
      });
    }
  }
  // Monthly plans renew in the app on their own; a yearly one is worth a call before it ends.
  if (s.deal_renewal.isActive && deal.billingPeriod === "yearly") {
    await createTaskOnce({
      tenantId, creatorId, assigneeId: deal.ownerId, priority: "high", subjectType: "deal", subjectId: deal.id,
      dueDate: dueIn(365 - s.deal_renewal.daysBefore, base),
      title: `Obnova ročního balíčku – ${deal.name}`,
      description: `Předplatné končí ${new Date(base.getTime() + 365 * DAY).toLocaleDateString("cs-CZ", { timeZone: "UTC" })}. Ozvat se kvůli prodloužení.`,
    });
  }
}
