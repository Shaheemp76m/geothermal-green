/**
 * AnimationCanvas.tsx
 *
 * The single HTML canvas that renders the image sequence.
 * Occupies the full viewport with cover-fit scaling.
 */

import { forwardRef } from 'react';

interface AnimationCanvasProps {
  style?: React.CSSProperties;
}

export const AnimationCanvas = forwardRef<HTMLCanvasElement | null, AnimationCanvasProps>(
  ({ style }, ref) => {
    return (
      <canvas
        ref={ref}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          ...style,
        }}
      />
    );
  }
);

AnimationCanvas.displayName = 'AnimationCanvas';
