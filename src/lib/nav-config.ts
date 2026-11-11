import type { ModuleResource } from "@/lib/rbac";

export type NavCountKey = "companies" | "contacts" | "leads" | "openDeals" | "myTasks" | "slipping";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  resource?: ModuleResource;
  countKey?: NavCountKey;
};

export type NavGroup = {
  label?: string;
  collapsible?: boolean;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", resource: "dashboard" },
      { label: "Kluby", href: "/crm/companies", icon: "Building2", resource: "company", countKey: "companies" },
      { label: "Mapa trhu", href: "/crm/market", icon: "MapPinned", resource: "company" },
      { label: "Kontakty", href: "/crm/contacts", icon: "BookUser", resource: "contact", countKey: "contacts" },
      { label: "Leady", href: "/crm/leads", icon: "UserPlus", resource: "lead", countKey: "leads" },
      { label: "Obchodní případy", href: "/crm/deals", icon: "KanbanSquare", resource: "deal", countKey: "openDeals" },
      { label: "Forecast", href: "/crm/forecast", icon: "BarChart3", resource: "deal" },
      { label: "Aktivity", href: "/crm/activities", icon: "ListChecks", resource: "activity" },
    ],
  },
  {
    label: "Obchod",
    items: [
      { label: "Produkty", href: "/crm/products", icon: "Package", resource: "product" },
      { label: "Nabídky", href: "/crm/quotes", icon: "FileText", resource: "quote" },
      { label: "Import dat", href: "/crm/import", icon: "Upload", resource: "company" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Přehled", href: "/marketing", icon: "Megaphone", resource: "marketing" },
      { label: "Obsah a posty", href: "/marketing/content", icon: "Clapperboard", resource: "marketing" },
      { label: "Kampaně", href: "/marketing/campaigns", icon: "Target", resource: "marketing" },
      { label: "Webové formuláře", href: "/marketing/forms", icon: "Inbox", resource: "marketing" },
    ],
  },
  {
    label: "Partnerství",
    items: [
      { label: "Ambasadoři", href: "/crm/ambassadors", icon: "Star", resource: "ambassador" },
      { label: "Obsahový plán", href: "/crm/ambassadors/content", icon: "Clapperboard", resource: "ambassador" },
      { label: "Partneři a sponzoring", href: "/crm/partners", icon: "HeartHandshake", resource: "partner" },
    ],
  },
  {
    label: "Práce",
    items: [
      { label: "Akce a kempy", href: "/events", icon: "Tent", resource: "event" },
      { label: "Úkoly", href: "/tasks", icon: "CheckSquare", resource: "task", countKey: "myTasks" },
      { label: "Kalendář", href: "/calendar", icon: "Calendar", resource: "task" },
    ],
  },
  {
    label: "Reporty",
    items: [
      { label: "Přehled reportů", href: "/reports", icon: "ChartNoAxesColumn", resource: "report" },
      { label: "Ohrožené obchody", href: "/reports/slipping-deals", icon: "AlertTriangle", resource: "deal", countKey: "slipping" },
    ],
  },
  {
    label: "Platforma",
    items: [{ label: "Roadmap", href: "/roadmap", icon: "Map", resource: "roadmap" }],
  },
  {
    label: "Administrace",
    collapsible: true,
    items: [
      { label: "Uživatelé", href: "/admin/users", icon: "UserCog", resource: "admin" },
      { label: "Role a oprávnění", href: "/admin/roles", icon: "ShieldCheck", resource: "admin" },
      { label: "Týmy", href: "/admin/teams", icon: "UsersRound", resource: "admin" },
      { label: "Moduly platformy", href: "/admin/modules", icon: "LayoutGrid", resource: "admin" },
      { label: "Vlastní pole", href: "/admin/custom-fields", icon: "SlidersHorizontal", resource: "admin" },
      { label: "Automatizace", href: "/admin/automation", icon: "Workflow", resource: "admin" },
      { label: "Import klubů a kontaktů", href: "/admin/florbal-import", icon: "Upload", resource: "admin" },
      { label: "Audit log", href: "/admin/audit-log", icon: "History", resource: "admin" },
    ],
  },
];

const ALL_HREFS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));

// Highlight only the most specific item: /crm/ambassadors/content must light up
// "Obsahový plán", not also "Ambasadoři".
export function isNavActive(pathname: string, href: string) {
  const matches = (h: string) => pathname === h || pathname.startsWith(h + "/");
  if (!matches(href)) return false;
  return !ALL_HREFS.some((other) => other.length > href.length && matches(other));
}

export const PIPELINE_DOT_COLORS = ["#fbbf24", "#f472b6", "#a78bfa", "#38bdf8", "#34d399", "#fb923c"];
