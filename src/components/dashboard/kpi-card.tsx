import { cn } from "@/lib/utils";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-card p-4 outline-1 -outline-offset-1 outline-white/6">
      <div className="flex items-start justify-between gap-2">
        <span className="caption-style line-clamp-2 leading-tight text-subtle">{label}</span>
        <Icon className="size-3.5 shrink-0 text-subtle" aria-hidden />
      </div>
      <span className="text-lg leading-none font-medium tabular-nums sm:text-[22px]">{value}</span>
      {hint && <span className="caption-style leading-tight text-soft">{hint}</span>}
      {trend !== undefined && (
        <span className={cn("caption-style flex items-center gap-1", trend >= 0 ? "text-success" : "text-danger")}>
          {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {Math.abs(trend)}% oproti min. období
        </span>
      )}
    </div>
  );
}
