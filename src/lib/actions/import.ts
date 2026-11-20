"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";
import type { ImportEntity } from "@/lib/import-config";
import { importAppUserRows, importContacts, type ImportResult, type ImportRow } from "@/lib/contact-import";

export type { ImportResult, ImportRow };

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export async function bulkImport(entity: ImportEntity, rows: ImportRow[]): Promise<ImportResult> {
  const resource =
    entity === "company" ? "company" : entity === "contact" || entity === "appUser" ? "contact" : entity === "lead" ? "lead" : "product";
  const user = await requirePermission(resource, "create");

  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  if (entity === "company") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.name?.trim()) {
        result.skipped++;
        result.errors.push({ row: i + 1, reason: "Chybí povinné pole „Název klubu“." });
        continue;
      }
      await prisma.company.create({
        data: {
          tenantId: user.tenantId,
          name: r.name.trim(),
          registrationNumber: r.registrationNumber || undefined,
          vatNumber: r.vatNumber || undefined,
          industry: r.industry || undefined,
          sport: r.sport || undefined,
          league: r.league || undefined,
          segment: r.segment || undefined,
          website: r.website || undefined,
          phone: r.phone || undefined,
          email: r.email || undefined,
          billingCity: r.billingCity || undefined,
          source: r.source || "Import",
          ownerId: user.id,
        },
      });
      result.created++;
    }
  }

  if (entity === "contact") {
    await importContacts(user, rows, result);
  }

  if (entity === "appUser") {
    await importAppUserRows(user, rows, result);
  }

  if (entity === "lead") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.lastName?.trim() && !r.companyName?.trim()) {
        result.skipped++;
        result.errors.push({ row: i + 1, reason: "Chybí příjmení i název klubu — lead nelze pojmenovat." });
        continue;
      }
      await prisma.lead.create({
        data: {
          tenantId: user.tenantId,
          firstName: r.firstName || undefined,
          lastName: r.lastName || undefined,
          companyName: r.companyName || undefined,
          email: r.email || undefined,
          phone: r.phone || undefined,
          source: r.source || "Import",
          estimatedValue: num(r.estimatedValue),
          ownerId: user.id,
        },
      });
      result.created++;
    }
  }

  if (entity === "product") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.name?.trim()) {
        result.skipped++;
        result.errors.push({ row: i + 1, reason: "Chybí povinné pole „Název“." });
        continue;
      }
      await prisma.product.create({
        data: {
          tenantId: user.tenantId,
          name: r.name.trim(),
          code: r.code || undefined,
          category: r.category || undefined,
          price: num(r.price) ?? 0,
          vatRate: num(r.vatRate) ?? 21,
          unit: r.unit || "ks",
        },
      });
      result.created++;
    }
  }

  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: `import_${entity}`, entityId: "bulk", action: "create", changes: { created: result.created, skipped: result.skipped } });

  const revalidateMap: Record<ImportEntity, string> = {
    company: "/crm/companies",
    contact: "/crm/contacts",
    appUser: "/crm/contacts",
    lead: "/crm/leads",
    product: "/crm/products",
  };
  revalidatePath(revalidateMap[entity]);

  return result;
}
