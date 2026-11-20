"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { appSyncConfigured, runAppSync } from "@/lib/app-sync";

export async function syncAppNow() {
  const user = await requirePermission("contact", "create");
  if (!appSyncConfigured()) throw new ActionError("Napojení na aplikaci není nastavené (chybí APP_DB_URL ve Vercelu).");
  const run = await runAppSync({ tenantId: user.tenantId, ownerId: user.id }, "manual");
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "appSync", entityId: run.id, action: "sync", changes: { users: run.users, created: run.created, updated: run.updated } });
  revalidatePath("/crm/contacts", "layout");
  revalidatePath("/reports/app");
  return { users: run.users ?? 0, created: run.created ?? 0, updated: run.updated ?? 0 };
}
