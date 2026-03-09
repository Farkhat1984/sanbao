/**
 * Individual chat screen — message list + input.
 * Streams AI responses via NDJSON.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Square, Bot, User as UserIcon } from 'lucide-react'
import { api, streamChat, ApiError } from '@/lib/api-client'
import { cacheMessages, getCachedMessages, isOnline, queueMessage } from '@/lib/offline'
import { cn } from '@sanbao/shared/utils'
import type { ChatMessage, StreamChunk } from '@/types'

interface MessagesResponse {
  messages: ChatMessage[];
  nextCursor: string | null;
}

interface ConversationResponse {
  id: string;
  title: string;
  agentId?: string | null;
  agentName?: string | null;
}

export default function ChatScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNewChat = id === 'new'

  const [conversationId, setConversationId] = useState<string | null>(
    isNewChat ? null : (id ?? null),
  )
  const [title, setTitle] = useState(isNewChat ? 'Новый чат' : '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(!isNewChat)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  /* Scroll to bottom on new messages */
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  /* Fetch messages for existing conversation */
  useEffect(() => {
    if (isNewChat || !conversationId) return
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        if (!isOnline()) {
          const cached = await getCachedMessages(conversationId!)
          if (!cancelled) setMessages(cached)
          setIsLoading(false)
          return
        }

        const [convData, msgData] = await Promise.all([
          api.get<ConversationResponse>(`/api/conversations/${conversationId}`),
          api.get<MessagesResponse>(`/api/conversations/${conversationId}/messages?limit=50`),
        ])
        if (cancelled) return
        setTitle(convData.title)
        setMessages(msgData.messages)
        await cacheMessages(conversationId!, msgData.messages)
      } catch {
        const cached = await getCachedMessages(conversationId!)
        if (cached.length > 0 && !cancelled) {
          setMessages(cached)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [conversationId, isNewChat])

  useEffect(scrollToBottom, [messages, streamContent, scrollToBottom])

  /* Send message */
  async function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setError(null)

    /* Optimistic user message */
    const userMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      role: 'USER',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    /* Queue if offline */
    if (!isOnline()) {
      await queueMessage(conversationId, null, text)
      return
    }

    /* Stream response */
    setIsStreaming(true)
    setStreamContent('')
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const body: Record<string, unknown> = {
        message: text,
        conversationId,
      }

      let fullContent = ''

      for await (const chunk of streamChat(body, controller.signal)) {
        handleChunk(chunk)
        if (chunk.t === 'c') {
          fullContent += chunk.v
          setStreamContent(fullContent)
        }
      }

      /* Commit streamed message */
      if (fullContent) {
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'ASSISTANT',
          content: fullContent,
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])
        setStreamContent('')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        /* User cancelled */
      } else if (err instanceof ApiError && err.status === 401) {
        navigate('/login', { replace: true })
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка отправки')
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  function handleChunk(chunk: StreamChunk) {
    switch (chunk.t) {
      case 'e':
        setError(chunk.v)
        break
      /* Future: handle 'r' reasoning, 'p' plan, 's' status */
      default:
        break
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header
        className={cn(
          'flex items-center gap-3 px-3 py-2.5',
          'border-b border-[var(--border)]',
          'bg-[var(--bg-secondary)]',
        )}
      >
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-[var(--surface-hover)]"
          aria-label="Назад"
        >
          <ArrowLeft size={20} className="text-[var(--text-primary)]" />
        </button>
        <h2 className="flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
          {title || 'Новый чат'}
        </h2>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="scroll-container flex-1 px-4 py-3">
        {isLoading ? (
          <MessagesSkeleton />
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Bot size={40} className="mb-3 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              Начните разговор
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming assistant message */}
            {isStreaming && streamContent && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)]">
                  <Bot size={14} className="text-[var(--accent)]" />
                </div>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-[var(--bg-secondary)] px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">
                    {streamContent}
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--accent)]" />
                  </p>
                </div>
              </div>
            )}

            {/* Streaming indicator without content yet */}
            {isStreaming && !streamContent && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)]">
                  <Bot size={14} className="text-[var(--accent)]" />
                </div>
                <div className="rounded-2xl rounded-tl-md bg-[var(--bg-secondary)] px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-3 rounded-xl bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
            {error}
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        className={cn(
          'border-t border-[var(--border)]',
          'bg-[var(--bg-secondary)] px-3 py-2',
          'safe-area-bottom',
        )}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-2xl border border-[var(--border)]',
              'bg-[var(--surface)] px-4 py-2.5',
              'text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]',
              'focus:border-[var(--accent)] focus:outline-none',
              'max-h-32',
            )}
            style={{ minHeight: '40px' }}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center',
                'rounded-full bg-[var(--error)]',
                'active:scale-95 transition-transform',
              )}
              aria-label="Остановить"
            >
              <Square size={16} className="text-white" fill="white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center',
                'rounded-full bg-[var(--accent)]',
                'disabled:opacity-40',
                'active:scale-95 transition-transform',
              )}
              aria-label="Отправить"
            >
              <Send size={16} className="text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────── */

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'USER'

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-[var(--accent)]'
            : 'bg-[var(--accent-muted)]',
        )}
      >
        {isUser ? (
          <UserIcon size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-[var(--accent)]" />
        )}
      </div>
      <div
        className={cn(
          'min-w-0 max-w-[80%] rounded-2xl px-4 py-3',
          isUser
            ? 'rounded-tr-md bg-[var(--accent)] text-white'
            : 'rounded-tl-md bg-[var(--bg-secondary)] text-[var(--text-primary)]',
        )}
      >
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]"
          style={{
            animation: `typing 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes typing {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

function MessagesSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className={cn('flex gap-3', i % 2 === 0 && 'flex-row-reverse')}
        >
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
          <div
            className={cn(
              'animate-pulse rounded-2xl bg-[var(--border)]',
              i % 2 === 0 ? 'h-10 w-48' : 'h-16 w-56',
            )}
          />
        </div>
      ))}
    </div>
  )
}
