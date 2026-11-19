import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { ContactsTable, type ContactRow } from "./contacts-table";

export default async function ContactsPage() {
  const session = await auth();
  const user = session!.user;

  const scope = await ownerScopeWhere(user, "contact");
  const [contacts, owners, companies] = await Promise.all([
    prisma.contact.findMany({
      where: scope,
      include: {
        owner: { select: { name: true } },
        companies: { include: { company: { select: { name: true } } }, take: 1 },
        clubTeams: { include: { clubTeam: { include: { company: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const tagged = contacts.length
    ? await prisma.taggedItem.findMany({
        where: { entityType: "contact", entityId: { in: contacts.map((c) => c.id) }, tag: { tenantId: user.tenantId } },
        select: { entityId: true, tag: { select: { name: true } } },
      })
    : [];
  const tagsById = new Map<string, string[]>();
  for (const t of tagged) tagsById.set(t.entityId, [...(tagsById.get(t.entityId) ?? []), t.tag.name]);

  const rows: ContactRow[] = contacts.map((c) => ({
    id: c.id,
    fullName: `${c.firstName} ${c.lastName}`,
    jobTitle: c.jobTitle,
    companyName: c.companies[0]?.company.name ?? c.clubTeams[0]?.clubTeam.company.name ?? null,
    teamNames: c.clubTeams.map((ct) => ct.clubTeam.name),
    email: c.email,
    phone: c.phone,
    status: c.status,
    ownerName: c.owner.name,
    marketingConsent: c.marketingConsent ? "yes" : "no",
    tags: (tagsById.get(c.id) ?? []).sort((a, b) => a.localeCompare(b, "cs")),
  }));

  return (
    <div>
      <PageHeader title="Kontakty" description={`${rows.length} kontaktních osob`} breadcrumbs={[{ label: "CRM" }, { label: "Kontakty" }]} />
      <div className="p-4 sm:p-6">
        <ContactsTable data={rows} owners={owners} companies={companies} />
      </div>
    </div>
  );
}
