"use client";

import { useEffect, useState } from "react";
import { Plus, Bot } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAgentStore } from "@/stores/agentStore";
import { AgentCard } from "@/components/agents/AgentCard";
import { Skeleton } from "@/components/ui/Skeleton";

export default function AgentsPage() {
  const router = useRouter();
  const { agents, setAgents, isLoading, setLoading } = useAgentStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAgents(data);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [setAgents, setLoading]);

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              Мои агенты
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Создавайте персональных AI-ассистентов с уникальными инструкциями
            </p>
          </div>
          <button
            onClick={() => router.push("/agents/new")}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Создать агента
          </button>
        </div>

        {/* Loading */}
        {isLoading && !loaded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-2xl border border-border bg-surface">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1.5" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full mb-1.5" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {loaded && agents.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-5">
              <Bot className="h-8 w-8 text-text-muted" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              У вас пока нет агентов
            </h2>
            <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
              Создайте своего первого AI-агента с персональными инструкциями, файлами знаний и выбором модели
            </p>
            <button
              onClick={() => router.push("/agents/new")}
              className="h-10 px-6 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Создать первого агента
            </button>
          </motion.div>
        )}

        {/* Agent Grid */}
        {loaded && agents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
