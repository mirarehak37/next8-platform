"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setUserRole, setUserStatus } from "@/lib/actions/admin";
import { FormSelect } from "@/components/form-select";

export function UserRoleControl({ userId, roleId, roles }: { userId: string; roleId: string; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  async function handleChange(value: string) {
    try {
      await setUserRole(userId, value);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }
  return <FormSelect value={roleId} onChange={handleChange} options={roles.map((r) => ({ value: r.id, label: r.name }))} className="w-[160px] h-8" />;
}

export function UserStatusControl({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  async function handleChange(value: string) {
    try {
      await setUserStatus(userId, value);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }
  return (
    <FormSelect
      value={status}
      onChange={handleChange}
      options={[{ value: "active", label: "Aktivní" }, { value: "invited", label: "Pozvaný" }, { value: "disabled", label: "Zablokovaný" }]}
      className="w-[140px] h-8"
    />
  );
}
