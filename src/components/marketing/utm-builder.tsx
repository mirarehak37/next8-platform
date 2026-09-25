"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/form-select";
import { utmUrl } from "@/lib/marketing";
import { Copy } from "lucide-react";

// source / medium pairs as they should appear in analytics.
const SOURCES = [
  { value: "instagram|social", label: "Instagram (bio, story)" },
  { value: "facebook|social", label: "Facebook" },
  { value: "tiktok|social", label: "TikTok" },
  { value: "meta|paid_social", label: "Meta reklama" },
  { value: "newsletter|email", label: "Newsletter / e-mail" },
  { value: "ambasador|referral", label: "Ambasador" },
  { value: "qr|offline", label: "QR kód / leták" },
];

export function UtmBuilder({ campaign, defaultUrl = "https://next8performance.cz" }: { campaign: string; defaultUrl?: string }) {
  const [base, setBase] = useState(defaultUrl);
  const [src, setSrc] = useState(SOURCES[0].value);
  const [content, setContent] = useState("");
  const [source, medium] = src.split("|");
  const url = utmUrl(base, { source, medium, campaign, content: content.trim() || undefined });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5"><Label>Cílová stránka</Label><Input value={base} onChange={(e) => setBase(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Zdroj</Label><FormSelect value={src} onChange={setSrc} options={SOURCES} /></div>
        <div className="space-y-1.5"><Label>utm_content (volitelné)</Label><Input placeholder="např. reel-trener-1" value={content} onChange={(e) => setContent(e.target.value)} /></div>
      </div>
      <div className="flex gap-2">
        <Input readOnly value={url ?? "Neplatná adresa"} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!url}
          onClick={async () => {
            await navigator.clipboard.writeText(url!);
            toast.success("Odkaz zkopírován.");
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Kopírovat
        </Button>
      </div>
    </div>
  );
}
