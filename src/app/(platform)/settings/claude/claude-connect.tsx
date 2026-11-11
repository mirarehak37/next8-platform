"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { createApiToken, revokeApiToken } from "@/lib/actions/api-tokens";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/common/stat-card";
import { Tag } from "@/components/common/tag";

type TokenRow = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };

const TOOLS = [
  ["Přehledy", "hledání v CRM, pipeline a forecast, ohrožené obchody, moje úkoly"],
  ["Čtení všeho", "kluby, týmy, kontakty, leady, obchody, úkoly, aktivity, produkty, nabídky, ambasadoři, partneři, akce, marketing, formuláře, roadmapa, sekvence"],
  ["Zakládání a úpravy", "všechny výše uvedené typy záznamů – se stejnou validací jako v aplikaci"],
  ["Obchody", "přesun mezi fázemi, uzavření jako vyhráno/prohráno, nabídky"],
  ["Leady", "změna stavu a převod na klub + kontakt + obchod"],
  ["Úkoly a aktivity", "vytvořit, dokončit, zapsat hovor nebo schůzku"],
  ["Sekvence", "založit, zapsat kontakty, pozastavit, ukončit zápis"],
  ["Mazání", "jen s výslovným potvrzením; správa uživatelů a rolí zůstává v aplikaci"],
];

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="caption-style text-subtle">{label}</span>
      <div className="flex items-start gap-2 rounded-lg border border-line-strong bg-secondary p-2.5">
        <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-chip">{value}</pre>
        <button
          type="button"
          aria-label="Kopírovat"
          className="shrink-0 rounded-md p-1 text-subtle transition-colors hover:bg-white/6 hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function ClaudeConnect({ mcpUrl, tokens }: { mcpUrl: string; tokens: TokenRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("Claude");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const token = freshToken ?? "n8_VÁŠ_TOKEN";

  function create() {
    startTransition(async () => {
      try {
        const res = await createApiToken(name);
        setFreshToken(res.token);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Token se nepodařilo vytvořit.");
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      try {
        await revokeApiToken(id);
        toast.success("Token zrušen.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Token se nepodařilo zrušit.");
      }
    });
  }

  const claudeCode = `claude mcp add --transport http next8-crm ${mcpUrl} \\\n  --header "Authorization: Bearer ${token}"`;
  const desktopConfig = JSON.stringify(
    {
      mcpServers: {
        "next8-crm": {
          command: "npx",
          args: ["-y", "mcp-remote", mcpUrl, "--header", `Authorization: Bearer ${token}`],
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-4">
        <Panel className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">1</span>
            <h2 className="text-sm font-medium">Vytvořte API token</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Název tokenu" className="max-w-[240px]" />
            <Button onClick={create} disabled={pending}>
              <KeyRound /> Vytvořit token
            </Button>
          </div>
          {freshToken && (
            <div className="flex flex-col gap-2 rounded-lg border border-(--tag-amber-border) bg-(--tag-amber-bg) p-3">
              <span className="text-xs text-(--tag-amber-text)">
                Token se zobrazí jen teď. Zkopírujte si ho — příkazy níže už ho obsahují.
              </span>
              <CopyBlock label="Token" value={freshToken} />
            </div>
          )}
        </Panel>

        <Panel className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">2</span>
            <h2 className="text-sm font-medium">Připojte Clauda</h2>
          </div>
          <CopyBlock label="Claude Code (terminál nebo aplikace Claude → Code)" value={claudeCode} />
          <CopyBlock
            label="Claude Desktop — vložte do Settings → Developer → Edit Config (claude_desktop_config.json) a restartujte aplikaci"
            value={desktopConfig}
          />
          <CopyBlock label="Adresa MCP serveru" value={mcpUrl} />
          <p className="caption-style leading-snug text-subtle">
            Claude vidí jen to, co vidíte vy v CRM (role a viditelnost záznamů platí i tady). Zápisy se v audit logu označí jako „via mcp“.
          </p>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel className="overflow-hidden">
          <div className="border-b px-4 py-3 text-sm font-medium">Aktivní tokeny</div>
          <ul className="divide-y divide-border">
            {tokens.length === 0 && <li className="caption-style px-4 py-6 text-center text-subtle">Zatím žádný token.</li>}
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="truncate">{t.name}</span>
                    <Tag size="sm">{t.prefix}…</Tag>
                  </span>
                  <span className="caption-style text-subtle">
                    {t.lastUsedAt ? `Naposledy použit ${formatDateTime(t.lastUsedAt)}` : `Vytvořen ${formatDateTime(t.createdAt)}`}
                  </span>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Zrušit token" disabled={pending} onClick={() => revoke(t.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-medium">Co Claude umí</h2>
          <ul className="flex flex-col gap-2">
            {TOOLS.map(([tool, label]) => (
              <li key={tool} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-chip">{tool}</span>
                <span className="caption-style text-subtle">{label}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
