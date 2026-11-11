import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { can, type ModuleResource, type PermissionAction } from "@/lib/rbac";
import { ownerScopeWhere } from "@/lib/scope";
import { loadSlippingDeals, quarterOf, quarterRange } from "@/lib/deal-insights";
import { logAudit } from "@/lib/actions/helpers";
import type { TokenUser } from "@/lib/api-tokens";

export class ToolError extends Error {}

type Tool<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  input: S;
  readOnly: boolean;
  run: (user: TokenUser, args: z.infer<S>) => Promise<unknown>;
};

function tool<S extends z.ZodType>(t: Tool<S>) {
  return t;
}

function require(user: TokenUser, resource: ModuleResource, action: PermissionAction = "view") {
  if (!can(user.role, resource, action)) throw new ToolError(`Role ${user.role} nemá oprávnění (${resource}:${action}).`);
}

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const DAY = 24 * 60 * 60 * 1000;

const SUBJECT_TYPES = ["company", "contact", "lead", "deal"] as const;

async function assertSubject(user: TokenUser, type?: string | null, id?: string | null) {
  if (!type || !id) return;
  const where = { id, tenantId: user.tenantId };
  const found =
    type === "company"
      ? await prisma.company.findFirst({ where, select: { id: true } })
      : type === "contact"
        ? await prisma.contact.findFirst({ where, select: { id: true } })
        : type === "lead"
          ? await prisma.lead.findFirst({ where, select: { id: true } })
          : await prisma.deal.findFirst({ where, select: { id: true } });
  if (!found) throw new ToolError(`Záznam ${type} ${id} neexistuje.`);
}

export const TOOLS = [
  tool({
    name: "search_crm",
    title: "Hledat v CRM",
    description:
      "Fulltextové hledání napříč kluby (firmami), kontakty, obchodními případy a leady. Vrací ID, které lze použít v dalších nástrojích.",
    readOnly: true,
    input: z.object({
      query: z.string().min(2).describe("Hledaný text – název klubu, jméno, e-mail, název obchodu"),
      limit: z.number().int().min(1).max(20).default(8).describe("Max. počet výsledků na typ"),
    }),
    run: async (user, { query, limit }) => {
      const contains = { contains: query, mode: "insensitive" as const };
      const t = user.tenantId;
      const [companyScope, contactScope, dealScope, leadScope] = await Promise.all([
        ownerScopeWhere(user, "company"),
        ownerScopeWhere(user, "contact"),
        ownerScopeWhere(user, "deal"),
        ownerScopeWhere(user, "lead"),
      ]);
      const [companies, contacts, deals, leads] = await Promise.all([
        can(user.role, "company", "view")
          ? prisma.company.findMany({
              where: { ...companyScope, name: contains },
              select: { id: true, name: true, status: true, sport: true, league: true, billingCity: true },
              take: limit,
            })
          : [],
        can(user.role, "contact", "view")
          ? prisma.contact.findMany({
              where: { ...contactScope, tenantId: t, OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] },
              select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true },
              take: limit,
            })
          : [],
        can(user.role, "deal", "view")
          ? prisma.deal.findMany({
              where: { ...dealScope, name: contains },
              select: { id: true, name: true, value: true, currency: true, status: true, stage: { select: { name: true } }, company: { select: { name: true } } },
              take: limit,
            })
          : [],
        can(user.role, "lead", "view")
          ? prisma.lead.findMany({
              where: { ...leadScope, OR: [{ firstName: contains }, { lastName: contains }, { companyName: contains }, { email: contains }] },
              select: { id: true, firstName: true, lastName: true, companyName: true, status: true, email: true },
              take: limit,
            })
          : [],
      ]);
      return {
        companies,
        contacts,
        deals: deals.map((d) => ({ ...d, stage: d.stage.name, company: d.company?.name ?? null })),
        leads,
      };
    },
  }),

  tool({
    name: "get_company",
    title: "Detail klubu",
    description: "Detail klubu/firmy: údaje, kontakty, týmy, obchodní případy a posledních 10 aktivit.",
    readOnly: true,
    input: z.object({ company_id: z.string().describe("ID klubu z search_crm") }),
    run: async (user, { company_id }) => {
      require(user, "company");
      const scope = await ownerScopeWhere(user, "company");
      const company = await prisma.company.findFirst({
        where: { ...scope, id: company_id },
        include: {
          owner: { select: { name: true } },
          contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true } } } },
          clubTeams: { select: { id: true, name: true, category: true, league: true } },
          deals: {
            select: { id: true, name: true, value: true, currency: true, status: true, expectedCloseDate: true, stage: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!company) throw new ToolError("Klub nenalezen nebo k němu nemáte přístup.");
      const activities = can(user.role, "activity", "view")
        ? await prisma.activity.findMany({
            where: { tenantId: user.tenantId, subjectType: "company", subjectId: company.id },
            orderBy: { activityAt: "desc" },
            take: 10,
            select: { type: true, subject: true, description: true, activityAt: true, owner: { select: { name: true } } },
          })
        : [];
      return {
        id: company.id,
        name: company.name,
        status: company.status,
        sport: company.sport,
        league: company.league,
        city: company.billingCity,
        website: company.website,
        email: company.email,
        phone: company.phone,
        owner: company.owner.name,
        description: company.description,
        contacts: company.contacts.map((c) => c.contact),
        teams: company.clubTeams,
        deals: company.deals.map((d) => ({ ...d, stage: d.stage.name, expectedCloseDate: day(d.expectedCloseDate) })),
        recentActivities: activities.map((a) => ({ ...a, owner: a.owner.name })),
      };
    },
  }),

  tool({
    name: "list_deals",
    title: "Seznam obchodů",
    description: "Obchodní případy viditelné pro uživatele, seřazené podle hodnoty. Lze filtrovat podle stavu a jen na vlastní.",
    readOnly: true,
    input: z.object({
      status: z.enum(["open", "won", "lost", "all"]).default("open"),
      only_mine: z.boolean().default(false).describe("Jen obchody, které vlastním já"),
      limit: z.number().int().min(1).max(100).default(25),
    }),
    run: async (user, { status, only_mine, limit }) => {
      require(user, "deal");
      const scope = await ownerScopeWhere(user, "deal");
      const deals = await prisma.deal.findMany({
        where: {
          ...scope,
          ...(status !== "all" ? { status } : {}),
          ...(only_mine ? { AND: [{ ownerId: user.id }] } : {}),
        },
        include: { stage: { select: { name: true, probability: true } }, company: { select: { id: true, name: true } }, owner: { select: { name: true } } },
        orderBy: { value: "desc" },
        take: limit,
      });
      return deals.map((d) => ({
        id: d.id,
        name: d.name,
        company: d.company,
        stage: d.stage.name,
        probability: d.probability ?? d.stage.probability,
        value: d.value,
        currency: d.currency,
        status: d.status,
        expectedCloseDate: day(d.expectedCloseDate),
        nextStep: d.nextStep,
        owner: d.owner.name,
      }));
    },
  }),

  tool({
    name: "pipeline_summary",
    title: "Přehled pipeline a forecastu",
    description:
      "Souhrn otevřené pipeline po fázích, forecast aktuálního čtvrtletí (vyhráno, commit ≥ 75 %, best case ≥ 50 %) a počet ohrožených obchodů.",
    readOnly: true,
    input: z.object({}),
    run: async (user) => {
      require(user, "deal");
      const scope = await ownerScopeWhere(user, "deal");
      const q = quarterOf(new Date());
      const { start, end } = quarterRange(q.year, q.quarter);
      const [open, wonQuarter, slipping] = await Promise.all([
        prisma.deal.findMany({ where: { ...scope, status: "open" }, include: { stage: { select: { name: true, order: true, probability: true } } } }),
        prisma.deal.aggregate({ where: { ...scope, status: "won", closedAt: { gte: start, lt: end } }, _sum: { value: true }, _count: true }),
        loadSlippingDeals(scope, user.tenantId),
      ]);
      const byStage = new Map<string, { stage: string; order: number; count: number; value: number }>();
      for (const d of open) {
        const e = byStage.get(d.stage.name) ?? { stage: d.stage.name, order: d.stage.order, count: 0, value: 0 };
        e.count += 1;
        e.value += d.value;
        byStage.set(d.stage.name, e);
      }
      const inQuarter = open.filter((d) => d.expectedCloseDate && d.expectedCloseDate >= start && d.expectedCloseDate < end);
      const prob = (d: (typeof open)[number]) => d.probability ?? d.stage.probability;
      const won = wonQuarter._sum.value ?? 0;
      const commit = won + inQuarter.filter((d) => prob(d) >= 75).reduce((s, d) => s + d.value, 0);
      const bestCase = won + inQuarter.filter((d) => prob(d) >= 50).reduce((s, d) => s + d.value, 0);
      return {
        currency: "CZK",
        openDeals: open.length,
        openValue: open.reduce((s, d) => s + d.value, 0),
        weightedValue: Math.round(open.reduce((s, d) => s + (d.value * prob(d)) / 100, 0)),
        stages: Array.from(byStage.values()).sort((a, b) => a.order - b.order).map(({ stage, count, value }) => ({ stage, count, value })),
        forecast: { quarter: `Q${q.quarter} ${q.year}`, closedWon: won, wonDeals: wonQuarter._count, commit, bestCase, pipelineInQuarter: inQuarter.reduce((s, d) => s + d.value, 0) },
        slippingDeals: slipping.length,
        slippingValue: slipping.reduce((s, r) => s + r.deal.value, 0),
      };
    },
  }),

  tool({
    name: "list_slipping_deals",
    title: "Ohrožené obchody",
    description: "Otevřené obchody po termínu uzavření nebo bez aktivity déle než 21 dní, s důvodem.",
    readOnly: true,
    input: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
    run: async (user, { limit }) => {
      require(user, "deal");
      const scope = await ownerScopeWhere(user, "deal");
      const rows = await loadSlippingDeals(scope, user.tenantId);
      return rows.slice(0, limit).map(({ deal, reasons }) => ({
        id: deal.id,
        name: deal.name,
        company: deal.company?.name ?? null,
        stage: deal.stage.name,
        value: deal.value,
        currency: deal.currency,
        expectedCloseDate: day(deal.expectedCloseDate),
        owner: deal.owner.name,
        reasons: reasons.map((r) => r.label),
      }));
    },
  }),

  tool({
    name: "list_my_tasks",
    title: "Moje úkoly",
    description: "Otevřené úkoly přihlášeného uživatele seřazené podle termínu (včetně úkolů po termínu).",
    readOnly: true,
    input: z.object({ days_ahead: z.number().int().min(0).max(90).default(14).describe("Kolik dní dopředu zahrnout") }),
    run: async (user, { days_ahead }) => {
      require(user, "task");
      const until = new Date(Date.now() + (days_ahead + 1) * DAY);
      const tasks = await prisma.task.findMany({
        where: {
          tenantId: user.tenantId,
          assigneeId: user.id,
          status: { in: ["open", "in_progress"] },
          OR: [{ dueDate: null }, { dueDate: { lt: until } }],
        },
        orderBy: [{ dueDate: "asc" }],
        take: 50,
        select: { id: true, title: true, description: true, dueDate: true, priority: true, status: true, subjectType: true, subjectId: true },
      });
      const today = new Date().toISOString().slice(0, 10);
      return tasks.map((t) => ({ ...t, dueDate: day(t.dueDate), overdue: !!t.dueDate && day(t.dueDate)! < today }));
    },
  }),

  tool({
    name: "create_task",
    title: "Vytvořit úkol",
    description: "Vytvoří úkol přiřazený přihlášenému uživateli, volitelně navázaný na klub, kontakt, lead nebo obchod.",
    readOnly: false,
    input: z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(4000).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Termín ve formátu YYYY-MM-DD"),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      subject_type: z.enum(SUBJECT_TYPES).optional(),
      subject_id: z.string().optional(),
    }),
    run: async (user, args) => {
      require(user, "task", "create");
      await assertSubject(user, args.subject_type, args.subject_id);
      const task = await prisma.task.create({
        data: {
          tenantId: user.tenantId,
          title: args.title,
          description: args.description,
          dueDate: args.due_date ? new Date(`${args.due_date}T00:00:00.000Z`) : undefined,
          priority: args.priority,
          assigneeId: user.id,
          creatorId: user.id,
          subjectType: args.subject_id ? args.subject_type : undefined,
          subjectId: args.subject_type ? args.subject_id : undefined,
        },
      });
      await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "task", entityId: task.id, action: "create", changes: { via: "mcp" } });
      revalidatePath("/tasks");
      return { id: task.id, title: task.title, dueDate: day(task.dueDate) };
    },
  }),

  tool({
    name: "log_activity",
    title: "Zaznamenat aktivitu",
    description: "Zapíše aktivitu (hovor, e-mail, schůzku, poznámku…) ke klubu, kontaktu, leadu nebo obchodu.",
    readOnly: false,
    input: z.object({
      type: z.enum(["call", "email", "meeting", "video_call", "note", "presentation", "other"]),
      subject: z.string().min(1).max(200),
      description: z.string().max(4000).optional(),
      subject_type: z.enum(SUBJECT_TYPES).optional(),
      subject_id: z.string().optional(),
      activity_at: z.string().optional().describe("ISO datum a čas; výchozí teď"),
    }),
    run: async (user, args) => {
      require(user, "activity", "create");
      await assertSubject(user, args.subject_type, args.subject_id);
      const at = args.activity_at ? new Date(args.activity_at) : new Date();
      if (Number.isNaN(at.getTime())) throw new ToolError("Neplatné datum activity_at.");
      const activity = await prisma.activity.create({
        data: {
          tenantId: user.tenantId,
          ownerId: user.id,
          type: args.type,
          subject: args.subject,
          description: args.description,
          subjectType: args.subject_id ? args.subject_type : undefined,
          subjectId: args.subject_type ? args.subject_id : undefined,
          activityAt: at,
        },
      });
      await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "activity", entityId: activity.id, action: "create", changes: { via: "mcp" } });
      revalidatePath("/crm/activities");
      return { id: activity.id, type: activity.type, subject: activity.subject, activityAt: activity.activityAt };
    },
  }),

  tool({
    name: "create_lead",
    title: "Vytvořit lead",
    description: "Založí nový lead (poptávku) vlastněný přihlášeným uživatelem.",
    readOnly: false,
    input: z.object({
      first_name: z.string().max(100).optional(),
      last_name: z.string().max(100).optional(),
      company_name: z.string().max(200).optional(),
      email: z.email().optional(),
      phone: z.string().max(50).optional(),
      source: z.string().max(100).optional(),
      estimated_value: z.number().min(0).optional(),
      notes: z.string().max(4000).optional(),
    }),
    run: async (user, args) => {
      require(user, "lead", "create");
      if (!args.first_name && !args.last_name && !args.company_name) throw new ToolError("Zadejte jméno nebo název firmy.");
      const lead = await prisma.lead.create({
        data: {
          tenantId: user.tenantId,
          ownerId: user.id,
          firstName: args.first_name,
          lastName: args.last_name,
          companyName: args.company_name,
          email: args.email,
          phone: args.phone,
          source: args.source ?? "Claude",
          estimatedValue: args.estimated_value,
          notes: args.notes,
        },
      });
      await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "lead", entityId: lead.id, action: "create", changes: { via: "mcp" } });
      revalidatePath("/crm/leads");
      return { id: lead.id, status: lead.status };
    },
  }),
];

export function toolDefinitions() {
  return TOOLS.map((t) => {
    const inputSchema = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
    delete inputSchema.$schema;
    return {
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema,
      annotations: { title: t.title, readOnlyHint: t.readOnly, destructiveHint: false, openWorldHint: false },
    };
  });
}

export async function callTool(user: TokenUser, name: string, rawArgs: unknown) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new ToolError(`Neznámý nástroj: ${name}`);
  const parsed = t.input.safeParse(rawArgs ?? {});
  if (!parsed.success) throw new ToolError(`Neplatné parametry: ${z.prettifyError(parsed.error)}`);
  return (t.run as (u: TokenUser, a: unknown) => Promise<unknown>)(user, parsed.data);
}
