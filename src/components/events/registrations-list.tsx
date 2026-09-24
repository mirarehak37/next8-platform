"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { FormSelect } from "@/components/form-select";
import { deleteRegistration, updateRegistration } from "@/lib/actions/events";
import { exportToCsv } from "@/lib/export-csv";
import { PAYMENT_STATUSES, REGISTRATION_ROLES, REGISTRATION_STATUSES, findMeta } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download, Mail, Phone, Trash2 } from "lucide-react";

export type RegistrationView = {
  id: string;
  role: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactId: string | null;
  ambassadorId: string | null;
  companyName: string | null;
  status: string;
  paymentStatus: string;
  amount: number | null;
  note: string | null;
};

export function RegistrationsList({ rows, canEdit, eventName }: { rows: RegistrationView[]; canEdit: boolean; eventName: string }) {
  const router = useRouter();

  async function change(id: string, data: Partial<Pick<RegistrationView, "status" | "paymentStatus">>) {
    try {
      await updateRegistration(id, data);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  async function remove(r: RegistrationView) {
    if (!confirm(`Smazat přihlášku: ${r.name}?`)) return;
    try {
      await deleteRegistration(r.id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground border rounded-md border-dashed">Zatím žádné přihlášky.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportToCsv(
              `prihlasky-${eventName}`,
              rows.map((r) => ({
                Jméno: r.name,
                Role: findMeta(REGISTRATION_ROLES, r.role)?.label ?? r.role,
                Klub: r.companyName ?? "",
                "E-mail": r.email ?? "",
                Telefon: r.phone ?? "",
                Stav: findMeta(REGISTRATION_STATUSES, r.status)?.label ?? r.status,
                Platba: findMeta(PAYMENT_STATUSES, r.paymentStatus)?.label ?? r.paymentStatus,
                "Částka (Kč)": r.amount ?? "",
                Poznámka: r.note ?? "",
              })),
            )
          }
        >
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>
      {rows.map((r) => {
        const role = findMeta(REGISTRATION_ROLES, r.role);
        const status = findMeta(REGISTRATION_STATUSES, r.status);
        const payment = findMeta(PAYMENT_STATUSES, r.paymentStatus);
        const href = r.contactId ? `/crm/contacts/${r.contactId}` : r.ambassadorId ? `/crm/ambassadors/${r.ambassadorId}` : null;
        return (
          <Card key={r.id} className={r.status === "cancelled" ? "opacity-60" : undefined}>
            <CardContent className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {href ? <Link href={href} className="text-sm font-medium hover:underline">{r.name}</Link> : <span className="text-sm font-medium">{r.name}</span>}
                  {role && r.role !== "participant" && <StatusBadge label={role.label} color={role.color} />}
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {r.companyName && <span>{r.companyName}</span>}
                  {r.email && <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />{r.email}</a>}
                  {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                </div>
                {r.note && <div className="text-xs text-muted-foreground mt-0.5">{r.note}</div>}
              </div>
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-2">
                  <FormSelect value={r.status} onChange={(v) => change(r.id, { status: v })} options={REGISTRATION_STATUSES.map((s) => ({ value: s.value, label: s.label }))} className="w-36" />
                  {r.role === "participant" && (
                    <FormSelect value={r.paymentStatus} onChange={(v) => change(r.id, { paymentStatus: v })} options={PAYMENT_STATUSES.map((s) => ({ value: s.value, label: s.label }))} className="w-36" />
                  )}
                </div>
              ) : (
                <div className="flex gap-1">
                  {status && <StatusBadge label={status.label} color={status.color} />}
                  {payment && r.role === "participant" && <StatusBadge label={payment.label} color={payment.color} />}
                </div>
              )}
              <div className="w-24 text-right text-sm font-medium">{r.role === "participant" && r.amount ? formatCurrency(r.amount) : "—"}</div>
              {canEdit && (
                <Button variant="ghost" size="icon-sm" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
