/**
 * ScrollIndicator.tsx
 *
 * Minimal animated scroll hint shown at the beginning.
 * Fades out once the user starts scrolling.
 */

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface ScrollIndicatorProps {
  visible: boolean;
}

export function ScrollIndicator({ visible }: ScrollIndicatorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (visible) {
      gsap.set(ref.current, { opacity: 0, display: 'flex' });
      gsap.to(ref.current, { opacity: 1, duration: 1, delay: 0.8 });
    } else {
      gsap.to(ref.current, {
        opacity: 0,
        y: 10,
        duration: 0.4,
        onComplete: () => {
          if (ref.current) ref.current.style.display = 'none';
        },
      });
    }
  }, [visible]);

  return (
    <div ref={ref} style={containerStyle}>
      <span style={labelStyle}>Scroll to explore</span>
      <svg width="24" height="40" viewBox="0 0 24 40" fill="none">
        <rect x="1" y="1" width="22" height="38" rx="11" stroke="#A6A7A3" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" fill="#E89A42">
          <animateMotion
            dur="1.6s"
            repeatCount="indefinite"
            path="M 0 0 L 0 14"
          />
          <animate
            attributeName="opacity"
            values="1;0"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 36,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  pointerEvents: 'none',
  opacity: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  letterSpacing: '0.2em',
  color: '#A6A7A3',
  textTransform: 'uppercase',
};
