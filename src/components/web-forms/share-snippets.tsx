"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink } from "lucide-react";

// Link for the Instagram bio + an <iframe> snippet that forwards the host page's UTM parameters.
export function ShareSnippets({ formId }: { formId: string }) {
  // The app's own origin, known only in the browser (server render leaves it empty, no mismatch).
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const url = `${origin}/f/${formId}`;
  const bio = `${url}?utm_source=instagram&utm_medium=bio`;
  const embed = `<iframe id="next8-form" src="${url}?embed=1" style="width:100%;height:760px;border:0" title="NEXT8 poptávka"></iframe>
<script>(function(){var f=document.getElementById("next8-form");var q=location.search.slice(1);if(q)f.src+="&"+q;})();</script>`;

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} zkopírován.`);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input readOnly value={bio} className="font-mono text-xs" />
        <Button type="button" size="sm" variant="outline" onClick={() => copy(bio, "Odkaz")}><Copy className="h-3.5 w-3.5" /> Odkaz do bia</Button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 text-muted-foreground hover:text-foreground" title="Otevřít"><ExternalLink className="h-4 w-4" /></a>
      </div>
      <Button type="button" size="sm" variant="ghost" className="px-0 text-xs" onClick={() => copy(embed, "Kód")}><Copy className="h-3.5 w-3.5" /> Kopírovat kód pro vložení na web (iframe)</Button>
    </div>
  );
}
