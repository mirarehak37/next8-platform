"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleTenantModule } from "@/lib/actions/admin";
import { Switch } from "@/components/ui/switch";

export function ModuleToggle({ moduleId, enabled, isCore }: { moduleId: string; enabled: boolean; isCore: boolean }) {
  const router = useRouter();
  async function handleChange(checked: boolean) {
    try {
      await toggleTenantModule(moduleId, checked);
      toast.success(checked ? "Modul byl aktivován." : "Modul byl deaktivován.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }
  return <Switch checked={enabled} onCheckedChange={handleChange} disabled={isCore} />;
}
