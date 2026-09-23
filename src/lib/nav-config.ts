import type { ModuleResource } from "@/lib/rbac";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  resource?: ModuleResource;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", resource: "dashboard" }],
  },
  {
    label: "CRM",
    items: [
      { label: "Firmy", href: "/crm/companies", icon: "Building2", resource: "company" },
      { label: "Kontakty", href: "/crm/contacts", icon: "Users", resource: "contact" },
      { label: "Leady", href: "/crm/leads", icon: "UserPlus", resource: "lead" },
      { label: "Obchodní případy", href: "/crm/deals", icon: "Handshake", resource: "deal" },
      { label: "Aktivity", href: "/crm/activities", icon: "Activity", resource: "activity" },
      { label: "Produkty", href: "/crm/products", icon: "Package", resource: "product" },
      { label: "Nabídky", href: "/crm/quotes", icon: "FileText", resource: "quote" },
      { label: "Import dat", href: "/crm/import", icon: "Upload", resource: "company" },
    ],
  },
  {
    label: "Práce",
    items: [
      { label: "Úkoly", href: "/tasks", icon: "CheckSquare", resource: "task" },
      { label: "Kalendář", href: "/calendar", icon: "Calendar", resource: "task" },
      { label: "Reporty", href: "/reports", icon: "BarChart3", resource: "report" },
    ],
  },
  {
    label: "Platforma",
    items: [{ label: "Roadmap", href: "/roadmap", icon: "Map", resource: "roadmap" }],
  },
  {
    label: "Administrace",
    items: [
      { label: "Uživatelé", href: "/admin/users", icon: "UserCog", resource: "admin" },
      { label: "Role a oprávnění", href: "/admin/roles", icon: "ShieldCheck", resource: "admin" },
      { label: "Týmy", href: "/admin/teams", icon: "UsersRound", resource: "admin" },
      { label: "Moduly platformy", href: "/admin/modules", icon: "LayoutGrid", resource: "admin" },
      { label: "Vlastní pole", href: "/admin/custom-fields", icon: "SlidersHorizontal", resource: "admin" },
      { label: "Automatizace", href: "/admin/automation", icon: "Workflow", resource: "admin" },
      { label: "Audit log", href: "/admin/audit-log", icon: "History", resource: "admin" },
    ],
  },
];
