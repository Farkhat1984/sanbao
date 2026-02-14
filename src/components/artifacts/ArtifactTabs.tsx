"use client";

import { Eye, Pencil, Code, Play } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ArtifactType } from "@/types/chat";

type Tab = "preview" | "edit" | "source";

interface ArtifactTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  artifactType?: ArtifactType;
}

const documentTabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "preview", label: "Просмотр", icon: Eye },
  { key: "edit", label: "Редактор", icon: Pencil },
  { key: "source", label: "Исходник", icon: Code },
];

const codeTabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "source", label: "Код", icon: Code },
  { key: "preview", label: "Превью", icon: Play },
  { key: "edit", label: "Редактор", icon: Pencil },
];

export function ArtifactTabs({ activeTab, onTabChange, artifactType }: ArtifactTabsProps) {
  const tabs = artifactType === "CODE" ? codeTabs : documentTabs;

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
            activeTab === key
              ? "text-accent"
              : "text-text-muted hover:text-text-secondary"
          )}
        >
          {activeTab === key && (
            <motion.div
              layoutId="artifact-tab"
              className="absolute inset-0 bg-accent-light rounded-lg"
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            />
          )}
          <Icon className="h-3.5 w-3.5 relative z-10" />
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  );
}
