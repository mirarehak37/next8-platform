"use server";

import { prisma } from "@/lib/prisma";
import { requireSession, ActionError, logAudit } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";
import florbalClubs from "@/data/florbal-clubs.json";

type FlorbalClub = {
  name: string;
  city: string | null;
  league: string | null;
  teams: { category: string; name: string; league: string }[];
};

// One-off data-migration action: seeds the ~400 clubs registered with Český
// florbal (scraped from ceskyflorbal.cz's public club directory) plus every
// team/league they field, run once by an admin from inside the deployed app
// so it never needs the raw production DATABASE_URL outside the app itself.
// Idempotent — a club already present (by name) is left untouched, including
// its teams, so re-running only picks up clubs that are still missing.
export async function importFlorbalClubs() {
  const user = await requireSession();
  if (user.role !== "Administrator") {
    throw new ActionError("Tuto akci může spustit jen administrátor.");
  }

  const clubs = florbalClubs as FlorbalClub[];

  const existing = await prisma.company.findMany({
    where: { tenantId: user.tenantId, sport: "Florbal" },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));

  const newClubs = clubs.filter((c) => !existingNames.has(c.name.trim().toLowerCase()));

  if (newClubs.length === 0) {
    return { clubsCreated: 0, teamsCreated: 0, clubsSkipped: clubs.length };
  }

  await prisma.company.createMany({
    data: newClubs.map((c) => ({
      tenantId: user.tenantId,
      name: c.name,
      billingCity: c.city || undefined,
      sport: "Florbal",
      league: c.league || undefined,
      status: "prospect",
      source: "Import – Český florbal",
      ownerId: user.id,
    })),
  });

  const created = await prisma.company.findMany({
    where: { tenantId: user.tenantId, name: { in: newClubs.map((c) => c.name) } },
    select: { id: true, name: true },
  });
  const idByName = new Map(created.map((c) => [c.name, c.id]));

  const teamRows = newClubs.flatMap((c) => {
    const companyId = idByName.get(c.name);
    if (!companyId) return [];
    return c.teams.map((t) => ({
      tenantId: user.tenantId,
      companyId,
      category: t.category,
      name: t.name,
      league: t.league || undefined,
    }));
  });

  if (teamRows.length > 0) {
    await prisma.clubTeam.createMany({ data: teamRows });
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entityType: "company",
    entityId: "bulk-import",
    action: "create",
    changes: { source: "florbal-import", clubsCreated: newClubs.length, teamsCreated: teamRows.length },
  });

  revalidatePath("/crm/companies");

  return { clubsCreated: newClubs.length, teamsCreated: teamRows.length, clubsSkipped: clubs.length - newClubs.length };
}
