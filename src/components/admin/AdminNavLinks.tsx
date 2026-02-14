"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3, Users, CreditCard, Cpu, Bot, Mail,
  TrendingUp, Coins, Heart, File,
  Settings, FileText, Scale, Globe,
  Bell, Key, Webhook, ClipboardList,
  AlertTriangle, DollarSign, UserX, Eye, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    title: null,
    links: [
      { href: "/admin", label: "Обзор", icon: BarChart3 },
    ],
  },
  {
    title: "Пользователи",
    links: [
      { href: "/admin/users", label: "Пользователи", icon: Users },
      { href: "/admin/plans", label: "Тарифы", icon: CreditCard },
      { href: "/admin/billing", label: "Биллинг", icon: DollarSign },
      { href: "/admin/promo-codes", label: "Промокоды", icon: Tag },
      { href: "/admin/sessions", label: "Сессии", icon: UserX },
    ],
  },
  {
    title: "AI",
    links: [
      { href: "/admin/providers", label: "Провайдеры", icon: Cpu },
      { href: "/admin/models", label: "Модели", icon: Bot },
      { href: "/admin/agents", label: "Сис. агенты", icon: Scale },
      { href: "/admin/skills", label: "Скиллы", icon: FileText },
      { href: "/admin/mcp", label: "MCP-серверы", icon: Globe },
    ],
  },
  {
    title: "Аналитика",
    links: [
      { href: "/admin/analytics", label: "Аналитика", icon: TrendingUp },
      { href: "/admin/usage", label: "Токены", icon: Coins },
    ],
  },
  {
    title: "Система",
    links: [
      { href: "/admin/logs", label: "Аудит-лог", icon: ClipboardList },
      { href: "/admin/errors", label: "Ошибки", icon: AlertTriangle },
      { href: "/admin/health", label: "Health", icon: Heart },
      { href: "/admin/moderation", label: "Модерация", icon: Eye },
      { href: "/admin/email", label: "Email", icon: Mail },
      { href: "/admin/notifications", label: "Уведомления", icon: Bell },
      { href: "/admin/settings", label: "Настройки", icon: Settings },
      { href: "/admin/templates", label: "Шаблоны", icon: FileText },
    ],
  },
  {
    title: "Интеграции",
    links: [
      { href: "/admin/api-keys", label: "API-ключи", icon: Key },
      { href: "/admin/webhooks", label: "Вебхуки", icon: Webhook },
      { href: "/admin/files", label: "Файлы", icon: File },
    ],
  },
];

export function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {sections.map((section, si) => (
        <div key={si}>
          {section.title && (
            <p className="text-[10px] uppercase tracking-wider text-text-muted px-3 pt-4 pb-1 font-semibold">
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
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
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
        </div>
      ))}
    </>
  );
}
