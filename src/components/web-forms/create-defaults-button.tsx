"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createDefaultWebForms } from "@/lib/actions/web-forms";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function CreateDefaultsButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const n = await createDefaultWebForms();
          toast.success(n ? `Vytvořeno ${n} formulářů.` : "Základní formuláře už máte.");
          router.refresh();
        })
      }
    >
      <Sparkles className="h-4 w-4" /> Základní sada formulářů
    </Button>
  );
}
