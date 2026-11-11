import { z } from "zod";
import type { ModuleResource } from "@/lib/rbac";
import {
  companySchema, contactSchema, leadSchema, dealSchema, productSchema, taskSchema, roadmapItemSchema, activitySchema,
} from "@/lib/validations/crm";
import { eventSchema, registrationSchema } from "@/lib/validations/events";
import { postSchema, campaignSchema } from "@/lib/validations/marketing";
import {
  ambassadorSchema, partnerSchema, partnershipTermSchema, partnershipFulfillmentSchema,
} from "@/lib/validations/partnerships";
import { webFormSchema } from "@/lib/validations/web-forms";
import * as C from "@/lib/constants";
import { createCompany, updateCompany, deleteCompany } from "@/lib/actions/companies";
import { createContact, updateContact, deleteContact } from "@/lib/actions/contacts";
import { createLead, updateLead, deleteLead } from "@/lib/actions/leads";
import { createDeal, updateDeal, deleteDeal } from "@/lib/actions/deals";
import { createTask, updateTask, deleteTask } from "@/lib/actions/tasks";
import { createActivity } from "@/lib/actions/activities";
import { createProduct, updateProduct, deleteProduct } from "@/lib/actions/products";
import { createQuote } from "@/lib/actions/quotes";
import { createClubTeam, updateClubTeam, deleteClubTeam } from "@/lib/actions/club-teams";
import { createAmbassador, updateAmbassador, deleteAmbassador } from "@/lib/actions/ambassadors";
import { createPartner, updatePartner, deletePartner } from "@/lib/actions/partners";
import {
  createPartnershipTerm, updatePartnershipTerm, deletePartnershipTerm, createPartnershipFulfillment,
  updatePartnershipFulfillment, deletePartnershipFulfillment,
} from "@/lib/actions/partnership-terms";
import {
  createEvent, updateEvent, deleteEvent, createRegistration, updateRegistration, deleteRegistration,
} from "@/lib/actions/events";
import {
  createPost, updatePost, deletePost, createCampaign, updateCampaign, deleteCampaign,
} from "@/lib/actions/marketing";
import { createWebForm, updateWebForm, deleteWebForm } from "@/lib/actions/web-forms";
import { createRoadmapItem, updateRoadmapItem, deleteRoadmapItem } from "@/lib/actions/roadmap";
import { createSequence, deleteSequence } from "@/lib/actions/sequences";

type Vocab = readonly ({ value: string; label: string } | string)[];

export type EntityConfig = {
  label: string;
  resource: ModuleResource;
  /** Any of these view permissions is enough to read (defaults to `resource`). */
  viewAny?: ModuleResource[];
  model: string;
  /** Record-visibility scope (own/team/all) is applied on this field; omit for tenant-wide records. */
  scope?: { resource: ModuleResource; field: string };
  search: string[];
  filters: string[];
  /** Filters that are not plain columns. */
  filterMap?: Record<string, (value: string) => Record<string, unknown>>;
  orderBy: Record<string, "asc" | "desc">;
  listInclude?: Record<string, unknown>;
  getInclude?: Record<string, unknown>;
  schema?: z.ZodType;
  /** Field auto-filled with the calling user when omitted on create. */
  ownerDefault?: string;
  vocab?: Record<string, Vocab>;
  notes?: string;
  create?: (data: unknown) => Promise<unknown>;
  update?: (id: string, data: unknown) => Promise<unknown>;
  remove?: (id: string) => Promise<unknown>;
};

const name = { select: { id: true, name: true } };
const person = { select: { id: true, firstName: true, lastName: true } };

// Mirrors of schemas that live inside "use server" files (which can only export actions).
const clubTeamShape = z.object({
  companyId: z.string(),
  category: z.string(),
  name: z.string(),
  league: z.string().optional().nullable(),
});
const quoteShape = z.object({
  dealId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable().describe("YYYY-MM-DD"),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().optional().nullable(),
        name: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        vatRate: z.number().default(21),
      }),
    )
    .min(1),
});
const sequenceShape = z.object({
  name: z.string(),
  description: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  steps: z
    .array(
      z.object({
        dayOffset: z.number().int().min(0).max(365),
        type: z.enum(["email", "call", "task"]),
        title: z.string(),
        body: z.string().optional().nullable(),
      }),
    )
    .min(1)
    .max(20),
});

export const ENTITIES = {
  company: {
    label: "Klub / firma",
    resource: "company",
    model: "company",
    scope: { resource: "company", field: "ownerId" },
    search: ["name", "legalName", "registrationNumber", "billingCity"],
    filters: ["status", "sport", "league", "region", "ownerId"],
    orderBy: { name: "asc" },
    listInclude: { owner: name },
    getInclude: {
      owner: name,
      contacts: { include: { contact: true } },
      clubTeams: true,
      deals: { select: { id: true, name: true, value: true, status: true, stage: { select: { name: true } } } },
    },
    schema: companySchema,
    ownerDefault: "ownerId",
    vocab: { status: C.COMPANY_STATUSES, sport: C.SPORTS, sizeBand: C.COMPANY_SIZE_BANDS },
    create: createCompany,
    update: updateCompany,
    remove: deleteCompany,
  },
  contact: {
    label: "Kontakt",
    resource: "contact",
    model: "contact",
    scope: { resource: "contact", field: "ownerId" },
    search: ["firstName", "lastName", "email", "phone", "mobile"],
    filters: ["status", "ownerId", "companyId", "clubTeamId"],
    filterMap: {
      companyId: (v) => ({ companies: { some: { companyId: v } } }),
      clubTeamId: (v) => ({ clubTeams: { some: { clubTeamId: v } } }),
    },
    orderBy: { lastName: "asc" },
    listInclude: { companies: { select: { company: name, role: true } } },
    getInclude: {
      owner: name,
      companies: { select: { company: name, role: true, isPrimary: true } },
      clubTeams: { select: { clubTeam: { select: { id: true, name: true, category: true } }, role: true } },
    },
    schema: contactSchema,
    ownerDefault: "ownerId",
    vocab: { status: C.CONTACT_STATUSES },
    notes: "companyId při vytvoření/úpravě přiřadí kontakt ke klubu. K týmu klubu ho přiřadí nástroj link_contact_to_team.",
    create: createContact,
    update: updateContact,
    remove: deleteContact,
  },
  lead: {
    label: "Lead",
    resource: "lead",
    model: "lead",
    scope: { resource: "lead", field: "ownerId" },
    search: ["firstName", "lastName", "companyName", "email", "phone"],
    filters: ["status", "rating", "source", "ownerId"],
    orderBy: { createdAt: "desc" },
    listInclude: { owner: name },
    getInclude: { owner: name },
    schema: leadSchema,
    ownerDefault: "ownerId",
    vocab: { status: C.LEAD_STATUSES, rating: C.LEAD_RATINGS, source: C.LEAD_SOURCES },
    notes: "Převod na klub + kontakt + obchod dělá nástroj convert_lead.",
    create: createLead,
    update: updateLead,
    remove: deleteLead,
  },
  deal: {
    label: "Obchodní případ",
    resource: "deal",
    model: "deal",
    scope: { resource: "deal", field: "ownerId" },
    search: ["name", "description", "nextStep"],
    filters: ["status", "stageId", "pipelineId", "companyId", "ownerId", "ambassadorId", "productId"],
    orderBy: { createdAt: "desc" },
    listInclude: { stage: { select: { id: true, name: true, probability: true } }, company: name, owner: name },
    getInclude: {
      stage: true,
      pipeline: name,
      company: name,
      owner: name,
      clubTeam: { select: { id: true, name: true } },
      product: name,
      contacts: { include: { contact: person } },
      quotes: { select: { id: true, number: true, status: true, total: true } },
    },
    schema: dealSchema,
    ownerDefault: "ownerId",
    vocab: { status: C.DEAL_STATUSES },
    notes:
      "pipelineId a stageId se při vytvoření doplní výchozí pipeline a její první fází, když chybí (ID fází: list_pipelines). " +
      "Fázi měňte nástrojem move_deal_stage — přesun do vyhrané/prohrané fáze obchod uzavře. Data ve formátu YYYY-MM-DD.",
    create: createDeal,
    update: updateDeal,
    remove: deleteDeal,
  },
  task: {
    label: "Úkol",
    resource: "task",
    model: "task",
    scope: { resource: "task", field: "assigneeId" },
    search: ["title", "description"],
    filters: ["status", "priority", "assigneeId", "subjectType", "subjectId"],
    orderBy: { dueDate: "asc" },
    listInclude: { assignee: name },
    getInclude: { assignee: name, creator: name, checklistItems: true },
    schema: taskSchema,
    ownerDefault: "assigneeId",
    vocab: { status: C.TASK_STATUSES, priority: C.TASK_PRIORITIES, subjectType: ["company", "contact", "lead", "deal"] },
    notes: "dueDate ve formátu YYYY-MM-DD. Stav rychle změní set_status (např. done).",
    create: createTask,
    update: updateTask,
    remove: deleteTask,
  },
  activity: {
    label: "Aktivita",
    resource: "activity",
    model: "activity",
    scope: { resource: "activity", field: "ownerId" },
    search: ["subject", "description"],
    filters: ["type", "subjectType", "subjectId", "ownerId"],
    orderBy: { activityAt: "desc" },
    listInclude: { owner: name },
    getInclude: { owner: name },
    schema: activitySchema,
    vocab: { type: C.ACTIVITY_TYPES, subjectType: ["company", "contact", "lead", "deal"], direction: ["inbound", "outbound"] },
    notes: "Aktivity jsou záznam historie — lze je jen přidávat.",
    create: createActivity,
  },
  product: {
    label: "Produkt",
    resource: "product",
    model: "product",
    search: ["name", "code", "description"],
    filters: ["category", "isActive"],
    orderBy: { name: "asc" },
    schema: productSchema,
    vocab: { category: C.PRODUCT_CATEGORIES, unit: C.PRODUCT_UNITS },
    create: createProduct,
    update: updateProduct,
    remove: deleteProduct,
  },
  quote: {
    label: "Nabídka",
    resource: "quote",
    model: "quote",
    scope: { resource: "quote", field: "ownerId" },
    search: ["number", "notes"],
    filters: ["status", "dealId", "companyId", "contactId", "ownerId"],
    orderBy: { createdAt: "desc" },
    listInclude: { company: name, deal: name },
    getInclude: { company: name, deal: name, contact: person, owner: name, items: true },
    schema: quoteShape,
    vocab: { status: C.QUOTE_STATUSES },
    notes: "Číslo a součty se dopočítají. Po vytvoření lze měnit jen stav (set_status).",
    create: createQuote,
  },
  club_team: {
    label: "Tým klubu",
    resource: "company",
    model: "clubTeam",
    search: ["name", "league"],
    filters: ["companyId", "category"],
    orderBy: { name: "asc" },
    listInclude: { company: name },
    getInclude: { company: name, contacts: { include: { contact: person } } },
    schema: clubTeamShape,
    vocab: { category: C.CLUB_TEAM_CATEGORIES },
    create: createClubTeam,
    update: updateClubTeam,
    remove: deleteClubTeam,
  },
  ambassador: {
    label: "Ambasador",
    resource: "ambassador",
    model: "ambassador",
    search: ["firstName", "lastName", "nickname", "email", "instagram"],
    filters: ["status", "tier", "companyId", "ownerId"],
    orderBy: { lastName: "asc" },
    listInclude: { company: name },
    getInclude: { company: name, contact: person, owner: name },
    schema: ambassadorSchema,
    ownerDefault: "ownerId",
    vocab: { status: C.PARTNERSHIP_STATUSES, tier: C.AMBASSADOR_TIERS, billingType: C.AMBASSADOR_BILLING_TYPES },
    create: createAmbassador,
    update: updateAmbassador,
    remove: deleteAmbassador,
  },
  partner: {
    label: "Partner / sponzor",
    resource: "partner",
    model: "partner",
    search: ["name", "email", "registrationNumber"],
    filters: ["status", "kind", "level", "companyId", "ownerId"],
    orderBy: { name: "asc" },
    listInclude: { company: name },
    getInclude: { company: name, contact: person, owner: name },
    schema: partnerSchema,
    ownerDefault: "ownerId",
    vocab: { status: C.PARTNERSHIP_STATUSES, kind: C.PARTNER_KINDS, level: C.PARTNER_LEVELS },
    create: createPartner,
    update: updatePartner,
    remove: deletePartner,
  },
  partnership_term: {
    label: "Podmínka partnerství (plnění / protiplnění)",
    resource: "partner",
    viewAny: ["partner", "ambassador"],
    model: "partnershipTerm",
    search: ["title", "description"],
    filters: ["subjectType", "subjectId", "direction", "type", "isActive"],
    orderBy: { createdAt: "desc" },
    getInclude: { fulfillments: { orderBy: { date: "desc" }, take: 20 } },
    schema: partnershipTermSchema,
    vocab: { period: C.TERM_PERIODS, valueType: C.TERM_VALUE_TYPES },
    notes: "subjectType je ambassador nebo partner, subjectId jeho ID.",
    create: createPartnershipTerm,
    update: updatePartnershipTerm,
    remove: deletePartnershipTerm,
  },
  partnership_fulfillment: {
    label: "Plnění podmínky partnerství",
    resource: "partner",
    viewAny: ["partner", "ambassador"],
    model: "partnershipFulfillment",
    search: ["note", "link"],
    filters: ["termId", "status", "dealId"],
    orderBy: { date: "desc" },
    listInclude: { term: { select: { id: true, title: true, subjectType: true, subjectId: true } } },
    getInclude: { term: true, product: name },
    schema: partnershipFulfillmentSchema,
    notes: "Úprava navíc přijímá paid (true/false) a status (planned | done).",
    create: createPartnershipFulfillment,
    update: updatePartnershipFulfillment,
    remove: deletePartnershipFulfillment,
  },
  event: {
    label: "Akce / kemp",
    resource: "event",
    model: "event",
    search: ["name", "location", "description"],
    filters: ["status", "type", "companyId", "ownerId"],
    orderBy: { startDate: "desc" },
    listInclude: { company: name, _count: { select: { registrations: true } } },
    getInclude: { company: name, owner: name, registrations: true },
    schema: eventSchema,
    ownerDefault: "ownerId",
    vocab: { type: C.EVENT_TYPES, status: C.EVENT_STATUSES },
    create: createEvent,
    update: updateEvent,
    remove: deleteEvent,
  },
  event_registration: {
    label: "Přihláška na akci",
    resource: "event",
    model: "eventRegistration",
    search: ["name", "email", "phone"],
    filters: ["eventId", "status", "paymentStatus", "role", "contactId", "companyId"],
    orderBy: { createdAt: "desc" },
    listInclude: { event: name },
    getInclude: { event: name, contact: person, company: name },
    schema: registrationSchema,
    vocab: { role: C.REGISTRATION_ROLES, status: C.REGISTRATION_STATUSES, paymentStatus: C.PAYMENT_STATUSES },
    create: createRegistration,
    update: updateRegistration,
    remove: deleteRegistration,
  },
  marketing_post: {
    label: "Marketingový příspěvek",
    resource: "marketing",
    model: "marketingPost",
    search: ["title", "caption", "notes"],
    filters: ["status", "channel", "format", "pillar", "campaignId", "ambassadorId", "ownerId"],
    orderBy: { scheduledAt: "desc" },
    listInclude: { campaign: name },
    getInclude: { campaign: name, ambassador: person, owner: name },
    schema: postSchema,
    ownerDefault: "ownerId",
    vocab: {
      status: C.POST_STATUSES,
      channel: C.MARKETING_CHANNELS,
      format: C.POST_FORMATS,
      audience: C.MARKETING_AUDIENCES,
      pillar: C.CONTENT_PILLARS,
    },
    notes: "scheduledAt/publishedAt ve formátu YYYY-MM-DDTHH:mm (pražský čas).",
    create: createPost,
    update: updatePost,
    remove: deletePost,
  },
  marketing_campaign: {
    label: "Marketingová kampaň",
    resource: "marketing",
    model: "marketingCampaign",
    search: ["name", "goal", "description"],
    filters: ["status", "ownerId"],
    orderBy: { createdAt: "desc" },
    listInclude: { _count: { select: { posts: true } } },
    getInclude: { owner: name, posts: { select: { id: true, title: true, status: true, channel: true, scheduledAt: true } } },
    schema: campaignSchema,
    ownerDefault: "ownerId",
    vocab: { status: C.CAMPAIGN_STATUSES, channels: C.MARKETING_CHANNELS },
    create: createCampaign,
    update: updateCampaign,
    remove: deleteCampaign,
  },
  web_form: {
    label: "Webový formulář",
    resource: "marketing",
    model: "webForm",
    search: ["name", "headline"],
    filters: ["type", "isActive", "eventId", "ownerId"],
    orderBy: { createdAt: "desc" },
    listInclude: { _count: { select: { leads: true } } },
    getInclude: { owner: name, event: name },
    schema: webFormSchema,
    ownerDefault: "ownerId",
    notes: "Veřejná adresa formuláře je /f/<id>.",
    create: createWebForm,
    update: updateWebForm,
    remove: deleteWebForm,
  },
  roadmap_item: {
    label: "Položka roadmapy",
    resource: "roadmap",
    model: "roadmapItem",
    search: ["title", "description"],
    filters: ["status", "type", "priority", "targetQuarter", "ownerId", "parentId"],
    orderBy: { createdAt: "desc" },
    listInclude: { owner: name },
    getInclude: { owner: name, children: { select: { id: true, title: true, status: true } } },
    schema: roadmapItemSchema,
    ownerDefault: "ownerId",
    vocab: {
      status: C.ROADMAP_STATUSES,
      type: C.ROADMAP_TYPES,
      priority: C.ROADMAP_PRIORITIES,
      effort: C.ROADMAP_EFFORTS,
      targetQuarter: C.ROADMAP_QUARTERS,
    },
    create: createRoadmapItem,
    update: updateRoadmapItem,
    remove: deleteRoadmapItem,
  },
  sequence: {
    label: "Emailová sekvence",
    resource: "contact",
    model: "sequence",
    search: ["name", "description"],
    filters: ["active", "ownerId"],
    orderBy: { createdAt: "desc" },
    listInclude: { owner: name, _count: { select: { steps: true, enrollments: true } } },
    getInclude: { owner: name, steps: { orderBy: { order: "asc" } }, enrollments: { include: { contact: person } } },
    schema: sequenceShape,
    notes:
      "Kroky po vytvoření nelze měnit. Pozastavení/obnovení: set_status (active | paused). Zápis kontaktů: enroll_contacts. " +
      "Stav zápisu: update_enrollment.",
    create: createSequence,
    remove: deleteSequence,
  },
} satisfies Record<string, EntityConfig>;

export type EntityName = keyof typeof ENTITIES;
export const ENTITY_NAMES = Object.keys(ENTITIES) as [EntityName, ...EntityName[]];

export function entity(name: EntityName): EntityConfig {
  return ENTITIES[name];
}

export function vocabValues(vocab: Vocab) {
  return vocab.map((v) => (typeof v === "string" ? { value: v } : { value: v.value, label: v.label }));
}
