import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ATTACHMENT_ENTITIES, type AttachmentEntityType } from "@/lib/attachments";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new Response("Nepřihlášeno.", { status: 401 });

  const attachment = await prisma.attachment.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { content: true },
  });
  const entity = attachment && ATTACHMENT_ENTITIES[attachment.entityType as AttachmentEntityType];
  if (!attachment?.content || !entity || !can(session.user.role, entity.resource, "view")) {
    return new Response("Příloha nenalezena.", { status: 404 });
  }

  // Inline for types the browser can preview safely (PDF, images); everything else downloads.
  const inline = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/.test(attachment.mimeType);
  const download = new URL(request.url).searchParams.has("download");
  const disposition = inline && !download ? "inline" : "attachment";

  return new Response(new Uint8Array(attachment.content.data), {
    headers: {
      "Content-Type": inline ? attachment.mimeType : "application/octet-stream",
      "Content-Length": String(attachment.content.data.length),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
