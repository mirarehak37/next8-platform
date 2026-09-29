"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError, onlyProvided } from "@/lib/actions/helpers";
import { submissionSchemas, webFormSchema } from "@/lib/validations/web-forms";
import { createTaskOnce, dueIn, onLeadCreated } from "@/lib/follow-ups";
import { AMBASSADOR_SOURCE, MARKETING_AUDIENCES } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { WEB_FORM_TYPES } from "@/lib/web-form-types";

async function checkRefs(tenantId: string, p: { ownerId?: string; type?: string; eventId?: string | null }) {
  if (p.ownerId && !(await prisma.user.findFirst({ where: { id: p.ownerId, tenantId }, select: { id: true } }))) {
    throw new ActionError("Uživatel nenalezen.");
  }
  if (p.eventId && !(await prisma.event.findFirst({ where: { id: p.eventId, tenantId }, select: { id: true } }))) {
    throw new ActionError("Akce nenalezena.");
  }
  if (p.type === "event" && !p.eventId) throw new ActionError("Vyberte akci, na kterou se lidé přihlašují.");
}

export async function createWebForm(input: unknown) {
  const user = await requirePermission("marketing", "create");
  const parsed = webFormSchema.parse(input);
  await checkRefs(user.tenantId, parsed);
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
  await checkRefs(user.tenantId, { ...parsed, type: parsed.type ?? existing.type, eventId: parsed.eventId !== undefined ? parsed.eventId : existing.eventId });
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

type Result = { ok: true } | { ok: false; error: string };
type Form = NonNullable<Awaited<ReturnType<typeof prisma.webForm.findFirst>>>;
type Utm = { utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; utmContent?: string | null; ref?: string | null };

function splitName(full: string) {
  const [first, ...rest] = full.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}
const utmNote = (d: Utm) =>
  [
    (d.utmSource || d.utmMedium || d.utmContent) && `UTM: ${[d.utmSource, d.utmMedium, d.utmContent].filter(Boolean).join(" / ")}`,
    d.ref && `Doporučení (ref): ${d.ref}`,
  ].filter(Boolean);

// Club typed by the visitor → existing club record when the name matches exactly.
async function findClub(tenantId: string, club: string | null | undefined) {
  if (!club) return null;
  const c = await prisma.company.findFirst({ where: { tenantId, name: { equals: club.trim(), mode: "insensitive" } }, select: { id: true } });
  return c?.id ?? null;
}

async function leadFrom(form: Form, data: {
  firstName: string; lastName: string | null; email: string; phone?: string | null; companyName?: string | null; jobTitle?: string | null;
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

// Public, unauthenticated: called from /f/<id>. Returns a result instead of throwing so the
// visitor gets a friendly message.
export async function submitWebForm(formId: string, input: unknown): Promise<Result> {
  const form = await prisma.webForm.findFirst({ where: { id: formId, isActive: true } });
  if (!form) return { ok: false, error: "Formulář už není aktivní." };
  const type = (form.type in submissionSchemas ? form.type : "demo") as keyof typeof submissionSchemas;
  const parsed = submissionSchemas[type].safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Zkontrolujte formulář." };
  const d = parsed.data;

  // Bots fill the hidden field or submit instantly; pretend success so they don't retry.
  if (d.hp || Date.now() - d.startedAt < 2500) return { ok: true };
  // Flood guard: a burst on one form.
  if (form.lastSubmittedAt && form.submissions > 0) {
    const recentLeads = await prisma.lead.count({ where: { webFormId: form.id, createdAt: { gte: new Date(Date.now() - 60 * 1000) } } });
    if (recentLeads >= 20) return { ok: false, error: "Příliš mnoho odeslání, zkuste to prosím za chvíli." };
  }
  if ("email" in d && d.email) {
    const recent = new Date(Date.now() - 10 * 60 * 1000);
    const same = await prisma.lead.count({ where: { tenantId: form.tenantId, email: d.email, createdAt: { gte: recent } } });
    if (same >= 3) return { ok: true };
  }

  const res = await deliver(form, type, d);
  if (!res.ok) return res;
  await prisma.webForm.update({ where: { id: form.id }, data: { submissions: { increment: 1 }, lastSubmittedAt: new Date() } });
  revalidatePath("/marketing/forms");
  return { ok: true };
}

async function deliver(form: Form, type: keyof typeof submissionSchemas, input: unknown): Promise<Result> {
  switch (type) {
    case "demo": {
      const d = submissionSchemas.demo.parse(input);
      const n = splitName(d.name);
      const audience = MARKETING_AUDIENCES.find((a) => a.value === d.role)?.label;
      await leadFrom(form, {
        ...n, lastName: n.lastName || null, email: d.email, phone: d.phone || null, companyName: d.club || null,
        jobTitle: ROLE_TITLE[d.role], productInterest: ROLE_INTEREST[d.role], utm: d,
        notes: [d.message && `Zpráva: ${d.message}`, d.team && `Tým / kategorie: ${d.team}`, `Formulář: ${form.name}${audience ? ` · publikum: ${audience}` : ""}`, ...utmNote(d)].filter(Boolean).join("\n"),
      });
      return { ok: true };
    }
    case "contact": {
      const d = submissionSchemas.contact.parse(input);
      const n = splitName(d.name);
      await leadFrom(form, {
        ...n, lastName: n.lastName || null, email: d.email, phone: d.phone || null, utm: d,
        notes: [`Zpráva: ${d.message}`, `Formulář: ${form.name}`, ...utmNote(d)].join("\n"),
      });
      return { ok: true };
    }
    case "event": {
      const d = submissionSchemas.event.parse(input);
      const event = form.eventId ? await prisma.event.findFirst({ where: { id: form.eventId, tenantId: form.tenantId }, include: { registrations: { select: { role: true, status: true } } } }) : null;
      if (!event || event.status === "cancelled" || event.status === "done") return { ok: false, error: "Na tuto akci se už nelze přihlásit." };
      const taken = event.registrations.filter((r) => r.role === "participant" && r.status !== "cancelled").length;
      if (d.role === "participant" && event.capacity != null && taken >= event.capacity) return { ok: false, error: "Kapacita akce je bohužel naplněná." };
      await prisma.eventRegistration.create({
        data: {
          tenantId: form.tenantId, eventId: event.id, role: d.role, name: d.name, email: d.email, phone: d.phone,
          companyId: await findClub(form.tenantId, d.club),
          paymentStatus: d.role === "participant" && event.price ? "unpaid" : "free",
          amount: d.role === "participant" ? event.price : null,
          note: [d.birthYear && `Ročník: ${d.birthYear}`, d.club && `Klub: ${d.club}`, d.parentName && `Zákonný zástupce: ${d.parentName}`, d.note, `Přihláška z webu (${form.name})`, ...utmNote(d)].filter(Boolean).join("\n"),
        },
      });
      revalidatePath(`/events/${event.id}`);
      revalidatePath("/events");
      return { ok: true };
    }
    case "ambassador": {
      const d = submissionSchemas.ambassador.parse(input);
      const n = splitName(d.name);
      const amb = await prisma.ambassador.create({
        data: {
          tenantId: form.tenantId, firstName: n.firstName, lastName: n.lastName || "—", email: d.email, phone: d.phone || null,
          position: d.position || null, instagram: d.instagram || null, tiktok: d.tiktok || null, followers: d.followers ?? null,
          companyId: await findClub(form.tenantId, d.club), status: "candidate", ownerId: form.ownerId,
          notes: [d.message && `O sobě: ${d.message}`, d.club && `Klub: ${d.club}`, `Přihláška z webu (${form.name})`, ...utmNote(d)].filter(Boolean).join("\n"),
        },
      });
      await createTaskOnce({
        tenantId: form.tenantId, creatorId: form.ownerId, assigneeId: form.ownerId, dueDate: dueIn(3), subjectType: "ambassador", subjectId: amb.id,
        title: `Posoudit kandidáta na ambasadora: ${d.name}`, description: d.instagram ? `Instagram: ${d.instagram}` : undefined,
      });
      revalidatePath("/crm/ambassadors");
      return { ok: true };
    }
    case "partner": {
      const d = submissionSchemas.partner.parse(input);
      const partner = await prisma.partner.create({
        data: {
          tenantId: form.tenantId, name: d.company, kind: d.interest, email: d.email, phone: d.phone || null, website: d.website || null,
          status: "prospect", ownerId: form.ownerId,
          notes: [`Kontaktní osoba: ${d.name}`, d.message && `Zpráva: ${d.message}`, `Poptávka z webu (${form.name})`, ...utmNote(d)].filter(Boolean).join("\n"),
        },
      });
      await createTaskOnce({
        tenantId: form.tenantId, creatorId: form.ownerId, assigneeId: form.ownerId, dueDate: dueIn(2), priority: "high", subjectType: "partner", subjectId: partner.id,
        title: `Ozvat se partnerovi: ${d.company} (${d.name})`, description: [d.phone && `Telefon: ${d.phone}`, `E-mail: ${d.email}`].filter(Boolean).join("\n"),
      });
      revalidatePath("/crm/partners");
      return { ok: true };
    }
  }
}

// One click: the standard set of forms (demo, contact, ambassador, partner) that don't exist yet.
export async function createDefaultWebForms() {
  const user = await requirePermission("marketing", "create");
  const existing = await prisma.webForm.findMany({ where: { tenantId: user.tenantId }, select: { type: true } });
  const have = new Set(existing.map((f) => f.type));
  const missing = WEB_FORM_TYPES.filter((t) => t.value !== "event" && !have.has(t.value));
  for (const t of missing) {
    await prisma.webForm.create({ data: { tenantId: user.tenantId, name: `Web – ${t.label.toLowerCase()}`, type: t.value, source: t.source, ownerId: user.id } });
  }
  revalidatePath("/marketing/forms");
  return missing.length;
}
