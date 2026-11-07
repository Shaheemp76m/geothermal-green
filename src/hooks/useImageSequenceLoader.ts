import { useEffect, useRef, useState, useCallback } from 'react';
import { FRAMES, TOTAL_FRAMES, FrameInfo } from '../framesData';

const MAX_CACHE_SIZE = 70;
const LOOKAHEAD_FORWARD = 18;
const LOOKAHEAD_BACKWARD = 6;

class LRUImageCache {
  private cache = new Map<number, HTMLImageElement>();
  private readonly maxCapacity: number;

  constructor(maxCapacity: number) {
    this.maxCapacity = maxCapacity;
  }

  get(index: number): HTMLImageElement | undefined {
    const img = this.cache.get(index);
    if (img) {
      // Refresh key order (LRU)
      this.cache.delete(index);
      this.cache.set(index, img);
    }
    return img;
  }

  has(index: number): boolean {
    return this.cache.has(index);
  }

  set(index: number, img: HTMLImageElement): void {
    if (this.cache.has(index)) {
      this.cache.delete(index);
    } else if (this.cache.size >= this.maxCapacity) {
      // Evict oldest item
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        const evicted = this.cache.get(oldestKey);
        if (evicted) {
          evicted.src = ''; // help browser release memory
        }
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(index, img);
  }

  clear(): void {
    for (const img of this.cache.values()) {
      img.src = '';
    }
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export function useImageSequenceLoader() {
  const cacheRef = useRef<LRUImageCache>(new LRUImageCache(MAX_CACHE_SIZE));
  const activeLoadsRef = useRef<Map<number, Promise<HTMLImageElement>>>(new Map());
  const [isInitialReady, setIsInitialReady] = useState(false);
  const [initialProgress, setInitialProgress] = useState(0);
  const lastIndexRef = useRef(0);
  const scrollDirectionRef = useRef<'down' | 'up'>('down');

  // Load a single frame by index
  const loadFrame = useCallback((index: number): Promise<HTMLImageElement> => {
    if (index < 0 || index >= TOTAL_FRAMES) {
      return Promise.reject(new Error(`Index out of bounds: ${index}`));
    }

    const cached = cacheRef.current.get(index);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      return Promise.resolve(cached);
    }

    const inFlight = activeLoadsRef.current.get(index);
    if (inFlight) {
      return inFlight;
    }

    const frame: FrameInfo = FRAMES[index];
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';

      img.onload = () => {
        if ('decode' in img) {
          img.decode()
            .then(() => {
              cacheRef.current.set(index, img);
              activeLoadsRef.current.delete(index);
              resolve(img);
            })
            .catch(() => {
              // Even if decode fails (e.g. aborted), image is loaded
              cacheRef.current.set(index, img);
              activeLoadsRef.current.delete(index);
              resolve(img);
            });
        } else {
          cacheRef.current.set(index, img);
          activeLoadsRef.current.delete(index);
          resolve(img);
        }
      };

      img.onerror = (err) => {
        activeLoadsRef.current.delete(index);
        reject(err);
      };

      img.src = frame.path;
    });

    activeLoadsRef.current.set(index, promise);
    return promise;
  }, []);

  // Preload frames around current index based on scroll direction
  const requestFrames = useCallback((currentIndex: number) => {
    if (currentIndex !== lastIndexRef.current) {
      scrollDirectionRef.current = currentIndex >= lastIndexRef.current ? 'down' : 'up';
      lastIndexRef.current = currentIndex;
    }

    const forwardCount = scrollDirectionRef.current === 'down' ? LOOKAHEAD_FORWARD : LOOKAHEAD_BACKWARD;
    const backwardCount = scrollDirectionRef.current === 'down' ? LOOKAHEAD_BACKWARD : LOOKAHEAD_FORWARD;

    // Load current frame immediately
    loadFrame(currentIndex).catch(() => {});

    // Prioritized nearby window
    const indicesToLoad: number[] = [];

    if (scrollDirectionRef.current === 'down') {
      for (let i = 1; i <= forwardCount; i++) {
        const next = currentIndex + i;
        if (next < TOTAL_FRAMES) indicesToLoad.push(next);
      }
      for (let i = 1; i <= backwardCount; i++) {
        const prev = currentIndex - i;
        if (prev >= 0) indicesToLoad.push(prev);
      }
    } else {
      for (let i = 1; i <= forwardCount; i++) {
        const prev = currentIndex - i;
        if (prev >= 0) indicesToLoad.push(prev);
      }
      for (let i = 1; i <= backwardCount; i++) {
        const next = currentIndex + i;
        if (next < TOTAL_FRAMES) indicesToLoad.push(next);
      }
    }

    // Trigger preloads sequentially in batches to avoid network congestion
    indicesToLoad.forEach((idx) => {
      if (!cacheRef.current.has(idx) && !activeLoadsRef.current.has(idx)) {
        loadFrame(idx).catch(() => {});
      }
    });
  }, [loadFrame]);

  // Get currently cached image if available
  const getCachedFrame = useCallback((index: number): HTMLImageElement | null => {
    const img = cacheRef.current.get(index);
    if (img && img.complete && img.naturalWidth > 0) {
      return img;
    }
    return null;
  }, []);

  // Find the closest loaded frame to avoid blank flash
  const getClosestLoadedFrame = useCallback((targetIndex: number): HTMLImageElement | null => {
    const exact = getCachedFrame(targetIndex);
    if (exact) return exact;

    // Check ±5 frames radius for immediate fallback
    for (let offset = 1; offset <= 10; offset++) {
      const prev = targetIndex - offset;
      if (prev >= 0) {
        const img = getCachedFrame(prev);
        if (img) return img;
      }
      const next = targetIndex + offset;
      if (next < TOTAL_FRAMES) {
        const img = getCachedFrame(next);
        if (img) return img;
      }
    }
    return null;
  }, [getCachedFrame]);

  // Initial load
  useEffect(() => {
    let isCancelled = false;
    const initialBatchCount = 12;
    let loadedCount = 0;

    const initialIndices: number[] = [];
    for (let i = 0; i < initialBatchCount && i < TOTAL_FRAMES; i++) {
      initialIndices.push(i);
    }

    // Preload frame 0 first
    loadFrame(0).then(() => {
      if (isCancelled) return;
      loadedCount++;
      setInitialProgress(Math.round((loadedCount / initialBatchCount) * 100));
      // First frame ready, we can mark ready or wait for first few frames
      setIsInitialReady(true);
    }).catch((err) => {
      console.error("Failed to load initial frame:", err);
      // Even if failed, mark ready so user is not stuck
      if (!isCancelled) setIsInitialReady(true);
    });

    // Concurrently load the rest of the initial batch
    initialIndices.slice(1).forEach((idx) => {
      loadFrame(idx)
        .then(() => {
          if (!isCancelled) {
            loadedCount++;
            setInitialProgress(Math.round((loadedCount / initialBatchCount) * 100));
          }
        })
        .catch(() => {});
    });

    return () => {
      isCancelled = true;
      activeLoadsRef.current.clear();
      cacheRef.current.clear();
    };
  }, [loadFrame]);

  return {
    isInitialReady,
    initialProgress,
    loadFrame,
    requestFrames,
    getCachedFrame,
    getClosestLoadedFrame
  };
}
