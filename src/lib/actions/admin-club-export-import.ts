"use server";

import { z } from "zod";
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, ActionError, logAudit } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";
import { clubExportSchema, splitName, type ClubExportPerson } from "@/lib/club-export";
import { PositionCollector } from "@/lib/contact-positions";

const SOURCE = "Import – Český florbal (kontakty)";

export type ClubExportResult = {
  clubsUpdated: number;
  clubsCreated: number;
  contactsCreated: number;
  contactsMatched: number;
  clubLinks: number;
  teamLinks: number;
  teamsCreated: number;
  positionsUpdated: number;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Imports one batch of clubs from the club/team/contact export. Idempotent:
// clubs are matched by id then name, people by e-mail (else by name within the
// club), teams by category + competition — re-running creates no duplicates and
// never overwrites data already filled in by hand.
export async function importClubExportBatch(input: unknown): Promise<ClubExportResult> {
  const user = await requireSession();
  if (user.role !== "Administrator") throw new ActionError("Tuto akci může spustit jen administrátor.");
  const clubs = z.array(clubExportSchema).max(100).parse(input);
  const tenantId = user.tenantId;
  const result: ClubExportResult = { clubsUpdated: 0, clubsCreated: 0, contactsCreated: 0, contactsMatched: 0, clubLinks: 0, teamLinks: 0, teamsCreated: 0, positionsUpdated: 0 };

  // --- Clubs
  const existing = await prisma.company.findMany({
    where: {
      tenantId,
      OR: [{ id: { in: clubs.map((c) => c.id).filter((x): x is string => !!x) } }, { name: { in: clubs.map((c) => c.name) } }],
    },
  });
  const byId = new Map(existing.map((c) => [c.id, c]));
  const byName = new Map(existing.map((c) => [norm(c.name), c]));

  const companyIdFor = new Map<string, string>(); // club name → company id
  const ownerFor = new Map<string, string>(); // company id → owner (new contacts inherit it)
  const updates: Promise<unknown>[] = [];
  for (const club of clubs) {
    let company = (club.id && byId.get(club.id)) || byName.get(norm(club.name));
    if (!company) {
      company = await prisma.company.create({
        data: {
          tenantId, name: club.name, sport: "Florbal", status: "prospect", source: SOURCE, ownerId: user.id,
          billingCity: club.city, billingStreet: club.street, billingZip: club.zip, employeeCount: club.members,
        },
      });
      result.clubsCreated++;
    } else {
      // Only fill gaps — never overwrite what someone already edited.
      const patch = {
        ...(!company.billingStreet && club.street && { billingStreet: club.street }),
        ...(!company.billingCity && club.city && { billingCity: club.city }),
        ...(!company.billingZip && club.zip && { billingZip: club.zip }),
        ...(company.employeeCount == null && club.members != null && { employeeCount: club.members }),
      };
      if (Object.keys(patch).length) {
        updates.push(prisma.company.update({ where: { id: company.id }, data: patch }));
        result.clubsUpdated++;
      }
    }
    companyIdFor.set(club.name, company.id);
    ownerFor.set(company.id, company.ownerId);
  }
  await Promise.all(updates);
  const companyIds = [...new Set(companyIdFor.values())];

  // --- People: reuse contacts by e-mail anywhere in the tenant, else by name within the club.
  const people: ClubExportPerson[] = clubs.flatMap((c) => [c.secretary, c.chairman, ...c.teams.map((t) => t.contact)]).filter((p): p is ClubExportPerson => !!p);
  const emails = [...new Set(people.map((p) => norm(p.email)).filter(Boolean))];
  const knownContacts = await prisma.contact.findMany({
    where: {
      tenantId,
      OR: [
        { email: { in: emails, mode: "insensitive" } },
        { companies: { some: { companyId: { in: companyIds } } } },
        { clubTeams: { some: { clubTeam: { companyId: { in: companyIds } } } } },
      ],
    },
    include: { companies: { select: { companyId: true } }, clubTeams: { select: { clubTeam: { select: { companyId: true } } } } },
  });
  const contactByEmail = new Map(knownContacts.filter((c) => c.email).map((c) => [norm(c.email), c.id]));
  const contactByClubName = new Map<string, string>();
  for (const c of knownContacts) {
    const clubIds = [...c.companies.map((x) => x.companyId), ...c.clubTeams.map((x) => x.clubTeam.companyId)];
    for (const id of clubIds) contactByClubName.set(`${id}|${norm(`${c.firstName} ${c.lastName}`)}`, c.id);
  }

  const seen = new Set<string>();
  const positions = new PositionCollector();
  const newContacts: Prisma.ContactCreateManyInput[] = [];
  function contactFor(p: ClubExportPerson, companyId: string, jobTitle: string) {
    const id = findOrCreate(p, companyId);
    positions.add(id, jobTitle);
    return id;
  }
  function findOrCreate(p: ClubExportPerson, companyId: string) {
    const emailKey = norm(p.email);
    const { firstName, lastName, titleBefore, titleAfter } = splitName(p.name);
    const nameKey = `${companyId}|${norm(`${firstName} ${lastName}`)}`;
    const found = (emailKey && contactByEmail.get(emailKey)) || contactByClubName.get(nameKey);
    if (found) {
      if (!seen.has(found)) { seen.add(found); result.contactsMatched++; }
      contactByClubName.set(nameKey, found);
      return found;
    }
    // Queued and inserted in one go below (a query per person is slow on Vercel).
    const id = randomUUID();
    newContacts.push({
      id, tenantId, firstName, lastName, titleBefore, titleAfter, email: p.email, phone: p.phone,
      source: SOURCE, ownerId: ownerFor.get(companyId) ?? user.id,
    });
    seen.add(id);
    result.contactsCreated++;
    if (emailKey) contactByEmail.set(emailKey, id);
    contactByClubName.set(nameKey, id);
    return id;
  }

  // --- Teams of these clubs, for matching rows to existing squads.
  const teams = await prisma.clubTeam.findMany({ where: { tenantId, companyId: { in: companyIds } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

  const clubLinks: { companyId: string; contactId: string; role: string; isPrimary: boolean }[] = [];
  const teamLinks: { clubTeamId: string; contactId: string; role: string }[] = [];

  for (const club of clubs) {
    const companyId = companyIdFor.get(club.name)!;
    if (club.secretary) clubLinks.push({ companyId, contactId: contactFor(club.secretary, companyId, "Sekretář klubu"), role: "Sekretář klubu", isPrimary: true });
    if (club.chairman) clubLinks.push({ companyId, contactId: contactFor(club.chairman, companyId, "Předseda klubu"), role: "Předseda klubu", isPrimary: false });

    // Pair each row with an unused team: exact category + competition, then the
    // same competition ignoring "- skupina N", then just the category.
    const pool = teams.filter((t) => t.companyId === companyId);
    const used = new Set<string>();
    const base = (l: string | null) => norm(l).replace(/\s*-\s*skupina.*$/, "");
    for (const row of club.teams) {
      const pick =
        pool.find((t) => !used.has(t.id) && t.category === row.category && norm(t.league) === norm(row.league)) ??
        pool.find((t) => !used.has(t.id) && t.category === row.category && base(t.league) === base(row.league)) ??
        pool.find((t) => !used.has(t.id) && t.category === row.category);
      // The original directory scrape garbled a few clubs' categories ("muži (FBC Trutnov"),
      // so repair such a team in place rather than adding a duplicate.
      const garbled = pick
        ? undefined
        : pool.find((t) => !used.has(t.id) && t.category.startsWith(`${row.category} (`) && norm(t.league) === norm(row.league));
      if (garbled) {
        await prisma.clubTeam.update({ where: { id: garbled.id }, data: { category: row.category, name: club.name } });
        garbled.category = row.category;
      }
      let teamId = pick?.id ?? garbled?.id;
      if (!teamId) {
        const created = await prisma.clubTeam.create({ data: { tenantId, companyId, category: row.category, name: club.name, league: row.league } });
        pool.push(created);
        teamId = created.id;
        result.teamsCreated++;
      }
      used.add(teamId);
      if (row.contact) {
        const contactId = contactFor(row.contact, companyId, "Kontaktní osoba týmu");
        teamLinks.push({ clubTeamId: teamId, contactId, role: "Kontaktní osoba" });
        clubLinks.push({ companyId, contactId, role: "Kontaktní osoba týmu", isPrimary: false });
      }
    }
  }

  // The first role wins per person+club (secretary/chairman are listed first):
  // reversed, so the earliest entry is the one a Map keeps.
  const dedupClub = [...new Map([...clubLinks].reverse().map((l) => [`${l.companyId}|${l.contactId}`, l])).values()];
  if (newContacts.length) await prisma.contact.createMany({ data: newContacts });
  const clubRes = await prisma.companyContact.createMany({ data: dedupClub, skipDuplicates: true });
  const teamRes = await prisma.clubTeamContact.createMany({ data: teamLinks, skipDuplicates: true });
  result.clubLinks = clubRes.count;
  result.teamLinks = teamRes.count;
  result.positionsUpdated = await positions.apply(tenantId);
  return result;
}

export async function finishClubExportImport(totals: ClubExportResult) {
  const user = await requireSession();
  if (user.role !== "Administrator") throw new ActionError("Tuto akci může spustit jen administrátor.");
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "company", entityId: "bulk-import", action: "update", changes: { source: "club-contacts-export", ...totals } });
  revalidatePath("/crm/companies");
  revalidatePath("/crm/contacts");
}
