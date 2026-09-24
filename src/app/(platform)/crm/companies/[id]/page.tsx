import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CompanyFormDialog, CompanyEditTrigger } from "@/components/crm/company-form-dialog";
import { ClubTeamFormDialog, ClubTeamEditTrigger } from "@/components/crm/club-team-form-dialog";
import { ClubTeamContacts } from "@/components/crm/club-team-contacts";
import { ClubTeamDeleteButton } from "@/components/crm/club-team-delete-button";
import {
  Building2, Globe, Phone, Mail, MapPin, Users, Handshake, FileText, CheckSquare, History, Plus, Shield,
} from "lucide-react";
import { COMPANY_STATUSES, findMeta, ACTIVITY_TYPES, DEAL_STATUSES, QUOTE_STATUSES, TASK_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, initials } from "@/lib/format";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;

  const company = await prisma.company.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      owner: true,
      contacts: { include: { contact: true } },
      deals: { include: { stage: true }, orderBy: { createdAt: "desc" } },
      quotes: { orderBy: { createdAt: "desc" } },
      clubTeams: { include: { contacts: { include: { contact: true } } }, orderBy: { category: "asc" } },
    },
  });
  if (!company) notFound();

  const [activities, tasks, auditLogs, owners, tags, allContacts] = await Promise.all([
    prisma.activity.findMany({
      where: { tenantId: user.tenantId, OR: [{ subjectType: "company", subjectId: id }, { subjectType: "deal", subjectId: { in: company.deals.map((d) => d.id) } }] },
      include: { owner: { select: { name: true } } },
      orderBy: { activityAt: "desc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: { tenantId: user.tenantId, subjectType: "company", subjectId: id },
      include: { assignee: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { tenantId: user.tenantId, entityType: "company", entityId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.taggedItem.findMany({ where: { entityType: "company", entityId: id }, include: { tag: true } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
  ]);
  const contactOptions = allContacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));

  const statusMeta = findMeta(COMPANY_STATUSES, company.status);
  const openDeals = company.deals.filter((d) => d.status === "open");
  const dealsValue = openDeals.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <PageHeader
        title={company.name}
        breadcrumbs={[{ label: "CRM" }, { label: "Kluby", href: "/crm/companies" }, { label: company.name }]}
        actions={
          <CompanyFormDialog
            owners={owners}
            company={{
              id: company.id,
              name: company.name,
              legalName: company.legalName,
              registrationNumber: company.registrationNumber,
              vatNumber: company.vatNumber,
              companyType: company.companyType,
              status: company.status,
              segment: company.segment,
              industry: company.industry,
              sport: company.sport,
              league: company.league,
              sizeBand: company.sizeBand,
              website: company.website,
              phone: company.phone,
              email: company.email,
              billingStreet: company.billingStreet,
              billingCity: company.billingCity,
              billingZip: company.billingZip,
              source: company.source,
              ownerId: company.ownerId,
              description: company.description,
            }}
            trigger={<CompanyEditTrigger />}
          />
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-3">
            <CardContent className="flex flex-wrap items-start gap-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#FF1947]/10 text-[#FF1947] dark:bg-[#FF1947]/10 shrink-0">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-[200px] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{company.name}</h2>
                  {statusMeta && <StatusBadge label={statusMeta.label} color={statusMeta.color} />}
                  {tags.map((t) => (
                    <StatusBadge key={t.id} label={t.tag.name} color={t.tag.color} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  {company.sport && <span>{company.sport}</span>}
                  {company.league && <span>{company.league}</span>}
                  {company.industry && <span>{company.industry}</span>}
                  {company.registrationNumber && <span>IČO: {company.registrationNumber}</span>}
                  {company.vatNumber && <span>DIČ: {company.vatNumber}</span>}
                  {company.sizeBand && <span>{company.sizeBand} zaměstnanců</span>}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                  {company.website && (
                    <a href={`https://${company.website}`} target="_blank" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <Globe className="h-3.5 w-3.5" /> {company.website}
                    </a>
                  )}
                  {company.phone && (
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {company.phone}</span>
                  )}
                  {company.email && (
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {company.email}</span>
                  )}
                  {company.billingCity && (
                    <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {company.billingCity}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-[#FF1947] text-white">{initials(company.owner.name)}</AvatarFallback></Avatar>
                <div>
                  <div className="text-xs text-muted-foreground">Vlastník</div>
                  <div className="text-sm font-medium">{company.owner.name}</div>
                </div>
              </div>
              <div className="pt-2 border-t space-y-1">
                <div className="text-xs text-muted-foreground">Otevřené obchody</div>
                <div className="text-lg font-semibold">{formatCurrency(dealsValue)}</div>
                <div className="text-xs text-muted-foreground">{openDeals.length} aktivních obchodů</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList variant="line">
            <TabsTrigger value="overview">Přehled</TabsTrigger>
            <TabsTrigger value="contacts">Kontakty ({company.contacts.length})</TabsTrigger>
            <TabsTrigger value="teams">Týmy ({company.clubTeams.length})</TabsTrigger>
            <TabsTrigger value="deals">Obchodní případy ({company.deals.length})</TabsTrigger>
            <TabsTrigger value="activities">Aktivity ({activities.length})</TabsTrigger>
            <TabsTrigger value="quotes">Nabídky ({company.quotes.length})</TabsTrigger>
            <TabsTrigger value="tasks">Úkoly ({tasks.length})</TabsTrigger>
            <TabsTrigger value="documents">Dokumenty</TabsTrigger>
            <TabsTrigger value="history">Historie</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <Card>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-muted-foreground text-xs mb-1">Sport</div>{company.sport ?? "—"}</div>
                <div><div className="text-muted-foreground text-xs mb-1">Liga / soutěž</div>{company.league ?? "—"}</div>
                <div><div className="text-muted-foreground text-xs mb-1">Segment</div>{company.segment ?? "—"}</div>
                <div><div className="text-muted-foreground text-xs mb-1">Zdroj</div>{company.source ?? "—"}</div>
                <div><div className="text-muted-foreground text-xs mb-1">Roční obrat</div>{company.annualRevenue ? formatCurrency(company.annualRevenue) : "—"}</div>
                <div><div className="text-muted-foreground text-xs mb-1">Počet zaměstnanců</div>{company.employeeCount ?? "—"}</div>
                <div className="col-span-2"><div className="text-muted-foreground text-xs mb-1">Adresa</div>{[company.billingStreet, company.billingCity, company.billingZip].filter(Boolean).join(", ") || "—"}</div>
                <div className="col-span-2"><div className="text-muted-foreground text-xs mb-1">Poznámka</div>{company.description ?? "—"}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="pt-4 space-y-2">
            {company.contacts.length === 0 && <EmptyState text="Zatím žádné kontaktní osoby." />}
            {company.contacts.map((cc) => (
              <Link key={cc.id} href={`/crm/contacts/${cc.contact.id}`}>
                <Card className="hover:bg-muted/40 transition-colors">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials(`${cc.contact.firstName} ${cc.contact.lastName}`)}</AvatarFallback></Avatar>
                      <div>
                        <div className="text-sm font-medium">{cc.contact.firstName} {cc.contact.lastName} {cc.isPrimary && <StatusBadge label="Primární" color="indigo" className="ml-1.5" />}</div>
                        <div className="text-xs text-muted-foreground">{cc.role ?? cc.contact.jobTitle ?? "—"}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{cc.contact.email}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </TabsContent>

          <TabsContent value="teams" className="pt-4 space-y-2">
            <div className="flex justify-end">
              <ClubTeamFormDialog companyId={company.id} />
            </div>
            {company.clubTeams.length === 0 && <EmptyState text="Zatím žádné týmy." icon={Shield} />}
            {company.clubTeams.map((team) => (
              <Card key={team.id}>
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge label={team.category} color="indigo" />
                      <span className="text-sm font-medium">{team.name}</span>
                      {team.league && <span className="text-xs text-muted-foreground">· {team.league}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <ClubTeamFormDialog
                        companyId={company.id}
                        team={{ id: team.id, companyId: company.id, category: team.category, name: team.name, league: team.league }}
                        trigger={<ClubTeamEditTrigger />}
                      />
                      <ClubTeamDeleteButton id={team.id} />
                    </div>
                  </div>
                  <ClubTeamContacts
                    clubTeamId={team.id}
                    contacts={team.contacts.map((c) => ({ contactId: c.contact.id, name: `${c.contact.firstName} ${c.contact.lastName}`, role: c.role }))}
                    allContacts={contactOptions}
                  />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="deals" className="pt-4 space-y-2">
            {company.deals.length === 0 && <EmptyState text="Zatím žádné obchodní případy." />}
            {company.deals.map((deal) => {
              const meta = findMeta(DEAL_STATUSES, deal.status);
              return (
                <Link key={deal.id} href={`/crm/deals/${deal.id}`}>
                  <Card className="hover:bg-muted/40 transition-colors">
                    <CardContent className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Handshake className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{deal.name}</div>
                          <div className="text-xs text-muted-foreground">{deal.stage.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{formatCurrency(deal.value, deal.currency)}</span>
                        {meta && <StatusBadge label={meta.label} color={meta.color} />}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </TabsContent>

          <TabsContent value="activities" className="pt-4 space-y-2">
            {activities.length === 0 && <EmptyState text="Zatím žádné aktivity." />}
            {activities.map((a) => {
              const meta = findMeta(ACTIVITY_TYPES, a.type);
              return (
                <Card key={a.id}>
                  <CardContent className="flex items-start gap-3 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground mt-0.5 text-[10px] font-medium">
                      {meta?.label.slice(0, 2) ?? "•"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{a.subject}</p>
                      {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{a.owner.name} · {formatDateTime(a.activityAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="quotes" className="pt-4 space-y-2">
            {company.quotes.length === 0 && <EmptyState text="Zatím žádné nabídky." />}
            {company.quotes.map((q) => {
              const meta = findMeta(QUOTE_STATUSES, q.status);
              return (
                <Link key={q.id} href={`/crm/quotes/${q.id}`}>
                  <Card className="hover:bg-muted/40 transition-colors">
                    <CardContent className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{q.number}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{formatCurrency(q.total, q.currency)}</span>
                        {meta && <StatusBadge label={meta.label} color={meta.color} />}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </TabsContent>

          <TabsContent value="tasks" className="pt-4 space-y-2">
            {tasks.length === 0 && <EmptyState text="Zatím žádné úkoly." />}
            {tasks.map((t) => {
              const meta = findMeta(TASK_STATUSES, t.status);
              return (
                <Card key={t.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{t.title}</div>
                        <div className="text-xs text-muted-foreground">{t.assignee.name} {t.dueDate && `· ${formatDate(t.dueDate)}`}</div>
                      </div>
                    </div>
                    {meta && <StatusBadge label={meta.label} color={meta.color} />}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="documents" className="pt-4">
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Modul Dokumenty (DMS) zatím není pro tento klub aktivován.
                <br />
                Přílohy jednotlivých záznamů jsou podporovány napříč platformou a připraveny na plnohodnotný DMS modul.
                <div className="mt-3">
                  <Button variant="outline" size="sm" disabled>
                    <Plus className="h-3.5 w-3.5" /> Nahrát dokument
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="pt-4 space-y-2">
            {auditLogs.length === 0 && <EmptyState text="Zatím žádná historie změn." />}
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                <span>{log.user?.name ?? "Systém"}</span>
                <span className="text-muted-foreground">{actionLabel(log.action)}</span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function actionLabel(action: string) {
  return { create: "vytvořil(a) záznam", update: "upravil(a) záznam", delete: "smazal(a) záznam" }[action] ?? action;
}

function EmptyState({ text, icon: Icon = Users }: { text: string; icon?: typeof Users }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground border rounded-md border-dashed">
      <Icon className="h-6 w-6 mb-2 opacity-40" />
      {text}
    </div>
  );
}
