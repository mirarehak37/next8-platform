import { prisma } from "@/lib/prisma";
import { AMBASSADOR_SOURCE } from "@/lib/constants";

// Keeps the ambassador's commission in step with a deal. A won deal brought by an
// ambassador books one delivery on the chosen commission term — a % of the deal value
// (what the club actually pays), a fixed amount per sale, or an amount agreed for this
// deal — shown as "k výplatě" until paid. Anything else removes an unpaid booking; a paid one
// is left alone (money already went out) so it can be sorted out by hand.
export async function syncDealCommission(tenantId: string, dealId: string, userId: string) {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId }, include: { commissionTerm: true } });
  const existing = await prisma.partnershipFulfillment.findUnique({ where: { dealId } });
  if (!deal) {
    if (existing && !existing.paidAt) await prisma.partnershipFulfillment.delete({ where: { id: existing.id } });
    return null;
  }

  let term = deal.commissionTerm;
  const viaAmbassador = deal.status === "won" && deal.source === AMBASSADOR_SOURCE && !!deal.ambassadorId;
  const termOk =
    !!term && term.tenantId === tenantId && term.subjectType === "ambassador" && term.subjectId === deal.ambassadorId && term.direction === "we_give";
  // Commission: an amount agreed for this deal, else the term's percentage of the
  // deal value, else the term's fixed amount per sale.
  let commission: number | null = null;
  if (viaAmbassador && deal.commissionAmount != null) commission = deal.commissionAmount;
  else if (viaAmbassador && termOk && term!.valueType === "percent" && term!.percent != null) commission = Math.round(deal.value * term!.percent) / 100;
  else if (viaAmbassador && termOk && term!.valueType === "fixed" && term!.amount != null) commission = term!.amount;

  if (commission == null) {
    if (existing && !existing.paidAt) await prisma.partnershipFulfillment.delete({ where: { id: existing.id } });
    return null;
  }

  // A custom amount without a chosen rule still needs a term to be booked on.
  if (!termOk) term = await commissionTermFor(tenantId, deal.ambassadorId!);

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

// The ambassador's catch-all "Provize z obchodů" term, created on first use.
async function commissionTermFor(tenantId: string, ambassadorId: string) {
  const title = "Provize z obchodů";
  const found = await prisma.partnershipTerm.findFirst({
    where: { tenantId, subjectType: "ambassador", subjectId: ambassadorId, direction: "we_give", title },
  });
  return (
    found ??
    prisma.partnershipTerm.create({
      data: { tenantId, subjectType: "ambassador", subjectId: ambassadorId, direction: "we_give", type: "bonus", title, valueType: "fixed", period: "per_event" },
    })
  );
}
