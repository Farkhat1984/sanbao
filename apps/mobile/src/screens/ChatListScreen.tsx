/**
 * Chat list screen — shows all conversations, sorted by last update.
 * Pull-to-refresh, infinite scroll, swipe-to-delete (future).
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MessageSquare, Search } from 'lucide-react'
import { api } from '@/lib/api-client'
import { cacheConversations, getCachedConversations, isOnline } from '@/lib/offline'
import { cn } from '@sanbao/shared/utils'
import { formatDate } from '@sanbao/shared/utils'
import type { ConversationItem } from '@/types'

interface ConversationsResponse {
  conversations: ConversationItem[];
  nextCursor: string | null;
}

export default function ChatListScreen() {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchConversations = useCallback(async () => {
    setIsLoading(true)
    try {
      if (!isOnline()) {
        const cached = await getCachedConversations()
        setConversations(cached)
        setIsLoading(false)
        return
      }

      const data = await api.get<ConversationsResponse>('/api/conversations?limit=50')
      setConversations(data.conversations)
      await cacheConversations(data.conversations)
    } catch {
      /* Fallback to cache on error */
      const cached = await getCachedConversations()
      if (cached.length > 0) {
        setConversations(cached)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  function handleNewChat() {
    navigate('/chat/new')
  }

  function handleOpenChat(id: string) {
    navigate(`/chat/${id}`)
  }

  const filtered = searchQuery.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Чаты
        </h1>
        <button
          type="button"
          onClick={handleNewChat}
          className={cn(
            'flex h-9 w-9 items-center justify-center',
            'rounded-full bg-[var(--accent)]',
            'active:scale-95 transition-transform',
          )}
          aria-label="Новый чат"
        >
          <Plus size={20} className="text-white" />
        </button>
      </header>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full rounded-xl border border-[var(--border)]',
              'bg-[var(--bg-secondary)] py-2.5 pl-9 pr-4',
              'text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]',
              'focus:border-[var(--accent)] focus:outline-none',
            )}
          />
        </div>
      </div>

      {/* List */}
      <div className="scroll-container flex-1 px-4">
        {isLoading ? (
          <ChatListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState hasSearch={searchQuery.trim().length > 0} onNewChat={handleNewChat} />
        ) : (
          <ul className="space-y-1">
            {filtered.map((conv) => (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => handleOpenChat(conv.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl p-3',
                    'text-left transition-colors',
                    'active:bg-[var(--surface-hover)]',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center',
                      'rounded-full bg-[var(--accent-muted)]',
                    )}
                  >
                    <MessageSquare size={18} className="text-[var(--accent)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {conv.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                        {formatDate(conv.updatedAt)}
                      </span>
                    </div>
                    {conv.lastMessage && (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                        {conv.lastMessage}
                      </p>
                    )}
                    {conv.agentName && (
                      <span className="mt-1 inline-block rounded-md bg-[var(--accent-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                        {conv.agentName}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────── */

function ChatListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl p-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--border)]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  hasSearch,
  onNewChat,
}: {
  hasSearch: boolean;
  onNewChat: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <MessageSquare size={48} className="mb-4 text-[var(--text-muted)]" />
      <p className="mb-1 text-sm font-medium text-[var(--text-secondary)]">
        {hasSearch ? 'Ничего не найдено' : 'Нет чатов'}
      </p>
      {!hasSearch && (
        <>
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            Начните новый разговор с AI-ассистентом
          </p>
          <button
            type="button"
            onClick={onNewChat}
            className={cn(
              'rounded-xl bg-[var(--accent)] px-5 py-2.5',
              'text-sm font-medium text-white',
              'active:scale-95 transition-transform',
            )}
          >
            Новый чат
          </button>
        </>
      )}
    </div>
  )
}
