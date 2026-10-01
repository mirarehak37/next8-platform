"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveFollowUpRule } from "@/lib/actions/follow-ups";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FOLLOW_UPS, type FollowUpSettings } from "@/lib/follow-ups-meta";

export function FollowUpSettingsCard({ settings, canEdit }: { settings: FollowUpSettings; canEdit: boolean }) {
  const [s, setS] = useState(settings);
  const [onboarding, setOnboarding] = useState(settings.deal_onboarding.days.join(", "));
  const [saving, setSaving] = useState<string | null>(null);

  async function save(key: keyof FollowUpSettings, isActive: boolean, config: object) {
    setSaving(key);
    try {
      await saveFollowUpRule(key, isActive, config);
      toast.success("Uloženo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uložení se nezdařilo.");
    } finally {
      setSaving(null);
    }
  }

  const onboardingDays = onboarding.split(/[,\s;]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0);

  const rows = [
    {
      key: "lead_call" as const,
      control: (
        <label className="flex items-center gap-2 text-sm">Úkol s termínem za
          <Input type="number" min={0} className="w-20" value={s.lead_call.days} disabled={!canEdit} onChange={(e) => setS({ ...s, lead_call: { ...s.lead_call, days: Number(e.target.value) } })} /> dní
        </label>
      ),
      config: () => ({ days: s.lead_call.days }),
    },
    {
      key: "deal_onboarding" as const,
      control: (
        <label className="flex items-center gap-2 text-sm">Check-iny po
          <Input className="w-32" value={onboarding} disabled={!canEdit} onChange={(e) => setOnboarding(e.target.value)} /> dnech
        </label>
      ),
      config: () => ({ days: onboardingDays }),
    },
    {
      key: "deal_renewal" as const,
      control: (
        <label className="flex items-center gap-2 text-sm">Ozvat se
          <Input type="number" min={0} className="w-20" value={s.deal_renewal.daysBefore} disabled={!canEdit} onChange={(e) => setS({ ...s, deal_renewal: { ...s.deal_renewal, daysBefore: Number(e.target.value) } })} /> dní před koncem
        </label>
      ),
      config: () => ({ daysBefore: s.deal_renewal.daysBefore }),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Automatické follow-upy</CardTitle>
        <CardDescription>Vytvářejí úkoly samy, aby se na žádný lead ani klub nezapomnělo. Úkoly uvidíte v Úkolech, kalendáři i na dashboardu.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {rows.map((r) => {
          const meta = FOLLOW_UPS[r.key];
          const active = s[r.key].isActive;
          return (
            <div key={r.key} className="flex flex-col lg:flex-row lg:items-center gap-3 py-3">
              <div className="flex items-start gap-3 lg:w-1/2">
                <Switch
                  checked={active}
                  disabled={!canEdit}
                  onCheckedChange={(v: boolean) => {
                    setS({ ...s, [r.key]: { ...s[r.key], isActive: v } });
                    void save(r.key, v, r.config());
                  }}
                />
                <div>
                  <div className="text-sm font-medium">{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:ml-auto">
                {r.control}
                {canEdit && (
                  <Button size="sm" variant="outline" disabled={saving === r.key} onClick={() => save(r.key, active, r.config())}>
                    {saving === r.key ? "Ukládám…" : "Uložit"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
