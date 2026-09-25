import { z } from "zod";

export const companySchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  legalName: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  companyType: z.string().optional().nullable(),
  status: z.string().default("prospect"),
  segment: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  sport: z.string().optional().nullable(),
  league: z.string().optional().nullable(),
  sizeBand: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  billingStreet: z.string().optional().nullable(),
  billingCity: z.string().optional().nullable(),
  billingZip: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
  description: z.string().optional().nullable(),
});
export type CompanyInput = z.input<typeof companySchema>;

export const contactSchema = z.object({
  firstName: z.string().min(1, "Jméno je povinné"),
  lastName: z.string().min(1, "Příjmení je povinné"),
  jobTitle: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
  status: z.string().default("active"),
  source: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  gdprConsent: z.boolean().default(false),
  marketingConsent: z.boolean().default(false),
  description: z.string().optional().nullable(),
});
export type ContactInput = z.input<typeof contactSchema>;

export const leadSchema = z.object({
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  campaign: z.string().optional().nullable(),
  estimatedValue: z.coerce.number().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
  status: z.string().default("new"),
  rating: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type LeadInput = z.input<typeof leadSchema>;

export const dealSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  companyId: z.string().optional().nullable(),
  primaryContactId: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  value: z.coerce.number().min(0),
  expectedCloseDate: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  nextStep: z.string().optional().nullable(),
  nextStepDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  clubTeamId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  customPackage: z.string().optional().nullable(),
  billingPeriod: z.string().optional().nullable(),
  listPrice: z.preprocess((v) => (v === "" || v == null || Number.isNaN(v) ? null : v), z.coerce.number().min(0).nullable().optional()),
  discountPercent: z.preprocess((v) => (v === "" || v == null || Number.isNaN(v) ? null : v), z.coerce.number().min(0).max(100).nullable().optional()),
  ambassadorId: z.string().optional().nullable(),
  commissionTermId: z.string().optional().nullable(),
  commissionAmount: z.preprocess((v) => (v === "" || v == null || Number.isNaN(v) ? null : v), z.coerce.number().min(0).nullable().optional()),
});
export type DealInput = z.input<typeof dealSchema>;

export const productSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  code: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unit: z.string().default("ks"),
  price: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).default(21),
  isRecurring: z.boolean().default(false),
  billingPeriod: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type ProductInput = z.input<typeof productSchema>;

export const taskSchema = z.object({
  title: z.string().min(1, "Název je povinný"),
  description: z.string().optional().nullable(),
  assigneeId: z.string().min(1, "Řešitel je povinný"),
  dueDate: z.string().optional().nullable(),
  priority: z.string().default("medium"),
  status: z.string().default("open"),
  subjectType: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
});
export type TaskInput = z.input<typeof taskSchema>;

export const roadmapItemSchema = z.object({
  title: z.string().min(1, "Název je povinný"),
  description: z.string().optional().nullable(),
  type: z.string().default("feature"),
  status: z.string().default("backlog"),
  priority: z.string().default("medium"),
  effort: z.string().optional().nullable(),
  targetQuarter: z.string().optional().nullable(),
  moduleId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
});
export type RoadmapItemInput = z.input<typeof roadmapItemSchema>;

export const activitySchema = z.object({
  type: z.string().min(1),
  subject: z.string().min(1, "Předmět je povinný"),
  description: z.string().optional().nullable(),
  subjectType: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  direction: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().optional().nullable(),
  activityAt: z.string().optional().nullable(),
});
export type ActivityInput = z.input<typeof activitySchema>;
