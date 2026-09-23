import { cn } from "@/lib/utils";

// Static class map — Tailwind can't see dynamically built `bg-${color}-100` strings.
const COLOR_CLASSES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  gray: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/30",
  sky: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  indigo: "bg-[#FF1947]/15 text-[#FF1947] border-[#FF1947]/20 dark:bg-[#FF1947]/15 dark:text-[#FF1947] dark:border-[#FF1947]/30",
  violet: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  amber: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  rose: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
};

export function StatusBadge({ label, color = "slate", className }: { label: string; color?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        COLOR_CLASSES[color] ?? COLOR_CLASSES.slate,
        className,
      )}
    >
      {label}
    </span>
  );
}
