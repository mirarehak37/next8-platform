import { z } from "zod";

export const webFormSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  type: z.enum(["demo", "contact", "event", "ambassador", "partner"]).default("demo"),
  eventId: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  intro: z.string().optional().nullable(),
  thankYou: z.string().optional().nullable(),
  source: z.string().min(1).default("Web – formulář"),
  campaign: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
  isActive: z.boolean().default(true),
});
export type WebFormInput = z.input<typeof webFormSchema>;

const text = (max: number) => z.string().trim().max(max).optional().nullable();
const name = z.string().trim().min(2, "Vyplňte jméno").max(120);
const email = z.string().trim().email("Neplatný e-mail").max(200);

// Sent by every form: consent, where the visitor came from, and the anti-spam fields.
const common = {
  consent: z.literal(true, { message: "Bez souhlasu nemůžeme odpovědět" }),
  utmSource: text(100),
  utmMedium: text(100),
  utmCampaign: text(150),
  utmContent: text(150),
  ref: text(100),
  hp: z.string().max(0).optional().nullable(), // honeypot: must stay empty
  startedAt: z.number().int(),
};

export const submissionSchemas = {
  demo: z.object({
    ...common,
    role: z.enum(["coach", "player", "parent", "club"]),
    name,
    email,
    phone: text(40),
    club: text(160),
    team: text(160),
    message: text(2000),
  }),
  contact: z.object({ ...common, name, email, phone: text(40), message: z.string().trim().min(2, "Napište zprávu").max(2000) }),
  event: z.object({
    ...common,
    role: z.enum(["participant", "coach"]),
    name,
    birthYear: z.coerce.number().int().min(1940).max(2030).optional().nullable().or(z.literal("").transform(() => null)),
    club: text(160),
    email,
    phone: z.string().trim().min(6, "Vyplňte telefon").max(40),
    parentName: text(120),
    note: text(1000),
  }),
  ambassador: z.object({
    ...common,
    name,
    email,
    phone: text(40),
    club: text(160),
    position: text(80),
    instagram: text(100),
    tiktok: text(100),
    followers: z.coerce.number().int().min(0).max(100_000_000).optional().nullable().or(z.literal("").transform(() => null)),
    message: text(2000),
  }),
  partner: z.object({
    ...common,
    company: z.string().trim().min(2, "Vyplňte firmu").max(160),
    name,
    email,
    phone: text(40),
    website: text(200),
    interest: z.enum(["next8_partner", "club_sponsor"]).default("next8_partner"),
    message: text(2000),
  }),
} as const;
