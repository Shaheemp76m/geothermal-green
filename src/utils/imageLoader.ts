/**
 * imageLoader.ts
 *
 * A bounded LRU image cache with controlled concurrency.
 *
 * Goals:
 *  - Avoid loading all 566 frames at once.
 *  - Cache recently used frames.
 *  - Limit simultaneous HTTP requests.
 *  - Support cancellation of stale requests.
 *  - Prioritise the currently needed frame.
 */

const CACHE_CAPACITY = 80;    // Maximum decoded images in memory
const MAX_CONCURRENT = 6;     // Maximum simultaneous loads

type LoadState = 'loading' | 'ready' | 'error';

interface CacheEntry {
  image: HTMLImageElement;
  state: LoadState;
  url: string;
  lastAccessed: number;
  callbacks: Array<(img: HTMLImageElement | null) => void>;
}

class ImageCache {
  private cache = new Map<string, CacheEntry>();
  private activeLoads = 0;
  private queue: Array<{ url: string; priority: number }> = [];

  /**
   * Request an image. Calls `onReady` immediately if cached, or queues the load.
   * Returns the image element if already cached, otherwise null.
   */
  request(
    url: string,
    onReady?: (img: HTMLImageElement | null) => void
  ): HTMLImageElement | null {
    const entry = this.cache.get(url);

    if (entry) {
      entry.lastAccessed = Date.now();

      if (entry.state === 'ready') {
        onReady?.(entry.image);
        return entry.image;
      }

      if (entry.state === 'loading') {
        if (onReady) entry.callbacks.push(onReady);
        return null;
      }

      // Error state — retry
      this.cache.delete(url);
    }

    // Create new entry
    const img = new Image();
    const newEntry: CacheEntry = {
      image: img,
      state: 'loading',
      url,
      lastAccessed: Date.now(),
      callbacks: onReady ? [onReady] : [],
    };
    this.cache.set(url, newEntry);

    this.scheduleLoad(url, 1);
    return null;
  }

  /**
   * Prefetch a list of URLs in order of priority.
   * Lower index = higher priority.
   */
  prefetch(urls: string[]): void {
    urls.forEach((url, i) => {
      if (!this.cache.has(url)) {
        const img = new Image();
        const entry: CacheEntry = {
          image: img,
          state: 'loading',
          url,
          lastAccessed: Date.now() - i * 100, // Earlier entries are more recent
          callbacks: [],
        };
        this.cache.set(url, entry);
        this.scheduleLoad(url, urls.length - i);
      }
    });
  }

  /**
   * Check if a URL is ready in the cache.
   */
  isReady(url: string): boolean {
    return this.cache.get(url)?.state === 'ready';
  }

  /**
   * Get a cached image if ready, without triggering a load.
   */
  get(url: string): HTMLImageElement | null {
    const entry = this.cache.get(url);
    if (entry?.state === 'ready') {
      entry.lastAccessed = Date.now();
      return entry.image;
    }
    return null;
  }

  private scheduleLoad(url: string, priority: number): void {
    // Remove existing queue entry for this URL if present
    this.queue = this.queue.filter((q) => q.url !== url);
    this.queue.push({ url, priority });
    this.processQueue();
  }

  private processQueue(): void {
    if (this.activeLoads >= MAX_CONCURRENT || this.queue.length === 0) return;

    // Sort descending by priority
    this.queue.sort((a, b) => b.priority - a.priority);
    const { url } = this.queue.shift()!;

    const entry = this.cache.get(url);
    if (!entry || entry.state !== 'loading') {
      this.processQueue();
      return;
    }

    this.activeLoads++;
    entry.image.onload = () => {
      entry.state = 'ready';
      entry.lastAccessed = Date.now();
      entry.callbacks.forEach((cb) => cb(entry.image));
      entry.callbacks = [];
      this.activeLoads--;
      this.evictIfNeeded();
      this.processQueue();
    };
    entry.image.onerror = () => {
      entry.state = 'error';
      entry.callbacks.forEach((cb) => cb(null));
      entry.callbacks = [];
      this.activeLoads--;
      this.processQueue();
    };
    entry.image.src = url;
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= CACHE_CAPACITY) return;

    // Find the least recently accessed entry that is ready (not loading)
    let oldest: { url: string; time: number } | null = null;
    this.cache.forEach((entry, url) => {
      if (entry.state === 'ready') {
        if (!oldest || entry.lastAccessed < oldest.time) {
          oldest = { url, time: entry.lastAccessed };
        }
      }
    });

    if (oldest) {
      this.cache.delete((oldest as { url: string }).url);
    }
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  get activeLoadCount(): number {
    return this.activeLoads;
  }
}

// Singleton cache shared across the application
export const imageCache = new ImageCache();
