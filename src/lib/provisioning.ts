import { prisma } from "@/lib/prisma";
import { ROLE_MATRIX, ROLE_NAMES } from "@/lib/rbac";

// The platform's module registry — a shared, tenant-independent catalog. Kept here (not
// only in prisma/seed.ts) so a brand-new production database can bootstrap itself the
// first time anyone registers, without a human having to SSH in and run a seed script.
export const MODULE_DEFS = [
  { code: "crm", name: "CRM", icon: "users-round", isCore: true, route: "/crm", order: 1 },
  { code: "roadmap", name: "Roadmap", icon: "map", isCore: true, route: "/roadmap", order: 2 },
  { code: "invoices", name: "Faktury", icon: "receipt", isCore: false, route: "/invoices", order: 3 },
  { code: "orders", name: "Objednávky", icon: "shopping-cart", isCore: false, route: "/orders", order: 4 },
  { code: "contracts", name: "Smlouvy", icon: "file-signature", isCore: false, route: "/contracts", order: 5 },
  { code: "projects", name: "Projekty", icon: "kanban-square", isCore: false, route: "/projects", order: 6 },
  { code: "helpdesk", name: "HelpDesk", icon: "life-buoy", isCore: false, route: "/helpdesk", order: 7 },
  { code: "documents", name: "Dokumenty (DMS)", icon: "folder", isCore: false, route: "/documents", order: 8 },
  { code: "hr", name: "HR", icon: "id-card", isCore: false, route: "/hr", order: 9 },
  { code: "assets", name: "Majetek", icon: "package", isCore: false, route: "/assets", order: 10 },
  { code: "approvals", name: "Schvalování", icon: "check-check", isCore: false, route: "/approvals", order: 11 },
] as const;

// Idempotent and race-safe (createMany + skipDuplicates on the unique `code` columns), so
// it's cheap to call on every registration instead of requiring a one-off seed step.
export async function ensureGlobalCatalog() {
  await prisma.module.createMany({ data: [...MODULE_DEFS], skipDuplicates: true });

  const actionSet = new Set<string>();
  const resources = new Set<string>();
  for (const roleName of ROLE_NAMES) {
    for (const [resource, def] of Object.entries(ROLE_MATRIX[roleName])) {
      resources.add(resource);
      def!.actions.forEach((a) => actionSet.add(a));
    }
  }
  const permissionDefs = Array.from(resources).flatMap((resource) =>
    Array.from(actionSet).map((action) => ({
      code: `${resource}.${action}`,
      module: "crm",
      resource,
      action,
      label: `${resource}:${action}`,
    })),
  );
  await prisma.permission.createMany({ data: permissionDefs, skipDuplicates: true });
}

// Sets up everything a freshly registered tenant needs to be immediately usable: core
// modules enabled, the 8 system roles wired to the permission catalog, and a default
// sales pipeline so the Deals Kanban has somewhere to put cards.
export async function provisionTenant(tenantId: string) {
  await ensureGlobalCatalog();
  const [modules, permissions] = await Promise.all([prisma.module.findMany(), prisma.permission.findMany()]);

  const permissionByCode = new Map(permissions.map((p) => [p.code, p.id]));
  const coreModuleCodes = new Set(["crm", "roadmap"]);

  await prisma.tenantModule.createMany({
    data: modules.map((m) => ({ tenantId, moduleId: m.id, enabled: coreModuleCodes.has(m.code) })),
  });

  for (const roleName of ROLE_NAMES) {
    const role = await prisma.role.create({
      data: { tenantId, name: roleName, isSystem: true, description: `Systémová role ${roleName}` },
    });
    const matrix = ROLE_MATRIX[roleName];
    const rolePermissions: { roleId: string; permissionId: string; scope: string }[] = [];
    for (const [resource, def] of Object.entries(matrix)) {
      for (const action of def!.actions) {
        const permId = permissionByCode.get(`${resource}.${action}`);
        if (permId) rolePermissions.push({ roleId: role.id, permissionId: permId, scope: def!.scope });
      }
    }
    if (rolePermissions.length > 0) {
      await prisma.rolePermission.createMany({ data: rolePermissions });
    }
  }

  const pipeline = await prisma.pipeline.create({
    data: { tenantId, name: "Standardní obchodní pipeline", isDefault: true, order: 1 },
  });
  const stageDefs = [
    { name: "Nový", order: 1, probability: 10 },
    { name: "Kvalifikace", order: 2, probability: 20 },
    { name: "Analýza", order: 3, probability: 35 },
    { name: "Demo", order: 4, probability: 50 },
    { name: "Nabídka", order: 5, probability: 65 },
    { name: "Jednání", order: 6, probability: 80 },
    { name: "Vyhráno", order: 7, probability: 100, isWon: true },
    { name: "Prohráno", order: 8, probability: 0, isLost: true },
  ];
  await prisma.pipelineStage.createMany({
    data: stageDefs.map((s) => ({ pipelineId: pipeline.id, name: s.name, order: s.order, probability: s.probability, isWon: !!s.isWon, isLost: !!s.isLost })),
  });

  return { pipeline };
}

export async function getAdministratorRoleId(tenantId: string) {
  const role = await prisma.role.findFirst({ where: { tenantId, name: "Administrator" } });
  if (!role) throw new Error("Role Administrator nebyla pro tuto organizaci nalezena.");
  return role.id;
}
