"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, Users, CreditCard, Cpu, Bot, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Обзор", icon: BarChart3 },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/plans", label: "Тарифы", icon: CreditCard },
  { href: "/admin/providers", label: "AI-провайдеры", icon: Cpu },
  { href: "/admin/models", label: "AI-модели", icon: Bot },
  { href: "/admin/email", label: "Email", icon: Mail },
];

export function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const isActive =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              isActive
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:bg-surface-alt hover:text-text-primary"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
