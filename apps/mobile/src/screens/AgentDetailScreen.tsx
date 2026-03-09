/**
 * Agent detail screen — shows agent info, tools, and "Start chat" button.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bot, MessageSquare, Wrench } from 'lucide-react'
import { api } from '@/lib/api-client'
import { cn } from '@sanbao/shared/utils'
import type { AgentDetail } from '@/types'

export default function AgentDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      try {
        const data = await api.get<AgentDetail>(`/api/agents/${id}`)
        if (!cancelled) setAgent(data)
      } catch {
        /* Navigate back on error */
        if (!cancelled) navigate('/agents', { replace: true })
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, navigate])

  function handleStartChat() {
    /* Navigate to new chat with this agent pre-selected (pass via state) */
    navigate('/chat/new', { state: { agentId: id } })
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <Header onBack={() => navigate('/agents')} title="" />
        <div className="flex flex-1 flex-col items-center px-6 pt-12">
          <div className="mb-4 h-20 w-20 animate-pulse rounded-full bg-[var(--border)]" />
          <div className="mb-2 h-6 w-40 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-4 w-56 animate-pulse rounded bg-[var(--border)]" />
        </div>
      </div>
    )
  }

  if (!agent) return null

  return (
    <div className="flex h-full flex-col">
      <Header onBack={() => navigate('/agents')} title={agent.name} />

      <div className="scroll-container flex-1 px-5 py-6">
        {/* Agent icon + info */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: `${agent.iconColor}20` }}
          >
            <Bot size={36} style={{ color: agent.iconColor }} />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {agent.name}
          </h2>
          {agent.description && (
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {agent.description}
            </p>
          )}
        </div>

        {/* Tools */}
        {agent.tools.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <Wrench size={12} />
              Инструменты
            </h3>
            <div className="space-y-2">
              {agent.tools.map((tool) => (
                <div
                  key={tool.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl',
                    'border border-[var(--border)] bg-[var(--bg-secondary)]',
                    'px-4 py-3',
                  )}
                >
                  <Wrench
                    size={16}
                    style={{ color: tool.iconColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {tool.name}
                    </span>
                    {tool.description && (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                        {tool.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Starter prompts */}
        {agent.starterPrompts.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Быстрые вопросы
            </h3>
            <div className="space-y-2">
              {agent.starterPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={handleStartChat}
                  className={cn(
                    'w-full rounded-xl border border-[var(--border)]',
                    'bg-[var(--bg-secondary)] px-4 py-3',
                    'text-left text-sm text-[var(--text-primary)]',
                    'active:bg-[var(--surface-hover)] transition-colors',
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Start chat button */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-4 safe-area-bottom">
        <button
          type="button"
          onClick={handleStartChat}
          className={cn(
            'flex w-full items-center justify-center gap-2',
            'rounded-xl bg-[var(--accent)] py-3.5',
            'text-sm font-semibold text-white',
            'active:scale-[0.98] transition-transform',
          )}
        >
          <MessageSquare size={16} />
          Начать чат
        </button>
      </div>
    </div>
  )
}

function Header({
  onBack,
  title,
}: {
  onBack: () => void;
  title: string;
}) {
  return (
    <header
      className={cn(
        'flex items-center gap-3 px-3 py-2.5',
        'border-b border-[var(--border)]',
        'bg-[var(--bg-secondary)]',
      )}
    >
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full active:bg-[var(--surface-hover)]"
        aria-label="Назад"
      >
        <ArrowLeft size={20} className="text-[var(--text-primary)]" />
      </button>
      <h2 className="flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </h2>
    </header>
  )
}
