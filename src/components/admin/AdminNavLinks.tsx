"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChartBar, Users, CreditCard, Cpu, Robot, Envelope,
  TrendUp, Coins, Heart, File,
  GearSix, FileText, Scales, Globe,
  Bell, Key, WebhooksLogo, Clipboard,
  Warning, CurrencyDollar, UserMinus, Eye, Tag,
  Scroll,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const sections = [
  {
    title: null,
    links: [
      { href: "/admin", label: "Обзор", icon: ChartBar },
    ],
  },
  {
    title: "Пользователи",
    links: [
      { href: "/admin/users", label: "Пользователи", icon: Users },
      { href: "/admin/plans", label: "Тарифы", icon: CreditCard },
      { href: "/admin/billing", label: "Биллинг", icon: CurrencyDollar },
      { href: "/admin/promo-codes", label: "Промокоды", icon: Tag },
      { href: "/admin/sessions", label: "Сессии", icon: UserMinus },
    ],
  },
  {
    title: "AI",
    links: [
      { href: "/admin/providers", label: "Провайдеры", icon: Cpu },
      { href: "/admin/models", label: "Модели", icon: Robot },
      { href: "/admin/agents", label: "Сис. агенты", icon: Scales },
      { href: "/admin/skills", label: "Скиллы", icon: FileText },
      { href: "/admin/prompts", label: "Промпты", icon: Scroll },
      { href: "/admin/mcp", label: "MCP-серверы", icon: Globe },
    ],
  },
  {
    title: "Аналитика",
    links: [
      { href: "/admin/analytics", label: "Аналитика", icon: TrendUp },
      { href: "/admin/usage", label: "Токены", icon: Coins },
    ],
  },
  {
    title: "Система",
    links: [
      { href: "/admin/logs", label: "Аудит-лог", icon: Clipboard },
      { href: "/admin/errors", label: "Ошибки", icon: Warning },
      { href: "/admin/health", label: "Health", icon: Heart },
      { href: "/admin/moderation", label: "Модерация", icon: Eye },
      { href: "/admin/email", label: "Email", icon: Envelope },
      { href: "/admin/notifications", label: "Уведомления", icon: Bell },
      { href: "/admin/settings", label: "Настройки", icon: GearSix },
      { href: "/admin/templates", label: "Шаблоны", icon: FileText },
    ],
  },
  {
    title: "Интеграции",
    links: [
      { href: "/admin/api-keys", label: "API-ключи", icon: Key },
      { href: "/admin/webhooks", label: "Вебхуки", icon: WebhooksLogo },
      { href: "/admin/files", label: "Файлы", icon: File },
    ],
  },
];

interface AdminNavLinksProps {
  onNavigate?: () => void;
}

export function AdminNavLinks({ onNavigate }: AdminNavLinksProps) {
  const pathname = usePathname();

  return (
    <>
      {sections.map((section, si) => (
        <div key={si}>
          {section.title && (
            <p className="text-[10px] uppercase tracking-wider text-white/40 px-3 pt-4 pb-1 font-semibold">
              {section.title}
            </p>
          )}
          {section.links.map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <link.icon className="h-4 w-4" weight="duotone" />
                {link.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
