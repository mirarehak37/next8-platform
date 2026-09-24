"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addClubTeamContact, removeClubTeamContact } from "@/lib/actions/club-teams";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FormCombobox } from "@/components/form-combobox";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { initials } from "@/lib/format";

type TeamContact = { contactId: string; name: string; role: string | null };
type ContactOption = { id: string; name: string };

export function ClubTeamContacts({
  clubTeamId,
  contacts,
  allContacts,
}: {
  clubTeamId: string;
  contacts: TeamContact[];
  allContacts: ContactOption[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [contactId, setContactId] = useState<string | undefined>();
  const [role, setRole] = useState("");
  const [pending, setPending] = useState(false);

  const linkedIds = new Set(contacts.map((c) => c.contactId));
  const options = allContacts.filter((c) => !linkedIds.has(c.id)).map((c) => ({ value: c.id, label: c.name }));

  async function handleAdd() {
    if (!contactId) return;
    setPending(true);
    try {
      await addClubTeamContact(clubTeamId, contactId, role || null);
      toast.success("Kontakt byl přidán k týmu.");
      setAdding(false);
      setContactId(undefined);
      setRole("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeClubTeamContact(clubTeamId, id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <div className="space-y-1.5">
      {contacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {contacts.map((c) => (
            <span key={c.contactId} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 pl-1 pr-2 py-0.5 text-xs">
              <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px]">{initials(c.name)}</AvatarFallback></Avatar>
              {c.name}
              {c.role && <span className="text-muted-foreground">· {c.role}</span>}
              <button type="button" onClick={() => handleRemove(c.contactId)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {adding ? (
        <div className="flex items-center gap-1.5 pt-1">
          <FormCombobox value={contactId} onChange={setContactId} options={options} placeholder="Vyberte kontakt" className="h-7 w-40 text-xs" />
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (trenér…)" className="h-7 w-28 text-xs" />
          <Button size="sm" className="h-7 px-2" disabled={!contactId || pending} onClick={handleAdd}>Přidat</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAdding(false)}>Zrušit</Button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground pt-0.5">
          <Plus className="h-3 w-3" /> Přidat kontakt
        </button>
      )}
    </div>
  );
}
