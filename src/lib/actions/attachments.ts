"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";
import { ATTACHMENT_ENTITIES, MAX_ATTACHMENT_BYTES, type AttachmentEntityType } from "@/lib/attachments";

async function assertEntity(tenantId: string, entityType: AttachmentEntityType, entityId: string) {
  const exists =
    entityType === "ambassador"
      ? await prisma.ambassador.findFirst({ where: { id: entityId, tenantId }, select: { id: true } })
      : await prisma.partner.findFirst({ where: { id: entityId, tenantId }, select: { id: true } });
  if (!exists) throw new ActionError("Záznam nenalezen.");
}

export async function uploadAttachment(formData: FormData) {
  const entityType = String(formData.get("entityType") ?? "") as AttachmentEntityType;
  const entityId = String(formData.get("entityId") ?? "");
  const category = String(formData.get("category") ?? "") || null;
  const file = formData.get("file");

  const entity = ATTACHMENT_ENTITIES[entityType];
  if (!entity) throw new ActionError("Nepodporovaný typ záznamu.");
  const user = await requirePermission(entity.resource, "edit");
  await assertEntity(user.tenantId, entityType, entityId);

  if (!(file instanceof File) || file.size === 0) throw new ActionError("Vyberte soubor.");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new ActionError("Soubor je příliš velký (max. 4 MB).");

  const bytes = Buffer.from(await file.arrayBuffer());
  const attachment = await prisma.attachment.create({
    data: {
      tenantId: user.tenantId,
      entityType,
      entityId,
      fileName: file.name,
      fileUrl: "",
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      category,
      uploadedById: user.id,
      content: { create: { data: bytes } },
    },
  });
  await prisma.attachment.update({ where: { id: attachment.id }, data: { fileUrl: `/api/attachments/${attachment.id}` } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType, entityId, action: "attachment_create", changes: { fileName: file.name } });
  revalidatePath(`${entity.path}/${entityId}`);
}

export async function deleteAttachment(id: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  const entity = attachment && ATTACHMENT_ENTITIES[attachment.entityType as AttachmentEntityType];
  if (!attachment || !entity) throw new ActionError("Příloha nenalezena.");
  const user = await requirePermission(entity.resource, "edit");
  if (attachment.tenantId !== user.tenantId) throw new ActionError("Příloha nenalezena.");

  await prisma.attachment.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: attachment.entityType, entityId: attachment.entityId, action: "attachment_delete", changes: { fileName: attachment.fileName } });
  revalidatePath(`${entity.path}/${attachment.entityId}`);
}
