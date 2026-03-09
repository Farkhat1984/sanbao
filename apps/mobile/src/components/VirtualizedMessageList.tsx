/**
 * VirtualizedMessageList — lightweight chat message virtualization.
 *
 * Only renders messages within the viewport plus a buffer zone.
 * Uses IntersectionObserver for visibility detection.
 * Automatically scrolls to bottom on new messages and preserves
 * scroll position when loading older messages at the top.
 */

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type CSSProperties,
} from 'react'

/** Buffer zone above/below the viewport (px) */
const BUFFER_PX = 50

/** Estimated height per message when actual height is unknown (px) */
const ESTIMATED_ITEM_HEIGHT = 80

/** Threshold to consider user "at bottom" for auto-scroll (px) */
const BOTTOM_THRESHOLD = 100

interface VirtualizedMessageListProps<T> {
  /** Array of message items */
  items: T[]
  /** Unique key extractor for each item */
  keyExtractor: (item: T, index: number) => string
  /** Render function for each visible item */
  renderItem: (item: T, index: number) => ReactNode
  /** Called when user scrolls near the top — load older messages */
  onLoadMore?: () => void
  /** Whether more messages are currently loading */
  isLoadingMore?: boolean
  /** Additional content rendered after all items (e.g. streaming indicator) */
  footer?: ReactNode
  /** CSS class for the scroll container */
  className?: string
}

interface ItemMeasurement {
  height: number
  measured: boolean
}

/**
 * Lightweight virtualized list for chat messages.
 *
 * Strategy:
 * 1. Each item gets a sentinel div observed by IntersectionObserver
 * 2. Items within viewport + buffer are rendered; others get placeholder divs
 * 3. Heights are measured on first render and cached for accurate positioning
 * 4. Auto-scrolls to bottom when new items arrive (if user was at bottom)
 * 5. Preserves scroll position when items prepended at top (older messages)
 */
export function VirtualizedMessageList<T>({
  items,
  keyExtractor,
  renderItem,
  onLoadMore,
  isLoadingMore,
  footer,
  className,
}: VirtualizedMessageListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const measurementsRef = useRef<Map<string, ItemMeasurement>>(new Map())

  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })
  const [isAtBottom, setIsAtBottom] = useState(true)
  const prevItemCountRef = useRef(items.length)
  const prevFirstKeyRef = useRef<string | null>(null)

  /* Determine which items to render based on visibility */
  const renderRange = useMemo(() => {
    const start = Math.max(0, visibleRange.start - 5)
    const end = Math.min(items.length, visibleRange.end + 5)
    return { start, end }
  }, [visibleRange, items.length])

  /* Observe scroll position to detect viewport and auto-load */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const { scrollTop, scrollHeight, clientHeight } = el
    const atBottom = scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD
    setIsAtBottom(atBottom)

    /* Загрузка старых сообщений при прокрутке к верху */
    if (scrollTop < BUFFER_PX && onLoadMore && !isLoadingMore) {
      onLoadMore()
    }

    /* Вычислить видимый диапазон по позиции скролла */
    updateVisibleRange(el)
  }, [onLoadMore, isLoadingMore])

  /* Calculate visible range based on scroll position and measured heights */
  const updateVisibleRange = useCallback((container: HTMLDivElement) => {
    const { scrollTop, clientHeight } = container
    const viewTop = scrollTop - BUFFER_PX
    const viewBottom = scrollTop + clientHeight + BUFFER_PX

    let accumulatedHeight = 0
    let start = 0
    let end = items.length

    for (let i = 0; i < items.length; i++) {
      const key = keyExtractor(items[i], i)
      const measurement = measurementsRef.current.get(key)
      const height = measurement?.measured
        ? measurement.height
        : ESTIMATED_ITEM_HEIGHT

      if (accumulatedHeight + height < viewTop) {
        start = i + 1
      }

      if (accumulatedHeight > viewBottom) {
        end = i
        break
      }

      accumulatedHeight += height
    }

    setVisibleRange((prev) => {
      if (prev.start === start && prev.end === end) return prev
      return { start, end }
    })
  }, [items, keyExtractor])

  /* Measure item heights after render */
  useEffect(() => {
    itemRefs.current.forEach((el, key) => {
      if (!el) return
      const existing = measurementsRef.current.get(key)
      if (existing?.measured) return

      const rect = el.getBoundingClientRect()
      if (rect.height > 0) {
        measurementsRef.current.set(key, {
          height: rect.height,
          measured: true,
        })
      }
    })
  })

  /* Auto-scroll to bottom when new messages arrive at the end */
  useEffect(() => {
    const currentFirstKey = items.length > 0
      ? keyExtractor(items[0], 0)
      : null

    const itemsAddedAtEnd = items.length > prevItemCountRef.current
      && currentFirstKey === prevFirstKeyRef.current

    if (itemsAddedAtEnd && isAtBottom) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        })
      })
    }

    prevItemCountRef.current = items.length
    prevFirstKeyRef.current = currentFirstKey
  }, [items, isAtBottom, keyExtractor])

  /* Preserve scroll position when older messages are prepended */
  useEffect(() => {
    const currentFirstKey = items.length > 0
      ? keyExtractor(items[0], 0)
      : null

    if (
      prevFirstKeyRef.current !== null
      && currentFirstKey !== prevFirstKeyRef.current
      && scrollRef.current
    ) {
      /* Сообщения добавлены сверху — сохраняем позицию */
      const prevScrollHeight = scrollRef.current.scrollHeight
      requestAnimationFrame(() => {
        if (!scrollRef.current) return
        const newScrollHeight = scrollRef.current.scrollHeight
        const delta = newScrollHeight - prevScrollHeight
        scrollRef.current.scrollTop += delta
      })
    }
  }, [items, keyExtractor])

  /* Initial scroll to bottom */
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    })
  }, [])

  /* Register scroll listener */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    el.addEventListener('scroll', handleScroll, { passive: true })
    /* Начальный расчёт видимого диапазона */
    updateVisibleRange(el)

    return () => {
      el.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll, updateVisibleRange])

  /* Calculate spacer heights for items outside the render range */
  const { topSpacer, bottomSpacer } = useMemo(() => {
    let top = 0
    let bottom = 0

    for (let i = 0; i < renderRange.start; i++) {
      const key = keyExtractor(items[i], i)
      const m = measurementsRef.current.get(key)
      top += m?.measured ? m.height : ESTIMATED_ITEM_HEIGHT
    }

    for (let i = renderRange.end; i < items.length; i++) {
      const key = keyExtractor(items[i], i)
      const m = measurementsRef.current.get(key)
      bottom += m?.measured ? m.height : ESTIMATED_ITEM_HEIGHT
    }

    return { topSpacer: top, bottomSpacer: bottom }
  }, [items, renderRange, keyExtractor])

  const topSpacerStyle: CSSProperties = useMemo(
    () => ({ height: topSpacer, minHeight: topSpacer }),
    [topSpacer],
  )

  const bottomSpacerStyle: CSSProperties = useMemo(
    () => ({ height: bottomSpacer, minHeight: bottomSpacer }),
    [bottomSpacer],
  )

  /* Ref callback to track item DOM nodes */
  const setItemRef = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) {
        itemRefs.current.set(key, el)
      } else {
        itemRefs.current.delete(key)
      }
    },
    [],
  )

  return (
    <div
      ref={scrollRef}
      className={className}
      style={{ overflowY: 'auto', willChange: 'scroll-position' }}
    >
      {/* Загрузка старых сообщений */}
      {isLoadingMore && (
        <div className="flex justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      )}

      {/* Верхний спейсер для не-рендеренных элементов */}
      {topSpacer > 0 && <div style={topSpacerStyle} aria-hidden />}

      {/* Видимые элементы */}
      {items.slice(renderRange.start, renderRange.end).map((item, i) => {
        const index = renderRange.start + i
        const key = keyExtractor(item, index)
        return (
          <div key={key} ref={setItemRef(key)} data-index={index}>
            {renderItem(item, index)}
          </div>
        )
      })}

      {/* Нижний спейсер */}
      {bottomSpacer > 0 && <div style={bottomSpacerStyle} aria-hidden />}

      {/* Футер (стриминг-индикатор и т.п.) */}
      {footer}
    </div>
  )
}
