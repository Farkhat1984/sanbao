/**
 * LRU-bounded Map that evicts oldest entries when maxSize is reached.
 * Prevents OOM from unbounded in-memory caches under high load.
 */
export class BoundedMap<K, V> {
  private map = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    if (maxSize < 1) throw new Error("BoundedMap maxSize must be >= 1");
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): this {
    // If key exists, delete first to update insertion order
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest (first) entry
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }
    this.map.set(key, value);
    return this;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  /** Iterate entries (oldest first) */
  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.map[Symbol.iterator]();
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }

  forEach(callback: (value: V, key: K, map: BoundedMap<K, V>) => void): void {
    for (const [key, value] of this.map) {
      callback(value, key, this);
    }
  }

  /** Remove entries matching a predicate */
  cleanup(predicate: (value: V, key: K) => boolean): number {
    let removed = 0;
    for (const [key, value] of this.map) {
      if (predicate(value, key)) {
        this.map.delete(key);
        removed++;
      }
    }
    return removed;
  }
}
