import { prisma } from "@/lib/prisma";
import type { PostView, PostFormOptions } from "@/components/marketing/post-form-dialog";

export const postInclude = {
  campaign: { select: { name: true } },
  ambassador: { select: { firstName: true, lastName: true } },
  owner: { select: { name: true } },
} as const;

type PostWithRelations = NonNullable<Awaited<ReturnType<typeof prisma.marketingPost.findFirst<{ include: typeof postInclude }>>>>;

export function toPostView(p: PostWithRelations): PostView {
  return {
    id: p.id, title: p.title, status: p.status, channel: p.channel, format: p.format, audience: p.audience, pillar: p.pillar,
    campaignId: p.campaignId, campaignName: p.campaign?.name ?? null,
    ambassadorId: p.ambassadorId, ambassadorName: p.ambassador ? `${p.ambassador.firstName} ${p.ambassador.lastName}` : null,
    scheduledAt: p.scheduledAt?.toISOString() ?? null, publishedAt: p.publishedAt?.toISOString() ?? null,
    caption: p.caption, hashtags: p.hashtags, cta: p.cta, assetUrl: p.assetUrl, link: p.link, notes: p.notes,
    reach: p.reach, impressions: p.impressions, likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves,
    clicks: p.clicks, followers: p.followers, ownerId: p.ownerId, ownerName: p.owner.name,
  };
}

export async function loadPostFormOptions(tenantId: string): Promise<PostFormOptions> {
  const [owners, campaigns, ambassadors] = await Promise.all([
    prisma.user.findMany({ where: { tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.marketingCampaign.findMany({ where: { tenantId, status: { not: "done" } }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    prisma.ambassador.findMany({ where: { tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
  ]);
  return { owners, campaigns, ambassadors: ambassadors.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })) };
}

// Leads attributed to a campaign: Lead.campaign matches its utm_campaign or its name.
export function campaignLeadWhere(tenantId: string, c: { name: string; utmCampaign: string | null }) {
  const keys = [c.name, c.utmCampaign].filter((k): k is string => !!k);
  return { tenantId, OR: keys.map((k) => ({ campaign: { equals: k, mode: "insensitive" as const } })) };
}
