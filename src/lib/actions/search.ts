"use server";

import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireSession } from "@/lib/actions/helpers";

export type QuickSearchResult = {
  group: string;
  id: string;
  label: string;
  hint?: string;
  href: string;
};

export async function quickSearch(raw: string): Promise<QuickSearchResult[]> {
  const user = await requireSession();
  const q = raw.trim();
  if (q.length < 2) return [];

  const contains = { contains: q, mode: "insensitive" as const };
  const tenantId = user.tenantId;
  const allowed = (resource: Parameters<typeof can>[1]) => can(user.role, resource, "view");

  const [companies, contacts, deals, leads] = await Promise.all([
    allowed("company")
      ? prisma.company.findMany({ where: { tenantId, name: contains }, select: { id: true, name: true, league: true }, take: 6 })
      : [],
    allowed("contact")
      ? prisma.contact.findMany({
          where: { tenantId, OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] },
          select: { id: true, firstName: true, lastName: true, jobTitle: true },
          take: 6,
        })
      : [],
    allowed("deal")
      ? prisma.deal.findMany({
          where: { tenantId, name: contains },
          select: { id: true, name: true, company: { select: { name: true } } },
          take: 6,
        })
      : [],
    allowed("lead")
      ? prisma.lead.findMany({
          where: { tenantId, OR: [{ firstName: contains }, { lastName: contains }, { companyName: contains }] },
          select: { id: true, firstName: true, lastName: true, companyName: true },
          take: 4,
        })
      : [],
  ]);

  return [
    ...companies.map((c) => ({ group: "Kluby", id: c.id, label: c.name, hint: c.league ?? undefined, href: `/crm/companies/${c.id}` })),
    ...contacts.map((c) => ({
      group: "Kontakty",
      id: c.id,
      label: `${c.firstName} ${c.lastName}`,
      hint: c.jobTitle ?? undefined,
      href: `/crm/contacts/${c.id}`,
    })),
    ...deals.map((d) => ({ group: "Obchodní případy", id: d.id, label: d.name, hint: d.company?.name, href: `/crm/deals/${d.id}` })),
    ...leads.map((l) => ({
      group: "Leady",
      id: l.id,
      label: `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || l.companyName || "Lead",
      hint: l.companyName ?? undefined,
      href: `/crm/leads`,
    })),
  ];
}
