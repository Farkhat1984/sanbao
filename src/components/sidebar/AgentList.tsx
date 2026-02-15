"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Bot,
  Zap,
  Puzzle,
  Cable,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

const PLAYGROUND_ITEMS = [
  {
    label: "Агенты",
    icon: Bot,
    href: "/agents",
    color: "bg-blue-50 dark:bg-blue-950 text-blue-500",
    description: "AI-ассистенты",
  },
  {
    label: "Скиллы",
    icon: Zap,
    href: "/skills",
    color: "bg-indigo-50 dark:bg-indigo-950 text-indigo-500",
    description: "Шаблоны промптов",
  },
  {
    label: "Плагины",
    icon: Puzzle,
    href: "/plugins",
    color: "bg-amber-50 dark:bg-amber-950 text-amber-500",
    description: "Скоро",
    disabled: true,
  },
  {
    label: "MCP",
    icon: Cable,
    href: "/mcp",
    color: "bg-emerald-50 dark:bg-emerald-950 text-emerald-500",
    description: "Серверы",
  },
];

export function AgentList() {
  const router = useRouter();
  const { close: closeSidebar } = useSidebarStore();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(true);

  const handleNavigate = (href: string) => {
    router.push(href);
    if (isMobile) closeSidebar();
  };

  return (
    <div className="px-3 mb-1">
      {/* Section Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 py-1.5 text-[11px] font-medium text-text-muted uppercase tracking-wider hover:text-text-primary transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Playground
      </button>

      {expanded && (
        <div className="space-y-0.5 mt-0.5">
          {PLAYGROUND_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => !item.disabled && handleNavigate(item.href)}
              className={cn(
                "w-full rounded-lg flex items-center gap-2.5 px-2",
                "transition-colors",
                isMobile ? "h-10" : "h-8",
                item.disabled
                  ? "text-text-muted/50 cursor-default"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-alt cursor-pointer"
              )}
            >
              <div
                className={cn(
                  "h-5 w-5 rounded-md flex items-center justify-center shrink-0",
                  item.color,
                  item.disabled && "opacity-40"
                )}
              >
                <item.icon className="h-3 w-3" />
              </div>
              <span className="text-sm truncate">{item.label}</span>
              {item.disabled && (
                <span className="text-[9px] text-text-muted/50 ml-auto">
                  скоро
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
