import { z } from "zod";

export const webFormSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
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

// What a visitor sends from the public form.
export const submissionSchema = z.object({
  role: z.enum(["coach", "player", "parent", "club"]),
  name: z.string().trim().min(2, "Vyplňte jméno").max(120),
  email: z.string().trim().email("Neplatný e-mail").max(200),
  phone: text(40),
  club: text(160),
  team: text(160),
  message: text(2000),
  consent: z.literal(true, { message: "Bez souhlasu nemůžeme odpovědět" }),
  // UTM / referral carried from the page URL
  utmSource: text(100),
  utmMedium: text(100),
  utmCampaign: text(150),
  utmContent: text(150),
  ref: text(100),
  // anti-spam
  website: z.string().max(0).optional().nullable(), // honeypot: must stay empty
  startedAt: z.number().int(),
});
export type SubmissionInput = z.input<typeof submissionSchema>;
