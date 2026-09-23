"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/lib/nav-config";
import { can, type ModuleResource } from "@/lib/rbac";

export function MobileNav({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="lg:hidden"><Menu className="h-4.5 w-4.5" /></Button>} />
      <SheetContent side="left" className="w-72 p-0 bg-neutral-950 text-neutral-300 border-neutral-800">
        <div className="flex items-center px-5 h-16 border-b border-neutral-800">
          <Image src="/brand/logo-white.png" alt="NEXT8" width={110} height={26} className="h-6 w-auto" />
        </div>
        <nav className="px-3 py-4 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => !item.resource || can(role, item.resource as ModuleResource, "view"));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label ?? "root"}>
                {group.label && <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{group.label}</div>}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`block rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-[#FF1947]/15 text-white font-medium" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"}`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
