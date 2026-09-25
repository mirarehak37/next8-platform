"use server";

import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError, onlyProvided } from "@/lib/actions/helpers";
import { campaignSchema, postSchema } from "@/lib/validations/marketing";
import { revalidatePath } from "next/cache";

function revalidate(campaignId?: string | null) {
  revalidatePath("/marketing", "layout");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  if (campaignId) revalidatePath(`/marketing/campaigns/${campaignId}`);
}

// ---- Posts

type PostParsed = Partial<z.output<typeof postSchema>>;

async function postData(tenantId: string, parsed: PostParsed) {
  const { scheduledAt, publishedAt, campaignId, ambassadorId, ...rest } = parsed;
  if (campaignId && !(await prisma.marketingCampaign.findFirst({ where: { id: campaignId, tenantId }, select: { id: true } }))) {
    throw new ActionError("Kampaň nenalezena.");
  }
  if (ambassadorId && !(await prisma.ambassador.findFirst({ where: { id: ambassadorId, tenantId }, select: { id: true } }))) {
    throw new ActionError("Ambasador nenalezen.");
  }
  const data: Record<string, unknown> = { ...rest };
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (publishedAt !== undefined) data.publishedAt = publishedAt ? new Date(publishedAt) : null;
  if (campaignId !== undefined) data.campaignId = campaignId || null;
  if (ambassadorId !== undefined) data.ambassadorId = ambassadorId || null;
  // Publishing stamps the date if nobody filled it in.
  if (parsed.status === "published" && !publishedAt) data.publishedAt = data.publishedAt ?? new Date();
  return data;
}

export async function createPost(input: unknown) {
  const user = await requirePermission("marketing", "create");
  const parsed = postSchema.parse(input);
  const post = await prisma.marketingPost.create({
    data: { ...(await postData(user.tenantId, parsed)), title: parsed.title, ownerId: parsed.ownerId, tenantId: user.tenantId },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "marketingPost", entityId: post.id, action: "create" });
  revalidate(post.campaignId);
  return post;
}

export async function updatePost(id: string, input: unknown) {
  const user = await requirePermission("marketing", "edit");
  const existing = await prisma.marketingPost.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Příspěvek nenalezen.");
  const parsed = onlyProvided(postSchema.partial().parse(input), input);
  const data = await postData(user.tenantId, parsed);
  if (parsed.status === "published" && existing.publishedAt && !parsed.publishedAt) data.publishedAt = existing.publishedAt;
  const post = await prisma.marketingPost.update({ where: { id }, data });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "marketingPost", entityId: id, action: "update", changes: parsed });
  revalidate(post.campaignId ?? existing.campaignId);
  return post;
}

export async function setPostStatus(id: string, status: string) {
  return updatePost(id, { status });
}

export async function duplicatePost(id: string) {
  const user = await requirePermission("marketing", "create");
  const p = await prisma.marketingPost.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!p) throw new ActionError("Příspěvek nenalezen.");
  const copy = await prisma.marketingPost.create({
    data: {
      tenantId: user.tenantId, title: `${p.title} (kopie)`, status: "idea", channel: p.channel, format: p.format, audience: p.audience,
      pillar: p.pillar, campaignId: p.campaignId, ambassadorId: p.ambassadorId, caption: p.caption, hashtags: p.hashtags, cta: p.cta,
      assetUrl: p.assetUrl, notes: p.notes, ownerId: user.id,
    },
  });
  revalidate(p.campaignId);
  return copy;
}

export async function deletePost(id: string) {
  const user = await requirePermission("marketing", "delete");
  const existing = await prisma.marketingPost.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Příspěvek nenalezen.");
  await prisma.marketingPost.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "marketingPost", entityId: id, action: "delete" });
  revalidate(existing.campaignId);
}

// ---- Campaigns

type CampaignParsed = Partial<z.output<typeof campaignSchema>>;

function campaignData(parsed: CampaignParsed) {
  const { startDate, endDate, ...rest } = parsed;
  const data: Record<string, unknown> = { ...rest };
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  for (const k of ["budget", "spent", "targetLeads"] as const) if (k in parsed) data[k] = parsed[k] ?? null;
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) throw new ActionError("Konec nemůže být před začátkem.");
  return data;
}

export async function createCampaign(input: unknown) {
  const user = await requirePermission("marketing", "create");
  const parsed = campaignSchema.parse(input);
  const c = await prisma.marketingCampaign.create({
    data: { ...campaignData(parsed), name: parsed.name, ownerId: parsed.ownerId, tenantId: user.tenantId },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "marketingCampaign", entityId: c.id, action: "create" });
  revalidate(c.id);
  return c;
}

export async function updateCampaign(id: string, input: unknown) {
  const user = await requirePermission("marketing", "edit");
  const existing = await prisma.marketingCampaign.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Kampaň nenalezena.");
  const parsed = onlyProvided(campaignSchema.partial().parse(input), input);
  const c = await prisma.marketingCampaign.update({ where: { id }, data: campaignData(parsed) });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "marketingCampaign", entityId: id, action: "update", changes: parsed });
  revalidate(id);
  return c;
}

export async function deleteCampaign(id: string) {
  const user = await requirePermission("marketing", "delete");
  const existing = await prisma.marketingCampaign.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Kampaň nenalezena.");
  await prisma.marketingCampaign.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "marketingCampaign", entityId: id, action: "delete" });
  revalidate();
}
