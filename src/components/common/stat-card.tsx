import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg bg-card p-4 outline-1 -outline-offset-1 outline-white/6", className)}>
      <span className="caption-style block text-subtle">{label}</span>
      <span className="text-lg leading-none font-medium tabular-nums sm:text-[22px]">{value}</span>
      {hint && <span className="caption-style block text-soft">{hint}</span>}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-lg bg-card outline-1 -outline-offset-1 outline-white/6", className)}>{children}</div>;
}
