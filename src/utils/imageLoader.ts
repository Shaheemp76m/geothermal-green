/**
 * imageLoader.ts
 *
 * A high-performance bounded LRU image cache with off-main-thread decoding.
 *
 * Goals:
 *  - Off-main-thread decoding via createImageBitmap(blob) with fallback to img.decode() / HTMLImageElement.
 *  - Store ImageBitmap | HTMLImageElement in cache so canvas drawImage incurs zero decompression latency.
 *  - Bounded LRU cache capacity (140 frames) with explicit ImageBitmap.close() memory release.
 *  - Prioritized queueing: active display requests take precedence over speculative prefetches.
 *  - Controlled concurrency and queue pruning to prevent network saturation.
 */

export type CachedImage = ImageBitmap | HTMLImageElement;

const CACHE_CAPACITY = 140;        // Maximum decoded images in memory
const MAX_CONCURRENT = 8;          // Maximum simultaneous loads (optimal for HTTP/2 & decoding threads)
const REQUEST_BASE_PRIORITY = 100000;

type LoadState = 'loading' | 'ready' | 'error';

interface CacheEntry {
  image: CachedImage | null;
  state: LoadState;
  url: string;
  lastAccessed: number;
  callbacks: Array<(img: CachedImage | null) => void>;
  abortController?: AbortController;
}

interface QueueItem {
  url: string;
  priority: number;
}

/**
 * Loads and decodes an image off the main thread.
 * 1. Primary: fetch blob + createImageBitmap (fully off-main-thread).
 * 2. Fallback: HTMLImageElement + img.decode() (or onload fallback).
 */
async function loadAndDecodeImage(
  url: string,
  signal?: AbortSignal
): Promise<CachedImage> {
  // Strategy 1: Off-main-thread decode using fetch + createImageBitmap
  const createBitmap =
    typeof window !== 'undefined' && typeof window.createImageBitmap === 'function'
      ? window.createImageBitmap.bind(window)
      : typeof globalThis !== 'undefined' && typeof globalThis.createImageBitmap === 'function'
      ? globalThis.createImageBitmap.bind(globalThis)
      : null;

  if (createBitmap) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const bitmap = await createBitmap(blob);
      return bitmap;
    } catch (err: unknown) {
      if (signal?.aborted) {
        throw err;
      }
      // If fetch or createImageBitmap fails (e.g. CORS or decode issue), fall through to HTMLImageElement
      console.warn(`[imageLoader] Off-thread decode failed for ${url}, falling back to HTMLImageElement`, err);
    }
  }

  // Strategy 2: HTMLImageElement with img.decode() / onload fallback
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const img = new Image();
    let settled = false;

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      if (!settled) {
        settled = true;
        cleanup();
        img.src = '';
        reject(new DOMException('Aborted', 'AbortError'));
      }
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const settleSuccess = (image: HTMLImageElement) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(image);
    };

    const settleError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    img.onload = () => {
      if ('decode' in img && typeof img.decode === 'function') {
        img
          .decode()
          .then(() => settleSuccess(img))
          .catch(() => settleSuccess(img)); // If decode rejects but onload succeeded, still return image
      } else {
        settleSuccess(img);
      }
    };

    img.onerror = () => {
      settleError(new Error(`Failed to load image at ${url}`));
    };

    img.src = url;
  });
}

class ImageCache {
  private cache = new Map<string, CacheEntry>();
  private activeLoads = 0;
  private queue: QueueItem[] = [];
  private requestCounter = 0;

  /**
   * Request an image for immediate display. Calls `onReady` immediately if cached,
   * or schedules high-priority load.
   * Returns the cached image if already ready, otherwise null.
   */
  request(
    url: string,
    onReady?: (img: CachedImage | null) => void
  ): CachedImage | null {
    const entry = this.cache.get(url);

    if (entry) {
      entry.lastAccessed = Date.now();

      if (entry.state === 'ready' && entry.image) {
        onReady?.(entry.image);
        return entry.image;
      }

      if (entry.state === 'loading') {
        if (onReady) entry.callbacks.push(onReady);
        // Elevate priority in queue to active request priority
        const queuedItem = this.queue.find((q) => q.url === url);
        if (queuedItem) {
          queuedItem.priority = REQUEST_BASE_PRIORITY + (++this.requestCounter);
          this.processQueue();
        }
        return null;
      }

      // Error state — retry load
      this.cache.delete(url);
    }

    // Create new entry
    const priority = REQUEST_BASE_PRIORITY + (++this.requestCounter);
    const newEntry: CacheEntry = {
      image: null,
      state: 'loading',
      url,
      lastAccessed: Date.now(),
      callbacks: onReady ? [onReady] : [],
    };
    this.cache.set(url, newEntry);
    this.scheduleLoad(url, priority);
    return null;
  }

  /**
   * Prefetch a list of URLs with proximity-based priority.
   * Lower index = higher priority.
   * Supports an optional listener called when each frame finishes loading.
   */
  prefetch(
    urls: string[],
    onFrameLoaded?: (url: string, img: CachedImage | null) => void
  ): void {
    const basePriority = 1000;
    urls.forEach((url, i) => {
      const priority = basePriority + (urls.length - i);
      const existing = this.cache.get(url);

      if (existing) {
        if (existing.state === 'ready') {
          onFrameLoaded?.(url, existing.image);
        } else if (existing.state === 'loading') {
          if (onFrameLoaded) {
            existing.callbacks.push((img) => onFrameLoaded(url, img));
          }
          // Elevate queued priority if higher
          const queued = this.queue.find((q) => q.url === url);
          if (queued && priority > queued.priority) {
            queued.priority = priority;
          }
        }
        return;
      }

      const entry: CacheEntry = {
        image: null,
        state: 'loading',
        url,
        lastAccessed: Date.now() - (i + 1) * 10,
        callbacks: onFrameLoaded ? [(img) => onFrameLoaded(url, img)] : [],
      };
      this.cache.set(url, entry);
      this.scheduleLoad(url, priority);
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
  get(url: string): CachedImage | null {
    const entry = this.cache.get(url);
    if (entry?.state === 'ready') {
      entry.lastAccessed = Date.now();
      return entry.image;
    }
    return null;
  }

  private scheduleLoad(url: string, priority: number): void {
    const existingIndex = this.queue.findIndex((q) => q.url === url);
    if (existingIndex !== -1) {
      if (priority > this.queue[existingIndex].priority) {
        this.queue[existingIndex].priority = priority;
      }
    } else {
      this.queue.push({ url, priority });
    }
    this.pruneQueueIfNeeded();
    this.processQueue();
  }

  private pruneQueueIfNeeded(): void {
    // If fast scrubbing queues excessive prefetch requests, drop unstarted
    // speculative prefetches without listeners to keep network responsive.
    const MAX_QUEUE_SIZE = 200;
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue.sort((a, b) => b.priority - a.priority);
      const dropped = this.queue.splice(MAX_QUEUE_SIZE);
      for (const item of dropped) {
        const entry = this.cache.get(item.url);
        if (entry && entry.callbacks.length === 0 && entry.state === 'loading') {
          this.cache.delete(item.url);
        }
      }
    }
  }

  private processQueue(): void {
    while (this.activeLoads < MAX_CONCURRENT && this.queue.length > 0) {
      // Sort descending by priority so the highest priority item starts next
      this.queue.sort((a, b) => b.priority - a.priority);
      const item = this.queue.shift();
      if (!item) break;

      const entry = this.cache.get(item.url);
      if (!entry || entry.state !== 'loading') {
        continue;
      }

      this.startLoad(entry);
    }
  }

  private async startLoad(entry: CacheEntry): Promise<void> {
    this.activeLoads++;
    const controller = new AbortController();
    entry.abortController = controller;

    try {
      const image = await loadAndDecodeImage(entry.url, controller.signal);

      // Verify entry hasn't been deleted or replaced while awaiting decode
      if (this.cache.get(entry.url) !== entry) {
        if ('close' in image && typeof image.close === 'function') {
          image.close();
        }
        return;
      }

      entry.state = 'ready';
      entry.image = image;
      entry.lastAccessed = Date.now();
      entry.abortController = undefined;

      const cbs = entry.callbacks;
      entry.callbacks = [];
      cbs.forEach((cb) => {
        try {
          cb(image);
        } catch (e) {
          console.error('Error in imageLoader callback:', e);
        }
      });

      this.evictIfNeeded();
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      if (this.cache.get(entry.url) !== entry) {
        return;
      }

      entry.state = 'error';
      entry.image = null;
      entry.abortController = undefined;

      const cbs = entry.callbacks;
      entry.callbacks = [];
      cbs.forEach((cb) => {
        try {
          cb(null);
        } catch (e) {
          console.error('Error in imageLoader callback:', e);
        }
      });
    } finally {
      this.activeLoads--;
      this.processQueue();
    }
  }

  private evictIfNeeded(): void {
    while (this.cache.size > CACHE_CAPACITY) {
      // Find the least recently accessed entry that is ready
      let oldest: { url: string; time: number } | null = null;
      for (const [url, entry] of this.cache.entries()) {
        if (entry.state === 'ready') {
          if (!oldest || entry.lastAccessed < oldest.time) {
            oldest = { url, time: entry.lastAccessed };
          }
        }
      }

      if (!oldest) break;

      const entry = this.cache.get(oldest.url);
      if (entry?.image && 'close' in entry.image && typeof entry.image.close === 'function') {
        try {
          entry.image.close();
        } catch {
          // ignore
        }
      }
      this.cache.delete(oldest.url);
    }
  }

  /**
   * Clear all cached images and abort active loads.
   */
  clear(): void {
    for (const entry of this.cache.values()) {
      if (entry.abortController) {
        entry.abortController.abort();
      }
      if (entry.image && 'close' in entry.image && typeof entry.image.close === 'function') {
        try {
          entry.image.close();
        } catch {
          // ignore
        }
      }
    }
    this.cache.clear();
    this.queue = [];
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  get activeLoadCount(): number {
    return this.activeLoads;
  }

  get queuedCount(): number {
    return this.queue.length;
  }
}

// Singleton cache shared across the application
export const imageCache = new ImageCache();
