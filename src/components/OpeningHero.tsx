import React, { useMemo } from 'react';

export interface OpeningHeroProps {
  heroProgress: number; // 0 to 1
  prefersReducedMotion?: boolean;
}

export const OpeningHero: React.FC<OpeningHeroProps> = ({
  heroProgress,
  prefersReducedMotion = false
}) => {
  // Compute visual state based on heroProgress (0 to 1)
  const { headlineOpacity, headlineY, introOpacity, introY, introColor } = useMemo(() => {
    // 1. Headline: "WAIT. WE ARE DESTROYING NATURE."
    // 0.00 - 0.15: Fully visible
    // 0.15 - 0.38: Fades and moves out
    // > 0.38: Fully hidden
    let hOpacity = 0;
    let hY = 0;

    if (heroProgress <= 0.15) {
      hOpacity = 1;
      hY = 0;
    } else if (heroProgress < 0.38) {
      const t = (heroProgress - 0.15) / (0.38 - 0.15);
      hOpacity = Math.max(0, 1 - t);
      hY = prefersReducedMotion ? 0 : -35 * t;
    } else {
      hOpacity = 0;
      hY = prefersReducedMotion ? 0 : -35;
    }

    // 2. INTRODUCING Title
    // < 0.40: Hidden
    // 0.40 - 0.55: Enters (fades in, moves up)
    // 0.55 - 0.75: Fully visible and stable
    // 0.75 - 0.90: Exits (fades out, moves up)
    // > 0.90: Hidden
    let iOpacity = 0;
    let iY = 0;

    if (heroProgress < 0.40) {
      iOpacity = 0;
      iY = prefersReducedMotion ? 0 : 30;
    } else if (heroProgress <= 0.55) {
      const t = (heroProgress - 0.40) / (0.55 - 0.40);
      iOpacity = Math.min(1, Math.max(0, t));
      iY = prefersReducedMotion ? 0 : 30 * (1 - t);
    } else if (heroProgress <= 0.75) {
      iOpacity = 1;
      iY = 0;
    } else if (heroProgress < 0.90) {
      const t = (heroProgress - 0.75) / (0.90 - 0.75);
      iOpacity = Math.max(0, 1 - t);
      iY = prefersReducedMotion ? 0 : -25 * t;
    } else {
      iOpacity = 0;
      iY = prefersReducedMotion ? 0 : -25;
    }

    // Dynamic contrast color for INTRODUCING:
    // When background is mid-charcoal (< 0.55), white offers > 5:1 contrast
    // As background floods with silver-grey (> 0.65), dark charcoal (#0A0B0E) offers > 6:1 to 9:1 contrast
    const colorT = Math.max(0, Math.min(1, (heroProgress - 0.48) / 0.18));
    const textR = Math.round(255 - colorT * (255 - 10));
    const textG = Math.round(255 - colorT * (255 - 11));
    const textB = Math.round(255 - colorT * (255 - 14));
    const iColor = `rgb(${textR}, ${textG}, ${textB})`;

    return {
      headlineOpacity: hOpacity,
      headlineY: hY,
      introOpacity: iOpacity,
      introY: iY,
      introColor: iColor
    };
  }, [heroProgress, prefersReducedMotion]);

  // Don't render anything once both titles are fully invisible
  if (headlineOpacity <= 0 && introOpacity <= 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 5,
        userSelect: 'none'
      }}
    >
      {/* 1. Opening Headline: WAIT. WE ARE DESTROYING NATURE. */}
      {headlineOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            opacity: headlineOpacity,
            transform: `translate3d(0, ${headlineY}px, 0)`,
            willChange: 'opacity, transform',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '1.5rem',
            maxWidth: '92vw'
          }}
        >
          <div
            style={{
              fontFamily:
                'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: 850,
              fontSize: 'clamp(2.1rem, 7.8vw, 6.2rem)',
              lineHeight: 0.94,
              letterSpacing: '-0.035em',
              textTransform: 'uppercase',
              color: '#F8F9FA'
            }}
          >
            <div style={{ whiteSpace: 'nowrap' }}>WAIT.</div>
            <div style={{ whiteSpace: 'nowrap' }}>WE ARE</div>
            <div style={{ whiteSpace: 'nowrap' }}>DESTROYING</div>
            <div
              style={{
                whiteSpace: 'nowrap',
                color: '#E07A2C' // Restrained warm amber/orange accent
              }}
            >
              NATURE.
            </div>
          </div>
        </div>
      )}

      {/* 2. Transition Title: INTRODUCING */}
      {introOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            opacity: introOpacity,
            transform: `translate3d(0, ${introY}px, 0)`,
            willChange: 'opacity, transform',
            textAlign: 'center',
            padding: '1.5rem',
            maxWidth: '92vw'
          }}
        >
          <h1
            style={{
              fontFamily:
                'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: 850,
              fontSize: 'clamp(1.9rem, 7.2vw, 5.2rem)',
              lineHeight: 1.0,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: introColor,
              margin: 0
            }}
          >
            INTRODUCING
          </h1>
        </div>
      )}
    </div>
  );
};
