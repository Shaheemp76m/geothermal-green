/**
 * useScrollExperience.ts
 *
 * Binds GSAP ScrollTrigger to the image sequence progress.
 *
 * Architecture:
 *  - Pinned ScrollTrigger controls progress [0, 1] over scroll travel distance.
 *  - Scrub provides tight, tactile 1:1 scroll responsiveness (0.1s default).
 *  - Animates a progress proxy via GSAP tween with onUpdate triggering callbacks.
 *  - Calculates velocity (px/sec) and direction for adaptive frame prefetching.
 *  - Wrapped in gsap.context with explicit cleanup to prevent leaks & duplicates.
 *
 * Scroll distance: 6000px default (configurable).
 */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const SCROLL_DISTANCE = 6000; // px of scroll travel
export const DEFAULT_SCRUB = 0.1; // 100ms: instant, tactile connection without rubbery delay
export const SCROLL_TRIGGER_ID = 'geotherm-scroll-experience';

export type ScrollProgressCallback = (
  progress: number,
  direction: number,
  velocity: number
) => void;

export interface UseScrollExperienceOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onProgress: ScrollProgressCallback;
  enabled: boolean;
  scrub?: number | boolean;
  scrollDistance?: number;
}

export function useScrollExperience({
  containerRef,
  onProgress,
  enabled,
  scrub = DEFAULT_SCRUB,
  scrollDistance = SCROLL_DISTANCE,
}: UseScrollExperienceOptions): void {
  const progressProxy = useRef({ value: 0 });
  const directionRef = useRef<number>(1);
  const lastProgressRef = useRef<number>(0);

  // Store onProgress in a ref so changes in callback identity do not trigger re-binding
  const onProgressRef = useRef<ScrollProgressCallback>(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    // Safety: ensure no orphaned triggers with the same ID exist from hot reload / StrictMode
    const existing = ScrollTrigger.getById(SCROLL_TRIGGER_ID);
    if (existing) {
      existing.kill(true);
    }

    progressProxy.current = { value: 0 };
    lastProgressRef.current = 0;
    directionRef.current = 1;

    let triggerInstance: ScrollTrigger | null = null;

    // Scoped context to capture all tweens and triggers for safe teardown
    const ctx = gsap.context(() => {
      // Tween animating proxy object from 0 to 1
      const tween = gsap.to(progressProxy.current, {
        value: 1,
        ease: 'none',
        paused: true,
        onUpdate: () => {
          const progress = progressProxy.current.value;

          // Velocity in pixels/second from ScrollTrigger scroller
          const trigger = triggerInstance || ScrollTrigger.getById(SCROLL_TRIGGER_ID);
          const velocity = trigger ? trigger.getVelocity() : 0;

          // Direction tracking:
          // 1. Prefer velocity direction if moving
          // 2. Otherwise determine from progress delta
          // 3. Keep previous direction if stationary
          let direction = directionRef.current;
          if (Math.abs(velocity) > 1) {
            direction = velocity > 0 ? 1 : -1;
          } else if (Math.abs(progress - lastProgressRef.current) > 0.00001) {
            direction = progress >= lastProgressRef.current ? 1 : -1;
          }

          directionRef.current = direction;
          lastProgressRef.current = progress;

          onProgressRef.current(progress, direction, velocity);
        },
      });

      triggerInstance = ScrollTrigger.create({
        id: SCROLL_TRIGGER_ID,
        trigger: container,
        start: 'top top',
        end: `+=${scrollDistance}`,
        pin: true,
        scrub,
        animation: tween,
        anticipatePin: 1,
        fastScrollEnd: true,
        preventOverlaps: true,
      });
    }, container);

    // Initial frame trigger at progress 0
    onProgressRef.current(0, 1, 0);

    return () => {
      ctx.revert();
      if (triggerInstance) {
        triggerInstance.kill(true);
        triggerInstance = null;
      }
      const leftover = ScrollTrigger.getById(SCROLL_TRIGGER_ID);
      if (leftover) {
        leftover.kill(true);
      }
      ScrollTrigger.refresh();
    };
  }, [enabled, containerRef, scrub, scrollDistance]);
}
