"use server";

import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError, onlyProvided } from "@/lib/actions/helpers";
import { eventSchema, registrationSchema } from "@/lib/validations/events";
import { revalidatePath } from "next/cache";

function revalidate(eventId?: string) {
  revalidatePath("/events");
  revalidatePath("/calendar");
  if (eventId) revalidatePath(`/events/${eventId}`);
}

type EventParsed = Partial<z.output<typeof eventSchema>>;

async function eventData(tenantId: string, parsed: EventParsed) {
  const { startDate, endDate, companyId, ...rest } = parsed;
  if (companyId) {
    const company = await prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } });
    if (!company) throw new ActionError("Klub nenalezen.");
  }
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) throw new ActionError("Konec nemůže být před začátkem.");
  return {
    ...rest,
    ...(startDate !== undefined && { startDate: new Date(startDate) }),
    ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    ...(companyId !== undefined && { companyId: companyId || null }),
    ...(parsed.capacity !== undefined && { capacity: parsed.capacity ?? null }),
    ...(parsed.price !== undefined && { price: parsed.price ?? null }),
  };
}

export async function createEvent(data: unknown) {
  const user = await requirePermission("event", "create");
  const parsed = eventSchema.parse(data);
  const event = await prisma.event.create({
    data: { ...(await eventData(user.tenantId, parsed)), name: parsed.name, ownerId: parsed.ownerId, startDate: new Date(parsed.startDate), tenantId: user.tenantId },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "event", entityId: event.id, action: "create" });
  revalidate();
  return event;
}

export async function updateEvent(id: string, data: unknown) {
  const user = await requirePermission("event", "edit");
  const parsed = onlyProvided(eventSchema.partial().parse(data), data);
  const existing = await prisma.event.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Akce nenalezena.");
  const event = await prisma.event.update({ where: { id }, data: await eventData(user.tenantId, parsed) });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "event", entityId: id, action: "update", changes: parsed });
  revalidate(id);
  return event;
}

export async function deleteEvent(id: string) {
  const user = await requirePermission("event", "delete");
  const existing = await prisma.event.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Akce nenalezena.");
  await prisma.event.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "event", entityId: id, action: "delete" });
  revalidate();
}

// ---- Registrations

type RegParsed = Partial<z.output<typeof registrationSchema>>;

// Resolves who is registering: a CRM contact, an ambassador, or a typed-in name.
async function registrationData(tenantId: string, parsed: RegParsed) {
  const data: Record<string, unknown> = { ...parsed };
  delete data.eventId;
  if (parsed.contactId) {
    const c = await prisma.contact.findFirst({
      where: { id: parsed.contactId, tenantId },
      include: { companies: { select: { companyId: true }, take: 1 } },
    });
    if (!c) throw new ActionError("Kontakt nenalezen.");
    data.name = parsed.name || `${c.firstName} ${c.lastName}`;
    data.email = parsed.email || c.email;
    data.phone = parsed.phone || c.phone || c.mobile;
    if (!parsed.companyId && c.companies[0]) data.companyId = c.companies[0].companyId;
  }
  if (parsed.ambassadorId) {
    const a = await prisma.ambassador.findFirst({ where: { id: parsed.ambassadorId, tenantId } });
    if (!a) throw new ActionError("Ambasador nenalezen.");
    data.name = parsed.name || `${a.firstName} ${a.lastName}`;
    data.email = parsed.email || a.email;
    data.phone = parsed.phone || a.phone;
  }
  if (parsed.companyId) {
    const company = await prisma.company.findFirst({ where: { id: parsed.companyId, tenantId }, select: { id: true } });
    if (!company) throw new ActionError("Klub nenalezen.");
  }
  for (const key of ["contactId", "ambassadorId", "companyId"] as const) {
    if (key in data) data[key] = data[key] || null;
  }
  if ("amount" in data) data.amount = parsed.amount ?? null;
  return data;
}

export async function createRegistration(input: unknown) {
  const user = await requirePermission("event", "edit");
  const parsed = registrationSchema.parse(input);
  const event = await prisma.event.findFirst({ where: { id: parsed.eventId, tenantId: user.tenantId } });
  if (!event) throw new ActionError("Akce nenalezena.");
  const data = await registrationData(user.tenantId, parsed);
  if (!data.name) throw new ActionError("Vyberte kontakt / ambasadora nebo zadejte jméno.");
  if (parsed.contactId) {
    const dup = await prisma.eventRegistration.findFirst({ where: { eventId: event.id, contactId: parsed.contactId, status: { not: "cancelled" } } });
    if (dup) throw new ActionError("Tento kontakt už je na akci přihlášený.");
  }
  await prisma.eventRegistration.create({
    data: {
      ...(data as object),
      name: data.name as string,
      eventId: event.id,
      tenantId: user.tenantId,
      // Default the fee from the event price for paying participants.
      amount: parsed.amount ?? (parsed.role === "participant" ? event.price : null),
      paymentStatus: parsed.role !== "participant" && parsed.paymentStatus === "unpaid" ? "free" : parsed.paymentStatus,
    },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "event", entityId: event.id, action: "registration_create", changes: { name: data.name } });
  revalidate(event.id);
}

export async function updateRegistration(id: string, input: unknown) {
  const user = await requirePermission("event", "edit");
  const existing = await prisma.eventRegistration.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Přihláška nenalezena.");
  const parsed = onlyProvided(registrationSchema.partial().parse(input), input);
  await prisma.eventRegistration.update({ where: { id }, data: await registrationData(user.tenantId, parsed) });
  revalidate(existing.eventId);
}

export async function deleteRegistration(id: string) {
  const user = await requirePermission("event", "edit");
  const existing = await prisma.eventRegistration.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Přihláška nenalezena.");
  await prisma.eventRegistration.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "event", entityId: existing.eventId, action: "registration_delete", changes: { name: existing.name } });
  revalidate(existing.eventId);
}
