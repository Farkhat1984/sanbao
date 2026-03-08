"use client";

import { useState, useEffect } from "react";
import { Loader2, Circle, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationItem {
  id: string;
  name: string;
  type: string;
  status: string;
  entityCount: number;
}

interface AgentIntegrationPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function AgentIntegrationPicker({ selectedIds, onChange }: AgentIntegrationPickerProps) {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations?limit=100")
      .then((r) => r.json())
      .then((data) => {
        const items = (data.items || []).filter((i: IntegrationItem) => i.status === "CONNECTED");
        setIntegrations(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary text-xs py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Загрузка интеграций...
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <p className="text-xs text-text-secondary py-2">
        Нет подключённых интеграций. Создайте интеграцию в разделе «Интеграции».
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {integrations.map((intg) => {
        const selected = selectedIds.includes(intg.id);
        return (
          <button
            key={intg.id}
            type="button"
            onClick={() => toggle(intg.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer border",
              selected
                ? "border-accent bg-accent/5"
                : "border-border bg-surface-alt hover:border-border-hover"
            )}
          >
            <Circle className="h-2 w-2 fill-current shrink-0 text-success" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{intg.name}</p>
              <p className="text-[11px] text-text-secondary">
                {intg.type === "ODATA_1C" ? "1С OData" : intg.type} · {intg.entityCount} сущн.
              </p>
            </div>
            <Database className="h-3.5 w-3.5 text-text-secondary shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
