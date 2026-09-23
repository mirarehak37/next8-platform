import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { LeadsTable, type LeadRow } from "./leads-table";

export default async function LeadsPage() {
  const session = await auth();
  const user = session!.user;

  const scope = await ownerScopeWhere(user, "lead");
  const [leads, owners, pipeline] = await Promise.all([
    prisma.lead.findMany({ where: scope, include: { owner: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.pipeline.findFirst({ where: { tenantId: user.tenantId, isDefault: true }, include: { stages: { orderBy: { order: "asc" } } } }),
  ]);

  const rows: LeadRow[] = leads.map((l) => ({
    id: l.id,
    name: `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || l.companyName || "Bez jména",
    firstName: l.firstName,
    lastName: l.lastName,
    companyName: l.companyName,
    jobTitle: l.jobTitle,
    email: l.email,
    phone: l.phone,
    source: l.source,
    campaign: l.campaign,
    estimatedValue: l.estimatedValue,
    status: l.status,
    rating: l.rating,
    notes: l.notes,
    ownerId: l.ownerId,
    ownerName: l.owner.name,
  }));

  const firstStage = pipeline?.stages.find((s) => !s.isWon && !s.isLost) ?? pipeline?.stages[0];

  return (
    <div>
      <PageHeader title="Leady" description={`${rows.length} leadů v procesu kvalifikace`} breadcrumbs={[{ label: "CRM" }, { label: "Leady" }]} />
      <div className="p-6">
        <LeadsTable data={rows} owners={owners} pipelineId={pipeline?.id ?? ""} firstStageId={firstStage?.id ?? ""} />
      </div>
    </div>
  );
}
