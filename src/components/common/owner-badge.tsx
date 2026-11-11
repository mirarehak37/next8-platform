import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const AVATAR_TONES = ["bg-[#3a2a6b]", "bg-[#1d4e5f]", "bg-[#5c2a3a]", "bg-[#2f4f2a]", "bg-[#5a4320]", "bg-[#2a3f6b]"];

function toneFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

export function OwnerAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white/90 ring-1 ring-white/10",
        toneFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function OwnerBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <OwnerAvatar name={name} />
      <span className="truncate">{name}</span>
    </span>
  );
}
