import type { ModuleResource } from "@/lib/rbac";

// Record types that accept file attachments, with the RBAC resource guarding them
// and the detail-page base path to revalidate after a change.
export const ATTACHMENT_ENTITIES = {
  ambassador: { resource: "ambassador", path: "/crm/ambassadors" },
  partner: { resource: "partner", path: "/crm/partners" },
} satisfies Record<string, { resource: ModuleResource; path: string }>;

export type AttachmentEntityType = keyof typeof ATTACHMENT_ENTITIES;

// Vercel caps a function request body at 4.5 MB; keep uploads comfortably under it.
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
