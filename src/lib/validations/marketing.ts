import { z } from "zod";

const optInt = z.preprocess((v) => (v === "" || v == null || Number.isNaN(v) ? null : v), z.coerce.number().int().min(0).nullable().optional());
const optNum = z.preprocess((v) => (v === "" || v == null || Number.isNaN(v) ? null : v), z.coerce.number().min(0).nullable().optional());

export const postSchema = z.object({
  title: z.string().min(1, "Název je povinný"),
  status: z.string().default("idea"),
  channel: z.string().default("instagram"),
  format: z.string().optional().nullable(),
  audience: z.string().optional().nullable(),
  pillar: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  ambassadorId: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(), // "YYYY-MM-DDTHH:mm"
  publishedAt: z.string().optional().nullable(),
  caption: z.string().optional().nullable(),
  hashtags: z.string().optional().nullable(),
  cta: z.string().optional().nullable(),
  assetUrl: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  reach: optInt,
  impressions: optInt,
  likes: optInt,
  comments: optInt,
  shares: optInt,
  saves: optInt,
  clicks: optInt,
  followers: optInt,
  ownerId: z.string().min(1, "Vlastník je povinný"),
});
export type PostInput = z.input<typeof postSchema>;

export const campaignSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  goal: z.string().optional().nullable(),
  audience: z.string().optional().nullable(),
  channels: z.array(z.string()).default([]),
  status: z.string().default("planned"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budget: optNum,
  spent: optNum,
  utmCampaign: z.string().optional().nullable(),
  targetLeads: optInt,
  description: z.string().optional().nullable(),
  ownerId: z.string().min(1, "Vlastník je povinný"),
});
export type CampaignInput = z.input<typeof campaignSchema>;
