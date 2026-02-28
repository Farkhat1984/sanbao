"use client";

import { useState, useEffect, useRef } from "react";
import { useSkillStore } from "@/stores/skillStore";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import { Zap, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SkillSelector() {
  const { skills, activeSkillId, setActiveSkillId, setSkills, setLoading } =
    useSkillStore();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skills.length === 0) {
      setLoading(true);
      fetch("/api/skills")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data) => {
          const list = Array.isArray(data) ? data : data.items ?? [];
          setSkills(list);
        })
        .finally(() => setLoading(false));
    }
  }, [skills.length, setSkills, setLoading]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeSkill = skills.find((s) => s.id === activeSkillId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
          activeSkillId
            ? "bg-legal-ref/10 text-legal-ref border border-legal-ref/20"
            : "text-text-muted hover:text-text-secondary hover:bg-surface-alt"
        )}
      >
        {activeSkill ? (
          <>
            {(() => {
              const Icon = ICON_MAP[activeSkill.icon] || Zap;
              return <Icon className="h-3 w-3" />;
            })()}
            {activeSkill.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveSkillId(null);
              }}
              className="ml-0.5 hover:text-error cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <Zap className="h-3 w-3" />
            Скилл
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-surface border border-border rounded-xl shadow-card py-1 z-50 max-h-64 overflow-y-auto">
          {activeSkillId && (
            <button
              type="button"
              onClick={() => {
                setActiveSkillId(null);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:bg-surface-alt transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Без скилла
            </button>
          )}
          {skills.map((skill) => {
            const Icon = ICON_MAP[skill.icon] || Zap;
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => {
                  setActiveSkillId(skill.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-alt transition-colors cursor-pointer",
                  activeSkillId === skill.id && "bg-accent-light"
                )}
              >
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: skill.iconColor }}
                >
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {skill.name}
                  </p>
                  {skill.jurisdiction && (
                    <p className="text-[10px] text-text-muted">{skill.jurisdiction}</p>
                  )}
                </div>
                {skill.isBuiltIn && (
                  <span className="text-[10px] text-text-muted bg-surface-alt px-1.5 py-0.5 rounded">
                    встроенный
                  </span>
                )}
              </button>
            );
          })}
          {skills.length === 0 && (
            <p className="px-3 py-4 text-xs text-text-muted text-center">
              Нет доступных скиллов
            </p>
          )}
        </div>
      )}
    </div>
  );
}
