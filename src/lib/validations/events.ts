import { z } from "zod";

const optionalNumber = z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? null : v), z.coerce.number().min(0).nullable().optional());
const optionalInt = z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? null : v), z.coerce.number().int().min(0).nullable().optional());

export const eventSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  type: z.string().default("camp"),
  status: z.string().default("planned"),
  startDate: z.string().min(1, "Začátek je povinný"),
  endDate: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  capacity: optionalInt,
  price: optionalNumber,
  companyId: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
  description: z.string().optional().nullable(),
});
export type EventInput = z.input<typeof eventSchema>;

export const registrationSchema = z.object({
  eventId: z.string().min(1),
  role: z.string().default("participant"),
  contactId: z.string().optional().nullable(),
  ambassadorId: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  email: z.string().email("Neplatný e-mail").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  status: z.string().default("registered"),
  paymentStatus: z.string().default("unpaid"),
  amount: optionalNumber,
  note: z.string().optional().nullable(),
});
export type RegistrationInput = z.input<typeof registrationSchema>;
