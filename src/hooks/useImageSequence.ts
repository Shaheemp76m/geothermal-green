/**
 * useImageSequence.ts
 *
 * Hook for controlling the image sequence driven by a progress value.
 *
 * Responsibilities:
 *  - Maintains a renderer instance tied to the canvas ref.
 *  - On progress update: maps progress → URL → cache lookup → draw.
 *  - Prefetches neighbouring frames in the scroll direction.
 *  - Handles canvas resize events.
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
  type RendererState,
} from '../utils/canvasRenderer';

const PREFETCH_AHEAD = 12;  // Frames to prefetch in scroll direction
const PREFETCH_BEHIND = 4;  // Frames to keep behind current

export interface UseImageSequenceOptions {
  onFirstFrameReady?: () => void;
}

export interface UseImageSequenceReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  setProgress: (progress: number, direction?: number) => void;
}

export function useImageSequence(
  options: UseImageSequenceOptions = {}
): UseImageSequenceReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RendererState | null>(null);
  const firstFrameCalledRef = useRef(false);
  const lastProgressRef = useRef(0);
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

  // Update the displayed frame based on scroll progress
  const setProgress = useCallback(
    (progress: number, direction = 1) => {
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
        // Request load — when ready, draw only if still the latest request
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

      // Prefetch surrounding frames
      const { totalFrames } = SEQUENCE_CONFIG;
      const scrollDir = Math.sign(direction || 1);
      const ahead = direction >= 0 ? PREFETCH_AHEAD : PREFETCH_BEHIND;
      const behind = direction >= 0 ? PREFETCH_BEHIND : PREFETCH_AHEAD;

      const prefetchUrls: string[] = [];
      for (let i = 1; i <= ahead; i++) {
        const idx = Math.min(globalIndex + i * scrollDir, totalFrames - 1);
        prefetchUrls.push(indexToUrl(idx));
      }
      for (let i = 1; i <= behind; i++) {
        const idx = Math.max(globalIndex - i * scrollDir, 0);
        prefetchUrls.push(indexToUrl(idx));
      }

      imageCache.prefetch(
        prefetchUrls.filter((u, i, arr) => arr.indexOf(u) === i)
      );
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
    imageCache.request(firstUrl, (img) => {
      if (!img) return;
      const renderer = getRenderer();
      if (renderer) {
        scheduleFrame(renderer, firstUrl, img);
        signalFirstFrameReady();
      }
    });
  }, [getRenderer, signalFirstFrameReady]);

  return {
    canvasRef,
    setProgress,
  };
}
