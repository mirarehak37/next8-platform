"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { todayDateOnly } from "@/lib/format";
import { SEQUENCE_STEP_TYPES } from "@/lib/sequences";

const DAY = 24 * 60 * 60 * 1000;

const stepSchema = z.object({
  dayOffset: z.coerce.number().int().min(0).max(365),
  type: z.enum(SEQUENCE_STEP_TYPES.map((t) => t.value) as [string, ...string[]]),
  title: z.string().trim().min(1, "Každý krok potřebuje název"),
  body: z.string().trim().optional().nullable(),
});

const sequenceSchema = z.object({
  name: z.string().trim().min(1, "Název je povinný"),
  description: z.string().trim().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  steps: z.array(stepSchema).min(1, "Sekvence potřebuje aspoň jeden krok").max(20),
});

function revalidateSequences() {
  revalidatePath("/crm/sequences");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

async function cancelOpenTasks(tenantId: string, taskIds: string[]) {
  if (taskIds.length === 0) return 0;
  const result = await prisma.task.updateMany({
    where: { tenantId, id: { in: taskIds }, status: { in: ["open", "in_progress"] } },
    data: { status: "cancelled" },
  });
  return result.count;
}

export async function createSequence(data: unknown) {
  const user = await requirePermission("contact", "create");
  const parsed = sequenceSchema.parse(data);
  const ownerId = parsed.ownerId || user.id;
  const owner = await prisma.user.findFirst({ where: { id: ownerId, tenantId: user.tenantId }, select: { id: true } });
  if (!owner) throw new ActionError("Vlastník nenalezen.");

  const steps = [...parsed.steps].sort((a, b) => a.dayOffset - b.dayOffset);
  const sequence = await prisma.sequence.create({
    data: {
      tenantId: user.tenantId,
      name: parsed.name,
      description: parsed.description || null,
      ownerId,
      steps: {
        create: steps.map((step, order) => ({
          order,
          dayOffset: step.dayOffset,
          type: step.type,
          title: step.title,
          body: step.body || null,
        })),
      },
    },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "sequence", entityId: sequence.id, action: "create" });
  revalidateSequences();
  return { id: sequence.id };
}

export async function toggleSequence(id: string) {
  const user = await requirePermission("contact", "edit");
  const sequence = await prisma.sequence.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!sequence) throw new ActionError("Sekvence nenalezena.");
  await prisma.sequence.update({ where: { id }, data: { active: !sequence.active } });
  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entityType: "sequence",
    entityId: id,
    action: "update",
    changes: { active: !sequence.active },
  });
  revalidateSequences();
}

export async function deleteSequence(id: string) {
  const user = await requirePermission("contact", "delete");
  const sequence = await prisma.sequence.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { enrollments: { where: { status: "active" }, select: { taskIds: true } } },
  });
  if (!sequence) throw new ActionError("Sekvence nenalezena.");
  await cancelOpenTasks(
    user.tenantId,
    sequence.enrollments.flatMap((e) => e.taskIds),
  );
  await prisma.sequence.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "sequence", entityId: id, action: "delete" });
  revalidateSequences();
}

// Every step becomes a Task for the sequence owner, due enrollment day + dayOffset.
export async function enrollContacts(sequenceId: string, contactIds: string[]) {
  const user = await requirePermission("contact", "edit");
  const ids = Array.from(new Set(z.array(z.string().min(1)).max(500).parse(contactIds)));
  if (ids.length === 0) throw new ActionError("Vyberte aspoň jeden kontakt.");

  const sequence = await prisma.sequence.findFirst({
    where: { id: sequenceId, tenantId: user.tenantId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!sequence) throw new ActionError("Sekvence nenalezena.");
  if (!sequence.active) throw new ActionError("Sekvence je pozastavená. Nejdřív ji obnovte.");
  if (sequence.steps.length === 0) throw new ActionError("Sekvence nemá žádné kroky.");

  const [contacts, existing] = await Promise.all([
    prisma.contact.findMany({
      where: { tenantId: user.tenantId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.sequenceEnrollment.findMany({
      where: { sequenceId, contactId: { in: ids } },
      select: { contactId: true },
    }),
  ]);
  const already = new Set(existing.map((e) => e.contactId));
  const toEnroll = contacts.filter((c) => !already.has(c.id));
  const start = todayDateOnly();

  await prisma.$transaction(async (tx) => {
    for (const contact of toEnroll) {
      const name = `${contact.firstName} ${contact.lastName}`.trim();
      const taskIds: string[] = [];
      for (const step of sequence.steps) {
        const task = await tx.task.create({
          data: {
            tenantId: user.tenantId,
            title: `[Sekvence] ${step.title} – ${name}`,
            description: [`Sekvence „${sequence.name}“, krok ${step.order + 1} (den ${step.dayOffset}).`, step.body]
              .filter(Boolean)
              .join("\n\n"),
            assigneeId: sequence.ownerId,
            creatorId: user.id,
            dueDate: new Date(start.getTime() + step.dayOffset * DAY),
            priority: step.type === "call" ? "high" : "medium",
            status: "open",
            subjectType: "contact",
            subjectId: contact.id,
          },
          select: { id: true },
        });
        taskIds.push(task.id);
      }
      await tx.sequenceEnrollment.create({
        data: { tenantId: user.tenantId, sequenceId, contactId: contact.id, enrolledAt: start, taskIds },
      });
    }
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entityType: "sequence",
    entityId: sequenceId,
    action: "enroll",
    changes: { contactIds: toEnroll.map((c) => c.id) },
  });
  revalidateSequences();
  return { enrolled: toEnroll.length, skipped: ids.length - toEnroll.length };
}

export async function setEnrollmentStatus(enrollmentId: string, status: "replied" | "stopped") {
  const user = await requirePermission("contact", "edit");
  z.enum(["replied", "stopped"]).parse(status);
  const enrollment = await prisma.sequenceEnrollment.findFirst({ where: { id: enrollmentId, tenantId: user.tenantId } });
  if (!enrollment) throw new ActionError("Zápis nenalezen.");
  if (enrollment.status !== "active") throw new ActionError("Kontakt už v sekvenci neběží.");

  const cancelled = await cancelOpenTasks(user.tenantId, enrollment.taskIds);
  await prisma.sequenceEnrollment.update({ where: { id: enrollmentId }, data: { status, endedAt: new Date() } });
  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entityType: "sequence",
    entityId: enrollment.sequenceId,
    action: "status_change",
    changes: { enrollmentId, status, cancelledTasks: cancelled },
  });
  revalidateSequences();
  return { cancelled };
}
