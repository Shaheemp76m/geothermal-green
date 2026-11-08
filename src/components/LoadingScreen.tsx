/**
 * LoadingScreen.tsx
 *
 * Minimal loading state shown before the first frame is ready.
 * Fades out once the animation canvas is ready to display.
 */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface LoadingScreenProps {
  isVisible: boolean;
}

export function LoadingScreen({ isVisible }: LoadingScreenProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!isVisible) {
      gsap.to(ref.current, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        onComplete: () => {
          if (ref.current) ref.current.style.display = 'none';
        },
      });
    }
  }, [isVisible]);

  return (
    <div ref={ref} style={containerStyle}>
      <div style={innerStyle}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 20 }}>
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="#E89A42"
            strokeWidth="2"
            strokeDasharray="80 40"
            strokeLinecap="round"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 24 24"
              to="360 24 24"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
        <span style={labelStyle}>GEOTHERM&#8209;X</span>
        <span style={subStyle}>Preparing sequence&hellip;</span>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#101114',
};

const innerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'SF Pro Display', 'Inter', system-ui, sans-serif",
  fontSize: '0.85rem',
  letterSpacing: '0.3em',
  color: '#E89A42',
  fontWeight: 600,
  textTransform: 'uppercase',
};

const subStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  letterSpacing: '0.15em',
  color: '#A6A7A3',
  textTransform: 'uppercase',
};
