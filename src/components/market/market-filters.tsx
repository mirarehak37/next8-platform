"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";

const ALL = "all";

export function MarketFilters({
  sports,
  categories,
  leagues,
  owners,
}: {
  sports: string[];
  categories: string[];
  leagues: string[];
  owners: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next}`);
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <FormSelect value={params.get("sport") ?? ALL} onChange={(v) => set("sport", v)} options={[{ value: ALL, label: "Všechny sporty" }, ...sports.map((s) => ({ value: s, label: s }))]} />
      <FormCombobox value={params.get("category") ?? ""} onChange={(v) => set("category", v)} options={categories.map((c) => ({ value: c, label: c }))} placeholder="Všechny kategorie" allowClear clearLabel="Všechny kategorie" />
      <FormCombobox value={params.get("league") ?? ""} onChange={(v) => set("league", v)} options={leagues.map((l) => ({ value: l, label: l }))} placeholder="Všechny soutěže" allowClear clearLabel="Všechny soutěže" />
      <FormSelect value={params.get("owner") ?? ALL} onChange={(v) => set("owner", v)} options={[{ value: ALL, label: "Všichni obchodníci" }, ...owners.map((o) => ({ value: o.id, label: o.name }))]} />
    </div>
  );
}
