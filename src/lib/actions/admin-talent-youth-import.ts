"use server";

import { prisma } from "@/lib/prisma";
import { requireSession, ActionError, logAudit } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";

const ORG_NAME = "Výběry talentované mládeže";

// Regional talent-development squads (not a club) — head coaches for
// 2026/2027, as supplied directly by the user (not scraped).
const TALENT_TEAMS = [
  { category: "BU17", region: "západ", years: "2010", firstName: "Antonín", lastName: "Palatinus", phone: "723 725 809", email: "palatinus@florbalmladez.cz" },
  { category: "BU17", region: "východ", years: "2010", firstName: "Lukáš", lastName: "Paták", phone: "737 013 792", email: "patak@florbalmladez.cz" },
  { category: "BU16", region: "západ", years: "2011", firstName: "Daniel", lastName: "Tichý", phone: "776 489 819", email: "tichy@florbalmladez.cz" },
  { category: "BU16", region: "východ", years: "2011", firstName: "Dominik", lastName: "Gorný", phone: "603 934 688", email: "gorny@florbalmladez.cz" },
  { category: "BU15", region: "západ", years: "2012", firstName: "Michal", lastName: "Hanzlík", phone: "734 538 643", email: "hanzlik@florbalmladez.cz" },
  { category: "BU15", region: "východ", years: "2012", firstName: "Tomáš", lastName: "Hruška", phone: "733 200 533", email: "hruska@florbalmladez.cz" },
  { category: "BU14", region: "západ", years: "2013", firstName: "Martin", lastName: "Severa", phone: "733 129 662", email: "severa@florbalmladez.cz" },
  { category: "BU14", region: "východ", years: "2013", firstName: "Tomáš", lastName: "Pokorný", phone: "604 898 770", email: "pokorny@florbalmladez.cz" },
  { category: "GU17", region: "západ", years: "2010–2011", firstName: "Michaela", lastName: "Marešová", phone: "774 853 400", email: "maresova@florbalmladez.cz" },
  { category: "GU17", region: "východ", years: "2010–2011", firstName: "Michaela", lastName: "Marešová", phone: "774 853 400", email: "maresova@florbalmladez.cz" },
  { category: "GU15", region: "západ", years: "2012–2013", firstName: "Michal", lastName: "Vojáček", phone: "605 482 687", email: "vojacek@florbalmladez.cz" },
  { category: "GU15", region: "východ", years: "2012–2013", firstName: "Michal", lastName: "Vojáček", phone: "605 482 687", email: "vojacek@florbalmladez.cz" },
] as const;

export async function importTalentYouth() {
  const user = await requireSession();
  if (user.role !== "Administrator") {
    throw new ActionError("Tuto akci může spustit jen administrátor.");
  }

  const existing = await prisma.company.findFirst({ where: { tenantId: user.tenantId, name: ORG_NAME } });
  if (existing) {
    return { alreadyExists: true, teamsCreated: 0, contactsCreated: 0 };
  }

  const company = await prisma.company.create({
    data: {
      tenantId: user.tenantId,
      name: ORG_NAME,
      sport: "Florbal",
      status: "active",
      source: "Ruční zadání",
      description:
        "Krajské/regionální výběry talentované mládeže, ne klub. Kategorie BU14–BU17 a GU15–GU17, rozdělené na západ/východ. " +
        "Každá kategorie absolvuje 4 čtyřdenní kempy za sezónu (2 v sezóně, 2 po sezóně).",
      ownerId: user.id,
    },
  });

  const contactIdByEmail = new Map<string, string>();
  let teamsCreated = 0;
  let contactsCreated = 0;

  for (const t of TALENT_TEAMS) {
    let contactId = contactIdByEmail.get(t.email);
    if (!contactId) {
      const contact = await prisma.contact.create({
        data: {
          tenantId: user.tenantId,
          firstName: t.firstName,
          lastName: t.lastName,
          phone: t.phone,
          email: t.email,
          jobTitle: "Hlavní trenér",
          ownerId: user.id,
          source: "Ruční zadání",
        },
      });
      contactId = contact.id;
      contactIdByEmail.set(t.email, contactId);
      contactsCreated++;
    }

    const team = await prisma.clubTeam.create({
      data: {
        tenantId: user.tenantId,
        companyId: company.id,
        category: t.category,
        name: `${t.category} ${t.region} (${t.years})`,
        league: "Kempy talentované mládeže",
      },
    });
    teamsCreated++;

    await prisma.clubTeamContact.create({ data: { clubTeamId: team.id, contactId, role: "Hlavní trenér" } });
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entityType: "company",
    entityId: company.id,
    action: "create",
    changes: { source: "talent-youth-import", teamsCreated, contactsCreated },
  });

  revalidatePath("/crm/companies");
  revalidatePath(`/crm/companies/${company.id}`);
  return { alreadyExists: false, teamsCreated, contactsCreated };
}
