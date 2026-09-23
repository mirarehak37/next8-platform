import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { CustomFieldDialog, DeleteCustomFieldButton } from "@/components/admin/custom-field-dialog";

const ENTITY_LABELS: Record<string, string> = { company: "Firma", contact: "Kontakt", lead: "Lead", deal: "Obchodní případ" };
const FIELD_TYPE_LABELS: Record<string, string> = { text: "Text", number: "Číslo", date: "Datum", boolean: "Ano/Ne", select: "Výběr", multiselect: "Výběr (více)", currency: "Měna" };

export default async function CustomFieldsPage() {
  const session = await auth();
  const user = session!.user;

  const fields = await prisma.customFieldDefinition.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ entityType: "asc" }, { order: "asc" }] });

  return (
    <div>
      <PageHeader
        title="Vlastní pole"
        description="Rozšiřte kterýkoliv záznam v CRM o vlastní pole bez nutnosti programování."
        breadcrumbs={[{ label: "Administrace" }, { label: "Vlastní pole" }]}
        actions={<CustomFieldDialog />}
      />
      <div className="p-6">
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entita</TableHead>
                <TableHead>Popisek</TableHead>
                <TableHead>Klíč</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Možnosti</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground h-24">Zatím žádná vlastní pole.</TableCell></TableRow>
              )}
              {fields.map((f) => (
                <TableRow key={f.id}>
                  <TableCell><StatusBadge label={ENTITY_LABELS[f.entityType] ?? f.entityType} color="indigo" /></TableCell>
                  <TableCell className="font-medium">{f.label}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{f.key}</TableCell>
                  <TableCell>{FIELD_TYPE_LABELS[f.fieldType] ?? f.fieldType}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{f.options ? JSON.parse(f.options).join(", ") : "—"}</TableCell>
                  <TableCell><DeleteCustomFieldButton id={f.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
