/**
 * Offline support utilities for the Sanbao mobile app.
 *
 * - Network status detection (online/offline)
 * - LocalStorage-based cache for conversation lists
 * - Message queue for sends when offline
 * - Auto-sync on reconnect
 */

import { Preferences } from '@capacitor/preferences'
import type { ConversationItem, ChatMessage } from '@/types'

const CACHE_CONVERSATIONS = 'sanbao_cache_conversations'
const CACHE_PREFIX_MESSAGES = 'sanbao_cache_messages_'
const OFFLINE_QUEUE = 'sanbao_offline_queue'

/* ─── Network Status ──────────────────────────────────────── */

type NetworkListener = (online: boolean) => void

const listeners = new Set<NetworkListener>()
let currentOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

/** Subscribe to network status changes. Returns unsubscribe function. */
export function onNetworkChange(listener: NetworkListener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Get current network status. */
export function isOnline(): boolean {
  return currentOnline
}

function notifyListeners(online: boolean): void {
  currentOnline = online
  for (const listener of listeners) {
    listener(online)
  }
}

/* Set up global listeners */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => notifyListeners(true))
  window.addEventListener('offline', () => notifyListeners(false))
}

/* ─── Conversation Cache ──────────────────────────────────── */

/** Cache conversations list for offline viewing. */
export async function cacheConversations(
  conversations: ConversationItem[],
): Promise<void> {
  await Preferences.set({
    key: CACHE_CONVERSATIONS,
    value: JSON.stringify(conversations),
  })
}

/** Get cached conversations list. */
export async function getCachedConversations(): Promise<ConversationItem[]> {
  const { value } = await Preferences.get({ key: CACHE_CONVERSATIONS })
  if (!value) return []
  try {
    return JSON.parse(value) as ConversationItem[]
  } catch {
    return []
  }
}

/** Cache messages for a specific conversation. */
export async function cacheMessages(
  conversationId: string,
  messages: ChatMessage[],
): Promise<void> {
  await Preferences.set({
    key: `${CACHE_PREFIX_MESSAGES}${conversationId}`,
    value: JSON.stringify(messages),
  })
}

/** Get cached messages for a conversation. */
export async function getCachedMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const { value } = await Preferences.get({
    key: `${CACHE_PREFIX_MESSAGES}${conversationId}`,
  })
  if (!value) return []
  try {
    return JSON.parse(value) as ChatMessage[]
  } catch {
    return []
  }
}

/* ─── Offline Message Queue ───────────────────────────────── */

interface QueuedMessage {
  id: string;
  conversationId: string | null;
  agentId: string | null;
  content: string;
  queuedAt: number;
}

/** Get the current offline send queue. */
async function getQueue(): Promise<QueuedMessage[]> {
  const { value } = await Preferences.get({ key: OFFLINE_QUEUE })
  if (!value) return []
  try {
    return JSON.parse(value) as QueuedMessage[]
  } catch {
    return []
  }
}

/** Save queue to storage. */
async function saveQueue(queue: QueuedMessage[]): Promise<void> {
  await Preferences.set({ key: OFFLINE_QUEUE, value: JSON.stringify(queue) })
}

/**
 * Queue a message for sending when back online.
 * Returns a temporary ID for the queued message.
 */
export async function queueMessage(
  conversationId: string | null,
  agentId: string | null,
  content: string,
): Promise<string> {
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const queue = await getQueue()
  queue.push({
    id,
    conversationId,
    agentId,
    content,
    queuedAt: Date.now(),
  })
  await saveQueue(queue)
  return id
}

/** Get all queued messages. */
export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  return getQueue()
}

/** Remove a message from the queue (after successful send). */
export async function dequeueMessage(id: string): Promise<void> {
  const queue = await getQueue()
  const filtered = queue.filter((m) => m.id !== id)
  await saveQueue(filtered)
}

/** Clear the entire offline queue. */
export async function clearQueue(): Promise<void> {
  await Preferences.remove({ key: OFFLINE_QUEUE })
}

/* ─── Sync on Reconnect ───────────────────────────────────── */

type SyncCallback = (queued: QueuedMessage[]) => Promise<void>

let syncCallback: SyncCallback | null = null

/** Register a callback that fires when coming back online with queued messages. */
export function onSyncNeeded(callback: SyncCallback): () => void {
  syncCallback = callback

  const unsub = onNetworkChange(async (online) => {
    if (!online || !syncCallback) return
    const queued = await getQueue()
    if (queued.length === 0) return
    await syncCallback(queued)
  })

  return () => {
    syncCallback = null
    unsub()
  }
}

/** Clear all cached data (used on logout). */
export async function clearOfflineData(): Promise<void> {
  await Preferences.remove({ key: CACHE_CONVERSATIONS })
  await Preferences.remove({ key: OFFLINE_QUEUE })
  /* Note: individual conversation message caches are not enumerable
     in Preferences — they persist until overwritten or app data cleared. */
}
