import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicLeadForm } from "@/components/web-forms/public-lead-form";
import { webFormType } from "@/lib/web-form-types";
import { eventDateLabel } from "@/lib/events";
import { formatCurrency } from "@/lib/format";

type Search = { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; ref?: string; embed?: string };

async function load(id: string) {
  return prisma.webForm.findFirst({
    where: { id, isActive: true },
    select: {
      id: true, type: true, headline: true, intro: true, thankYou: true,
      event: { select: { name: true, startDate: true, endDate: true, location: true, price: true, capacity: true, status: true, registrations: { select: { role: true, status: true } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const form = await load((await params).id);
  return { title: form?.headline || (form ? webFormType(form.type).headline : "NEXT8 Performance"), robots: { index: false } };
}

// Public lead form — linked from an Instagram bio or embedded as an <iframe> (?embed=1).
export default async function PublicFormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const form = await load(id);
  if (!form) notFound();
  const embed = sp.embed === "1";
  const meta = webFormType(form.type);
  const ev = form.type === "event" ? form.event : null;
  const taken = ev ? ev.registrations.filter((r) => r.role === "participant" && r.status !== "cancelled").length : 0;

  const eventBox = ev && (
    <div className="mb-4 rounded-lg border bg-muted/40 p-3 text-sm">
      <div className="font-semibold">{ev.name}</div>
      <div className="text-muted-foreground">
        {eventDateLabel(ev.startDate, ev.endDate)}
        {ev.location && ` · ${ev.location}`}
        {` · ${ev.price ? `${formatCurrency(ev.price)} / osoba` : "zdarma"}`}
        {ev.capacity != null && ` · volná místa: ${Math.max(ev.capacity - taken, 0)}`}
      </div>
    </div>
  );
  const body = (
    <>
      {eventBox}
      <PublicLeadForm
        formId={form.id}
        type={meta.value}
        embed={embed}
        thankYou={form.thankYou || meta.thankYou}
        utm={{ utmSource: sp.utm_source, utmMedium: sp.utm_medium, utmCampaign: sp.utm_campaign, utmContent: sp.utm_content, ref: sp.ref }}
      />
    </>
  );
  if (embed) return <main className="p-1 sm:p-2">{body}</main>;

  return (
    <main className="min-h-screen bg-[#171717] px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-lg">
        <Image src="/brand/logo-white.png" alt="NEXT8 Performance" width={140} height={34} className="h-8 w-auto mb-6" priority />
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white leading-tight">{form.headline || meta.headline}</h1>
        <p className="mt-2 mb-6 text-sm text-white/70">{form.intro || meta.intro}</p>
        <div className="rounded-xl bg-background p-5 sm:p-6">{body}</div>
      </div>
    </main>
  );
}
