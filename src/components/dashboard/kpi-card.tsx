import { Card, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground font-medium">{label}</div>
          <div className="text-xl sm:text-2xl font-semibold tracking-tight mt-1 truncate">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          {trend !== undefined && (
            <div className={cn("flex items-center gap-1 text-xs mt-1.5 font-medium", trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}% oproti min. období
            </div>
          )}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF1947]/10 text-[#FF1947] dark:bg-[#FF1947]/10">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}
