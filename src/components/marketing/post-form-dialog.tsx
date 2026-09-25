"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { postSchema, type PostInput } from "@/lib/validations/marketing";
import { createPost, deletePost, duplicatePost, updatePost } from "@/lib/actions/marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { Section, Field } from "@/components/partnerships/form-parts";
import { CONTENT_PILLARS, MARKETING_AUDIENCES, MARKETING_CHANNELS, POST_FORMATS, POST_STATUSES } from "@/lib/constants";
import { engagementRate, formatPercent, toDateTimeInput } from "@/lib/marketing";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";

export type PostView = {
  id: string;
  title: string;
  status: string;
  channel: string;
  format: string | null;
  audience: string | null;
  pillar: string | null;
  campaignId: string | null;
  campaignName: string | null;
  ambassadorId: string | null;
  ambassadorName: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  caption: string | null;
  hashtags: string | null;
  cta: string | null;
  assetUrl: string | null;
  link: string | null;
  notes: string | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  followers: number | null;
  ownerId: string;
  ownerName: string;
};

export type PostFormOptions = {
  owners: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  ambassadors: { id: string; name: string }[];
};

const METRICS = [
  ["reach", "Dosah"],
  ["impressions", "Zobrazení"],
  ["likes", "To se mi líbí"],
  ["comments", "Komentáře"],
  ["shares", "Sdílení"],
  ["saves", "Uložení"],
  ["clicks", "Prokliky"],
  ["followers", "Noví sledující"],
] as const;

// Caption length limits worth warning about per channel.
const CAPTION_LIMIT: Record<string, number> = { instagram: 2200, tiktok: 2200, facebook: 63206, linkedin: 3000, youtube: 5000 };

export function PostFormDialog({
  post,
  options,
  currentUserId,
  defaults,
  trigger,
  readOnly,
  canDelete,
}: {
  post?: PostView | null;
  options: PostFormOptions;
  currentUserId?: string;
  defaults?: Partial<PostInput>;
  trigger?: React.ReactElement;
  readOnly?: boolean;
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!post;
  const blank = (): PostInput => ({ title: "", status: "idea", channel: "instagram", ownerId: currentUserId ?? options.owners[0]?.id ?? "", ...defaults });
  const initial = (): PostInput =>
    post
      ? {
          title: post.title, status: post.status, channel: post.channel, format: post.format, audience: post.audience, pillar: post.pillar,
          campaignId: post.campaignId, ambassadorId: post.ambassadorId,
          // Local wall-clock time for the pickers (computed in the browser, not on the server).
          scheduledAt: toDateTimeInput(post.scheduledAt ? new Date(post.scheduledAt) : null),
          publishedAt: toDateTimeInput(post.publishedAt ? new Date(post.publishedAt) : null),
          caption: post.caption, hashtags: post.hashtags, cta: post.cta, assetUrl: post.assetUrl, link: post.link, notes: post.notes,
          reach: post.reach, impressions: post.impressions, likes: post.likes, comments: post.comments, shares: post.shares,
          saves: post.saves, clicks: post.clicks, followers: post.followers, ownerId: post.ownerId,
        }
      : blank();

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<PostInput>({ resolver: zodResolver(postSchema), defaultValues: initial() });
  const status = useWatch({ control, name: "status" });
  const channel = useWatch({ control, name: "channel" });
  const caption = useWatch({ control, name: "caption" }) ?? "";
  const hashtags = useWatch({ control, name: "hashtags" }) ?? "";
  const limit = CAPTION_LIMIT[channel ?? ""];
  const tagCount = (hashtags.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;

  async function onSubmit(values: PostInput) {
    // Send absolute instants; the server doesn't know the user's time zone.
    const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);
    const data = { ...values, scheduledAt: iso(values.scheduledAt), publishedAt: iso(values.publishedAt) };
    try {
      if (isEdit) {
        await updatePost(post!.id, data);
        toast.success("Příspěvek byl uložen.");
      } else {
        await createPost(data);
        toast.success("Příspěvek byl vytvořen.");
        reset(blank());
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  async function onDuplicate() {
    try {
      await duplicatePost(post!.id);
      toast.success("Kopie je v nápadech.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  async function onDelete() {
    if (!confirm(`Smazat „${post!.title}“?`)) return;
    try {
      await deletePost(post!.id);
      toast.success("Příspěvek byl smazán.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  const er = post ? engagementRate(post) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(initial()); }}>
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový příspěvek</Button>} />
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? post!.title : "Nový příspěvek / nápad"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <fieldset disabled={readOnly} className="space-y-5 min-w-0">
          <Section title="Obsah">
            <Field label="Název / téma *" error={errors.title?.message} className="sm:col-span-2">
              <Input placeholder="např. Carousel: 3 signály, že je hráč přetížený" {...register("title")} />
            </Field>
            <Field label="Kanál">
              <Controller control={control} name="channel" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={MARKETING_CHANNELS.map((c) => ({ value: c.value, label: c.label }))} />
              )} />
            </Field>
            <Field label="Formát">
              <Controller control={control} name="format" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={POST_FORMATS.map((c) => ({ value: c.value, label: c.label }))} placeholder="Vyberte…" />
              )} />
            </Field>
            <Field label="Pro koho (publikum)">
              <Controller control={control} name="audience" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={MARKETING_AUDIENCES.map((c) => ({ value: c.value, label: c.label }))} placeholder="Vyberte…" />
              )} />
            </Field>
            <Field label="Pilíř obsahu">
              <Controller control={control} name="pillar" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={CONTENT_PILLARS.map((p) => ({ value: p, label: p }))} placeholder="Vyberte…" creatable allowClear />
              )} />
            </Field>
            <Field label="Kampaň">
              <Controller control={control} name="campaignId" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={options.campaigns.map((c) => ({ value: c.id, label: c.name }))} placeholder="Bez kampaně" allowClear />
              )} />
            </Field>
            <Field label="Spolupráce s ambasadorem">
              <Controller control={control} name="ambassadorId" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={options.ambassadors.map((c) => ({ value: c.id, label: c.name }))} placeholder="Bez ambasadora" allowClear />
              )} />
            </Field>
          </Section>

          <Section title="Text a podklady">
            <Field label={`Text příspěvku (${caption.length}${limit ? ` / ${limit}` : ""} znaků)`} className="sm:col-span-2">
              <Textarea rows={5} placeholder="Hook v první větě, jedna myšlenka, výzva k akci…" {...register("caption")} />
              {limit && caption.length > limit && <p className="text-xs text-destructive">Text je delší, než kanál dovolí.</p>}
            </Field>
            <Field label={`Hashtagy (${tagCount})`}>
              <Input placeholder="#florbal #next8" {...register("hashtags")} />
            </Field>
            <Field label="Výzva k akci (CTA)">
              <Input placeholder="např. Založ si tým a zkus to s klukama" {...register("cta")} />
            </Field>
            <Field label="Grafika / podklady (odkaz)" className="sm:col-span-2">
              <div className="flex gap-2">
                <Input placeholder="https://www.canva.com/design/…" {...register("assetUrl")} />
                {post?.assetUrl && (
                  <a href={post.assetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" /></a>
                )}
              </div>
            </Field>
            <Field label="Brief / poznámky / zpětná vazba" className="sm:col-span-2">
              <Textarea rows={2} {...register("notes")} />
            </Field>
          </Section>

          <Section title="Publikace">
            <Field label="Stav">
              <Controller control={control} name="status" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={POST_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
              )} />
            </Field>
            <Field label="Naplánováno na"><Input type="datetime-local" {...register("scheduledAt")} /></Field>
            {status === "published" && (
              <>
                <Field label="Publikováno"><Input type="datetime-local" {...register("publishedAt")} /></Field>
                <Field label="Odkaz na příspěvek">
                  <div className="flex gap-2">
                    <Input type="url" placeholder="https://instagram.com/p/…" {...register("link")} />
                    {post?.link && (
                      <a href={post.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" /></a>
                    )}
                  </div>
                </Field>
              </>
            )}
            <Field label="Vlastník *" error={errors.ownerId?.message}>
              <Controller control={control} name="ownerId" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={options.owners.map((o) => ({ value: o.id, label: o.name }))} />
              )} />
            </Field>
          </Section>

          {status === "published" && (
            <Section title={`Výsledky${er != null ? ` · engagement ${formatPercent(er)}` : ""}`}>
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {METRICS.map(([key, label]) => (
                  <Field key={key} label={label}><Input type="number" min={0} {...register(key)} /></Field>
                ))}
              </div>
            </Section>
          )}

          </fieldset>
          {!readOnly && (
            <DialogFooter className="sm:justify-between gap-2">
              {isEdit ? (
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /> Duplikovat</Button>
                  {canDelete && <Button type="button" variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /> Smazat</Button>}
                </div>
              ) : <span />}
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit" : "Vytvořit"}</Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
