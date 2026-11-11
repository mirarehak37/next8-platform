import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can, ROLE_MATRIX, type RoleName } from "@/lib/rbac";
import { ownerScopeWhere } from "@/lib/scope";
import type { TokenUser } from "@/lib/api-tokens";
import { moveDealStage } from "@/lib/actions/deals";
import { convertLead, setLeadStatus } from "@/lib/actions/leads";
import { setTaskStatus } from "@/lib/actions/tasks";
import { setQuoteStatus } from "@/lib/actions/quotes";
import { setPostStatus } from "@/lib/actions/marketing";
import { moveRoadmapItem } from "@/lib/actions/roadmap";
import { addClubTeamContact, removeClubTeamContact } from "@/lib/actions/club-teams";
import { enrollContacts, setEnrollmentStatus, toggleSequence } from "@/lib/actions/sequences";
import { partnershipFulfillmentUpdateSchema } from "@/lib/validations/partnerships";
import { tool, ToolError } from "./core";
import { ENTITIES, ENTITY_NAMES, entity, vocabValues, type EntityConfig, type EntityName } from "./entities";

type Row = Record<string, unknown>;
type Delegate = {
  findMany(args: unknown): Promise<Row[]>;
  findFirst(args: unknown): Promise<Row | null>;
  count(args: unknown): Promise<number>;
};

const delegate = (cfg: EntityConfig) => (prisma as unknown as Record<string, Delegate>)[cfg.model];

const entityArg = z.enum(ENTITY_NAMES).describe("Typ záznamu – seznam vrací describe_entity bez parametru");
const dataArg = z.record(z.string(), z.unknown());

function requireView(user: TokenUser, cfg: EntityConfig) {
  const resources = cfg.viewAny ?? [cfg.resource];
  if (!resources.some((r) => can(user.role, r, "view"))) {
    throw new ToolError(`Role ${user.role} nemá oprávnění zobrazit: ${cfg.label}.`);
  }
}

async function baseWhere(user: TokenUser, cfg: EntityConfig): Promise<Row> {
  if (!cfg.scope) return { tenantId: user.tenantId };
  return ownerScopeWhere(user, cfg.scope.resource, cfg.scope.field);
}

async function loadExisting(user: TokenUser, cfg: EntityConfig, id: string) {
  const row = await delegate(cfg).findFirst({ where: { AND: [await baseWhere(user, cfg), { id }] } });
  if (!row) throw new ToolError(`${cfg.label}: záznam ${id} neexistuje nebo k němu nemáte přístup.`);
  return row;
}

function jsonSchemaOf(schema: z.ZodType) {
  const out = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Row;
  delete out.$schema;
  return out;
}

const UPDATE_SCHEMAS: Partial<Record<EntityName, z.ZodType>> = {
  partnership_fulfillment: partnershipFulfillmentUpdateSchema,
};

// The app's update actions validate with `schema.partial()`, where omitted fields that carry a
// default (or a null-coercing preprocess) come back filled in — fine for forms that always send
// every field, destructive for a partial update. Carry the stored value over for those fields.
function keepStoredDefaults(cfg: EntityConfig, data: Row, existing: Row) {
  const schema = cfg.schema;
  if (!(schema instanceof z.ZodObject)) return data;
  const filled = schema.partial().safeParse({});
  if (!filled.success) return data;
  const merged = { ...data };
  for (const key of Object.keys(filled.data as Row)) {
    if (key in merged || !(key in existing)) continue;
    merged[key] = existing[key];
  }
  return merged;
}

async function defaultStage(user: TokenUser, pipelineId?: string | null) {
  const pipeline = await prisma.pipeline.findFirst({
    where: pipelineId ? { id: pipelineId, tenantId: user.tenantId } : { tenantId: user.tenantId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  const stage = pipeline?.stages.find((s) => !s.isWon && !s.isLost) ?? pipeline?.stages[0];
  if (!pipeline || !stage) throw new ToolError("Pipeline nebo její fáze nenalezena (viz list_pipelines).");
  return { pipelineId: pipeline.id, stageId: stage.id };
}

const STATUS_ACTIONS: Partial<Record<EntityName, (id: string, status: string) => Promise<unknown>>> = {
  lead: setLeadStatus,
  task: setTaskStatus,
  quote: setQuoteStatus,
  marketing_post: setPostStatus,
  roadmap_item: (id, status) => moveRoadmapItem(id, status),
};

export const RECORD_TOOLS = [
  tool({
    name: "whoami",
    title: "Kdo jsem a co smím",
    description: "Přihlášený uživatel (držitel tokenu), jeho role a oprávnění po modulech včetně rozsahu viditelnosti (own/team/all).",
    readOnly: true,
    input: z.object({}),
    run: async (user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: ROLE_MATRIX[user.role as RoleName] ?? {},
    }),
  }),

  tool({
    name: "list_users",
    title: "Uživatelé CRM",
    description: "Uživatelé pracovního prostoru s rolí – jejich ID se používají jako ownerId / assigneeId.",
    readOnly: true,
    input: z.object({}),
    run: async (user) => {
      const users = await prisma.user.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true, name: true, email: true, jobTitle: true, status: true, userRoles: { select: { role: { select: { name: true } } } } },
        orderBy: { name: "asc" },
      });
      return users.map(({ userRoles, ...u }) => ({ ...u, role: userRoles[0]?.role.name ?? null, isMe: u.id === user.id }));
    },
  }),

  tool({
    name: "list_pipelines",
    title: "Pipeliny a fáze",
    description: "Obchodní pipeliny a jejich fáze (ID, pořadí, pravděpodobnost, vyhraná/prohraná). Potřeba pro obchody a move_deal_stage.",
    readOnly: true,
    input: z.object({}),
    run: async (user) => {
      if (!can(user.role, "deal", "view")) throw new ToolError(`Role ${user.role} nemá přístup k obchodům.`);
      return prisma.pipeline.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          name: true,
          isDefault: true,
          stages: { select: { id: true, name: true, order: true, probability: true, isWon: true, isLost: true }, orderBy: { order: "asc" } },
        },
        orderBy: [{ isDefault: "desc" }, { order: "asc" }],
      });
    },
  }),

  tool({
    name: "describe_entity",
    title: "Popis typu záznamu",
    description:
      "Bez parametru vypíše všechny typy záznamů a co s nimi lze dělat. S parametrem entity vrátí pole (JSON Schema), " +
      "povolené hodnoty číselníků, dostupné filtry a poznámky. Zavolejte před create_record / update_record.",
    readOnly: true,
    input: z.object({ entity: entityArg.optional() }),
    run: async (user, { entity: name }) => {
      if (!name) {
        return (Object.entries(ENTITIES) as [EntityName, EntityConfig][]).map(([key, cfg]) => ({
          entity: key,
          label: cfg.label,
          canView: (cfg.viewAny ?? [cfg.resource]).some((r) => can(user.role, r, "view")),
          operations: ["list", "get", cfg.create && "create", cfg.update && "update", cfg.remove && "delete"].filter(Boolean),
        }));
      }
      const cfg = entity(name);
      return {
        entity: name,
        label: cfg.label,
        operations: ["list", "get", cfg.create && "create", cfg.update && "update", cfg.remove && "delete"].filter(Boolean),
        fields: cfg.schema ? jsonSchemaOf(cfg.schema) : null,
        autoFilled: cfg.ownerDefault ? `${cfg.ownerDefault} se při vytvoření doplní přihlášeným uživatelem` : undefined,
        allowedValues: cfg.vocab ? Object.fromEntries(Object.entries(cfg.vocab).map(([k, v]) => [k, vocabValues(v)])) : undefined,
        searchFields: cfg.search,
        filters: cfg.filters,
        notes: cfg.notes,
      };
    },
  }),

  tool({
    name: "list_records",
    title: "Seznam záznamů",
    description:
      "Vypíše záznamy libovolného typu (kluby, kontakty, leady, obchody, úkoly, aktivity, produkty, nabídky, týmy, ambasadoři, " +
      "partneři, akce, přihlášky, marketing, formuláře, roadmapa, sekvence) s hledáním, filtry a stránkováním.",
    readOnly: true,
    input: z.object({
      entity: entityArg,
      search: z.string().optional().describe("Fulltext přes hlavní textová pole"),
      filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe("Přesná shoda, např. {\"status\":\"open\"}. Povolené klíče: describe_entity"),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    }),
    run: async (user, { entity: name, search, filters, limit, offset }) => {
      const cfg = entity(name);
      requireView(user, cfg);
      const and: Row[] = [await baseWhere(user, cfg)];
      if (search?.trim()) {
        and.push({ OR: cfg.search.map((f) => ({ [f]: { contains: search.trim(), mode: "insensitive" } })) });
      }
      for (const [key, value] of Object.entries(filters ?? {})) {
        if (!cfg.filters.includes(key)) {
          throw new ToolError(`Filtr „${key}“ není pro ${name} dostupný. Povolené: ${cfg.filters.join(", ")}.`);
        }
        and.push(cfg.filterMap?.[key] ? cfg.filterMap[key](String(value)) : { [key]: value });
      }
      const where = { AND: and };
      const [total, records] = await Promise.all([
        delegate(cfg).count({ where }),
        delegate(cfg).findMany({ where, orderBy: cfg.orderBy, take: limit, skip: offset, include: cfg.listInclude }),
      ]);
      return { entity: name, total, offset, count: records.length, records };
    },
  }),

  tool({
    name: "get_record",
    title: "Detail záznamu",
    description: "Úplný detail jednoho záznamu včetně navázaných dat; u klubu, kontaktu, leadu a obchodu i poslední aktivity a otevřené úkoly.",
    readOnly: true,
    input: z.object({ entity: entityArg, id: z.string() }),
    run: async (user, { entity: name, id }) => {
      const cfg = entity(name);
      requireView(user, cfg);
      const record = await delegate(cfg).findFirst({ where: { AND: [await baseWhere(user, cfg), { id }] }, include: cfg.getInclude });
      if (!record) throw new ToolError(`${cfg.label}: záznam ${id} neexistuje nebo k němu nemáte přístup.`);
      if (!["company", "contact", "lead", "deal"].includes(name)) return record;
      const subject = { tenantId: user.tenantId, subjectType: name, subjectId: id };
      const [activities, tasks] = await Promise.all([
        can(user.role, "activity", "view")
          ? prisma.activity.findMany({
              where: subject,
              orderBy: { activityAt: "desc" },
              take: 10,
              select: { id: true, type: true, subject: true, description: true, activityAt: true, owner: { select: { name: true } } },
            })
          : [],
        can(user.role, "task", "view")
          ? prisma.task.findMany({
              where: { ...subject, status: { in: ["open", "in_progress"] } },
              orderBy: { dueDate: "asc" },
              select: { id: true, title: true, dueDate: true, priority: true, status: true, assignee: { select: { name: true } } },
            })
          : [],
      ]);
      return { ...record, recentActivities: activities, openTasks: tasks };
    },
  }),

  tool({
    name: "create_record",
    title: "Vytvořit záznam",
    description:
      "Vytvoří záznam libovolného typu se stejnou validací, oprávněními a automatizacemi jako aplikace. " +
      "Pole a povolené hodnoty zjistíte přes describe_entity. Vlastník se doplní automaticky.",
    readOnly: false,
    input: z.object({ entity: entityArg, data: dataArg.describe("Pole záznamu podle describe_entity") }),
    run: async (user, { entity: name, data }) => {
      const cfg = entity(name);
      if (!cfg.create) throw new ToolError(`${cfg.label}: vytváření přes MCP není podporované.`);
      const payload: Row = { ...data };
      if (cfg.ownerDefault && !payload[cfg.ownerDefault]) payload[cfg.ownerDefault] = user.id;
      if (name === "deal" && (!payload.pipelineId || !payload.stageId)) {
        const def = await defaultStage(user, payload.pipelineId as string | undefined);
        payload.pipelineId ??= def.pipelineId;
        payload.stageId ??= def.stageId;
      }
      const created = await cfg.create(payload);
      return { created: created ?? true, ...(created ? {} : { note: `Vytvořeno. ID zjistíte přes list_records ${name}.` }) };
    },
  }),

  tool({
    name: "update_record",
    title: "Upravit záznam",
    description: "Upraví vybraná pole existujícího záznamu; neuvedená pole zůstanou beze změny. Fázi obchodu mění move_deal_stage.",
    readOnly: false,
    input: z.object({ entity: entityArg, id: z.string(), data: dataArg.describe("Jen pole, která se mají změnit") }),
    run: async (user, { entity: name, id, data }) => {
      const cfg = entity(name);
      if (!cfg.update) throw new ToolError(`${cfg.label}: úprava přes MCP není podporovaná. ${cfg.notes ?? ""}`.trim());
      if (Object.keys(data).length === 0) throw new ToolError("Nezadali jste žádné pole ke změně.");
      const existing = await loadExisting(user, cfg, id);
      const withSchema = UPDATE_SCHEMAS[name] ? data : keepStoredDefaults(cfg, data, existing);
      return { updated: await cfg.update(id, withSchema) };
    },
  }),

  tool({
    name: "delete_record",
    title: "Smazat záznam",
    description: "Nevratně smaže záznam. Vyžaduje confirm: true – použijte jen na výslovný pokyn uživatele.",
    readOnly: false,
    destructive: true,
    input: z.object({ entity: entityArg, id: z.string(), confirm: z.literal(true).describe("Musí být true") }),
    run: async (user, { entity: name, id }) => {
      const cfg = entity(name);
      if (!cfg.remove) throw new ToolError(`${cfg.label}: mazání přes MCP není podporované.`);
      const existing = await loadExisting(user, cfg, id);
      await cfg.remove(id);
      const person = [existing.firstName, existing.lastName].filter(Boolean).join(" ");
      const label = existing.name ?? existing.title ?? existing.subject ?? existing.number ?? (person || existing.companyName || null);
      return { deleted: { entity: name, id, label } };
    },
  }),

  tool({
    name: "set_status",
    title: "Změnit stav",
    description:
      "Změní stav záznamu (např. úkol → done, lead → qualified, nabídka → sent, příspěvek → published, sekvence → paused). " +
      "Povolené hodnoty: describe_entity. Stav obchodu se mění přes move_deal_stage.",
    readOnly: false,
    input: z.object({ entity: entityArg, id: z.string(), status: z.string().min(1) }),
    run: async (user, { entity: name, id, status }) => {
      const cfg = entity(name);
      if (name === "deal") throw new ToolError("Stav obchodu se mění přesunem do fáze: move_deal_stage.");
      const existing = await loadExisting(user, cfg, id);

      if (name === "sequence") {
        if (!["active", "paused"].includes(status)) throw new ToolError("Stav sekvence je active nebo paused.");
        if ((existing.active === true) !== (status === "active")) await toggleSequence(id);
        return { entity: name, id, status };
      }

      const allowed = cfg.vocab?.status ? vocabValues(cfg.vocab.status).map((v) => v.value) : null;
      if (allowed && !allowed.includes(status)) throw new ToolError(`Neplatný stav „${status}“. Povolené: ${allowed.join(", ")}.`);

      const action = STATUS_ACTIONS[name];
      if (action) await action(id, status);
      else if (cfg.update && "status" in existing) await cfg.update(id, keepStoredDefaults(cfg, { status }, existing));
      else throw new ToolError(`${cfg.label} nemá stav, který by šlo změnit.`);
      return { entity: name, id, status };
    },
  }),

  tool({
    name: "move_deal_stage",
    title: "Přesunout obchod do fáze",
    description:
      "Přesune obchod do jiné fáze pipeline (podle ID nebo názvu fáze). Fáze Vyhráno/Prohráno obchod uzavře; " +
      "fáze Nabídka založí úkol na přípravu nabídky.",
    readOnly: false,
    input: z.object({ deal_id: z.string(), stage: z.string().describe("ID nebo název fáze (viz list_pipelines)") }),
    run: async (user, { deal_id, stage }) => {
      const deal = await loadExisting(user, entity("deal"), deal_id);
      const stages = await prisma.pipelineStage.findMany({ where: { pipelineId: deal.pipelineId as string }, orderBy: { order: "asc" } });
      const target = stages.find((s) => s.id === stage) ?? stages.find((s) => s.name.toLowerCase() === stage.trim().toLowerCase());
      if (!target) throw new ToolError(`Fáze „${stage}“ v pipeline obchodu není. Dostupné: ${stages.map((s) => s.name).join(", ")}.`);
      const updated = (await moveDealStage(deal_id, target.id)) as Row;
      return { id: deal_id, name: deal.name, stage: target.name, status: updated.status, probability: target.probability };
    },
  }),

  tool({
    name: "convert_lead",
    title: "Převést lead na obchod",
    description: "Z leadu vytvoří klub (pokud má název firmy), kontakt a obchodní případ a lead označí jako převedený.",
    readOnly: false,
    input: z.object({
      lead_id: z.string(),
      pipeline_id: z.string().optional().describe("Výchozí: hlavní pipeline"),
      stage_id: z.string().optional().describe("Výchozí: první fáze pipeline"),
    }),
    run: async (user, { lead_id, pipeline_id, stage_id }) => {
      await loadExisting(user, entity("lead"), lead_id);
      const def = await defaultStage(user, pipeline_id);
      return { converted: await convertLead(lead_id, pipeline_id ?? def.pipelineId, stage_id ?? def.stageId) };
    },
  }),

  tool({
    name: "link_contact_to_team",
    title: "Přiřadit kontakt k týmu klubu",
    description: "Přiřadí kontakt k týmu klubu (s volitelnou rolí, např. Trenér), nebo ho s remove: true z týmu odebere.",
    readOnly: false,
    input: z.object({
      club_team_id: z.string(),
      contact_id: z.string(),
      role: z.string().max(100).optional(),
      remove: z.boolean().default(false),
    }),
    run: async (_user, { club_team_id, contact_id, role, remove }) => {
      if (remove) await removeClubTeamContact(club_team_id, contact_id);
      else await addClubTeamContact(club_team_id, contact_id, role ?? null);
      return { clubTeamId: club_team_id, contactId: contact_id, linked: !remove };
    },
  }),

  tool({
    name: "enroll_contacts",
    title: "Zapsat kontakty do sekvence",
    description: "Zapíše kontakty do emailové sekvence – každý krok se jim naplánuje jako úkol vlastníka sekvence.",
    readOnly: false,
    input: z.object({ sequence_id: z.string(), contact_ids: z.array(z.string()).min(1).max(100) }),
    run: async (_user, { sequence_id, contact_ids }) => ({ result: await enrollContacts(sequence_id, contact_ids) }),
  }),

  tool({
    name: "update_enrollment",
    title: "Ukončit zápis v sekvenci",
    description: "Označí zápis kontaktu v sekvenci jako replied (odpověděl) nebo stopped (zastaveno) a zruší zbývající úkoly. ID zápisu: get_record sequence.",
    readOnly: false,
    input: z.object({ enrollment_id: z.string(), status: z.enum(["replied", "stopped"]) }),
    run: async (_user, { enrollment_id, status }) => {
      await setEnrollmentStatus(enrollment_id, status);
      return { enrollmentId: enrollment_id, status };
    },
  }),
];
