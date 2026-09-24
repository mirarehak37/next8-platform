import { prisma } from "@/lib/prisma";

const ORDER = ["Předseda klubu", "Sekretář klubu", "Kontaktní osoba týmu"];

// Collects the roles an import found for each person and writes them into the
// contact's "Pozice", e.g. "Sekretář klubu, Kontaktní osoba týmu". Existing text is
// kept (hand-written positions stay), missing roles are appended — so re-running an
// import never duplicates or drops anything.
export class PositionCollector {
  private roles = new Map<string, Set<string>>();

  add(contactId: string, role: string | null | undefined) {
    const r = role?.trim();
    if (!r) return;
    if (!this.roles.has(contactId)) this.roles.set(contactId, new Set());
    this.roles.get(contactId)!.add(r);
  }

  async apply(tenantId: string) {
    if (this.roles.size === 0) return 0;
    const contacts = await prisma.contact.findMany({
      where: { tenantId, id: { in: [...this.roles.keys()] } },
      select: { id: true, jobTitle: true },
    });
    const ids: string[] = [];
    const titles: string[] = [];
    for (const c of contacts) {
      const current = (c.jobTitle ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const have = new Set(current.map((s) => s.toLowerCase()));
      const added = [...this.roles.get(c.id)!]
        .filter((r) => !have.has(r.toLowerCase()))
        .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
      if (added.length === 0) continue;
      ids.push(c.id);
      titles.push([...current, ...added].join(", "));
    }
    // One statement for all changes — a query per contact is slow over the network.
    if (ids.length) {
      await prisma.$executeRaw`
        UPDATE "Contact" AS c SET "jobTitle" = v.title, "updatedAt" = NOW()
        FROM unnest(${ids}::text[], ${titles}::text[]) AS v(id, title)
        WHERE c.id = v.id`;
    }
    return ids.length;
  }
}
