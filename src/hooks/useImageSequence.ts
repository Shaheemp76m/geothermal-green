/**
 * useImageSequence.ts
 *
 * Hook for controlling the image sequence driven by a progress value.
 *
 * Responsibilities:
 *  - Maintains a renderer instance tied to the canvas ref.
 *  - On progress update: maps progress → URL → cache lookup → draw.
 *  - Adaptive velocity-aware prefetching: scales lookahead window (10 to 28 frames ahead)
 *    during rapid scrolling / high momentum while preserving a small window behind.
 *  - Supports both ImageBitmap and HTMLImageElement (DrawableFrame).
 *  - Handles canvas resize events and unmount cleanup.
 *  - Reports loading state via callback.
 */

import { useRef, useCallback, useEffect } from 'react';
import { imageCache } from '../utils/imageLoader';
import {
  progressToGlobalIndex,
  globalIndexToLocation,
  frameUrl,
  SEQUENCE_CONFIG,
} from '../utils/frameMapper';
import {
  createRenderer,
  resizeCanvas,
  scheduleFrame,
  fillBackground,
  cancelPendingFrame,
  type RendererState,
  type DrawableFrame,
} from '../utils/canvasRenderer';

export type { DrawableFrame };

const MIN_LOOKAHEAD = 10;   // Base lookahead frames at slow/stationary scroll
const MAX_LOOKAHEAD = 28;   // Dynamic lookahead frames during high velocity
const PREFETCH_BEHIND = 4;  // Frames to retain/prefetch behind current playhead

export interface UseImageSequenceOptions {
  onFirstFrameReady?: () => void;
}

export interface UseImageSequenceReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  setProgress: (progress: number, direction?: number, velocity?: number) => void;
}

export function useImageSequence(
  options: UseImageSequenceOptions = {}
): UseImageSequenceReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RendererState | null>(null);
  const firstFrameCalledRef = useRef(false);
  const lastProgressRef = useRef(0);
  const lastIndexRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const smoothedFpsRef = useRef(0);
  const lastDirectionRef = useRef(1);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Lazily initialise renderer when canvas becomes available
  const getRenderer = useCallback((): RendererState | null => {
    if (!canvasRef.current) return null;
    if (!rendererRef.current) {
      rendererRef.current = createRenderer(canvasRef.current);
      fillBackground(rendererRef.current);
      resizeCanvas(rendererRef.current);
    }
    return rendererRef.current;
  }, []);

  // Convert global frame index to URL
  const indexToUrl = useCallback((globalIndex: number): string => {
    const loc = globalIndexToLocation(globalIndex);
    return frameUrl(loc.phase, loc.localIndex);
  }, []);

  const signalFirstFrameReady = useCallback(() => {
    if (!firstFrameCalledRef.current) {
      firstFrameCalledRef.current = true;
      optionsRef.current.onFirstFrameReady?.();
    }
  }, []);

  // Update the displayed frame based on scroll progress and prefetch adaptively
  const setProgress = useCallback(
    (progress: number, direction = 1, velocity?: number) => {
      lastProgressRef.current = progress;

      const renderer = getRenderer();
      if (!renderer) return;

      const globalIndex = progressToGlobalIndex(progress);
      const url = indexToUrl(globalIndex);

      // Try to draw from cache immediately
      const cachedImage = imageCache.get(url);
      if (cachedImage) {
        scheduleFrame(renderer, url, cachedImage);
        signalFirstFrameReady();
      } else {
        // Request load — when ready, draw only if still the pending or last frame
        imageCache.request(url, (img) => {
          if (!img) return;
          const currentRenderer = getRenderer();
          if (!currentRenderer) return;
          // Only draw if this URL is still the pending or last frame
          if (
            currentRenderer.pendingUrl === url ||
            currentRenderer.pendingUrl === null
          ) {
            scheduleFrame(currentRenderer, url, img);
          }
          signalFirstFrameReady();
        });
        // Keep existing frame visible while loading
        scheduleFrame(renderer, url, null);
      }

      // ── Velocity calculation & adaptive prefetching ──
      const now = performance.now();
      const dt = Math.max(8, now - lastTimeRef.current);
      lastTimeRef.current = now;

      const frameDelta = Math.abs(globalIndex - lastIndexRef.current);
      lastIndexRef.current = globalIndex;

      // Reset smoothed velocity if paused for more than 180ms
      if (dt > 180) {
        smoothedFpsRef.current = 0;
      }

      const instantFps = (frameDelta / dt) * 1000;

      let effectiveFps = 0;
      if (velocity !== undefined && Number.isFinite(velocity) && Math.abs(velocity) > 0) {
        const absV = Math.abs(velocity);
        if (absV > 50) {
          // Pixel velocity (e.g. GSAP ScrollTrigger ~ 6000px travel for 566 frames ≈ 10.6 px/frame)
          effectiveFps = absV / 10.6;
        } else if (absV <= 2.5) {
          // Normalized progress velocity (progress units per second)
          effectiveFps = absV * SEQUENCE_CONFIG.totalFrames;
        } else {
          // Frame velocity (frames per second)
          effectiveFps = absV;
        }
      } else {
        smoothedFpsRef.current = smoothedFpsRef.current * 0.6 + instantFps * 0.4;
        effectiveFps = smoothedFpsRef.current;
      }

      // Track travel direction (1 forward, -1 reverse)
      const scrollDir = direction !== 0 ? Math.sign(direction) : lastDirectionRef.current;
      const validDir = scrollDir === -1 ? -1 : 1;
      lastDirectionRef.current = validDir;

      // Scale lookahead dynamically between MIN_LOOKAHEAD (10) and MAX_LOOKAHEAD (28)
      // 60 fps scroll travel corresponds to maximum lookahead
      const velocityRatio = Math.min(1, Math.max(0, effectiveFps / 60));
      const lookaheadCount = Math.round(
        MIN_LOOKAHEAD + (MAX_LOOKAHEAD - MIN_LOOKAHEAD) * velocityRatio
      );
      const behindCount = PREFETCH_BEHIND;

      // Prefetch surrounding frames in priority order
      const { totalFrames } = SEQUENCE_CONFIG;
      const prefetchUrls: string[] = [];

      // Lookahead window in direction of movement (highest priority)
      for (let i = 1; i <= lookaheadCount; i++) {
        const targetIndex = globalIndex + i * validDir;
        if (targetIndex >= 0 && targetIndex < totalFrames) {
          prefetchUrls.push(indexToUrl(targetIndex));
        }
      }

      // Small lookbehind window to preserve reverse responsiveness
      for (let i = 1; i <= behindCount; i++) {
        const targetIndex = globalIndex - i * validDir;
        if (targetIndex >= 0 && targetIndex < totalFrames) {
          prefetchUrls.push(indexToUrl(targetIndex));
        }
      }

      // Filter current URL and deduplicate
      const uniqueUrls = prefetchUrls.filter(
        (u, i, arr) => u !== url && arr.indexOf(u) === i
      );

      imageCache.prefetch(uniqueUrls);
    },
    [getRenderer, indexToUrl, signalFirstFrameReady]
  );

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const renderer = getRenderer();
      if (!renderer) return;
      const resized = resizeCanvas(renderer);
      if (resized) {
        // Redraw current frame after resize
        const globalIndex = progressToGlobalIndex(lastProgressRef.current);
        const url = indexToUrl(globalIndex);
        const img = imageCache.get(url);
        if (img) scheduleFrame(renderer, url, img);
        else fillBackground(renderer);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [getRenderer, indexToUrl]);

  // Preload first frame immediately on mount
  useEffect(() => {
    const firstUrl = frameUrl(1, 0);
    const cached = imageCache.get(firstUrl);
    if (cached) {
      const renderer = getRenderer();
      if (renderer) {
        scheduleFrame(renderer, firstUrl, cached);
        signalFirstFrameReady();
      }
    } else {
      imageCache.request(firstUrl, (img) => {
        if (!img) return;
        const renderer = getRenderer();
        if (renderer) {
          scheduleFrame(renderer, firstUrl, img);
          signalFirstFrameReady();
        }
      });
    }

    // Prefetch first batch of frames in advance
    const initialUrls: string[] = [];
    for (let i = 1; i <= MIN_LOOKAHEAD; i++) {
      initialUrls.push(indexToUrl(i));
    }
    imageCache.prefetch(initialUrls);
  }, [getRenderer, indexToUrl, signalFirstFrameReady]);

  // Cleanup pending rAF on unmount
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        cancelPendingFrame(rendererRef.current);
      }
    };
  }, []);

  return {
    canvasRef,
    setProgress,
  };
}
