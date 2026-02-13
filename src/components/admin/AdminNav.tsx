"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin", label: "Обзор", icon: BarChart3 },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/plans", label: "Тарифы", icon: CreditCard },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 mb-6 border-b border-border pb-3">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-surface-alt hover:text-text-primary"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
