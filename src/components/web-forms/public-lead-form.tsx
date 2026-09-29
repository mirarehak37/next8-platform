"use client";

import { useEffect, useRef, useState } from "react";
import { submitWebForm } from "@/lib/actions/web-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { WebFormType } from "@/lib/web-form-types";
import { CheckCircle2 } from "lucide-react";

type Utm = { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; ref?: string };
type Choice = { value: string; label: string };

const CHOICES: Partial<Record<WebFormType, { key: string; label: string; options: Choice[] }>> = {
  demo: {
    key: "role",
    label: "Jsem",
    options: [
      { value: "coach", label: "Trenér" },
      { value: "player", label: "Hráč" },
      { value: "parent", label: "Rodič" },
      { value: "club", label: "Zástupce klubu" },
    ],
  },
  event: { key: "role", label: "Přihlašuji", options: [{ value: "participant", label: "Hráče / sebe" }, { value: "coach", label: "Trenéra" }] },
  partner: { key: "interest", label: "Máme zájem o", options: [{ value: "next8_partner", label: "Partnerství s NEXT8" }, { value: "club_sponsor", label: "Sponzoring klubu" }] },
};

function F({ id, label, className, ...props }: { id: string; label: string; className?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={`wf-${id}`}>{label}</Label>
      <Input id={`wf-${id}`} name={id} {...props} />
    </div>
  );
}

function Fields({ type }: { type: WebFormType }) {
  switch (type) {
    case "demo":
      return (
        <>
          <F id="name" label="Jméno a příjmení *" required autoComplete="name" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F id="email" label="E-mail *" type="email" required autoComplete="email" />
            <F id="phone" label="Telefon" type="tel" autoComplete="tel" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F id="club" label="Klub" placeholder="např. FBC Hranice" />
            <F id="team" label="Tým / kategorie" placeholder="např. U17 dorost, 22 hráčů" />
          </div>
          <Area id="message" label="Co tě zajímá?" />
        </>
      );
    case "contact":
      return (
        <>
          <F id="name" label="Jméno a příjmení *" required autoComplete="name" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F id="email" label="E-mail *" type="email" required autoComplete="email" />
            <F id="phone" label="Telefon" type="tel" autoComplete="tel" />
          </div>
          <Area id="message" label="Zpráva *" required rows={4} />
        </>
      );
    case "event":
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <F id="name" label="Jméno a příjmení *" required className="sm:col-span-2" />
            <F id="birthYear" label="Ročník" type="number" min={1940} max={2030} placeholder="2010" />
          </div>
          <F id="club" label="Klub" placeholder="např. FBC Hranice" />
          <F id="parentName" label="Zákonný zástupce (u nezletilých)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F id="email" label="E-mail *" type="email" required autoComplete="email" />
            <F id="phone" label="Telefon *" type="tel" required autoComplete="tel" />
          </div>
          <Area id="note" label="Poznámka (alergie, velikost trika…)" />
        </>
      );
    case "ambassador":
      return (
        <>
          <F id="name" label="Jméno a příjmení *" required autoComplete="name" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F id="email" label="E-mail *" type="email" required autoComplete="email" />
            <F id="phone" label="Telefon" type="tel" autoComplete="tel" />
            <F id="club" label="Klub" />
            <F id="position" label="Pozice / role" placeholder="útočník, trenér, tvůrce obsahu…" />
            <F id="instagram" label="Instagram" placeholder="@jmeno" />
            <F id="tiktok" label="TikTok" placeholder="@jmeno" />
          </div>
          <F id="followers" label="Počet sledujících (celkem)" type="number" min={0} />
          <Area id="message" label="Napiš nám o sobě" rows={4} />
        </>
      );
    case "partner":
      return (
        <>
          <F id="company" label="Firma *" required autoComplete="organization" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F id="name" label="Kontaktní osoba *" required autoComplete="name" />
            <F id="website" label="Web" placeholder="www.firma.cz" />
            <F id="email" label="E-mail *" type="email" required autoComplete="email" />
            <F id="phone" label="Telefon" type="tel" autoComplete="tel" />
          </div>
          <Area id="message" label="Jakou spolupráci si představujete?" rows={4} />
        </>
      );
  }
}

function Area({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Textarea>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`wf-${id}`}>{label}</Label>
      <Textarea id={`wf-${id}`} name={id} rows={3} {...props} />
    </div>
  );
}

export function PublicLeadForm({ formId, type, thankYou, utm, embed }: { formId: string; type: WebFormType; thankYou: string | null; utm: Utm; embed?: boolean }) {
  const choice = CHOICES[type];
  const [picked, setPicked] = useState(choice?.options[0].value ?? "");
  const [startedAt] = useState(() => Date.now());
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Embedded in an <iframe>: tell the host page our height so it can size the frame (no inner scrollbar).
  useEffect(() => {
    if (!embed || !root.current || window.parent === window) return;
    // Measure the content, not the document: the document is at least as tall as the frame and would never shrink.
    const main = root.current.closest("main") ?? root.current;
    const post = () => window.parent.postMessage({ type: "next8-form-height", formId, height: Math.ceil(main.getBoundingClientRect().height) }, "*");
    const ro = new ResizeObserver(post);
    ro.observe(main);
    post();
    return () => ro.disconnect();
  }, [embed, formId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    f.forEach((v, k) => {
      if (typeof v === "string") values[k] = v.trim() || null;
    });
    setState("sending");
    setError(null);
    try {
      const res = await submitWebForm(formId, {
        ...values, ...(choice ? { [choice.key]: picked } : {}), consent: f.get("consent") === "on", startedAt, ...utm,
      });
      if (res.ok) setState("done");
      else {
        setError(res.error);
        setState("idle");
      }
    } catch {
      setError("Odeslání se nepovedlo, zkuste to prosím znovu.");
      setState("idle");
    }
  }

  return (
    <div ref={root}>
      {state === "done" ? (
        <div className="py-8 text-center space-y-2">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <div className="font-heading text-lg font-semibold">Hotovo, máme to!</div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{thankYou || "Brzy se ozveme."}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {choice && (
            <div className="space-y-1.5">
              <Label>{choice.label}</Label>
              <div className={cn("grid gap-1.5", choice.options.length > 2 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
                {choice.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setPicked(o.value)}
                    className={cn("rounded-md border px-2 py-2 text-sm", picked === o.value ? "border-[#FF1947] bg-[#FF1947]/10 font-medium text-[#c4002a] dark:text-[#FF1947]" : "hover:bg-muted")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Fields type={type} />
          {/* Honeypot — hidden from people, bots fill it in. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Nevyplňovat<input name="hp" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" name="consent" required className="mt-0.5 accent-[#FF1947]" />
            <span>Souhlasím se zpracováním osobních údajů za účelem vyřízení {type === "event" ? "přihlášky" : "poptávky"}. *</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={state === "sending"} className="w-full bg-[#FF1947] text-white hover:bg-[#e0103a]">
            {state === "sending" ? "Odesílám…" : type === "event" ? "Přihlásit" : "Odeslat"}
          </Button>
        </form>
      )}
    </div>
  );
}
