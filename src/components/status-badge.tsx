import { Tag, type TagTone } from "@/components/common/tag";

const COLOR_TONES: Record<string, TagTone> = {
  slate: "neutral",
  gray: "neutral",
  sky: "blue",
  indigo: "brand",
  violet: "purple",
  amber: "amber",
  emerald: "green",
  rose: "red",
};

export function StatusBadge({ label, color = "slate", className }: { label: string; color?: string; className?: string }) {
  return (
    <Tag tone={COLOR_TONES[color] ?? "neutral"} size="sm" className={className}>
      {label}
    </Tag>
  );
}
