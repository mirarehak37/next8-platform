"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { FormSelect } from "@/components/form-select";
import { deleteAttachment, uploadAttachment } from "@/lib/actions/attachments";
import { MAX_ATTACHMENT_BYTES, type AttachmentEntityType } from "@/lib/attachments";
import { ATTACHMENT_CATEGORIES, findMeta } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";

export type AttachmentView = {
  id: string;
  fileName: string;
  fileSize: number;
  category: string | null;
  uploadedBy: string;
  createdAt: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function AttachmentsPanel({
  entityType,
  entityId,
  attachments,
  canEdit,
}: {
  entityType: AttachmentEntityType;
  entityId: string;
  attachments: AttachmentView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("contract");
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name}: soubor je příliš velký (max. 4 MB).`);
          continue;
        }
        const fd = new FormData();
        fd.set("entityType", entityType);
        fd.set("entityId", entityId);
        fd.set("category", category);
        fd.set("file", file);
        await uploadAttachment(fd);
        toast.success(`Nahráno: ${file.name}`);
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nahrání se nezdařilo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(a: AttachmentView) {
    if (!confirm(`Opravdu smazat soubor „${a.fileName}“?`)) return;
    try {
      await deleteAttachment(a.id);
      toast.success("Soubor byl smazán.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Nahrát dokument jako</span>
            <FormSelect value={category} onChange={setCategory} options={ATTACHMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} className="w-44" />
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5" /> {uploading ? "Nahrávám…" : "Vybrat soubory"}
            </Button>
            <span className="text-xs text-muted-foreground">PDF, Word, obrázky… max. 4 MB na soubor</span>
          </CardContent>
        </Card>
      )}
      {attachments.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground border rounded-md border-dashed">Zatím žádné dokumenty. Nahrajte sem smlouvu a dodatky.</div>
      )}
      {attachments.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 hover:underline">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{a.fileName}</div>
                <div className="text-xs text-muted-foreground">{formatSize(a.fileSize)} · {a.uploadedBy} · {formatDate(a.createdAt)}</div>
              </div>
            </a>
            <div className="flex items-center gap-1 shrink-0">
              {a.category && <StatusBadge label={findMeta(ATTACHMENT_CATEGORIES, a.category)?.label ?? a.category} color={a.category === "contract" ? "indigo" : "slate"} />}
              <a href={`/api/attachments/${a.id}?download`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} title="Stáhnout">
                <Download className="h-3.5 w-3.5" />
              </a>
              {canEdit && (
                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
