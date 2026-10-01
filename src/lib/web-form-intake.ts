// Turning a submission of a hosted web form (/f/<id>) into CRM records.

import { prisma } from "@/lib/prisma";
import { onLeadCreated } from "@/lib/follow-ups";
import { AMBASSADOR_SOURCE } from "@/lib/constants";
import { revalidatePath } from "next/cache";

export const ROLE_INTEREST: Record<string, string> = { player: "PRO ATHLETE", parent: "PRO ATHLETE", coach: "TEAM", club: "TEAM" };
export const ROLE_TITLE: Record<string, string> = { player: "Hráč", parent: "Rodič", coach: "Trenér", club: "Zástupce klubu" };

export type Result = { ok: true } | { ok: false; error: string };
export type Form = NonNullable<Awaited<ReturnType<typeof prisma.webForm.findFirst>>>;
export type Utm = { utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; utmContent?: string | null; ref?: string | null };

export function splitName(full: string) {
  const [first, ...rest] = full.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}
export const utmNote = (d: Utm) =>
  [
    (d.utmSource || d.utmMedium || d.utmContent) && `UTM: ${[d.utmSource, d.utmMedium, d.utmContent].filter(Boolean).join(" / ")}`,
    d.ref && `Doporučení (ref): ${d.ref}`,
  ].filter(Boolean);

// Club typed by the visitor → existing club record when the name matches exactly.
export async function findClub(tenantId: string, club: string | null | undefined) {
  if (!club) return null;
  const c = await prisma.company.findFirst({ where: { tenantId, name: { equals: club.trim(), mode: "insensitive" } }, select: { id: true } });
  return c?.id ?? null;
}

export async function leadFrom(form: Form, data: {
  firstName: string; lastName: string | null; email: string | null; phone?: string | null; companyName?: string | null; jobTitle?: string | null;
  productInterest?: string | null; notes: string; utm: Utm;
}) {
  const { utm, ...rest } = data;
  const lead = await prisma.lead.create({
    data: {
      ...rest,
      tenantId: form.tenantId,
      source: utm.ref ? AMBASSADOR_SOURCE : form.source,
      campaign: utm.utmCampaign || form.campaign || null,
      status: "new",
      ownerId: form.ownerId,
      webFormId: form.id,
    },
  });
  await onLeadCreated(form.tenantId, lead, form.ownerId);
  revalidatePath("/crm/leads");
}

