import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PartnerFormDialog } from "@/components/partnerships/partner-form-dialog";
import { RecordEditTrigger } from "@/components/partnerships/form-parts";
import { DeleteRecordButton } from "@/components/partnerships/delete-record-button";
import { TermsPanel } from "@/components/partnerships/terms-panel";
import { AttachmentsPanel } from "@/components/partnerships/attachments-panel";
import { AuditHistory, FulfillmentLedger, InfoItem } from "@/components/partnerships/detail-parts";
import { loadPartnershipExtras } from "@/lib/partnership-queries";
import { contractRangeLabel, contractState, toDateInput, yearlyValue } from "@/lib/partnerships";
import { PARTNER_KINDS, PARTNERSHIP_STATUSES, findMeta } from "@/lib/constants";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { Building2, Globe, HeartHandshake, Mail, Phone, User } from "lucide-react";

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "partner", "view")) redirect("/dashboard");

  const partner = await prisma.partner.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { owner: true, company: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
  });
  if (!partner) notFound();

  const canEdit = can(user.role, "partner", "edit");
  const [{ terms, attachments, auditLogs }, owners, companies, contacts] = await Promise.all([
    loadPartnershipExtras(user.tenantId, "partner", id),
    canEdit ? prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    canEdit ? prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    canEdit ? prisma.contact.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }) : [],
  ]);

  const kindMeta = findMeta(PARTNER_KINDS, partner.kind);
  const statusMeta = findMeta(PARTNERSHIP_STATUSES, partner.status);
  const contract = contractState(partner.contractEnd);
  const theyGive = yearlyValue(terms, "they_give");
  const weGive = yearlyValue(terms, "we_give");
  const isSponsor = partner.kind === "club_sponsor";

  return (
    <div>
      <PageHeader
        title={partner.name}
        breadcrumbs={[{ label: "Partnerství" }, { label: "Partneři a sponzoring", href: "/crm/partners" }, { label: partner.name }]}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <PartnerFormDialog
                owners={owners}
                companies={companies}
                contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
                partner={{
                  id: partner.id,
                  name: partner.name,
                  kind: partner.kind,
                  level: partner.level,
                  registrationNumber: partner.registrationNumber,
                  website: partner.website,
                  email: partner.email,
                  phone: partner.phone,
                  contactId: partner.contactId,
                  companyId: partner.companyId,
                  status: partner.status,
                  contractStart: toDateInput(partner.contractStart),
                  contractEnd: toDateInput(partner.contractEnd),
                  ownerId: partner.ownerId,
                  notes: partner.notes,
                }}
                trigger={<RecordEditTrigger />}
              />
            )}
            {can(user.role, "partner", "delete") && <DeleteRecordButton kind="partner" id={partner.id} name={partner.name} />}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-3">
            <CardContent className="flex flex-wrap items-start gap-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#FF1947]/10 text-[#FF1947] shrink-0">
                <HeartHandshake className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-[200px] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{partner.name}</h2>
                  {kindMeta && <StatusBadge label={kindMeta.label} color={kindMeta.color} />}
                  {statusMeta && <StatusBadge label={statusMeta.label} color={statusMeta.color} />}
                  {contract?.label && partner.status === "active" && <StatusBadge label={contract.label} color={contract.color!} />}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  {partner.level && <span>{partner.level} partner</span>}
                  {partner.registrationNumber && <span>IČO: {partner.registrationNumber}</span>}
                  {isSponsor && partner.company && (
                    <Link href={`/crm/companies/${partner.company.id}`} className="flex items-center gap-1.5 hover:text-foreground">
                      <Building2 className="h-3.5 w-3.5" /> Sponzoruje: {partner.company.name}
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                  {partner.website && (
                    <a href={/^https?:\/\//.test(partner.website) ? partner.website : `https://${partner.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <Globe className="h-3.5 w-3.5" /> {partner.website}
                    </a>
                  )}
                  {partner.email && (
                    <a href={`mailto:${partner.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Mail className="h-3.5 w-3.5" /> {partner.email}</a>
                  )}
                  {partner.phone && <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {partner.phone}</span>}
                  {partner.contact && (
                    <Link href={`/crm/contacts/${partner.contact.id}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <User className="h-3.5 w-3.5" /> {partner.contact.firstName} {partner.contact.lastName}
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-[#FF1947] text-white">{initials(partner.owner.name)}</AvatarFallback></Avatar>
                <div>
                  <div className="text-xs text-muted-foreground">Vlastník</div>
                  <div className="text-sm font-medium">{partner.owner.name}</div>
                </div>
              </div>
              <div className="pt-2 border-t space-y-1">
                <div className="text-xs text-muted-foreground">Přínos za rok / naše protiplnění</div>
                <div className="text-lg font-semibold">{formatCurrency(theyGive)}</div>
                <div className="text-xs text-muted-foreground">protiplnění {formatCurrency(weGive)}</div>
                <div className="text-xs text-muted-foreground">
                  Smlouva: {contractRangeLabel(partner.contractStart, partner.contractEnd)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="terms">
          <TabsList variant="line">
            <TabsTrigger value="terms">Plnění a protiplnění ({terms.length})</TabsTrigger>
            <TabsTrigger value="ledger">Evidence plnění</TabsTrigger>
            <TabsTrigger value="documents">Smlouvy a dokumenty ({attachments.length})</TabsTrigger>
            <TabsTrigger value="details">Údaje</TabsTrigger>
            <TabsTrigger value="history">Historie</TabsTrigger>
          </TabsList>

          <TabsContent value="terms" className="pt-4">
            <TermsPanel
              subjectType="partner"
              subjectId={partner.id}
              terms={terms}
              canEdit={canEdit}
              labels={
                isSponsor
                  ? { weGive: "Co klubu / sponzorovi poskytujeme", theyGive: "Co sponzor dává" }
                  : { weGive: "Naše protiplnění (viditelnost, produkty…)", theyGive: "Co partner dává / musí splnit" }
              }
            />
          </TabsContent>

          <TabsContent value="ledger" className="pt-4">
            <FulfillmentLedger terms={terms} weGiveLabel="Naše plnění" theyGiveLabel="Přijato od partnera" />
          </TabsContent>

          <TabsContent value="documents" className="pt-4">
            <AttachmentsPanel entityType="partner" entityId={partner.id} attachments={attachments} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="details" className="pt-4">
            <Card>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <InfoItem label="Typ">{kindMeta?.label ?? null}</InfoItem>
                <InfoItem label="Úroveň">{partner.level}</InfoItem>
                <InfoItem label="IČO">{partner.registrationNumber}</InfoItem>
                <InfoItem label="Sponzorovaný klub">{partner.company?.name ?? null}</InfoItem>
                <InfoItem label="Smlouva od">{partner.contractStart ? formatDate(partner.contractStart) : null}</InfoItem>
                <InfoItem label="Smlouva do">{partner.contractEnd ? formatDate(partner.contractEnd) : null}</InfoItem>
                <InfoItem label="Poznámka" wide>{partner.notes ? <span className="whitespace-pre-line">{partner.notes}</span> : null}</InfoItem>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            <AuditHistory logs={auditLogs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
