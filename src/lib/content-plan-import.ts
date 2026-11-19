import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAppDateTime } from "@/lib/format";
import { STATUS_ORDER, type ContentPlan } from "@/lib/content-plan";

const str = z.string().nullable().optional();
const int = z.number().int().nullable().optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const contentPlanSchema = z.object({
  campaign: z.object({ name: z.string().min(1), description: str, startDate: day.nullable().optional(), endDate: day.nullable().optional() }),
  posts: z
    .array(
      z.object({
        planKey: z.string().min(1),
        date: day,
        time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        title: z.string().min(1),
        status: z.string(),
        format: str,
        audience: str,
        pillar: str,
        hook: str,
        brief: str,
        variant: str,
        materials: str,
        cta: str,
        goal: str,
        storyPlan: str,
        template: str,
        caption: str,
        hashtags: str,
        notes: str,
      }),
    )
    .max(500),
  weeks: z
    .array(
      z.object({
        week: z.number().int(),
        startDate: day.nullable().optional(),
        endDate: day.nullable().optional(),
        theme: str,
        reach: int,
        saves: int,
        shares: int,
        newFollowers: int,
        bioClicks: int,
        newTeams: int,
        bestPost: str,
        nextChange: str,
      }),
    )
    .max(60),
});

export type ContentPlanImportResult = { campaignId: string; campaignName: string; created: number; updated: number; weeks: number };

const rank = (status: string) => {
  const i = STATUS_ORDER.indexOf(status);
  return i === -1 ? STATUS_ORDER.length : i; // cancelled & unknown: never overwritten
};
const dateOnly = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00.000Z`) : null);

// Creates or refreshes the plan's campaign, its posts/stories and weekly rows.
// Re-importing the same (or an updated) spreadsheet updates in place, matched by
// planKey; a post's status only ever moves forward, so work done in the CRM
// (published, results) is never rolled back. Metrics typed into the CRM stay
// unless the sheet has a number for them.
export async function importContentPlan(user: { id: string; tenantId: string }, input: ContentPlan | z.input<typeof contentPlanSchema>): Promise<ContentPlanImportResult> {
  const plan = contentPlanSchema.parse(input);
  const tenantId = user.tenantId;
  const today = new Date().toISOString().slice(0, 10);
  const running = (!plan.campaign.startDate || plan.campaign.startDate <= today) && (!plan.campaign.endDate || plan.campaign.endDate >= today);

  const existingCampaign = await prisma.marketingCampaign.findFirst({ where: { tenantId, name: plan.campaign.name }, select: { id: true } });
  const campaignData = {
    description: plan.campaign.description ?? null,
    startDate: dateOnly(plan.campaign.startDate),
    endDate: dateOnly(plan.campaign.endDate),
  };
  const campaign = existingCampaign
    ? await prisma.marketingCampaign.update({ where: { id: existingCampaign.id }, data: campaignData })
    : await prisma.marketingCampaign.create({
        data: {
          ...campaignData,
          tenantId,
          name: plan.campaign.name,
          goal: "Obsahový plán: povědomí, hráči v appce, nové kluby a trenéři",
          channels: ["instagram", "facebook"],
          status: running ? "active" : "planned",
          ownerId: user.id,
        },
      });

  const existing = await prisma.marketingPost.findMany({
    where: { tenantId, campaignId: campaign.id, planKey: { in: plan.posts.map((p) => p.planKey) } },
    select: { id: true, planKey: true, status: true },
  });
  const byKey = new Map(existing.map((p) => [p.planKey, p]));

  let created = 0;
  let updated = 0;
  const creates: Prisma.MarketingPostCreateManyInput[] = [];
  const updates: ReturnType<typeof prisma.marketingPost.update>[] = [];
  for (const p of plan.posts) {
    const fields = {
      title: p.title,
      format: p.format ?? null,
      audience: p.audience ?? null,
      pillar: p.pillar ?? null,
      hook: p.hook ?? null,
      brief: p.brief ?? null,
      variant: p.variant ?? null,
      materials: p.materials ?? null,
      cta: p.cta ?? null,
      goal: p.goal ?? null,
      storyPlan: p.storyPlan ?? null,
      template: p.template ?? null,
      caption: p.caption ?? null,
      hashtags: p.hashtags ?? null,
      notes: p.notes ?? null,
      scheduledAt: parseAppDateTime(`${p.date}T${p.time ?? "12:00"}`),
    };
    const found = byKey.get(p.planKey);
    if (found) {
      const status = rank(p.status) > rank(found.status) && rank(found.status) < STATUS_ORDER.length ? p.status : found.status;
      updates.push(
        prisma.marketingPost.update({
          where: { id: found.id },
          data: { ...fields, status, ...(status === "published" && found.status !== "published" ? { publishedAt: new Date() } : {}) },
        }),
      );
      updated++;
    } else {
      creates.push({
        ...fields,
        tenantId,
        campaignId: campaign.id,
        planKey: p.planKey,
        status: p.status,
        channel: "instagram",
        ownerId: user.id,
        ...(p.status === "published" ? { publishedAt: fields.scheduledAt } : {}),
      });
      created++;
    }
  }
  if (creates.length) await prisma.marketingPost.createMany({ data: creates });
  if (updates.length) await prisma.$transaction(updates);

  for (const w of plan.weeks) {
    const metrics = Object.fromEntries(
      (["reach", "saves", "shares", "newFollowers", "bioClicks", "newTeams", "bestPost", "nextChange"] as const)
        .filter((k) => w[k] != null && w[k] !== "")
        .map((k) => [k, w[k]]),
    );
    const base = { startDate: dateOnly(w.startDate), endDate: dateOnly(w.endDate), theme: w.theme ?? null };
    await prisma.marketingWeek.upsert({
      where: { campaignId_week: { campaignId: campaign.id, week: w.week } },
      create: { campaignId: campaign.id, week: w.week, ...base, ...metrics },
      update: { ...base, ...metrics },
    });
  }

  return { campaignId: campaign.id, campaignName: campaign.name, created, updated, weeks: plan.weeks.length };
}
