import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ownerScopeWhere } from "@/lib/scope";
import { formatDate } from "@/lib/format";
import { ENROLLMENT_STATUSES, stepTypeMeta } from "@/lib/sequences";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid } from "@/components/common/stat-card";
import { SegmentBar } from "@/components/common/segment-bar";
import { OwnerBadge } from "@/components/common/owner-badge";
import { CountBadge } from "@/components/common/count-badge";
import { Tag } from "@/components/common/tag";
import { SequenceFormDialog } from "./sequence-form-dialog";
import { EnrollDialog } from "./enroll-dialog";
import { EnrollmentActions, SequenceDelete, SequenceToggle } from "./sequence-actions";

const DONE = new Set(["done", "cancelled"]);

export default async function SequencesPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "contact", "view")) redirect("/dashboard");

  const canCreate = can(user.role, "contact", "create");
  const canEdit = can(user.role, "contact", "edit");
  const canDelete = can(user.role, "contact", "delete");
  const contactScope = await ownerScopeWhere(user, "contact");

  const [sequences, owners, contacts] = await Promise.all([
    prisma.sequence.findMany({
      where: { tenantId: user.tenantId },
      include: {
        owner: { select: { name: true } },
        steps: { orderBy: { order: "asc" } },
        enrollments: {
          orderBy: { enrolledAt: "desc" },
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companies: { select: { company: { select: { name: true } } }, take: 1 },
              },
            },
          },
        },
      },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    canEdit
      ? prisma.contact.findMany({
          where: contactScope,
          select: { id: true, firstName: true, lastName: true, companies: { select: { company: { select: { name: true } } }, take: 1 } },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          take: 500,
        })
      : [],
  ]);

  const allTaskIds = sequences.flatMap((s) => s.enrollments.flatMap((e) => e.taskIds));
  const tasks = allTaskIds.length
    ? await prisma.task.findMany({ where: { tenantId: user.tenantId, id: { in: allTaskIds } }, select: { id: true, status: true } })
    : [];
  const taskStatus = new Map(tasks.map((t) => [t.id, t.status]));

  const enrollContacts = contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    hint: c.companies[0]?.company.name ?? null,
  }));

  const cards = sequences.map((sequence) => {
    const enrollments = sequence.enrollments.map((e) => {
      const statuses = e.taskIds.map((id) => taskStatus.get(id));
      const doneSteps = statuses.filter((s) => s === "done").length;
      const finished = statuses.every((s) => !s || DONE.has(s));
      const status = e.status === "active" && finished ? "completed" : e.status;
      return {
        id: e.id,
        status,
        doneSteps,
        totalSteps: e.taskIds.length,
        enrolledAt: e.enrolledAt,
        contactId: e.contact.id,
        contactName: `${e.contact.firstName} ${e.contact.lastName}`.trim(),
        company: e.contact.companies[0]?.company.name ?? null,
      };
    });
    const total = enrollments.length;
    const running = enrollments.filter((e) => e.status === "active").length;
    const replied = enrollments.filter((e) => e.status === "replied").length;
    const doneSteps = enrollments.reduce((s, e) => s + e.doneSteps, 0);
    const totalSteps = enrollments.reduce((s, e) => s + e.totalSteps, 0);
    return {
      ...sequence,
      enrollmentRows: enrollments,
      total,
      running,
      replied,
      replyRate: total > 0 ? Math.round((replied / total) * 100) : 0,
      progress: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0,
      doneSteps,
      lastDay: sequence.steps[sequence.steps.length - 1]?.dayOffset ?? 0,
    };
  });

  const activeCount = cards.filter((c) => c.active).length;
  const running = cards.reduce((s, c) => s + c.running, 0);
  const totalEnrolled = cards.reduce((s, c) => s + c.total, 0);
  const replied = cards.reduce((s, c) => s + c.replied, 0);
  const doneSteps = cards.reduce((s, c) => s + c.doneSteps, 0);
  const replyRate = totalEnrolled > 0 ? Math.round((replied / totalEnrolled) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Emailové sekvence"
        description="Navazující oslovení v pevném rytmu. Každý krok se zapsanému kontaktu objeví jako úkol vlastníka sekvence."
        breadcrumbs={[{ label: "CRM" }, { label: "Emailové sekvence" }]}
        actions={canCreate && <SequenceFormDialog owners={owners} currentUserId={user.id} />}
      />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <StatGrid>
          <StatCard label="Aktivní sekvence" value={activeCount} hint={`z ${cards.length}`} />
          <StatCard label="Kontakty v běhu" value={running} hint={`${totalEnrolled} zapsaných celkem`} />
          <StatCard label="Míra odpovědí" value={`${replyRate} %`} hint={`${replied} odpovědělo`} />
          <StatCard label="Dokončené kroky" value={doneSteps} hint="splněné úkoly ze sekvencí" />
        </StatGrid>

        {cards.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/8 px-4 py-16 text-center">
            <span className="text-sm font-medium">Zatím žádná sekvence</span>
            <span className="caption-style max-w-sm leading-snug text-subtle">
              Vytvořte rytmus kroků (email, hovor, úkol) a zapište do něj kontakty. Kroky se jim rozplánují jako úkoly.
            </span>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {cards.map((sequence) => (
            <li key={sequence.id} className="flex flex-col gap-4 rounded-lg bg-card p-4 outline-1 -outline-offset-1 outline-white/6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="flex items-center gap-2">
                    <h2 className="truncate text-base leading-none font-semibold">{sequence.name}</h2>
                    <Tag tone={sequence.active ? "green" : "neutral"} size="sm">
                      {sequence.active ? "Aktivní" : "Pozastaveno"}
                    </Tag>
                  </span>
                  <span className="caption-style flex flex-wrap items-center gap-1.5 text-soft">
                    <OwnerBadge name={sequence.owner.name} />
                    <span>
                      · {sequence.steps.length} kroků během {sequence.lastDay} dní
                    </span>
                  </span>
                  {sequence.description && <p className="text-sm leading-snug text-muted-foreground">{sequence.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <EnrollDialog
                      sequenceId={sequence.id}
                      sequenceName={sequence.name}
                      contacts={enrollContacts}
                      enrolledIds={sequence.enrollmentRows.map((e) => e.contactId)}
                      disabled={!sequence.active}
                    />
                  )}
                  {canEdit && <SequenceToggle id={sequence.id} active={sequence.active} />}
                  {canDelete && <SequenceDelete id={sequence.id} name={sequence.name} />}
                </div>
              </div>

              <ol className="flex flex-wrap items-center gap-1.5" aria-label="Kroky">
                {sequence.steps.map((step, index) => {
                  const meta = stepTypeMeta(step.type);
                  return (
                    <li key={step.id} className="flex items-center gap-1.5">
                      {index > 0 && <span aria-hidden className="h-px w-3 bg-white/15" />}
                      <Tag tone={meta.tone} size="sm" title={step.body ?? undefined}>
                        Den {step.dayOffset} · {meta.label}: {step.title}
                      </Tag>
                    </li>
                  );
                })}
              </ol>

              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <dt className="caption-style text-subtle">Zapsáno</dt>
                  <dd className="text-sm tabular-nums">{sequence.total}</dd>
                </div>
                <div className="flex flex-col gap-2">
                  <dt className="caption-style text-subtle">V běhu</dt>
                  <dd className="text-sm tabular-nums">{sequence.running}</dd>
                </div>
                <div className="flex flex-col gap-2">
                  <dt className="caption-style text-subtle">Splněné kroky</dt>
                  <dd className="flex items-center gap-2 text-sm tabular-nums">
                    <SegmentBar percent={sequence.progress} tone="success" segments={12} className="w-[60px]" />
                    {sequence.progress} %
                  </dd>
                </div>
                <div className="flex flex-col gap-2">
                  <dt className="caption-style text-subtle">Míra odpovědí</dt>
                  <dd className="flex items-center gap-2 text-sm tabular-nums">
                    <SegmentBar percent={sequence.replyRate} tone="warning" segments={12} className="w-[60px]" />
                    {sequence.replyRate} %
                  </dd>
                </div>
              </dl>

              {sequence.enrollmentRows.length > 0 && (
                <details className="group border-t pt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-soft transition-colors hover:text-foreground">
                    Zapsané kontakty <CountBadge>{sequence.enrollmentRows.length}</CountBadge>
                    <span className="caption-style text-subtle group-open:hidden">zobrazit</span>
                  </summary>
                  <ul className="mt-2 divide-y divide-border">
                    {sequence.enrollmentRows.map((e) => {
                      const meta = ENROLLMENT_STATUSES[e.status] ?? ENROLLMENT_STATUSES.active;
                      return (
                        <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                          <Link href={`/crm/contacts/${e.contactId}`} className="min-w-0 truncate hover:underline">
                            {e.contactName}
                          </Link>
                          {e.company && <span className="caption-style truncate text-subtle">{e.company}</span>}
                          <span className="ml-auto flex items-center gap-2">
                            <span className="caption-style text-subtle tabular-nums">
                              {e.doneSteps}/{e.totalSteps} · od {formatDate(e.enrolledAt)}
                            </span>
                            <Tag tone={meta.tone} size="sm">
                              {meta.label}
                            </Tag>
                            {canEdit && e.status === "active" && <EnrollmentActions id={e.id} />}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
