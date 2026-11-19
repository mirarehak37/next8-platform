"use server";

import { randomUUID } from "crypto";
import type { ClubTeam, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";
import type { ImportEntity } from "@/lib/import-config";
import { splitName } from "@/lib/club-export";
import { PositionCollector } from "@/lib/contact-positions";
import { tagGroup } from "@/lib/tag-groups";

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

function splitTags(v: string | undefined) {
  return (v ?? "")
    .split(/[,;]/)
    .map((t) => t.trim().replace(/\s+/g, " ").slice(0, 60))
    .filter(Boolean);
}

function parseYesNo(v: string | undefined): boolean | undefined {
  const s = norm(v);
  if (!s) return undefined;
  if (["ano", "yes", "true", "1", "y", "a"].includes(s)) return true;
  if (["ne", "no", "false", "0", "n"].includes(s)) return false;
  return undefined;
}

// Tags (created on first use) and, for contacts that already existed, consent + source.
async function applyContactExtras(
  tenantId: string,
  extras: Map<string, { tags: string[]; consent?: boolean; source?: string }>,
  newIds: Set<string>,
) {
  const tagNames = [...new Set([...extras.values()].flatMap((m) => m.tags))];
  if (tagNames.length) {
    await prisma.tag.createMany({ data: tagNames.map((name) => ({ tenantId, name })), skipDuplicates: true });
    const tags = await prisma.tag.findMany({ where: { tenantId, name: { in: tagNames } }, select: { id: true, name: true } });
    const tagId = new Map(tags.map((t) => [t.name, t.id]));
    const links = [...extras.entries()].flatMap(([entityId, m]) =>
      [...new Set(m.tags)].map((name) => ({ tagId: tagId.get(name)!, entityType: "contact", entityId })),
    );
    if (links.length) await prisma.taggedItem.createMany({ data: links, skipDuplicates: true });

    // Re-import = refresh: a row with tags is the full current state of the contact's
    // grouped tags ("Aktivita: …", "Tým: …", consent pair) — older grouped tags that the
    // row no longer has are removed (left a team, went quiet…). Plain tags are left alone.
    const refreshed = [...extras.entries()].filter(([id, m]) => !newIds.has(id) && m.tags.length > 0);
    if (refreshed.length) {
      const current = await prisma.taggedItem.findMany({
        where: { entityType: "contact", entityId: { in: refreshed.map(([id]) => id) }, tag: { tenantId } },
        select: { id: true, entityId: true, tag: { select: { name: true } } },
      });
      const keep = new Map(refreshed.map(([id, m]) => [id, new Set(m.tags)]));
      const stale = current.filter((t) => tagGroup(t.tag.name) && !keep.get(t.entityId)?.has(t.tag.name)).map((t) => t.id);
      if (stale.length) await prisma.taggedItem.deleteMany({ where: { id: { in: stale } } });
    }
  }

  const existing = [...extras.entries()].filter(([id]) => !newIds.has(id));
  for (const consent of [true, false]) {
    const ids = existing.filter(([, m]) => m.consent === consent).map(([id]) => id);
    if (ids.length) await prisma.contact.updateMany({ where: { tenantId, id: { in: ids } }, data: { marketingConsent: consent } });
  }
}

// Contacts: one row = one person (+ up to two extra people of the same club),
// optionally tied to a club and a team. The same person appearing on several rows
// (e.g. contact for 5 teams) becomes ONE contact linked to all of them — matched by
// e-mail anywhere in the CRM, else by name within the club.
//
// Everything is resolved in memory first and written with a handful of bulk
// queries: on Vercel every query is a network round trip to the database, so
// per-row inserts made a 3 000-row file take minutes and hit the time limit.
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

  const [teams, known] = await Promise.all([
    companyIds.length
      ? prisma.clubTeam.findMany({ where: { tenantId, companyId: { in: companyIds } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
      : Promise.resolve([] as ClubTeam[]),
    (() => {
      const emails = [...new Set(rows.flatMap((r) => [r.email, r.p2Email, r.p3Email]).map(norm).filter(Boolean))];
      const or = [
        ...(emails.length ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
        ...(companyIds.length ? [{ companies: { some: { companyId: { in: companyIds } } } }] : []),
      ];
      return or.length
        ? prisma.contact.findMany({ where: { tenantId, OR: or }, select: { id: true, firstName: true, lastName: true, email: true, companies: { select: { companyId: true } } } })
        : Promise.resolve([]);
    })(),
  ]);
  const byEmail = new Map(known.filter((c) => c.email).map((c) => [norm(c.email), c.id]));
  const byClubName = new Map<string, string>();
  for (const c of known) for (const cc of c.companies) byClubName.set(`${cc.companyId}|${norm(`${c.firstName} ${c.lastName}`)}`, c.id);

  const touched = new Set<string>();
  const usedTeams = new Set<string>();
  const positions = new PositionCollector();
  const newContacts: Prisma.ContactCreateManyInput[] = [];
  const newTeams: Prisma.ClubTeamCreateManyInput[] = [];
  const clubLinks: Prisma.CompanyContactCreateManyInput[] = [];
  const teamLinks: Prisma.ClubTeamContactCreateManyInput[] = [];
  // Tags, consent and source belong to the row's main person.
  const extrasById = new Map<string, { tags: string[]; consent?: boolean; source?: string }>();

  // Finds (by e-mail, else by name within the club) or queues one new person.
  function personId(p: { first: string; last: string; titleBefore?: string | null; titleAfter?: string | null; email?: string; phone?: string; mobile?: string }, companyId: string | null) {
    const emailKey = norm(p.email);
    const nameKey = companyId ? `${companyId}|${norm(`${p.first} ${p.last}`)}` : null;
    let id = (emailKey && byEmail.get(emailKey)) || (nameKey && byClubName.get(nameKey)) || null;
    if (id) {
      if (!touched.has(id)) result.linked!++;
    } else {
      id = randomUUID();
      newContacts.push({
        id,
        tenantId,
        firstName: p.first,
        lastName: p.last,
        titleBefore: p.titleBefore ?? undefined,
        titleAfter: p.titleAfter ?? undefined,
        email: p.email?.trim() || undefined,
        phone: p.phone?.trim() || undefined,
        mobile: p.mobile?.trim() || undefined,
        source: "Import",
        ownerId: user.id,
      });
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
      const id = personId({ first: x.firstName, last: x.lastName, titleBefore: x.titleBefore, titleAfter: x.titleAfter, email: x.email, phone: x.phone }, company?.id ?? null);
      positions.add(id, x.role);
      if (company) clubLinks.push({ companyId: company.id, contactId: id, role: x.role, isPrimary: !!x.role && /sekret/i.test(x.role) });
    }
    if (!firstName || !lastName) continue;

    const contactId = personId(
      { first: firstName, last: lastName, titleBefore: split?.titleBefore, titleAfter: split?.titleAfter, email: r.email, phone: r.phone, mobile: r.mobile },
      company?.id ?? null,
    );
    // Position: explicit Pozice column, else the role, else "team contact" for team rows.
    positions.add(contactId, r.jobTitle?.trim() || r.role?.trim() || (company && r.teamCategory?.trim() ? "Kontaktní osoba týmu" : null));
    const meta = extrasById.get(contactId) ?? { tags: [] };
    meta.tags.push(...splitTags(r.tags));
    const consent = parseYesNo(r.marketingConsent);
    if (consent !== undefined) meta.consent = consent;
    if (r.source?.trim()) meta.source = r.source.trim().slice(0, 100);
    extrasById.set(contactId, meta);
    if (!company) continue;

    // Team: match by category (+ competition / name); queue it if the club doesn't have it.
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
      else {
        const created = {
          id: randomUUID(), tenantId, companyId: company.id, category,
          name: r.teamName?.trim() || company.name, league: r.teamLeague?.trim() || null,
          externalId: null, createdAt: new Date(), updatedAt: new Date(),
        };
        newTeams.push(created);
        teams.push(created);
        teamId = created.id;
      }
      usedTeams.add(teamId);
    }

    clubLinks.push({ companyId: company.id, contactId, role: r.role?.trim() || (teamId ? "Kontaktní osoba týmu" : null) });
    if (teamId) teamLinks.push({ clubTeamId: teamId, contactId, role: r.role?.trim() || "Kontaktní osoba" });
  }

  // New people get consent/source straight in the insert; known ones are updated below.
  const newIds = new Set(newContacts.map((c) => c.id!));
  for (const c of newContacts) {
    const meta = extrasById.get(c.id!);
    if (meta?.consent !== undefined) c.marketingConsent = meta.consent;
    if (meta?.source) c.source = meta.source;
  }

  // Bulk writes — parents before the links that reference them.
  if (newContacts.length) await prisma.contact.createMany({ data: newContacts });
  await applyContactExtras(tenantId, extrasById, newIds);
  if (newTeams.length) await prisma.clubTeam.createMany({ data: newTeams });
  // First role wins per person + club (a Map keeps the last, so feed it reversed).
  const club = [...new Map([...clubLinks].reverse().map((l) => [`${l.companyId}|${l.contactId}`, l])).values()];
  if (club.length) await prisma.companyContact.createMany({ data: club, skipDuplicates: true });
  if (teamLinks.length) await prisma.clubTeamContact.createMany({ data: teamLinks, skipDuplicates: true });
  await positions.apply(tenantId);
}
