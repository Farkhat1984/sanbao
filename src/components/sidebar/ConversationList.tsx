"use client";

import { useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { groupByDate } from "@/lib/utils";
import { ConversationItem } from "./ConversationItem";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Loader2 } from "lucide-react";

/** Number of conversations to fetch per page */
const PAGE_SIZE = 30;

export function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const searchQuery = useSidebarStore((s) => s.searchQuery);
  const hasMore = useChatStore((s) => s.hasMoreConversations);
  const isLoadingMore = useChatStore((s) => s.isLoadingMoreConversations);
  const cursor = useChatStore((s) => s.conversationsCursor);
  const appendConversations = useChatStore((s) => s.appendConversations);
  const setIsLoadingMore = useChatStore((s) => s.setIsLoadingMoreConversations);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/conversations?limit=${PAGE_SIZE}&cursor=${cursor}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.items) {
        appendConversations(data.items, data.nextCursor ?? null);
      }
    } catch {
      /* silent — user can scroll again to retry */
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, setIsLoadingMore, appendConversations]);

  // Intersection Observer for infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  // When searching, filter all loaded conversations client-side.
  // Infinite scroll only applies to non-search mode.
  const filtered = conversations.filter((c) =>
    !c.pinned && c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups = groupByDate(filtered);
  const isSearching = searchQuery.length > 0;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="h-10 w-10 rounded-xl bg-surface-alt flex items-center justify-center mb-3">
          <MessageSquare className="h-5 w-5 text-text-secondary" />
        </div>
        <p className="text-sm text-text-secondary">
          {searchQuery ? "Ничего не найдено" : "Нет чатов"}
        </p>
      </div>
    );
  }

  return (
    <div className="px-2 py-1">
      <AnimatePresence initial={false}>
        {Object.entries(groups).map(([label, convs]) => (
          <motion.div
            key={label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-1"
          >
            <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider px-2 py-1.5">
              {label}
            </p>
            {convs.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
              />
            ))}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Infinite scroll sentinel — hidden during search */}
      {!isSearching && (
        <div ref={sentinelRef} className="h-1" aria-hidden="true" />
      )}

      {/* Loading spinner for next page */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 text-text-muted animate-spin" />
        </div>
      )}
    </div>
  );
}
