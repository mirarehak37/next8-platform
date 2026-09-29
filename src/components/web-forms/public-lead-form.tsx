"use client";

import { useState } from "react";
import { submitWebForm } from "@/lib/actions/web-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

const ROLES = [
  { value: "coach", label: "Trenér" },
  { value: "player", label: "Hráč" },
  { value: "parent", label: "Rodič" },
  { value: "club", label: "Zástupce klubu" },
] as const;

type Utm = { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; ref?: string };

export function PublicLeadForm({ formId, thankYou, utm }: { formId: string; thankYou: string | null; utm: Utm }) {
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("coach");
  const [startedAt] = useState(() => Date.now());
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => (f.get(k) as string | null)?.trim() || null;
    setState("sending");
    setError(null);
    try {
      const res = await submitWebForm(formId, {
        role, name: get("name") ?? "", email: get("email") ?? "", phone: get("phone"), club: get("club"), team: get("team"),
        message: get("message"), consent: f.get("consent") === "on", website: get("website"), startedAt, ...utm,
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

  if (state === "done") {
    return (
      <div className="py-8 text-center space-y-2">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <div className="font-heading text-lg font-semibold">Díky, máme to!</div>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{thankYou || "Ozveme se ti do 24 hodin."}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Jsem</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={cn("rounded-md border px-2 py-2 text-sm", role === r.value ? "border-[#FF1947] bg-[#FF1947]/10 font-medium text-[#c4002a] dark:text-[#FF1947]" : "hover:bg-muted")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="wf-name">Jméno a příjmení *</Label><Input id="wf-name" name="name" required autoComplete="name" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="wf-email">E-mail *</Label><Input id="wf-email" name="email" type="email" required autoComplete="email" /></div>
        <div className="space-y-1.5"><Label htmlFor="wf-phone">Telefon</Label><Input id="wf-phone" name="phone" type="tel" autoComplete="tel" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="wf-club">Klub</Label><Input id="wf-club" name="club" placeholder="např. FBC Hranice" /></div>
        <div className="space-y-1.5"><Label htmlFor="wf-team">Tým / kategorie</Label><Input id="wf-team" name="team" placeholder="např. U17 dorost, 22 hráčů" /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="wf-msg">Co tě zajímá?</Label><Textarea id="wf-msg" name="message" rows={3} /></div>
      {/* Honeypot — hidden from people, bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Web<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-[#FF1947]" />
        <span>Souhlasím se zpracováním osobních údajů za účelem vyřízení poptávky. *</span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={state === "sending"} className="w-full bg-[#FF1947] text-white hover:bg-[#e0103a]">
        {state === "sending" ? "Odesílám…" : "Odeslat"}
      </Button>
    </form>
  );
}
