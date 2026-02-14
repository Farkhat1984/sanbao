"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Flag, Ban, MessageSquare } from "lucide-react";

interface ConversationEntry {
  id: string;
  title: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  messageCount: number;
  flagged: boolean;
  updatedAt: string;
}

interface MessageEntry {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export default function AdminModerationPage() {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchConversations = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/moderation?${params}`);
    const data = await res.json();
    setConversations(data.conversations || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  const fetchMessages = async (convId: string) => {
    setLoadingMessages(true);
    const res = await fetch(`/api/admin/moderation/${convId}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setLoadingMessages(false);
  };

  useEffect(() => { fetchConversations(); }, [page]);

  const handleView = (convId: string) => {
    setSelectedId(convId);
    fetchMessages(convId);
  };

  const handleFlag = async (convId: string) => {
    await fetch(`/api/admin/moderation/${convId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: true }),
    });
    fetchConversations();
  };

  const handleBanUser = async (userId: string) => {
    if (!confirm("Заблокировать пользователя?")) return;
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBanned: true, bannedReason: "Нарушение правил (модерация)" }),
    });
    fetchConversations();
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary mb-1">Модерация</h1>
      <p className="text-sm text-text-muted mb-6">Просмотр разговоров и управление контентом</p>

      <div className="flex gap-2 mb-4">
        <input placeholder="Поиск по пользователю или заголовку" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 flex-1 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
        <Button variant="secondary" size="sm" onClick={() => { setPage(1); fetchConversations(); }}>Поиск</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversation list */}
        <div className="space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse h-16" />)
          ) : (
            <>
              {conversations.map((c) => (
                <div key={c.id} className={`bg-surface border rounded-xl p-4 transition-colors ${selectedId === c.id ? "border-accent" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">{c.title}</span>
                        {c.flagged && <Badge variant="default">Флаг</Badge>}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        {c.userName || c.userEmail} &middot; {c.messageCount} сообщ.
                        &middot; {new Date(c.updatedAt).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleView(c.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer" title="Просмотр">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleFlag(c.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-warning hover:bg-warning/10 transition-colors cursor-pointer" title="Пометить">
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleBanUser(c.userId)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer" title="Бан">
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {conversations.length === 0 && <p className="text-sm text-text-muted text-center py-8">Разговоры не найдены</p>}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Назад</Button>
                  <span className="text-xs text-text-muted">{page}/{totalPages}</span>
                  <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Далее</Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Message viewer */}
        <div className="bg-surface border border-border rounded-2xl p-5 min-h-[400px]">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Выберите разговор для просмотра</p>
            </div>
          ) : loadingMessages ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="animate-pulse h-12 bg-surface-alt rounded-lg" />)}</div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className={`p-3 rounded-lg text-sm ${m.role === "USER" ? "bg-accent/5 border border-accent/20" : "bg-surface-alt"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default">{m.role === "USER" ? "Пользователь" : m.role === "ASSISTANT" ? "AI" : m.role}</Badge>
                    <span className="text-xs text-text-muted">{new Date(m.createdAt).toLocaleString("ru-RU")}</span>
                  </div>
                  <p className="text-text-primary whitespace-pre-wrap break-words">{m.content.slice(0, 2000)}{m.content.length > 2000 ? "..." : ""}</p>
                </div>
              ))}
              {messages.length === 0 && <p className="text-sm text-text-muted text-center py-8">Нет сообщений</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
