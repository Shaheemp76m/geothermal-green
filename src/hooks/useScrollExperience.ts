/**
 * useScrollExperience.ts
 *
 * Binds GSAP ScrollTrigger to the image sequence progress.
 *
 * Architecture:
 *  - One continuous pinned ScrollTrigger controls progress [0, 1].
 *  - Progress is mapped to the global frame index via frameMapper.
 *  - Scrub provides direct 1:1 scroll-to-frame responsiveness.
 *  - Direction is tracked for prefetch optimisation.
 *
 * Scroll distance: 6000px default (configurable).
 */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const SCROLL_DISTANCE = 6000; // px of scroll travel

export interface UseScrollExperienceOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onProgress: (progress: number, direction: number) => void;
  enabled: boolean;
}

export function useScrollExperience({
  containerRef,
  onProgress,
  enabled,
}: UseScrollExperienceOptions): void {
  const progressProxy = useRef({ value: 0 });
  const directionRef = useRef(1);
  const lastProgressRef = useRef(0);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    // Proxy object that GSAP animates — progress tween target
    progressProxy.current = { value: 0 };

    const tween = gsap.to(progressProxy.current, {
      value: 1,
      ease: 'none',
    });

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: `+=${SCROLL_DISTANCE}`,
      pin: true,
      scrub: 0.3,
      animation: tween,
      onUpdate: (self) => {
        const progress = self.progress;
        const direction = progress >= lastProgressRef.current ? 1 : -1;
        directionRef.current = direction;
        lastProgressRef.current = progress;
        onProgress(progress, direction);
      },
    });

    // Trigger initial frame at progress 0
    onProgress(0, 1);

    return () => {
      st.kill();
      tween.kill();
      ScrollTrigger.refresh();
    };
  }, [enabled, containerRef, onProgress]);
}
