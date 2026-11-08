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
  const [isReady, setIsReady] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

  const phaseLabel = getPhaseLabel(progressValue);
  const frameNum = progressToGlobalIndex(progressValue) + 1;

  const handleFirstFrameReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const { canvasRef, setProgress } = useImageSequence({
    onFirstFrameReady: handleFirstFrameReady,
  });

  const handleProgress = useCallback(
    (progress: number, direction: number) => {
      setProgress(progress, direction);
      setProgressValue(progress);
      if (progress > 0.005 && !hasScrolled) {
        setHasScrolled(true);
      }
    },
    [setProgress, hasScrolled]
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
          <span style={phaseNumStyle}>PHASE {phaseLabel.phase}</span>
          <span style={phaseTitleStyle}>{phaseLabel.title}</span>
        </div>

        {/* GEOTHERM-X wordmark — top right */}
        <div style={wordmarkStyle}>GEOTHERM&#8209;X</div>

        {/* Frame counter — bottom right (subtle dev reference) */}
        <div style={frameCounterStyle}>
          {String(frameNum).padStart(3, '0')} / {totalFrames}
        </div>

        {/* Progress bar — bottom edge */}
        <div style={progressBarTrackStyle}>
          <div
            style={{
              ...progressBarFillStyle,
              width: `${progressValue * 100}%`,
            }}
          />
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
  height: '100%',
  backgroundColor: '#E89A42',
  transition: 'width 0.08s linear',
  willChange: 'width',
};
