/**
 * ScrollExperience.tsx
 *
 * The main orchestration component.
 *
 * Manages:
 *  - Loading state → scroll experience reveal
 *  - Canvas + scroll trigger binding
 *  - Phase label overlay
 *  - Scroll indicator visibility
 *  - Progress bar
 *
 * Performance note:
 *  Progress bar width, frame counter, and phase label are updated via direct DOM
 *  references inside handleProgress. This eliminates React component re-renders
 *  during active scrolling, freeing CPU time for smooth canvas frame rendering.
 */

import { useRef, useState, useCallback } from 'react';
import { AnimationCanvas } from './AnimationCanvas';
import { LoadingScreen } from './LoadingScreen';
import { ScrollIndicator } from './ScrollIndicator';
import { useImageSequence } from '../hooks/useImageSequence';
import { useScrollExperience } from '../hooks/useScrollExperience';
import { progressToGlobalIndex, SEQUENCE_CONFIG } from '../utils/frameMapper';

const { phase1Count, phase2Count, totalFrames } = SEQUENCE_CONFIG;

function getPhaseLabel(progress: number): { phase: string; title: string } {
  const globalIndex = progressToGlobalIndex(progress);
  if (globalIndex < phase1Count) {
    return { phase: '01', title: 'The Components' };
  }
  if (globalIndex < phase1Count + phase2Count) {
    return { phase: '02', title: 'The Complete System' };
  }
  return { phase: '03', title: 'The Descent' };
}

export function ScrollExperience() {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarFillRef = useRef<HTMLDivElement>(null);
  const phaseNumRef = useRef<HTMLSpanElement>(null);
  const phaseTitleRef = useRef<HTMLSpanElement>(null);
  const frameCounterRef = useRef<HTMLDivElement>(null);

  const lastFrameNumRef = useRef<number>(-1);
  const lastPhaseRef = useRef<string>('');
  const hasScrolledRef = useRef<boolean>(false);

  const [isReady, setIsReady] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  const handleFirstFrameReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const { canvasRef, setProgress } = useImageSequence({
    onFirstFrameReady: handleFirstFrameReady,
  });

  const handleProgress = useCallback(
    (progress: number, direction: number, velocity: number = 0) => {
      setProgress(progress, direction, velocity);

      // Direct DOM update: progress bar width
      if (progressBarFillRef.current) {
        progressBarFillRef.current.style.width = `${progress * 100}%`;
      }

      // Direct DOM update: frame counter
      const globalIndex = progressToGlobalIndex(progress);
      const frameNum = globalIndex + 1;
      if (frameNum !== lastFrameNumRef.current) {
        lastFrameNumRef.current = frameNum;
        if (frameCounterRef.current) {
          frameCounterRef.current.textContent = `${String(frameNum).padStart(3, '0')} / ${totalFrames}`;
        }
      }

      // Direct DOM update: phase indicators
      const phaseInfo = getPhaseLabel(progress);
      if (phaseInfo.phase !== lastPhaseRef.current) {
        lastPhaseRef.current = phaseInfo.phase;
        if (phaseNumRef.current) {
          phaseNumRef.current.textContent = `PHASE ${phaseInfo.phase}`;
        }
        if (phaseTitleRef.current) {
          phaseTitleRef.current.textContent = phaseInfo.title;
        }
      }

      // Fade out scroll indicator on initial scroll
      if (progress > 0.005 && !hasScrolledRef.current) {
        hasScrolledRef.current = true;
        setHasScrolled(true);
      }
    },
    [setProgress]
  );

  useScrollExperience({
    containerRef,
    onProgress: handleProgress,
    enabled: isReady,
  });

  return (
    <>
      <LoadingScreen isVisible={!isReady} />

      {/* Main scroll-pinned container */}
      <div ref={containerRef} style={containerStyle} className="no-select">
        {/* Canvas fills the entire viewport */}
        <AnimationCanvas ref={canvasRef} />

        {/* Phase label — top left */}
        <div style={phaseLabelStyle}>
          <span ref={phaseNumRef} style={phaseNumStyle}>
            PHASE 01
          </span>
          <span ref={phaseTitleRef} style={phaseTitleStyle}>
            The Components
          </span>
        </div>

        {/* GEOTHERM-X wordmark — top right */}
        <div style={wordmarkStyle}>GEOTHERM&#8209;X</div>

        {/* Frame counter — bottom right (subtle dev reference) */}
        <div ref={frameCounterRef} style={frameCounterStyle}>
          001 / {totalFrames}
        </div>

        {/* Progress bar — bottom edge */}
        <div style={progressBarTrackStyle}>
          <div ref={progressBarFillRef} style={progressBarFillStyle} />
        </div>
      </div>

      {/* Scroll indicator — fades when scrolling begins */}
      <ScrollIndicator visible={isReady && !hasScrolled} />
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100vw',
  height: '100vh',
  backgroundColor: '#101114',
  overflow: 'hidden',
};

const phaseLabelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 28,
  left: 32,
  zIndex: 5,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  pointerEvents: 'none',
};

const phaseNumStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  letterSpacing: '0.3em',
  color: '#E89A42',
  fontWeight: 700,
  textTransform: 'uppercase',
};

const phaseTitleStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  letterSpacing: '0.12em',
  color: '#F4F1E9',
  textTransform: 'uppercase',
  fontWeight: 400,
};

const wordmarkStyle: React.CSSProperties = {
  position: 'absolute',
  top: 28,
  right: 32,
  zIndex: 5,
  fontSize: '0.72rem',
  letterSpacing: '0.3em',
  color: 'rgba(244, 241, 233, 0.6)',
  fontWeight: 600,
  textTransform: 'uppercase',
  pointerEvents: 'none',
};

const frameCounterStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 20,
  right: 24,
  zIndex: 5,
  fontSize: '0.6rem',
  letterSpacing: '0.15em',
  color: 'rgba(166, 167, 163, 0.4)',
  fontVariantNumeric: 'tabular-nums',
  pointerEvents: 'none',
};

const progressBarTrackStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 2,
  backgroundColor: 'rgba(255,255,255,0.08)',
  zIndex: 5,
};

const progressBarFillStyle: React.CSSProperties = {
  width: '0%',
  height: '100%',
  backgroundColor: '#E89A42',
  transition: 'width 0.08s linear',
  willChange: 'width',
};
