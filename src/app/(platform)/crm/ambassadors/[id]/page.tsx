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
import { AmbassadorFormDialog } from "@/components/partnerships/ambassador-form-dialog";
import { RecordEditTrigger } from "@/components/partnerships/form-parts";
import { DeleteRecordButton } from "@/components/partnerships/delete-record-button";
import { TermsPanel } from "@/components/partnerships/terms-panel";
import { AttachmentsPanel } from "@/components/partnerships/attachments-panel";
import { AuditHistory, FulfillmentLedger, InfoItem } from "@/components/partnerships/detail-parts";
import { loadPartnershipExtras } from "@/lib/partnership-queries";
import { contractRangeLabel, contractState, socialUrl, toDateInput, unpaidRewards, yearlyValue } from "@/lib/partnerships";
import { AMBASSADOR_BILLING_TYPES, AMBASSADOR_TIERS, PARTNERSHIP_STATUSES, findMeta } from "@/lib/constants";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { Building2, Mail, Phone, AtSign, Users } from "lucide-react";

export default async function AmbassadorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "ambassador", "view")) redirect("/dashboard");

  const ambassador = await prisma.ambassador.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { owner: true, company: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!ambassador) notFound();

  const canEdit = can(user.role, "ambassador", "edit");
  const [{ terms, attachments, auditLogs, products }, owners, companies, contacts] = await Promise.all([
    loadPartnershipExtras(user.tenantId, "ambassador", id),
    canEdit ? prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    canEdit ? prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    canEdit ? prisma.contact.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }) : [],
  ]);

  const fullName = `${ambassador.firstName} ${ambassador.lastName}`;
  const statusMeta = findMeta(PARTNERSHIP_STATUSES, ambassador.status);
  const tierMeta = findMeta(AMBASSADOR_TIERS, ambassador.tier);
  const contract = contractState(ambassador.contractEnd);
  const yearlyCost = yearlyValue(terms, "we_give");
  const toPay = unpaidRewards(terms);
  const socials = (["instagram", "tiktok", "youtube"] as const)
    .map((network) => ({ network, value: ambassador[network], url: socialUrl(network, ambassador[network]) }))
    .filter((s) => s.value);

  return (
    <div>
      <PageHeader
        title={fullName}
        breadcrumbs={[{ label: "Partnerství" }, { label: "Ambasadoři", href: "/crm/ambassadors" }, { label: fullName }]}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <AmbassadorFormDialog
                owners={owners}
                companies={companies}
                contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
                ambassador={{
                  id: ambassador.id,
                  firstName: ambassador.firstName,
                  lastName: ambassador.lastName,
                  nickname: ambassador.nickname,
                  email: ambassador.email,
                  phone: ambassador.phone,
                  birthDate: toDateInput(ambassador.birthDate),
                  sport: ambassador.sport,
                  position: ambassador.position,
                  companyId: ambassador.companyId,
                  contactId: ambassador.contactId,
                  instagram: ambassador.instagram,
                  tiktok: ambassador.tiktok,
                  youtube: ambassador.youtube,
                  followers: ambassador.followers,
                  status: ambassador.status,
                  tier: ambassador.tier,
                  contractStart: toDateInput(ambassador.contractStart),
                  contractEnd: toDateInput(ambassador.contractEnd),
                  discountCode: ambassador.discountCode,
                  billingType: ambassador.billingType,
                  registrationNumber: ambassador.registrationNumber,
                  bankAccount: ambassador.bankAccount,
                  ownerId: ambassador.ownerId,
                  notes: ambassador.notes,
                }}
                trigger={<RecordEditTrigger />}
              />
            )}
            {can(user.role, "ambassador", "delete") && <DeleteRecordButton kind="ambassador" id={ambassador.id} name={fullName} />}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-3">
            <CardContent className="flex flex-wrap items-start gap-6">
              <Avatar className="h-14 w-14"><AvatarFallback className="text-lg bg-[#FF1947]/10 text-[#FF1947]">{initials(fullName)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-[200px] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{fullName}</h2>
                  {ambassador.nickname && <span className="text-muted-foreground">„{ambassador.nickname}“</span>}
                  {statusMeta && <StatusBadge label={statusMeta.label} color={statusMeta.color} />}
                  {tierMeta && <StatusBadge label={tierMeta.label} color={tierMeta.color} />}
                  {contract?.label && ambassador.status === "active" && <StatusBadge label={contract.label} color={contract.color!} />}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  {ambassador.position && <span>{ambassador.position}</span>}
                  {ambassador.sport && <span>{ambassador.sport}</span>}
                  {ambassador.company && (
                    <Link href={`/crm/companies/${ambassador.company.id}`} className="flex items-center gap-1.5 hover:text-foreground">
                      <Building2 className="h-3.5 w-3.5" /> {ambassador.company.name}
                    </Link>
                  )}
                  {ambassador.followers != null && (
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {new Intl.NumberFormat("cs-CZ").format(ambassador.followers)} sledujících</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                  {socials.map((s) => (
                    <a key={s.network} href={s.url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <AtSign className="h-3.5 w-3.5" /> {s.network === "instagram" ? "Instagram" : s.network === "tiktok" ? "TikTok" : "YouTube"}: {s.value}
                    </a>
                  ))}
                  {ambassador.email && (
                    <a href={`mailto:${ambassador.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Mail className="h-3.5 w-3.5" /> {ambassador.email}</a>
                  )}
                  {ambassador.phone && (
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {ambassador.phone}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-[#FF1947] text-white">{initials(ambassador.owner.name)}</AvatarFallback></Avatar>
                <div>
                  <div className="text-xs text-muted-foreground">Vlastník</div>
                  <div className="text-sm font-medium">{ambassador.owner.name}</div>
                </div>
              </div>
              <div className="pt-2 border-t space-y-1">
                <div className="text-xs text-muted-foreground">Náklady za rok (odhad)</div>
                <div className="text-lg font-semibold">{formatCurrency(yearlyCost)}</div>
                {toPay > 0 && <div className="text-xs font-medium text-[#FF1947]">K výplatě: {formatCurrency(toPay)}</div>}
                <div className="text-xs text-muted-foreground">
                  Smlouva: {contractRangeLabel(ambassador.contractStart, ambassador.contractEnd)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="terms">
          <TabsList variant="line">
            <TabsTrigger value="terms">Podmínky spolupráce ({terms.length})</TabsTrigger>
            <TabsTrigger value="ledger">Výplaty a plnění</TabsTrigger>
            <TabsTrigger value="documents">Smlouvy a dokumenty ({attachments.length})</TabsTrigger>
            <TabsTrigger value="details">Údaje</TabsTrigger>
            <TabsTrigger value="history">Historie</TabsTrigger>
          </TabsList>

          <TabsContent value="terms" className="pt-4">
            <TermsPanel
              subjectType="ambassador"
              subjectId={ambassador.id}
              terms={terms}
              canEdit={canEdit}
              products={products}
              labels={{ weGive: "Co mu platíme / dáváme", theyGive: "Co musí udělat" }}
            />
          </TabsContent>

          <TabsContent value="ledger" className="pt-4">
            <FulfillmentLedger terms={terms} weGiveLabel="Vyplaceno" theyGiveLabel="Hodnota plnění" />
          </TabsContent>

          <TabsContent value="documents" className="pt-4">
            <AttachmentsPanel entityType="ambassador" entityId={ambassador.id} attachments={attachments} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="details" className="pt-4">
            <Card>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <InfoItem label="Datum narození">{ambassador.birthDate ? formatDate(ambassador.birthDate) : null}</InfoItem>
                <InfoItem label="Propojený kontakt">
                  {ambassador.contact ? (
                    <Link href={`/crm/contacts/${ambassador.contact.id}`} className="hover:underline">{ambassador.contact.firstName} {ambassador.contact.lastName}</Link>
                  ) : null}
                </InfoItem>
                <InfoItem label="Slevový kód">{ambassador.discountCode ? <code className="rounded bg-muted px-1.5 py-0.5">{ambassador.discountCode}</code> : null}</InfoItem>
                <InfoItem label="Způsob vyplácení">{findMeta(AMBASSADOR_BILLING_TYPES, ambassador.billingType)?.label ?? null}</InfoItem>
                <InfoItem label="IČO">{ambassador.registrationNumber}</InfoItem>
                <InfoItem label="Číslo účtu">{ambassador.bankAccount}</InfoItem>
                <InfoItem label="Smlouva od">{ambassador.contractStart ? formatDate(ambassador.contractStart) : null}</InfoItem>
                <InfoItem label="Smlouva do">{ambassador.contractEnd ? formatDate(ambassador.contractEnd) : null}</InfoItem>
                <InfoItem label="Poznámka" wide>{ambassador.notes ? <span className="whitespace-pre-line">{ambassador.notes}</span> : null}</InfoItem>
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
