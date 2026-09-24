import { prisma } from "@/lib/prisma";
import { AMBASSADOR_SOURCE } from "@/lib/constants";

// Keeps the ambassador's commission in step with a deal. A won deal brought by an
// ambassador books one delivery on the chosen commission term (e.g. 30 % "dojednal
// ambasador"): base = deal value (what the club actually pays), commission = % of it,
// shown as "k výplatě" until paid. Anything else removes an unpaid booking; a paid one
// is left alone (money already went out) so it can be sorted out by hand.
export async function syncDealCommission(tenantId: string, dealId: string, userId: string) {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId }, include: { commissionTerm: true } });
  const existing = await prisma.partnershipFulfillment.findUnique({ where: { dealId } });
  if (!deal) {
    if (existing && !existing.paidAt) await prisma.partnershipFulfillment.delete({ where: { id: existing.id } });
    return null;
  }

  const term = deal.commissionTerm;
  const eligible =
    deal.status === "won" &&
    deal.source === AMBASSADOR_SOURCE &&
    !!deal.ambassadorId &&
    !!term &&
    term.tenantId === tenantId &&
    term.subjectType === "ambassador" &&
    term.subjectId === deal.ambassadorId &&
    term.valueType === "percent" &&
    term.percent != null;

  if (!eligible) {
    if (existing && !existing.paidAt) await prisma.partnershipFulfillment.delete({ where: { id: existing.id } });
    return null;
  }

  const commission = Math.round(deal.value * term!.percent!) / 100;
  const data = {
    termId: term!.id,
    date: deal.closedAt ?? new Date(),
    quantity: 1,
    productId: deal.productId,
    baseAmount: deal.value,
    amount: commission,
    rewardAmount: commission,
    note: `Obchod: ${deal.name}`,
    status: "done",
  };
  if (existing) {
    // Once paid, the booked amount is history — don't rewrite it.
    if (existing.paidAt) return existing;
    return prisma.partnershipFulfillment.update({ where: { id: existing.id }, data });
  }
  return prisma.partnershipFulfillment.create({ data: { ...data, dealId, tenantId, recordedById: userId } });
}
