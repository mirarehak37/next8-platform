import { revalidatePath } from "next/cache";
import { appSyncConfigured, resolveSyncContext, runAppSync } from "@/lib/app-sync";

// Nightly NEXT8 app → CRM sync, called by Vercel Cron (vercel.json) with
// "Authorization: Bearer $CRON_SECRET". /api is outside the login proxy, so the
// secret is the only gate — without CRON_SECRET set, the endpoint refuses.
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!appSyncConfigured()) return Response.json({ skipped: "APP_DB_URL není nastavená" });

  try {
    const run = await runAppSync(await resolveSyncContext(), "cron");
    revalidatePath("/crm/contacts", "layout");
    revalidatePath("/reports/app");
    return Response.json({ ok: true, users: run.users, created: run.created, updated: run.updated });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
