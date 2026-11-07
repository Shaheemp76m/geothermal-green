import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ContinuousFrameSequence } from './components/ContinuousFrameSequence';
import { useImageSequenceLoader } from './hooks/useImageSequenceLoader';
import { TOTAL_FRAMES } from './framesData';

gsap.registerPlugin(ScrollTrigger);

// Configurable scroll distance (approx. 8 pixels per frame for smooth scroll feel)
const SCROLL_DISTANCE_PX = Math.max(3500, TOTAL_FRAMES * 8);

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  const {
    isInitialReady,
    getCachedFrame,
    getClosestLoadedFrame,
    loadFrame,
    requestFrames
  } = useImageSequenceLoader();

  // Setup GSAP ScrollTrigger
  useEffect(() => {
    if (!isInitialReady) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: `+=${SCROLL_DISTANCE_PX}`,
        pin: stageRef.current,
        scrub: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const progress = self.progress;
          const frameIndex = Math.round(progress * (TOTAL_FRAMES - 1));
          const safeFrameIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameIndex));
          setCurrentFrameIndex(safeFrameIndex);
        }
      });
    }, containerRef);

    // Refresh ScrollTrigger after DOM has settled
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
        backgroundColor: '#08090B',
        minHeight: '100vh',
        position: 'relative'
      }}
    >
      {/* Pinned full-screen visual stage */}
      <div
        ref={stageRef}
        style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: '#08090B',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        <ContinuousFrameSequence
          frameIndex={currentFrameIndex}
          getCachedFrame={getCachedFrame}
          getClosestLoadedFrame={getClosestLoadedFrame}
          loadFrame={loadFrame}
          requestFrames={requestFrames}
          style={{ width: '100%', height: '100%' }}
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
              backgroundColor: '#08090B',
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
