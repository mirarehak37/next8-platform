import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check } from "lucide-react";
import { ROLE_MATRIX, ROLE_NAMES, type ModuleResource } from "@/lib/rbac";

const RESOURCE_LABELS: Record<ModuleResource, string> = {
  dashboard: "Dashboard", company: "Firmy", contact: "Kontakty", lead: "Leady", deal: "Obchody",
  product: "Produkty", quote: "Nabídky", activity: "Aktivity", task: "Úkoly", report: "Reporty", roadmap: "Roadmap", admin: "Administrace",
};

export default async function RolesPage() {
  const session = await auth();
  const user = session!.user;

  const roles = await prisma.role.findMany({
    where: { tenantId: user.tenantId },
    include: { _count: { select: { users: true, permissions: true } } },
    orderBy: { name: "asc" },
  });

  const resources = Object.keys(RESOURCE_LABELS) as ModuleResource[];

  return (
    <div>
      <PageHeader title="Role a oprávnění" description="RBAC model: Zobrazit | Vytvořit | Upravit | Smazat | Exportovat | Schválit | Administrovat" breadcrumbs={[{ label: "Administrace" }, { label: "Role" }]} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {roles.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-4">
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{r._count.users} uživatelů</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matice oprávnění</CardTitle>
            <CardDescription>Přístup k modulům podle role. Rozsah (own/team/all) určuje viditelnost záznamů.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Modul</TableHead>
                  {ROLE_NAMES.map((role) => (
                    <TableHead key={role} className="text-center whitespace-nowrap">{role}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((resource) => (
                  <TableRow key={resource}>
                    <TableCell className="font-medium">{RESOURCE_LABELS[resource]}</TableCell>
                    {ROLE_NAMES.map((role) => {
                      const entry = ROLE_MATRIX[role][resource];
                      return (
                        <TableCell key={role} className="text-center">
                          {entry ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-[10px] text-muted-foreground">{entry.scope}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
