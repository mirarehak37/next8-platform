import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const tagVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border leading-none",
  {
    variants: {
      tone: {
        blue: "border-(--tag-blue-border) bg-(--tag-blue-bg) text-(--tag-blue-text)",
        purple: "border-(--tag-purple-border) bg-(--tag-purple-bg) text-(--tag-purple-text)",
        green: "border-(--tag-green-border) bg-(--tag-green-bg) text-(--tag-green-text)",
        red: "border-(--tag-red-border) bg-(--tag-red-bg) text-(--tag-red-text)",
        orange: "border-(--tag-orange-border) bg-(--tag-orange-bg) text-(--tag-orange-text)",
        amber: "border-(--tag-amber-border) bg-(--tag-amber-bg) text-(--tag-amber-text)",
        teal: "border-(--tag-teal-border) bg-(--tag-teal-bg) text-(--tag-teal-text)",
        brand: "border-(--tag-brand-border) bg-(--tag-brand-bg) text-(--tag-brand-text)",
        neutral: "border-(--tag-neutral-border) bg-(--tag-neutral-bg) text-(--tag-neutral-text)",
      },
      size: {
        md: "h-[22px] px-2 text-[13px]",
        sm: "h-5 px-1.5 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type TagTone = NonNullable<VariantProps<typeof tagVariants>["tone"]>;

export function Tag({ tone, size, className, ...props }: ComponentProps<"span"> & VariantProps<typeof tagVariants>) {
  return <span className={cn(tagVariants({ tone, size }), className)} {...props} />;
}

export function stageTone(stage: { probability: number; isWon?: boolean; isLost?: boolean }): TagTone {
  if (stage.isWon) return "green";
  if (stage.isLost) return "red";
  if (stage.probability >= 75) return "amber";
  if (stage.probability >= 50) return "purple";
  if (stage.probability >= 25) return "blue";
  return "neutral";
}
