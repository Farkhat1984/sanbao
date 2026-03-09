/**
 * Agent list screen — grid of available agents.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Sparkles } from 'lucide-react'
import { api } from '@/lib/api-client'
import { cn } from '@sanbao/shared/utils'
import type { AgentSummary } from '@/types'

interface AgentsResponse {
  agents: AgentSummary[];
}

export default function AgentListScreen() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await api.get<AgentsResponse>('/api/agents')
        if (!cancelled) setAgents(data.agents)
      } catch {
        /* Silently fail — show empty state */
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const systemAgents = agents.filter((a) => a.isSystem)
  const userAgents = agents.filter((a) => !a.isSystem)

  return (
    <div className="scroll-container h-full px-4 py-3">
      {/* Header */}
      <header className="mb-4">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Агенты
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Специализированные AI-ассистенты
        </p>
      </header>

      {isLoading ? (
        <AgentGridSkeleton />
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Bot size={48} className="mb-4 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Нет доступных агентов
          </p>
        </div>
      ) : (
        <>
          {/* System agents */}
          {systemAgents.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <Sparkles size={12} />
                Системные
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {systemAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onTap={() => navigate(`/agents/${agent.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* User agents */}
          {userAgents.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Мои агенты
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {userAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onTap={() => navigate(`/agents/${agent.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────── */

function AgentCard({
  agent,
  onTap,
}: {
  agent: AgentSummary;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        'flex flex-col items-center rounded-2xl',
        'border border-[var(--border)] bg-[var(--bg-secondary)]',
        'px-3 py-4 text-center',
        'active:bg-[var(--surface-hover)] transition-colors',
      )}
    >
      <div
        className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: `${agent.iconColor}20` }}
      >
        <Bot size={22} style={{ color: agent.iconColor }} />
      </div>
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {agent.name}
      </span>
      {agent.description && (
        <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-[var(--text-muted)]">
          {agent.description}
        </span>
      )}
    </button>
  )
}

function AgentGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-4"
        >
          <div className="mb-2.5 h-12 w-12 animate-pulse rounded-full bg-[var(--border)]" />
          <div className="h-4 w-20 animate-pulse rounded bg-[var(--border)]" />
          <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-[var(--border)]" />
        </div>
      ))}
    </div>
  )
}
