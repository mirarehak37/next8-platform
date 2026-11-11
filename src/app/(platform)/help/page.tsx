import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/common/stat-card";

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Otevřít vyhledávání a rychlou navigaci" },
  { keys: ["Esc"], label: "Zavřít dialog nebo vyhledávání" },
  { keys: ["↑", "↓"], label: "Pohyb ve výsledcích vyhledávání" },
  { keys: ["↵"], label: "Otevřít vybraný výsledek" },
];

const GUIDES = [
  {
    title: "Kluby a kontakty",
    body: "Klub je firma/organizace, pod ní jsou týmy a kontakty. Kontakty přiřadíte ke klubu i konkrétnímu týmu.",
    href: "/crm/companies",
  },
  {
    title: "Obchodní případy",
    body: "Kanban podle fází pipeline. Přetažením karty změníte fázi; přechod do fáze Nabídka vytvoří úkol.",
    href: "/crm/deals",
  },
  {
    title: "Forecast",
    body: "Commit = vyhrané + obchody s pravděpodobností ≥ 75 %. Best case přidává obchody ≥ 50 %.",
    href: "/crm/forecast",
  },
  {
    title: "Ohrožené obchody",
    body: "Otevřené obchody po termínu uzavření nebo bez aktivity přes 21 dní. Zaznamenejte kontakt nebo posuňte termín.",
    href: "/reports/slipping-deals",
  },
];

export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Nápověda" description="Klávesové zkratky a stručný průvodce platformou." />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <Panel className="p-4">
          <h2 className="mb-4 text-base leading-none font-semibold">Klávesové zkratky</h2>
          <ul className="flex flex-col divide-y divide-border">
            {SHORTCUTS.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-soft">{s.label}</span>
                <span className="flex gap-1">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border-[0.5px] border-[#414141] bg-muted px-1.5 font-sans text-xs text-chip"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid gap-3 md:grid-cols-2">
          {GUIDES.map((g) => (
            <Link
              key={g.title}
              href={g.href}
              className="group flex flex-col gap-2.5 rounded-lg bg-card p-4 outline-1 -outline-offset-1 outline-white/6 transition-colors hover:bg-[#202226]"
            >
              <span className="flex items-center justify-between text-sm font-medium">
                {g.title}
                <ArrowRight className="size-3.5 text-subtle transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </span>
              <span className="text-sm leading-snug text-muted-foreground">{g.body}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
