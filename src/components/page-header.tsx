import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
}: {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="border-b px-4 pt-1 pb-4 sm:px-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Drobečková navigace" className="caption-style mb-2.5 flex items-center gap-1 text-subtle">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 text-faint" />}
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? "text-soft" : undefined}>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base leading-none font-medium tracking-[-0.01em]">{title}</h1>
            {badge}
          </div>
          {description && <p className="text-sm leading-tight text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
