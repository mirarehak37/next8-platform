import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ContactFormDialog, ContactEditTrigger } from "@/components/crm/contact-form-dialog";
import { Users, Handshake, Building2, Mail, Phone, Smartphone } from "lucide-react";
import { CONTACT_STATUSES, findMeta, ACTIVITY_TYPES, DEAL_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDateTime, initials } from "@/lib/format";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;

  const contact = await prisma.contact.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      owner: true,
      companies: { include: { company: true } },
      dealContacts: { include: { deal: { include: { stage: true, company: true } } } },
    },
  });
  if (!contact) notFound();

  const [activities, owners, companies] = await Promise.all([
    prisma.activity.findMany({
      where: { tenantId: user.tenantId, subjectType: "contact", subjectId: id },
      include: { owner: { select: { name: true } } },
      orderBy: { activityAt: "desc" },
      take: 30,
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const statusMeta = findMeta(CONTACT_STATUSES, contact.status);
  const fullName = `${contact.firstName} ${contact.lastName}`;
  const primaryCompany = contact.companies[0]?.company ?? null;

  return (
    <div>
      <PageHeader
        title={fullName}
        breadcrumbs={[{ label: "CRM" }, { label: "Kontakty", href: "/crm/contacts" }, { label: fullName }]}
        actions={
          <ContactFormDialog
            owners={owners}
            companies={companies}
            defaultCompanyId={primaryCompany?.id}
            contact={{
              id: contact.id,
              firstName: contact.firstName,
              lastName: contact.lastName,
              jobTitle: contact.jobTitle,
              department: contact.department,
              email: contact.email,
              phone: contact.phone,
              mobile: contact.mobile,
              ownerId: contact.ownerId,
              status: contact.status,
              source: contact.source,
              companyId: primaryCompany?.id ?? null,
              gdprConsent: contact.gdprConsent,
              marketingConsent: contact.marketingConsent,
              description: contact.description,
            }}
            trigger={<ContactEditTrigger />}
          />
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-3">
            <CardContent className="flex flex-wrap items-start gap-6">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarFallback className="text-lg bg-[#FF1947] text-white">{initials(fullName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-[200px] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{fullName}</h2>
                  {statusMeta && <StatusBadge label={statusMeta.label} color={statusMeta.color} />}
                </div>
                <div className="text-sm text-muted-foreground">{contact.jobTitle}{contact.department && ` · ${contact.department}`}</div>
                {primaryCompany && (
                  <Link href={`/crm/companies/${primaryCompany.id}`} className="flex items-center gap-1.5 text-sm text-[#FF1947] hover:underline w-fit">
                    <Building2 className="h-3.5 w-3.5" /> {primaryCompany.name}
                  </Link>
                )}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                  {contact.email && <span className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {contact.email}</span>}
                  {contact.phone && <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {contact.phone}</span>}
                  {contact.mobile && <span className="flex items-center gap-1.5 text-muted-foreground"><Smartphone className="h-3.5 w-3.5" /> {contact.mobile}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-[#FF1947] text-white">{initials(contact.owner.name)}</AvatarFallback></Avatar>
                <div>
                  <div className="text-xs text-muted-foreground">Vlastník</div>
                  <div className="text-sm font-medium">{contact.owner.name}</div>
                </div>
              </div>
              <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
                <div>GDPR souhlas: {contact.gdprConsent ? "Ano" : "Ne"}</div>
                <div>Marketingový souhlas: {contact.marketingConsent ? "Ano" : "Ne"}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="deals">
          <TabsList variant="line">
            <TabsTrigger value="deals">Obchodní případy ({contact.dealContacts.length})</TabsTrigger>
            <TabsTrigger value="activities">Aktivity ({activities.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="deals" className="pt-4 space-y-2">
            {contact.dealContacts.length === 0 && <EmptyState text="Zatím žádné obchodní případy." />}
            {contact.dealContacts.map((dc) => {
              const meta = findMeta(DEAL_STATUSES, dc.deal.status);
              return (
                <Link key={dc.id} href={`/crm/deals/${dc.deal.id}`}>
                  <Card className="hover:bg-muted/40 transition-colors">
                    <CardContent className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Handshake className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{dc.deal.name}</div>
                          <div className="text-xs text-muted-foreground">{dc.deal.stage.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{formatCurrency(dc.deal.value, dc.deal.currency)}</span>
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
                      <p className="text-xs text-muted-foreground mt-1">{a.owner.name} · {formatDateTime(a.activityAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground border rounded-md border-dashed">
      <Users className="h-6 w-6 mb-2 opacity-40" />
      {text}
    </div>
  );
}
