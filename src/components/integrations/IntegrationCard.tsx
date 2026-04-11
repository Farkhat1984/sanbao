"use client";

import { Database, MessageCircle, Send, Circle, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegrationSummary } from "@/types/integration";

interface IntegrationCardProps {
  integration: IntegrationSummary;
  onDelete?: (id: string) => void;
  onDiscover?: (id: string) => void;
  onReconnect?: (id: string) => void;
  onClick?: (id: string) => void;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  CONNECTED: { color: "text-success fill-success", label: "Подключено" },
  DISCOVERING: { color: "text-warning fill-warning", label: "Обнаружение..." },
  ERROR: { color: "text-error fill-error", label: "Ошибка" },
  PENDING: { color: "text-text-secondary fill-text-secondary", label: "Ожидание" },
};

const TYPE_CONFIG: Record<string, { label: string; Icon: typeof Database; iconColor: string }> = {
  ODATA_1C: { label: "1С OData", Icon: Database, iconColor: "text-accent" },
  WHATSAPP: { label: "WhatsApp", Icon: MessageCircle, iconColor: "text-[#25D366]" },
  TELEGRAM: { label: "Telegram", Icon: Send, iconColor: "text-[#0088cc]" },
};

export function IntegrationCard({ integration, onDelete, onDiscover, onReconnect, onClick }: IntegrationCardProps) {
  const status = STATUS_CONFIG[integration.status] || STATUS_CONFIG.PENDING;
  const typeConfig = TYPE_CONFIG[integration.type] || TYPE_CONFIG.ODATA_1C;
  const { Icon, iconColor } = typeConfig;
  const isWhatsApp = integration.type === "WHATSAPP";
  const isTelegram = integration.type === "TELEGRAM";
  const isMessenger = isWhatsApp || isTelegram;

  return (
    <div
      className="group p-5 rounded-2xl border border-border bg-surface hover:border-border-hover transition-all cursor-pointer"
      onClick={() => onClick?.(integration.id)}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", isWhatsApp ? "bg-[#25D366]/10" : isTelegram ? "bg-[#0088cc]/10" : "bg-accent/10")}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">{integration.name}</h3>
            <Circle className={cn("h-2 w-2 shrink-0", status.color)} />
          </div>
          {!isMessenger && (
            <p className="text-xs text-text-secondary truncate mt-0.5">{integration.baseUrl}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-alt text-text-secondary font-medium">
            {typeConfig.label}
          </span>
          <span className={cn("text-[11px] font-medium", status.color.split(" ")[0])}>
            {status.label}
          </span>
          {!isMessenger && integration.entityCount > 0 && (
            <span className="text-[11px] text-text-secondary tabular-nums">
              {integration.entityCount} сущн.
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isMessenger && onDiscover && integration.status !== "DISCOVERING" && (
            <button
              onClick={(e) => { e.stopPropagation(); onDiscover(integration.id); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
              title="Обнаружить сущности"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          {isMessenger && onReconnect && integration.status !== "CONNECTED" && (
            <button
              onClick={(e) => { e.stopPropagation(); onReconnect(integration.id); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
              title="Переподключить"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(integration.id); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
              title="Удалить"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {integration.statusMessage && integration.status === "ERROR" && (
        <p className="text-[11px] text-error mt-2 line-clamp-2">{integration.statusMessage}</p>
      )}
    </div>
  );
}
