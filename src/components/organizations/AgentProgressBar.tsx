"use client";

import { useEffect, useState, useRef } from "react";

interface ProgressEvent {
  stage?: string;
  progress?: number;
  message?: string;
  status?: string;
}

export function AgentProgressBar({
  orgId,
  agentId,
}: {
  orgId: string;
  agentId: string;
}) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Подготовка...");
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/organizations/${orgId}/agents/${agentId}/progress`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        if (data.progress !== undefined) setProgress(Math.min(data.progress, 100));
        if (data.stage) setStage(data.stage);
        if (data.message) setStage(data.message);
        if (data.status === "completed" || data.status === "done") {
          setDone(true);
          setProgress(100);
          es.close();
        }
        if (data.status === "error") {
          setStage("Ошибка обработки");
          es.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [orgId, agentId]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{stage}</span>
        <span className="text-text-primary font-medium">{progress}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {done && (
        <p className="text-xs text-success font-medium">Обработка завершена!</p>
      )}
    </div>
  );
}
