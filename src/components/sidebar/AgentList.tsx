"use client";

import { useState } from "react";
import {
  CaretDown,
  CaretRight,
  Robot,
  Lightning,
  Plugs,
  BuildingOffice,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

const PLAYGROUND_ITEMS = [
  {
    label: "Агенты",
    icon: Robot,
    href: "/agents",
    color: "bg-accent-light text-accent",
    description: "AI-ассистенты",
  },
  {
    label: "Скиллы",
    icon: Lightning,
    href: "/skills",
    color: "bg-accent-light text-accent",
    description: "Шаблоны промптов",
  },
  {
    label: "Организации",
    icon: BuildingOffice,
    href: "/organizations",
    color: "bg-accent-light text-accent",
    description: "Корпоративные агенты",
  },
  {
    label: "MCP",
    icon: Plugs,
    href: "/mcp",
    color: "bg-accent-light text-accent",
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
        className="w-full flex items-center gap-1.5 py-1.5 text-[11px] font-medium text-text-secondary uppercase tracking-wider hover:text-text-primary transition-colors cursor-pointer"
      >
        {expanded ? (
          <CaretDown weight="duotone" className="h-3 w-3" />
        ) : (
          <CaretRight weight="duotone" className="h-3 w-3" />
        )}
        Playground
      </button>

      {expanded && (
        <div className="space-y-0.5 mt-0.5">
          {PLAYGROUND_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigate(item.href)}
              className={cn(
                "w-full rounded-lg flex items-center gap-2.5 px-2",
                "transition-colors",
                isMobile ? "h-10" : "h-8",
                "text-text-secondary hover:text-text-primary hover:bg-surface-alt cursor-pointer"
              )}
            >
              <div
                className={cn(
                  "h-5 w-5 rounded-md flex items-center justify-center shrink-0",
                  item.color
                )}
              >
                <item.icon weight="duotone" className="h-3 w-3" />
              </div>
              <span className="text-sm truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
