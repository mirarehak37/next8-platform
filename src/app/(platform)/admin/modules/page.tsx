import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ModuleToggle } from "@/components/admin/module-toggle";
import {
  Users2, Receipt, ShoppingCart, FileSignature, KanbanSquare, LifeBuoy, Folder, IdCard, Package, CheckCheck, type LucideIcon,
} from "lucide-react";

const MODULE_ICONS: Record<string, LucideIcon> = {
  "users-round": Users2, receipt: Receipt, "shopping-cart": ShoppingCart, "file-signature": FileSignature,
  "kanban-square": KanbanSquare, "life-buoy": LifeBuoy, folder: Folder, "id-card": IdCard, package: Package, "check-check": CheckCheck,
};

export default async function ModulesPage() {
  const session = await auth();
  const user = session!.user;

  const tenantModules = await prisma.tenantModule.findMany({
    where: { tenantId: user.tenantId },
    include: { module: true },
    orderBy: { module: { order: "asc" } },
  });

  return (
    <div>
      <PageHeader
        title="Moduly platformy"
        description="Aktivujte další aplikace pro digitalizaci firemních procesů — sdílí uživatele, oprávnění, dokumenty, úkoly i automatizace s CRM."
        breadcrumbs={[{ label: "Administrace" }, { label: "Moduly platformy" }]}
      />
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenantModules.map((tm) => {
          const Icon = MODULE_ICONS[tm.module.icon] ?? Package;
          return (
            <Card key={tm.id}>
              <CardContent className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FF1947]/10 text-[#FF1947] dark:bg-[#FF1947]/10">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{tm.module.name}</span>
                    <ModuleToggle moduleId={tm.moduleId} enabled={tm.enabled} isCore={tm.module.isCore} />
                  </div>
                  <div className="mt-1.5">
                    {tm.module.isCore ? (
                      <StatusBadge label="Základní modul" color="indigo" />
                    ) : tm.enabled ? (
                      <StatusBadge label="Aktivní" color="emerald" />
                    ) : (
                      <StatusBadge label="Připravujeme" color="slate" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
