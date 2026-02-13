import { Check, Sparkles, MessageSquare, Cpu, Zap, FolderOpen, Bot, Layers } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  plan: {
    slug: string;
    name: string;
    description: string | null;
    price: string;
    messagesPerDay: number;
    tokensPerMessage: number;
    requestsPerMinute: number;
    contextWindowSize: number;
    maxConversations: number;
    canUseAdvancedTools: boolean;
    canChooseProvider: boolean;
    highlighted?: boolean;
  };
  isCurrent: boolean;
}

export function PlanCard({ plan, isCurrent }: PlanCardProps) {
  const formatLimit = (value: number, unit: string) =>
    value === 0 ? "Безлимит" : `${value.toLocaleString("ru-RU")} ${unit}`;

  const features = [
    {
      icon: MessageSquare,
      label: formatLimit(plan.messagesPerDay, "сообщ./день"),
    },
    {
      icon: Cpu,
      label: `${(plan.tokensPerMessage / 1024).toFixed(0)}K токенов/сообщ.`,
    },
    {
      icon: Zap,
      label: `${plan.requestsPerMinute} запросов/мин`,
    },
    {
      icon: Layers,
      label: `${(plan.contextWindowSize / 1024).toFixed(0)}K контекст`,
    },
    {
      icon: FolderOpen,
      label: formatLimit(plan.maxConversations, "диалогов"),
    },
  ];

  const booleanFeatures = [
    { enabled: plan.canUseAdvancedTools, label: "Продвинутые инструменты" },
    { enabled: plan.canChooseProvider, label: "Выбор AI-провайдера" },
  ];

  return (
    <div
      className={cn(
        "bg-surface border rounded-2xl p-5 flex flex-col relative",
        plan.highlighted
          ? "border-accent shadow-md"
          : "border-border",
        isCurrent && "ring-2 ring-accent"
      )}
    >
      {plan.highlighted && (
        <Badge
          variant="accent"
          className="absolute -top-2.5 left-1/2 -translate-x-1/2"
        >
          <Sparkles className="h-3 w-3" />
          Рекомендуемый
        </Badge>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
        <p className="text-2xl font-bold text-text-primary mt-1">
          {plan.price}
        </p>
        {plan.description && (
          <p className="text-xs text-text-muted mt-2">{plan.description}</p>
        )}
      </div>

      <div className="space-y-2.5 flex-1">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <f.icon className="h-3.5 w-3.5 text-text-muted shrink-0" />
            <span className="text-sm text-text-secondary">{f.label}</span>
          </div>
        ))}
        {booleanFeatures.map((f, i) => (
          <div key={`b-${i}`} className="flex items-center gap-2">
            <Check
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                f.enabled ? "text-success" : "text-text-muted opacity-40"
              )}
            />
            <span
              className={cn(
                "text-sm",
                f.enabled ? "text-text-secondary" : "text-text-muted line-through"
              )}
            >
              {f.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        {isCurrent ? (
          <div className="w-full h-10 rounded-xl bg-accent-light text-accent text-sm font-medium flex items-center justify-center">
            Текущий тариф
          </div>
        ) : (
          <button className="w-full h-10 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:bg-surface-alt flex items-center justify-center transition-colors cursor-pointer">
            <Bot className="h-4 w-4 mr-2" />
            Обратитесь к администратору
          </button>
        )}
      </div>
    </div>
  );
}
