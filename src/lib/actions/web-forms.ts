"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError, onlyProvided } from "@/lib/actions/helpers";
import { submissionSchema, webFormSchema } from "@/lib/validations/web-forms";
import { onLeadCreated } from "@/lib/follow-ups";
import { AMBASSADOR_SOURCE, MARKETING_AUDIENCES } from "@/lib/constants";
import { revalidatePath } from "next/cache";

async function checkOwner(tenantId: string, ownerId: string | undefined) {
  if (ownerId && !(await prisma.user.findFirst({ where: { id: ownerId, tenantId }, select: { id: true } }))) {
    throw new ActionError("Uživatel nenalezen.");
  }
}

export async function createWebForm(input: unknown) {
  const user = await requirePermission("marketing", "create");
  const parsed = webFormSchema.parse(input);
  await checkOwner(user.tenantId, parsed.ownerId);
  const form = await prisma.webForm.create({ data: { ...parsed, tenantId: user.tenantId } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "webForm", entityId: form.id, action: "create" });
  revalidatePath("/marketing/forms");
  return form;
}

export async function updateWebForm(id: string, input: unknown) {
  const user = await requirePermission("marketing", "edit");
  const existing = await prisma.webForm.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Formulář nenalezen.");
  const parsed = onlyProvided(webFormSchema.partial().parse(input), input);
  await checkOwner(user.tenantId, parsed.ownerId);
  const form = await prisma.webForm.update({ where: { id }, data: parsed });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "webForm", entityId: id, action: "update", changes: parsed });
  revalidatePath("/marketing/forms");
  revalidatePath(`/f/${id}`);
  return form;
}

export async function deleteWebForm(id: string) {
  const user = await requirePermission("marketing", "delete");
  const existing = await prisma.webForm.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Formulář nenalezen.");
  await prisma.webForm.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "webForm", entityId: id, action: "delete" });
  revalidatePath("/marketing/forms");
}

const ROLE_INTEREST: Record<string, string> = { player: "PRO ATHLETE", parent: "PRO ATHLETE", coach: "TEAM", club: "TEAM" };
const ROLE_TITLE: Record<string, string> = { player: "Hráč", parent: "Rodič", coach: "Trenér", club: "Zástupce klubu" };

// Public, unauthenticated: called from /f/<id>. Returns a result instead of throwing so the
// visitor gets a friendly message.
export async function submitWebForm(formId: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Zkontrolujte formulář." };
  const d = parsed.data;

  const form = await prisma.webForm.findFirst({ where: { id: formId, isActive: true } });
  if (!form) return { ok: false, error: "Formulář už není aktivní." };

  // Bots fill the hidden field or submit instantly; pretend success so they don't retry.
  if (d.website || Date.now() - d.startedAt < 2500) return { ok: true };
  // Flood guard: same e-mail repeatedly, or a burst on one form.
  const recent = new Date(Date.now() - 10 * 60 * 1000);
  const [sameEmail, burst] = await Promise.all([
    prisma.lead.count({ where: { tenantId: form.tenantId, email: d.email, createdAt: { gte: recent } } }),
    prisma.lead.count({ where: { webFormId: form.id, createdAt: { gte: new Date(Date.now() - 60 * 1000) } } }),
  ]);
  if (sameEmail >= 3) return { ok: true };
  if (burst >= 20) return { ok: false, error: "Příliš mnoho odeslání, zkuste to prosím za chvíli." };

  const [firstName, ...rest] = d.name.split(/\s+/);
  const audience = MARKETING_AUDIENCES.find((a) => a.value === d.role)?.label;
  const notes = [
    d.message && `Zpráva: ${d.message}`,
    d.team && `Tým / kategorie: ${d.team}`,
    `Formulář: ${form.name}${audience ? ` · publikum: ${audience}` : ""}`,
    (d.utmSource || d.utmMedium || d.utmContent) && `UTM: ${[d.utmSource, d.utmMedium, d.utmContent].filter(Boolean).join(" / ")}`,
    d.ref && `Doporučení (ref): ${d.ref}`,
  ].filter(Boolean).join("\n");

  const lead = await prisma.lead.create({
    data: {
      tenantId: form.tenantId,
      firstName,
      lastName: rest.join(" ") || null,
      email: d.email,
      phone: d.phone || null,
      companyName: d.club || null,
      jobTitle: ROLE_TITLE[d.role],
      productInterest: ROLE_INTEREST[d.role],
      source: d.ref ? AMBASSADOR_SOURCE : form.source,
      campaign: d.utmCampaign || form.campaign || null,
      notes,
      status: "new",
      ownerId: form.ownerId,
      webFormId: form.id,
    },
  });
  await onLeadCreated(form.tenantId, lead, form.ownerId);
  revalidatePath("/crm/leads");
  revalidatePath("/marketing/forms");
  return { ok: true };
}
