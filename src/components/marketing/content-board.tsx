"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DndContext, type DragEndEvent, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { setPostStatus } from "@/lib/actions/marketing";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { FormSelect } from "@/components/form-select";
import { PostFormDialog, type PostFormOptions, type PostView } from "@/components/marketing/post-form-dialog";
import { MARKETING_AUDIENCES, MARKETING_CHANNELS, POST_FORMATS, POST_STATUSES, findMeta } from "@/lib/constants";
import { engagementRate, formatPercent, formatPostTime } from "@/lib/marketing";
import { cn } from "@/lib/utils";
import { CalendarDays, Columns3, List, Plus, Star } from "lucide-react";

const BOARD_COLUMNS = POST_STATUSES.filter((s) => s.value !== "cancelled");
const ALL = "all";

export function ContentBoard({
  posts,
  options,
  currentUserId,
  canEdit,
  canDelete,
  hideCampaignFilter,
}: {
  posts: PostView[];
  options: PostFormOptions;
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  hideCampaignFilter?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState(ALL);
  const [audience, setAudience] = useState(ALL);
  const [campaign, setCampaign] = useState(ALL);
  // Optimistic status while a drag is being saved. It only applies while the server still
  // reports the status the card was dragged from — any newer server state wins.
  const [moved, setMoved] = useState<Record<string, { from: string; to: string }>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return posts
      .map((p) => (moved[p.id] && moved[p.id].from === p.status ? { ...p, status: moved[p.id].to } : p))
      .filter((p) =>
        (channel === ALL || p.channel === channel) &&
        (audience === ALL || p.audience === audience) &&
        (campaign === ALL || p.campaignId === campaign) &&
        (!needle || [p.title, p.caption, p.pillar, p.hashtags].some((t) => t?.toLowerCase().includes(needle))),
      );
  }, [posts, moved, q, channel, audience, campaign]);

  const byStatus = useMemo(() => {
    const map = new Map<string, PostView[]>(BOARD_COLUMNS.map((s) => [s.value, []]));
    for (const p of filtered) map.get(p.status)?.push(p);
    return map;
  }, [filtered]);

  async function handleDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const id = String(e.active.id);
    const target = String(e.over.id);
    const post = filtered.find((p) => p.id === id);
    if (!post || post.status === target) return;
    const from = posts.find((p) => p.id === id)?.status ?? post.status;
    setMoved((m) => ({ ...m, [id]: { from, to: target } }));
    try {
      await setPostStatus(id, target);
      if (target === "scheduled" && !post.scheduledAt) toast.info("Nezapomeňte příspěvku nastavit datum publikace.");
      if (target === "published") toast.success("Publikováno – po pár dnech doplňte výsledky (dosah, lajky…).");
      router.refresh();
    } catch (err) {
      setMoved((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
      toast.error(err instanceof Error ? err.message : "Přesun se nezdařil.");
    }
  }

  const dialogProps = { options, currentUserId, readOnly: !canEdit, canDelete };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <Input placeholder="Hledat v názvu, textu, hashtazích…" value={q} onChange={(e) => setQ(e.target.value)} className="lg:max-w-xs" />
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <FormSelect className="w-full lg:w-40" value={channel} onChange={setChannel} options={[{ value: ALL, label: "Všechny kanály" }, ...MARKETING_CHANNELS.map((c) => ({ value: c.value, label: c.label }))]} />
          <FormSelect className="w-full lg:w-40" value={audience} onChange={setAudience} options={[{ value: ALL, label: "Všechna publika" }, ...MARKETING_AUDIENCES.map((c) => ({ value: c.value, label: c.label }))]} />
          {!hideCampaignFilter && <FormSelect className="w-full lg:w-44" value={campaign} onChange={setCampaign} options={[{ value: ALL, label: "Všechny kampaně" }, ...options.campaigns.map((c) => ({ value: c.id, label: c.name }))]} />}
        </div>
        <div className="flex gap-1 rounded-lg border p-1 w-fit text-sm lg:ml-auto">
          <button type="button" onClick={() => setView("board")} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1", view === "board" ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted")}><Columns3 className="h-3.5 w-3.5" /> Tabule</button>
          <button type="button" onClick={() => setView("list")} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1", view === "list" ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted")}><List className="h-3.5 w-3.5" /> Seznam</button>
          <Link href="/calendar?f=marketing" className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted"><CalendarDays className="h-3.5 w-3.5" /> Kalendář</Link>
        </div>
      </div>

      {view === "board" ? (
        <DndContext id="marketing-board" sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 snap-x">
            {BOARD_COLUMNS.map((s) => {
              const items = byStatus.get(s.value) ?? [];
              return (
                <Column key={s.value} id={s.value} title={s.label} color={s.color} count={items.length}>
                  {items.map((p) => <PostCard key={p.id} post={p} draggable={canEdit} dialogProps={dialogProps} />)}
                  {canEdit && s.value === "idea" && (
                    <PostFormDialog
                      {...dialogProps}
                      trigger={<button type="button" className="w-full rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-background flex items-center justify-center gap-1"><Plus className="h-3.5 w-3.5" /> Přidat nápad</button>}
                    />
                  )}
                </Column>
              );
            })}
          </div>
        </DndContext>
      ) : (
        <PostList posts={filtered} dialogProps={dialogProps} />
      )}
    </div>
  );
}

type DialogProps = { options: PostFormOptions; currentUserId: string; readOnly: boolean; canDelete: boolean };

function Column({ id, title, color, count, children }: { id: string; title: string; color: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 snap-start flex-col rounded-lg border bg-muted/30 xl:w-auto xl:flex-1 xl:min-w-[210px]", isOver && "bg-[#FF1947]/10 border-[#FF1947]")}>
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <StatusBadge label={title} color={color} />
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="flex-1 space-y-2 p-2 min-h-[160px]">{children}</div>
    </div>
  );
}

function PostMeta({ post }: { post: PostView }) {
  const ch = findMeta(MARKETING_CHANNELS, post.channel);
  const fmt = findMeta(POST_FORMATS, post.format);
  const aud = findMeta(MARKETING_AUDIENCES, post.audience);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[11px] font-medium">{ch?.label ?? post.channel}{fmt ? ` · ${fmt.label}` : ""}</span>
      {aud && <StatusBadge label={aud.label} color={aud.color} />}
    </div>
  );
}

function PostCard({ post, draggable, dialogProps }: { post: PostView; draggable: boolean; dialogProps: DialogProps }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: post.id, disabled: !draggable });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const when = post.status === "published" ? post.publishedAt : post.scheduledAt;
  const er = post.status === "published" ? engagementRate(post) : null;
  return (
    <Card ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn("relative py-0", draggable && "cursor-grab active:cursor-grabbing", isDragging && "opacity-60 shadow-lg z-10")}>
      <CardContent className="p-3 space-y-1.5">
        <PostMeta post={post} />
        <PostFormDialog
          {...dialogProps}
          post={post}
          trigger={<button type="button" className="block w-full text-left text-sm font-medium leading-snug hover:underline after:absolute after:inset-0">{post.title}</button>}
        />
        {post.pillar && <div className="text-[11px] text-muted-foreground">{post.pillar}</div>}
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className={cn(!when && post.status === "scheduled" && "text-amber-600")}>{when ? formatPostTime(when) : post.status === "scheduled" ? "chybí datum" : ""}</span>
          <span className="truncate">{post.ownerName}</span>
        </div>
        {(post.campaignName || post.ambassadorName) && (
          <div className="flex flex-wrap gap-1 text-[11px]">
            {post.campaignName && <span className="rounded bg-muted px-1.5 py-0.5 truncate max-w-full">🎯 {post.campaignName}</span>}
            {post.ambassadorName && <span className="rounded bg-muted px-1.5 py-0.5 truncate max-w-full"><Star className="inline h-3 w-3 -mt-0.5" /> {post.ambassadorName}</span>}
          </div>
        )}
        {post.status === "published" && (post.reach != null || er != null) && (
          <div className="flex gap-3 text-[11px] pt-1 border-t">
            {post.reach != null && <span>Dosah <b>{post.reach.toLocaleString("cs-CZ")}</b></span>}
            {er != null && <span>ER <b>{formatPercent(er)}</b></span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PostList({ posts, dialogProps }: { posts: PostView[]; dialogProps: DialogProps }) {
  const sorted = [...posts].sort((a, b) => {
    const da = a.publishedAt ?? a.scheduledAt;
    const db = b.publishedAt ?? b.scheduledAt;
    if (!da) return 1;
    if (!db) return -1;
    return db.localeCompare(da);
  });
  if (sorted.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground border rounded-md border-dashed">Nic tu není.</div>;
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Datum</th>
            <th className="px-3 py-2 font-medium">Příspěvek</th>
            <th className="px-3 py-2 font-medium">Stav</th>
            <th className="px-3 py-2 font-medium">Kampaň</th>
            <th className="px-3 py-2 font-medium text-right">Dosah</th>
            <th className="px-3 py-2 font-medium text-right">Interakce</th>
            <th className="px-3 py-2 font-medium text-right">ER</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const st = findMeta(POST_STATUSES, p.status);
            const inter = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0);
            return (
              <tr key={p.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{formatPostTime(p.publishedAt ?? p.scheduledAt, true)}</td>
                <td className="px-3 py-2">
                  <PostFormDialog {...dialogProps} post={p} trigger={<button type="button" className="text-left font-medium hover:underline">{p.title}</button>} />
                  <PostMeta post={p} />
                </td>
                <td className="px-3 py-2">{st && <StatusBadge label={st.label} color={st.color} />}</td>
                <td className="px-3 py-2 text-xs">{p.campaignName ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.reach?.toLocaleString("cs-CZ") ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.status === "published" ? inter.toLocaleString("cs-CZ") : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPercent(engagementRate(p))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
