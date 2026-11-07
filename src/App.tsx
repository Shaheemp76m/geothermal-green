import React, { useState, useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ContinuousFrameSequence } from './components/ContinuousFrameSequence';
import { OpeningHero } from './components/OpeningHero';
import { useImageSequenceLoader } from './hooks/useImageSequenceLoader';
import { TOTAL_FRAMES } from './framesData';

gsap.registerPlugin(ScrollTrigger);

// Measured scroll distances
const HERO_SCROLL_PX = 2000;
const ANIMATION_SCROLL_PX = Math.max(3500, TOTAL_FRAMES * 8); // 4512px
const TOTAL_SCROLL_PX = HERO_SCROLL_PX + ANIMATION_SCROLL_PX; // 6512px
const HERO_RATIO = HERO_SCROLL_PX / TOTAL_SCROLL_PX; // ~0.3071

// Sampled color coordinates
// Opening charcoal starting tone: #111216
const START_BG: [number, number, number] = [17, 18, 22];
// First frame exact background top & bottom studio lighting gradient
// Top edge: #adb0b1
const TARGET_TOP: [number, number, number] = [173, 176, 177];
// Bottom edge: #cbcfce
const TARGET_BOT: [number, number, number] = [203, 207, 206];

function interpolateRGB(
  c1: [number, number, number],
  c2: [number, number, number],
  factor: number
): [number, number, number] {
  const f = Math.max(0, Math.min(1, factor));
  return [
    Math.round(c1[0] + f * (c2[0] - c1[0])),
    Math.round(c1[1] + f * (c2[1] - c1[1])),
    Math.round(c1[2] + f * (c2[2] - c1[2]))
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`;
}

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [heroProgress, setHeroProgress] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const {
    isInitialReady,
    getCachedFrame,
    getClosestLoadedFrame,
    loadFrame,
    requestFrames
  } = useImageSequenceLoader();

  // Detect user preference for reduced motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Compute dynamic stage background and canvas opacity
  const { topColorHex, botColorHex, canvasOpacity, stageBackground } = useMemo(() => {
    // Background transition factor bgT (0 = charcoal #111216, 1 = studio gradient)
    // Runs between 15% and 90% of hero scroll
    let bgT = 0;
    if (heroProgress <= 0.15) {
      bgT = 0;
    } else if (heroProgress < 0.90) {
      bgT = (heroProgress - 0.15) / (0.90 - 0.15);
    } else {
      bgT = 1.0;
    }

    const currentTop = interpolateRGB(START_BG, TARGET_TOP, bgT);
    const currentBot = interpolateRGB(START_BG, TARGET_BOT, bgT);

    const topHex = rgbToHex(currentTop);
    const botHex = rgbToHex(currentBot);

    // Canvas opacity: machinery appears as INTRODUCING exits (0.75 - 0.92)
    let cOpacity = 0;
    if (heroProgress < 0.75) {
      cOpacity = 0;
    } else if (heroProgress < 0.92) {
      cOpacity = (heroProgress - 0.75) / (0.92 - 0.75);
    } else {
      cOpacity = 1.0;
    }

    return {
      topColorHex: topHex,
      botColorHex: botHex,
      canvasOpacity: cOpacity,
      stageBackground: `linear-gradient(180deg, ${topHex} 0%, ${botHex} 100%)`
    };
  }, [heroProgress]);

  // Setup single unified GSAP ScrollTrigger
  useEffect(() => {
    if (!isInitialReady) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: `+=${TOTAL_SCROLL_PX}`,
        pin: stageRef.current,
        scrub: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const progress = self.progress;

          if (progress <= HERO_RATIO) {
            // Within opening hero phase
            const hProg = progress / HERO_RATIO;
            setHeroProgress(hProg);
            setCurrentFrameIndex(0);
          } else {
            // Within geothermal animation phase
            setHeroProgress(1.0);
            const animProgress = (progress - HERO_RATIO) / (1 - HERO_RATIO);
            const frameIndex = Math.round(animProgress * (TOTAL_FRAMES - 1));
            const safeFrameIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameIndex));
            setCurrentFrameIndex(safeFrameIndex);
          }
        }
      });
    }, containerRef);

    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
    };
  }, [isInitialReady]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        minHeight: '100vh',
        position: 'relative',
        backgroundColor: '#111216'
      }}
    >
      {/* Pinned full-screen visual stage */}
      <div
        ref={stageRef}
        style={{
          width: '100vw',
          height: '100vh',
          background: stageBackground,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        {/* Core continuous geothermal sequence canvas */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: canvasOpacity,
            willChange: 'opacity'
          }}
        >
          <ContinuousFrameSequence
            frameIndex={currentFrameIndex}
            getCachedFrame={getCachedFrame}
            getClosestLoadedFrame={getClosestLoadedFrame}
            loadFrame={loadFrame}
            requestFrames={requestFrames}
            bgTopColor={topColorHex}
            bgBottomColor={botColorHex}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Cinematic Opening Hero Typography Overlay */}
        <OpeningHero
          heroProgress={heroProgress}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* Minimal unobtrusive loader while initial frame is decoding */}
        {!isInitialReady && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#111216',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                border: '2px solid rgba(255, 255, 255, 0.15)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}
            />
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
