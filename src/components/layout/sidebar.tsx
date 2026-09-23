"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/nav-config";
import { can, type ModuleResource } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Building2, Users, UserPlus, Handshake, Activity, Package, FileText,
  CheckSquare, Calendar, BarChart3, UserCog, ShieldCheck, UsersRound, LayoutGrid,
  SlidersHorizontal, Workflow, History, LockKeyhole, Map, Upload, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Building2, Users, UserPlus, Handshake, Activity, Package, FileText,
  CheckSquare, Calendar, BarChart3, UserCog, ShieldCheck, UsersRound, LayoutGrid,
  SlidersHorizontal, Workflow, History, Map, Upload,
};

export function Sidebar({
  role,
  tenantName,
  futureModules,
}: {
  role: string;
  tenantName: string;
  futureModules: { name: string; icon: string }[];
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r bg-neutral-950 text-neutral-300 h-screen sticky top-0">
      <div className="flex items-center px-5 h-16 border-b border-neutral-800 shrink-0">
        <Image src="/brand/logo-white.png" alt="NEXT8" width={110} height={26} className="h-6 w-auto" priority />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.resource || can(role, item.resource as ModuleResource, "view"),
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label ?? "root"}>
              {group.label && (
                <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-[#FF1947]/15 text-white font-medium"
                          : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100",
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {futureModules.length > 0 && (
          <div>
            <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
              Další moduly (připravujeme)
            </div>
            <div className="space-y-0.5">
              {futureModules.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-600 cursor-not-allowed"
                  title="Modul zatím není aktivován pro tento klub"
                >
                  <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
                  {m.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-neutral-800 text-[11px] text-neutral-600 truncate" title={tenantName}>
        {tenantName}
      </div>
    </aside>
  );
}
