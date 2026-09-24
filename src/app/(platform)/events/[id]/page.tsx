import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EventFormDialog } from "@/components/events/event-form-dialog";
import { RegistrationFormDialog } from "@/components/events/registration-form-dialog";
import { RegistrationsList, type RegistrationView } from "@/components/events/registrations-list";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { RecordEditTrigger } from "@/components/partnerships/form-parts";
import { EVENT_STATUSES, EVENT_TYPES, findMeta } from "@/lib/constants";
import { eventDateLabel, eventStats } from "@/lib/events";
import { toDateInput } from "@/lib/partnerships";
import { formatCurrency } from "@/lib/format";
import { Building2, CalendarDays, MapPin, Users, CheckCircle2, Wallet, Star } from "lucide-react";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "event", "view")) redirect("/dashboard");

  const event = await prisma.event.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      owner: { select: { name: true } },
      company: { select: { id: true, name: true } },
      registrations: { include: { company: { select: { name: true } } }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!event) notFound();

  const canEdit = can(user.role, "event", "edit");
  const [owners, companies, contacts, ambassadors] = canEdit
    ? await Promise.all([
        prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.contact.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
        prisma.ambassador.findMany({ where: { tenantId: user.tenantId, status: { notIn: ["ended"] } }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
      ])
    : [[], [], [], []];

  const type = findMeta(EVENT_TYPES, event.type);
  const status = findMeta(EVENT_STATUSES, event.status);
  const st = eventStats(event.registrations, event.capacity);
  const rows: RegistrationView[] = event.registrations.map((r) => ({
    id: r.id, role: r.role, name: r.name, email: r.email, phone: r.phone, contactId: r.contactId, ambassadorId: r.ambassadorId,
    companyName: r.company?.name ?? null, status: r.status, paymentStatus: r.paymentStatus, amount: r.amount, note: r.note,
  }));

  return (
    <div>
      <PageHeader
        title={event.name}
        breadcrumbs={[{ label: "Akce a kempy", href: "/events" }, { label: event.name }]}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <EventFormDialog
                owners={owners}
                companies={companies}
                event={{
                  id: event.id, name: event.name, type: event.type, status: event.status, startDate: toDateInput(event.startDate)!,
                  endDate: toDateInput(event.endDate), location: event.location, capacity: event.capacity, price: event.price,
                  companyId: event.companyId, ownerId: event.ownerId, description: event.description,
                }}
                trigger={<RecordEditTrigger />}
              />
            )}
            {can(user.role, "event", "delete") && <DeleteEventButton id={event.id} name={event.name} />}
          </div>
        }
      />
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {type && <StatusBadge label={type.label} color={type.color} />}
              {status && <StatusBadge label={status.label} color={status.color} />}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {eventDateLabel(event.startDate, event.endDate)}</span>
              {event.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>}
              {event.company && (
                <Link href={`/crm/companies/${event.company.id}`} className="flex items-center gap-1.5 hover:text-foreground"><Building2 className="h-3.5 w-3.5" /> {event.company.name}</Link>
              )}
              <span>{event.price ? `${formatCurrency(event.price)} / účastník` : "Zdarma"}</span>
              <span>Vlastník: {event.owner.name}</span>
            </div>
            {event.description && <p className="text-sm whitespace-pre-line pt-1">{event.description}</p>}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Účastníci" value={`${st.participants}${event.capacity ? ` / ${event.capacity}` : ""}`} hint={st.free !== null ? `volných míst: ${st.free}` : undefined} icon={Users} />
          <KpiCard label="Trenéři a hosté" value={String(st.coaches + st.guests)} hint={st.guests ? `z toho ${st.guests} hostů` : undefined} icon={Star} />
          <KpiCard label="Zúčastnilo se" value={String(st.attended)} icon={CheckCircle2} />
          <KpiCard label="Zaplaceno" value={formatCurrency(st.paid)} hint={st.unpaid ? `nezaplaceno ${formatCurrency(st.unpaid)}` : undefined} icon={Wallet} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Přihlášky ({rows.filter((r) => r.status !== "cancelled").length})</h2>
            {canEdit && (
              <RegistrationFormDialog
                eventId={event.id}
                price={event.price}
                contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
                ambassadors={ambassadors.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }))}
                companies={companies}
              />
            )}
          </div>
          <RegistrationsList rows={rows} canEdit={canEdit} eventName={event.name} />
        </div>
      </div>
    </div>
  );
}
