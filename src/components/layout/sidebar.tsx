"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, Building2, BookUser, UserPlus, KanbanSquare, BarChart3, ListChecks, Package, FileText, Upload,
  CheckSquare, Calendar, ChartNoAxesColumn, AlertTriangle, Map, UserCog, ShieldCheck, UsersRound, LayoutGrid,
  SlidersHorizontal, Workflow, History, LockKeyhole, Users, LifeBuoy, ChevronRight, Star, HeartHandshake, Clapperboard, Tent,
  Megaphone, Target, MapPinned, Inbox, Mail, type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS, PIPELINE_DOT_COLORS, isNavActive, type NavCountKey } from "@/lib/nav-config";
import { can, type ModuleResource } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/common/count-badge";
import { clampSidebarWidth, SIDEBAR_WIDTH_STORAGE_KEY, SIDEBAR_WIDTH_VAR } from "@/lib/sidebar";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Building2, BookUser, UserPlus, KanbanSquare, BarChart3, ListChecks, Package, FileText, Upload,
  CheckSquare, Calendar, ChartNoAxesColumn, AlertTriangle, Map, UserCog, ShieldCheck, UsersRound, LayoutGrid,
  SlidersHorizontal, Workflow, History, Star, HeartHandshake, Clapperboard, Tent, Megaphone, Target, MapPinned, Inbox, Mail,
};

export type SidebarData = {
  role: string;
  tenantName: string;
  futureModules: { name: string; icon: string }[];
  counts: Partial<Record<NavCountKey, number>>;
  teams: { id: string; name: string }[];
  pipelines: { id: string; name: string; isDefault: boolean }[];
  overdueTasks: number;
};

export function Sidebar({ data }: { data: SidebarData }) {
  return (
    <aside className="relative hidden w-(--sidebar-width) shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      <SidebarContent data={data} />
      <SidebarResizer />
    </aside>
  );
}

export function SidebarContent({ data, onNavigate }: { data: SidebarData; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePipeline = pathname === "/crm/deals" ? searchParams.get("pipeline") : null;
  const canView = (resource?: string) => !resource || can(data.role, resource as ModuleResource, "view");

  function isActive(href: string) {
    if (href === "/crm/deals") return pathname === href && !activePipeline;
    return isNavActive(pathname, href);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-sidebar-border bg-sidebar-accent p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand shadow-brand">
          <Image src="/brand/icon.svg" alt="" width={18} height={15} className="h-[15px] w-auto brightness-0 invert" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="block truncate text-sm leading-none font-medium tracking-[-0.01em] text-foreground">NEXT8 CRM</span>
          <span className="caption-style block truncate text-subtle" title={data.tenantName}>
            {data.tenantName || "Obchodní pipeline"}
          </span>
        </div>
      </div>

      <nav aria-label="Hlavní navigace" className="min-h-0 flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group, index) => {
          const items = group.items.filter((item) => canView(item.resource));
          if (items.length === 0) return null;
          const section = (
            <>
              {items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  icon={ICONS[item.icon]}
                  label={item.label}
                  href={item.href}
                  active={isActive(item.href)}
                  count={item.countKey ? data.counts[item.countKey] : undefined}
                  onClick={onNavigate}
                />
              ))}
            </>
          );
          return (
            <SidebarSection
              key={group.label ?? `root-${index}`}
              title={group.label}
              collapsible={group.collapsible}
              defaultOpen={!group.collapsible || items.some((item) => isActive(item.href))}
            >
              {section}
            </SidebarSection>
          );
        })}

        {data.teams.length > 0 && canView("report") && (
          <SidebarSection title="Týmy">
            {data.teams.map((team) => (
              <SidebarNavItem
                key={team.id}
                icon={Users}
                label={team.name}
                href={`/teams/${team.id}`}
                active={pathname === `/teams/${team.id}`}
                onClick={onNavigate}
              />
            ))}
          </SidebarSection>
        )}

        {data.pipelines.length > 1 && canView("deal") && (
          <SidebarSection title="Pipeliny">
            {data.pipelines.map((pipeline, i) => (
              <SidebarNavItem
                key={pipeline.id}
                dotColor={PIPELINE_DOT_COLORS[i % PIPELINE_DOT_COLORS.length]}
                label={pipeline.name}
                href={`/crm/deals?pipeline=${pipeline.id}`}
                active={activePipeline === pipeline.id}
                onClick={onNavigate}
              />
            ))}
          </SidebarSection>
        )}

        {data.futureModules.length > 0 && (
          <SidebarSection title="Připravujeme" collapsible defaultOpen={false}>
            {data.futureModules.map((m) => (
              <li key={m.name}>
                <span
                  className="flex h-[30px] cursor-not-allowed items-center gap-1.5 rounded-lg px-2 text-sm text-faint"
                  title="Modul zatím není aktivován"
                >
                  <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{m.name}</span>
                </span>
              </li>
            ))}
          </SidebarSection>
        )}
      </nav>

      <SidebarSection className="shrink-0 border-t">
        {can(data.role, "admin", "view") && (
          <SidebarNavItem icon={UserPlus} label="Pozvat kolegy" href="/admin/users" tone="quiet" onClick={onNavigate} />
        )}
        <SidebarNavItem icon={LifeBuoy} label="Nápověda" href="/help" tone="quiet" active={pathname === "/help"} onClick={onNavigate} />
      </SidebarSection>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-sidebar-border bg-sidebar-accent p-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="block text-sm leading-none font-medium tracking-[-0.01em] text-foreground tabular-nums">
            {data.overdueTasks > 0 ? `${data.overdueTasks} po termínu` : "Vše v termínu"}
          </span>
          <span className="caption-style block truncate text-subtle">
            {data.overdueTasks > 0 ? "Vaše úkoly čekají" : "Žádné zpožděné úkoly"}
          </span>
        </div>
        <Link
          href={data.overdueTasks > 0 ? "/tasks?filter=overdue" : "/tasks"}
          onClick={onNavigate}
          className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-medium text-foreground shadow-raised transition-colors hover:bg-[#333333]"
        >
          <CheckSquare className="size-3.5" aria-hidden />
          Úkoly
        </Link>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  children,
  className,
  collapsible,
  defaultOpen = true,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = !collapsible || open;

  return (
    <div className={cn("flex flex-col gap-1 border-b border-sidebar-border p-3 last:border-b-0", className)}>
      {title &&
        (collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={expanded}
            className="eyebrow-style flex items-center justify-between text-faint transition-colors hover:text-subtle"
          >
            {title}
            <ChevronRight className={cn("size-3 transition-transform duration-200 ease-power3-out", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="eyebrow-style block text-faint">{title}</span>
        ))}
      {expanded && <ul className="flex flex-col">{children}</ul>}
    </div>
  );
}

function SidebarNavItem({
  icon: Icon,
  dotColor,
  label,
  href,
  active = false,
  count,
  tone = "default",
  onClick,
}: {
  icon?: LucideIcon;
  dotColor?: string;
  label: string;
  href: string;
  active?: boolean;
  count?: number;
  tone?: "default" | "quiet";
  onClick?: () => void;
}) {
  return (
    <li className={cn(active && "my-[1.5px]")}>
      <Link
        href={href}
        onClick={onClick}
        data-active={active}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-[30px] w-full items-center gap-1.5 rounded-lg px-2 text-sm leading-none text-sidebar-foreground transition-[background-color,color,box-shadow] duration-150 ease-power3-out hover:text-foreground",
          "data-[active=true]:h-8 data-[active=true]:bg-sidebar-primary data-[active=true]:text-foreground data-[active=true]:shadow-raised",
          tone === "quiet" && "text-subtle",
        )}
      >
        {Icon ? (
          <Icon
            aria-hidden
            className="size-3.5 shrink-0 text-subtle transition-colors duration-150 group-hover:text-icon group-data-[active=true]:text-brand"
          />
        ) : (
          <span aria-hidden className="flex size-3.5 shrink-0 items-center justify-center">
            <span className="size-2 rounded-full" style={{ backgroundColor: dotColor }} />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {count !== undefined && count > 0 && <CountBadge>{count > 999 ? "999+" : count}</CountBadge>}
      </Link>
    </li>
  );
}

function SidebarResizer() {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; width: number } | null>(null);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!startRef.current) return;
    const width = clampSidebarWidth(startRef.current.width + event.clientX - startRef.current.x);
    document.documentElement.style.setProperty(SIDEBAR_WIDTH_VAR, `${width}px`);
  }, []);

  const stop = useCallback(() => {
    if (!startRef.current) return;
    startRef.current = null;
    setDragging(false);
    delete document.documentElement.dataset.sidebarResizing;
    const width = parseInt(getComputedStyle(document.documentElement).getPropertyValue(SIDEBAR_WIDTH_VAR), 10);
    try {
      if (width) localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width));
    } catch {}
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stop);
    };
  }, [onPointerMove, stop]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Změnit šířku postranního panelu"
      onPointerDown={(event) => {
        const aside = event.currentTarget.parentElement;
        if (!aside) return;
        event.preventDefault();
        startRef.current = { x: event.clientX, width: aside.getBoundingClientRect().width };
        setDragging(true);
        document.documentElement.dataset.sidebarResizing = "";
      }}
      onDoubleClick={() => {
        document.documentElement.style.removeProperty(SIDEBAR_WIDTH_VAR);
        try {
          localStorage.removeItem(SIDEBAR_WIDTH_STORAGE_KEY);
        } catch {}
      }}
      className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
    >
      <span
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors duration-150 group-hover:bg-ring",
          dragging && "bg-ring",
        )}
      />
    </div>
  );
}
