/**
 * Deep linking handler for the Sanbao mobile app.
 *
 * Supports three URL schemes:
 * - `sanbao://` — custom scheme (e.g. sanbao://chat/abc123)
 * - `https://sanbao.ai/...` — universal links (e.g. https://sanbao.ai/chat/abc123)
 * - `article://` — in-app article protocol (e.g. article://criminal_code/188)
 *
 * Uses @capacitor/app for native URL open events.
 */

import { App as CapApp } from '@capacitor/app'

const CUSTOM_SCHEME = 'sanbao://'
const UNIVERSAL_HOST = 'sanbao.ai'
const ARTICLE_SCHEME = 'article://'

interface DeepLinkResult {
  /** Internal route path (e.g. "/chat/abc123") */
  path: string;
  /** Parsed params from the URL */
  params: Record<string, string>;
}

/**
 * Parse a deep link URL into an internal route path and params.
 *
 * @returns Parsed route info, or null if the URL is not a recognized deep link.
 */
export function parseDeepLink(url: string): DeepLinkResult | null {
  /* article:// protocol — open article in panel */
  if (url.startsWith(ARTICLE_SCHEME)) {
    const articlePath = url.slice(ARTICLE_SCHEME.length)
    const segments = articlePath.split('/')
    const code = segments[0] ?? ''
    const id = segments[1] ?? ''

    if (!code) return null

    return {
      path: '/chat',
      params: { articleCode: code, articleId: id },
    }
  }

  /* sanbao:// custom scheme */
  if (url.startsWith(CUSTOM_SCHEME)) {
    const path = url.slice(CUSTOM_SCHEME.length)
    return parsePathToRoute(`/${path}`)
  }

  /* https://sanbao.ai/... universal link */
  try {
    const parsed = new URL(url)
    if (parsed.hostname === UNIVERSAL_HOST || parsed.hostname === `www.${UNIVERSAL_HOST}`) {
      return parsePathToRoute(parsed.pathname, Object.fromEntries(parsed.searchParams))
    }
  } catch {
    /* Not a valid URL */
  }

  /* Plain path (fallback for appUrlOpen events that return just a path) */
  if (url.startsWith('/')) {
    return parsePathToRoute(url)
  }

  return null
}

/**
 * Convert a pathname into a recognized app route.
 */
function parsePathToRoute(
  pathname: string,
  queryParams: Record<string, string> = {},
): DeepLinkResult | null {
  /* Normalize: strip trailing slash, ensure leading slash */
  const normalized = '/' + pathname.replace(/^\/+|\/+$/g, '')

  /* /chat/:id */
  const chatMatch = normalized.match(/^\/chat\/([a-zA-Z0-9_-]+)$/)
  if (chatMatch) {
    return { path: `/chat/${chatMatch[1]}`, params: { id: chatMatch[1], ...queryParams } }
  }

  /* /chat (list) */
  if (normalized === '/chat' || normalized === '/chat/new') {
    return { path: normalized, params: queryParams }
  }

  /* /agents/:id */
  const agentMatch = normalized.match(/^\/agents\/([a-zA-Z0-9_-]+)$/)
  if (agentMatch) {
    return { path: `/agents/${agentMatch[1]}`, params: { id: agentMatch[1], ...queryParams } }
  }

  /* /agents (list) */
  if (normalized === '/agents') {
    return { path: '/agents', params: queryParams }
  }

  /* /billing */
  if (normalized === '/billing') {
    return { path: '/billing', params: queryParams }
  }

  /* /profile */
  if (normalized === '/profile') {
    return { path: '/profile', params: queryParams }
  }

  /* /settings */
  if (normalized === '/settings') {
    return { path: '/settings', params: queryParams }
  }

  return null
}

/**
 * Set up deep link listeners. Call once at app startup.
 *
 * Listens for `appUrlOpen` events from @capacitor/app and navigates
 * to the parsed route.
 *
 * @param navigate - Router navigate function (from react-router-dom)
 * @returns Cleanup function to remove the listener
 */
export function setupDeepLinks(
  navigate: (path: string) => void,
): () => void {
  const listenerPromise = CapApp.addListener('appUrlOpen', ({ url }) => {
    const result = parseDeepLink(url)
    if (result) {
      navigate(result.path)
    }
  })

  return () => {
    listenerPromise.then((handle) => handle.remove()).catch(() => {
      /* Ignore — not running in native context */
    })
  }
}

/**
 * Check if the app was opened via a deep link (cold start).
 * Call after app initialization to handle the initial URL.
 */
export async function handleInitialDeepLink(
  navigate: (path: string) => void,
): Promise<void> {
  try {
    const result = await CapApp.getLaunchUrl()
    if (result?.url) {
      const parsed = parseDeepLink(result.url)
      if (parsed) {
        navigate(parsed.path)
      }
    }
  } catch {
    /* Not running in native context or no launch URL */
  }
}
