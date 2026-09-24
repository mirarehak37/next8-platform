import { z } from "zod";

const optionalEmail = z.string().email("Neplatný e-mail").optional().or(z.literal("")).nullable();
const optionalInt = z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? null : v), z.coerce.number().int().min(0).nullable().optional());
const optionalNumber = z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? null : v), z.coerce.number().min(0).nullable().optional());

export const ambassadorSchema = z.object({
  firstName: z.string().min(1, "Jméno je povinné"),
  lastName: z.string().min(1, "Příjmení je povinné"),
  nickname: z.string().optional().nullable(),
  email: optionalEmail,
  phone: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  sport: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  tiktok: z.string().optional().nullable(),
  youtube: z.string().optional().nullable(),
  followers: optionalInt,
  status: z.string().default("candidate"),
  tier: z.string().optional().nullable(),
  contractStart: z.string().optional().nullable(),
  contractEnd: z.string().optional().nullable(),
  discountCode: z.string().optional().nullable(),
  billingType: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
  notes: z.string().optional().nullable(),
});
export type AmbassadorInput = z.input<typeof ambassadorSchema>;

export const partnerSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  kind: z.string().default("next8_partner"),
  level: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  email: optionalEmail,
  phone: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  status: z.string().default("negotiation"),
  contractStart: z.string().optional().nullable(),
  contractEnd: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
  notes: z.string().optional().nullable(),
});
export type PartnerInput = z.input<typeof partnerSchema>;

export const partnershipTermSchema = z.object({
  subjectType: z.enum(["ambassador", "partner"]),
  subjectId: z.string().min(1),
  direction: z.enum(["we_give", "they_give"]),
  type: z.string().min(1, "Typ je povinný"),
  title: z.string().min(1, "Název je povinný"),
  description: z.string().optional().nullable(),
  valueType: z.enum(["fixed", "percent"]).default("fixed"),
  amount: optionalNumber,
  percent: z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? null : v), z.coerce.number().min(0).max(100, "Max. 100 %").nullable().optional()),
  percentBase: z.string().optional().nullable(),
  productIds: z.array(z.string()).default([]),
  quantity: optionalInt,
  period: z.string().default("one_off"),
  dueDate: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type PartnershipTermInput = z.input<typeof partnershipTermSchema>;

export const partnershipFulfillmentSchema = z.object({
  termId: z.string().min(1),
  date: z.string().min(1, "Datum je povinné"),
  quantity: z.coerce.number().int().min(1).default(1),
  productId: z.string().optional().nullable(),
  baseAmount: optionalNumber,
  amount: optionalNumber,
  link: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export type PartnershipFulfillmentInput = z.input<typeof partnershipFulfillmentSchema>;
