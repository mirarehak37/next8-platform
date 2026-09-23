// Role -> permission matrix. RolePermission/Permission tables in the schema make this
// data-driven from the Admin UI in the future; this static map is the enforcement layer
// for the initial CRM module and mirrors what gets seeded into those tables.

export type ModuleResource =
  | "dashboard"
  | "company"
  | "contact"
  | "lead"
  | "deal"
  | "product"
  | "quote"
  | "activity"
  | "task"
  | "report"
  | "roadmap"
  | "admin";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "export" | "approve" | "admin";

export type Scope = "own" | "team" | "all";

export type RoleName =
  | "Administrator"
  | "Management"
  | "Sales Manager"
  | "Sales"
  | "Marketing"
  | "Finance"
  | "Support"
  | "Read Only";

type RoleMatrix = Record<RoleName, Partial<Record<ModuleResource, { actions: PermissionAction[]; scope: Scope }>>>;

const ALL_ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "export", "approve", "admin"];
const EDIT_ACTIONS: PermissionAction[] = ["view", "create", "edit", "export"];
const VIEW_ONLY: PermissionAction[] = ["view"];

export const ROLE_MATRIX: RoleMatrix = {
  Administrator: {
    dashboard: { actions: ALL_ACTIONS, scope: "all" },
    company: { actions: ALL_ACTIONS, scope: "all" },
    contact: { actions: ALL_ACTIONS, scope: "all" },
    lead: { actions: ALL_ACTIONS, scope: "all" },
    deal: { actions: ALL_ACTIONS, scope: "all" },
    product: { actions: ALL_ACTIONS, scope: "all" },
    quote: { actions: ALL_ACTIONS, scope: "all" },
    activity: { actions: ALL_ACTIONS, scope: "all" },
    task: { actions: ALL_ACTIONS, scope: "all" },
    report: { actions: ALL_ACTIONS, scope: "all" },
    roadmap: { actions: ALL_ACTIONS, scope: "all" },
    admin: { actions: ALL_ACTIONS, scope: "all" },
  },
  Management: {
    dashboard: { actions: VIEW_ONLY, scope: "all" },
    company: { actions: EDIT_ACTIONS, scope: "all" },
    contact: { actions: EDIT_ACTIONS, scope: "all" },
    lead: { actions: EDIT_ACTIONS, scope: "all" },
    deal: { actions: [...EDIT_ACTIONS, "approve"], scope: "all" },
    product: { actions: VIEW_ONLY, scope: "all" },
    quote: { actions: [...EDIT_ACTIONS, "approve"], scope: "all" },
    activity: { actions: EDIT_ACTIONS, scope: "all" },
    task: { actions: EDIT_ACTIONS, scope: "all" },
    report: { actions: ALL_ACTIONS, scope: "all" },
    roadmap: { actions: [...EDIT_ACTIONS, "delete", "approve"], scope: "all" },
  },
  "Sales Manager": {
    dashboard: { actions: VIEW_ONLY, scope: "team" },
    company: { actions: EDIT_ACTIONS, scope: "team" },
    contact: { actions: EDIT_ACTIONS, scope: "team" },
    lead: { actions: EDIT_ACTIONS, scope: "team" },
    deal: { actions: [...EDIT_ACTIONS, "approve"], scope: "team" },
    product: { actions: VIEW_ONLY, scope: "all" },
    quote: { actions: [...EDIT_ACTIONS, "approve"], scope: "team" },
    activity: { actions: EDIT_ACTIONS, scope: "team" },
    task: { actions: EDIT_ACTIONS, scope: "team" },
    report: { actions: ["view", "export"], scope: "team" },
    roadmap: { actions: ["view", "create"], scope: "all" },
  },
  Sales: {
    dashboard: { actions: VIEW_ONLY, scope: "own" },
    company: { actions: EDIT_ACTIONS, scope: "own" },
    contact: { actions: EDIT_ACTIONS, scope: "own" },
    lead: { actions: EDIT_ACTIONS, scope: "own" },
    deal: { actions: EDIT_ACTIONS, scope: "own" },
    product: { actions: VIEW_ONLY, scope: "all" },
    quote: { actions: EDIT_ACTIONS, scope: "own" },
    activity: { actions: EDIT_ACTIONS, scope: "own" },
    task: { actions: EDIT_ACTIONS, scope: "own" },
    report: { actions: ["view"], scope: "own" },
    roadmap: { actions: ["view", "create"], scope: "all" },
  },
  Marketing: {
    dashboard: { actions: VIEW_ONLY, scope: "all" },
    company: { actions: VIEW_ONLY, scope: "all" },
    contact: { actions: EDIT_ACTIONS, scope: "all" },
    lead: { actions: EDIT_ACTIONS, scope: "all" },
    activity: { actions: EDIT_ACTIONS, scope: "own" },
    task: { actions: EDIT_ACTIONS, scope: "own" },
    report: { actions: ["view", "export"], scope: "all" },
    roadmap: { actions: ["view", "create"], scope: "all" },
  },
  Finance: {
    dashboard: { actions: VIEW_ONLY, scope: "all" },
    company: { actions: VIEW_ONLY, scope: "all" },
    contact: { actions: VIEW_ONLY, scope: "all" },
    deal: { actions: VIEW_ONLY, scope: "all" },
    product: { actions: EDIT_ACTIONS, scope: "all" },
    quote: { actions: [...EDIT_ACTIONS, "approve"], scope: "all" },
    report: { actions: ["view", "export"], scope: "all" },
    roadmap: { actions: ["view", "create"], scope: "all" },
  },
  Support: {
    dashboard: { actions: VIEW_ONLY, scope: "own" },
    company: { actions: VIEW_ONLY, scope: "all" },
    contact: { actions: EDIT_ACTIONS, scope: "all" },
    activity: { actions: EDIT_ACTIONS, scope: "own" },
    task: { actions: EDIT_ACTIONS, scope: "own" },
    roadmap: { actions: ["view", "create"], scope: "all" },
  },
  "Read Only": {
    dashboard: { actions: VIEW_ONLY, scope: "all" },
    company: { actions: VIEW_ONLY, scope: "all" },
    contact: { actions: VIEW_ONLY, scope: "all" },
    lead: { actions: VIEW_ONLY, scope: "all" },
    deal: { actions: VIEW_ONLY, scope: "all" },
    product: { actions: VIEW_ONLY, scope: "all" },
    quote: { actions: VIEW_ONLY, scope: "all" },
    activity: { actions: VIEW_ONLY, scope: "all" },
    task: { actions: VIEW_ONLY, scope: "all" },
    report: { actions: VIEW_ONLY, scope: "all" },
    roadmap: { actions: VIEW_ONLY, scope: "all" },
  },
};

export function can(role: string | undefined, resource: ModuleResource, action: PermissionAction): boolean {
  if (!role) return false;
  const entry = ROLE_MATRIX[role as RoleName]?.[resource];
  if (!entry) return false;
  return entry.actions.includes(action);
}

export function scopeFor(role: string | undefined, resource: ModuleResource): Scope | undefined {
  if (!role) return undefined;
  return ROLE_MATRIX[role as RoleName]?.[resource]?.scope;
}

export const ROLE_NAMES: RoleName[] = [
  "Administrator",
  "Management",
  "Sales Manager",
  "Sales",
  "Marketing",
  "Finance",
  "Support",
  "Read Only",
];
