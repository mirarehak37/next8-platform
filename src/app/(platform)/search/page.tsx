import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Handshake, FileText, CheckSquare, UserPlus } from "lucide-react";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const session = await auth();
  const user = session!.user;

  if (!query) {
    return (
      <div>
        <PageHeader title="Vyhledávání" breadcrumbs={[{ label: "Vyhledávání" }]} />
        <div className="p-6 text-sm text-muted-foreground">Zadejte hledaný výraz do vyhledávacího pole nahoře.</div>
      </div>
    );
  }

  const [companies, contacts, deals, leads, tasks, quotes] = await Promise.all([
    prisma.company.findMany({ where: { tenantId: user.tenantId, name: { contains: query } }, take: 8 }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId, OR: [{ firstName: { contains: query } }, { lastName: { contains: query } }, { email: { contains: query } }] }, take: 8 }),
    prisma.deal.findMany({ where: { tenantId: user.tenantId, name: { contains: query } }, take: 8 }),
    prisma.lead.findMany({ where: { tenantId: user.tenantId, OR: [{ firstName: { contains: query } }, { lastName: { contains: query } }, { companyName: { contains: query } }] }, take: 8 }),
    prisma.task.findMany({ where: { tenantId: user.tenantId, title: { contains: query } }, take: 8 }),
    prisma.quote.findMany({ where: { tenantId: user.tenantId, number: { contains: query } }, take: 8 }),
  ]);

  const totalResults = companies.length + contacts.length + deals.length + leads.length + tasks.length + quotes.length;

  const sections = [
    { title: "Firmy", icon: Building2, items: companies.map((c) => ({ id: c.id, label: c.name, href: `/crm/companies/${c.id}` })) },
    { title: "Kontakty", icon: Users, items: contacts.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}`, href: `/crm/contacts/${c.id}` })) },
    { title: "Obchodní případy", icon: Handshake, items: deals.map((d) => ({ id: d.id, label: d.name, href: `/crm/deals/${d.id}` })) },
    { title: "Leady", icon: UserPlus, items: leads.map((l) => ({ id: l.id, label: `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || l.companyName || "Lead", href: `/crm/leads` })) },
    { title: "Úkoly", icon: CheckSquare, items: tasks.map((t) => ({ id: t.id, label: t.title, href: `/tasks` })) },
    { title: "Nabídky", icon: FileText, items: quotes.map((q) => ({ id: q.id, label: q.number, href: `/crm/quotes/${q.id}` })) },
  ].filter((s) => s.items.length > 0);

  return (
    <div>
      <PageHeader title={`Výsledky pro „${query}“`} description={`${totalResults} nalezených záznamů`} breadcrumbs={[{ label: "Vyhledávání" }]} />
      <div className="p-6 space-y-4 max-w-2xl">
        {sections.length === 0 && <p className="text-sm text-muted-foreground">Nic nenalezeno. Zkuste jiný výraz.</p>}
        {sections.map((section) => (
          <Card key={section.title}>
            <CardContent className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                <section.icon className="h-3.5 w-3.5" /> {section.title}
              </div>
              {section.items.map((item) => (
                <Link key={item.id} href={item.href} className="block text-sm py-1.5 px-2 -mx-2 rounded-md hover:bg-muted">
                  {item.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
