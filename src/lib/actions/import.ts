"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";
import type { ImportEntity } from "@/lib/import-config";
import { splitName } from "@/lib/club-export";

export type ImportRow = Record<string, string>;
export type ImportResult = { created: number; skipped: number; linked?: number; errors: { row: number; reason: string }[] };

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export async function bulkImport(entity: ImportEntity, rows: ImportRow[]): Promise<ImportResult> {
  const resource = entity === "company" ? "company" : entity === "contact" ? "contact" : entity === "lead" ? "lead" : "product";
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
    lead: "/crm/leads",
    product: "/crm/products",
  };
  revalidatePath(revalidateMap[entity]);

  return result;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

// Contacts: one row = one person, optionally tied to a club and a team. The same
// person appearing on several rows (e.g. contact for 5 teams) becomes ONE contact
// linked to all of them — matched by e-mail anywhere in the CRM, else by name
// within the club.
async function importContacts(user: { id: string; tenantId: string }, rows: ImportRow[], result: ImportResult) {
  const tenantId = user.tenantId;
  result.linked = 0;

  // Clubs referenced by this chunk (by id or case-insensitive name).
  const ids = [...new Set(rows.map((r) => r.companyId?.trim()).filter(Boolean))] as string[];
  const names = [...new Set(rows.map((r) => r.companyName?.trim()).filter(Boolean))] as string[];
  const companies = ids.length || names.length
    ? await prisma.company.findMany({
        where: { tenantId, OR: [{ id: { in: ids } }, ...names.map((n) => ({ name: { equals: n, mode: "insensitive" as const } }))] },
        select: { id: true, name: true },
      })
    : [];
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const companyByName = new Map(companies.map((c) => [norm(c.name), c]));
  const companyIds = companies.map((c) => c.id);

  const teams = companyIds.length
    ? await prisma.clubTeam.findMany({ where: { tenantId, companyId: { in: companyIds } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    : [];

  const emails = [...new Set(rows.flatMap((r) => [r.email, r.p2Email, r.p3Email]).map(norm).filter(Boolean))];
  const known = await prisma.contact.findMany({
    where: {
      tenantId,
      OR: [
        ...(emails.length ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
        ...(companyIds.length ? [{ companies: { some: { companyId: { in: companyIds } } } }] : []),
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, companies: { select: { companyId: true } } },
  });
  const byEmail = new Map(known.filter((c) => c.email).map((c) => [norm(c.email), c.id]));
  const byClubName = new Map<string, string>();
  for (const c of known) for (const cc of c.companies) byClubName.set(`${cc.companyId}|${norm(`${c.firstName} ${c.lastName}`)}`, c.id);
  const touched = new Set<string>();
  const usedTeams = new Set<string>();

  // Finds (by e-mail, else by name within the club) or creates one person.
  async function personId(p: { first: string; last: string; titleBefore?: string | null; titleAfter?: string | null; email?: string; phone?: string; mobile?: string; jobTitle?: string }, companyId: string | null) {
    const emailKey = norm(p.email);
    const nameKey = companyId ? `${companyId}|${norm(`${p.first} ${p.last}`)}` : null;
    let id = (emailKey && byEmail.get(emailKey)) || (nameKey && byClubName.get(nameKey)) || null;
    if (id) {
      if (!touched.has(id)) result.linked!++;
    } else {
      const created = await prisma.contact.create({
        data: {
          tenantId,
          firstName: p.first,
          lastName: p.last,
          titleBefore: p.titleBefore ?? undefined,
          titleAfter: p.titleAfter ?? undefined,
          email: p.email?.trim() || undefined,
          phone: p.phone?.trim() || undefined,
          mobile: p.mobile?.trim() || undefined,
          jobTitle: p.jobTitle?.trim() || undefined,
          source: "Import",
          ownerId: user.id,
        },
      });
      id = created.id;
      result.created++;
    }
    touched.add(id);
    if (emailKey) byEmail.set(emailKey, id);
    if (nameKey) byClubName.set(nameKey, id);
    return id;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const split = r.fullName?.trim() ? splitName(r.fullName) : null;
    const firstName = r.firstName?.trim() || split?.firstName;
    const lastName = r.lastName?.trim() || split?.lastName;
    const extras = (["p2", "p3"] as const)
      .filter((n) => r[`${n}Name`]?.trim())
      .map((n) => ({ ...splitName(r[`${n}Name`]), email: r[`${n}Email`], phone: r[`${n}Phone`], role: r[`${n}Role`]?.trim() || null }));
    if ((!firstName || !lastName) && extras.length === 0) {
      result.skipped++;
      result.errors.push({ row: i + 1, reason: "Chybí jméno (Celé jméno, nebo Jméno + Příjmení)." });
      continue;
    }

    const company = (r.companyId?.trim() && companyById.get(r.companyId.trim())) || (r.companyName?.trim() && companyByName.get(norm(r.companyName))) || null;
    if ((r.companyId?.trim() || r.companyName?.trim()) && !company) {
      result.errors.push({ row: i + 1, reason: `Klub „${r.companyName || r.companyId}“ nenalezen — kontakt založen bez klubu.` });
    }

    // Extra people (secretary, chairman…) belong to the club, not to a team.
    for (const x of extras) {
      const id = await personId({ first: x.firstName, last: x.lastName, titleBefore: x.titleBefore, titleAfter: x.titleAfter, email: x.email, phone: x.phone, jobTitle: x.role ?? undefined }, company?.id ?? null);
      if (company) {
        await prisma.companyContact.createMany({
          data: [{ companyId: company.id, contactId: id, role: x.role, isPrimary: !!x.role && /sekret/i.test(x.role) }],
          skipDuplicates: true,
        });
      }
    }
    if (!firstName || !lastName) continue;

    const contactId = await personId(
      { first: firstName, last: lastName, titleBefore: split?.titleBefore, titleAfter: split?.titleAfter, email: r.email, phone: r.phone, mobile: r.mobile, jobTitle: r.jobTitle?.trim() || r.role?.trim() },
      company?.id ?? null,
    );

    if (!company) continue;

    // Team: match by category (+ competition / name), create it if the club doesn't have it yet.
    let teamId: string | null = null;
    const category = r.teamCategory?.trim();
    if (category) {
      const pool = teams.filter((t) => t.companyId === company.id && t.category === category);
      const league = norm(r.teamLeague);
      const teamName = norm(r.teamName);
      const base = (l: string | null) => norm(l).replace(/\s*-\s*skupina.*$/, "");
      // Prefer a team this import hasn't filled yet, so twin squads (same category and
      // competition, e.g. "blue" / "white") each get their own row's contact.
      const pick = (match: (t: (typeof pool)[number]) => boolean) =>
        pool.find((t) => match(t) && !usedTeams.has(t.id)) ?? pool.find(match);
      const team =
        pick((t) => (!league || norm(t.league) === league) && (!teamName || norm(t.name) === teamName)) ??
        (league ? pick((t) => base(t.league) === base(r.teamLeague)) : undefined) ??
        (!league && !teamName ? pick(() => true) : undefined);
      if (team) teamId = team.id;
      if (teamId) usedTeams.add(teamId);
      else {
        const created = await prisma.clubTeam.create({
          data: { tenantId, companyId: company.id, category, name: r.teamName?.trim() || company.name, league: r.teamLeague?.trim() || undefined },
        });
        teams.push(created);
        teamId = created.id;
        usedTeams.add(teamId);
      }
    }

    const role = r.role?.trim() || (teamId ? "Kontaktní osoba týmu" : null);
    await prisma.companyContact.createMany({ data: [{ companyId: company.id, contactId, role }], skipDuplicates: true });
    if (teamId) {
      await prisma.clubTeamContact.createMany({ data: [{ clubTeamId: teamId, contactId, role: r.role?.trim() || "Kontaktní osoba" }], skipDuplicates: true });
    }
  }
}
