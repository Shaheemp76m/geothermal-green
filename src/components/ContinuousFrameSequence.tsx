import React, { useRef, useEffect, useCallback } from 'react';
import { TOTAL_FRAMES, ORIGINAL_ASPECT_RATIO } from '../framesData';

export interface ContinuousFrameSequenceProps {
  frameIndex: number;
  getCachedFrame: (index: number) => HTMLImageElement | null;
  getClosestLoadedFrame: (index: number) => HTMLImageElement | null;
  loadFrame: (index: number) => Promise<HTMLImageElement>;
  requestFrames: (index: number) => void;
  bgTopColor?: string;
  bgBottomColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const ContinuousFrameSequence: React.FC<ContinuousFrameSequenceProps> = ({
  frameIndex,
  getCachedFrame,
  getClosestLoadedFrame,
  loadFrame,
  requestFrames,
  bgTopColor = '#adb0b1',
  bgBottomColor = '#cbcfce',
  className,
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const lastRenderedIndexRef = useRef<number | null>(null);
  const lastRenderedImgRef = useRef<HTMLImageElement | null>(null);
  const lastDimensionsRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 0 });
  const lastBgRef = useRef<{ top: string; bot: string }>({ top: '', bot: '' });
  const rafIdRef = useRef<number | null>(null);
  const activeTargetIndexRef = useRef<number>(frameIndex);

  activeTargetIndexRef.current = frameIndex;

  // Draw an image onto the canvas using contain logic, studio gradient background & high-DPI scaling
  const drawImageToCanvas = useCallback((img: HTMLImageElement, targetIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw === 0 || ch === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelW = Math.round(cw * dpr);
    const pixelH = Math.round(ch * dpr);

    // Update canvas buffer size if client size or DPR changed
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Contain aspect ratio calculations
    const canvasAspect = cw / ch;
    let drawW: number;
    let drawH: number;

    if (canvasAspect > ORIGINAL_ASPECT_RATIO) {
      // Window is wider than 16:9
      drawH = ch;
      drawW = ch * ORIGINAL_ASPECT_RATIO;
    } else {
      // Window is taller than 16:9
      drawW = cw;
      drawH = cw / ORIGINAL_ASPECT_RATIO;
    }

    const drawX = (cw - drawW) / 2;
    const drawY = (ch - drawH) / 2;

    // Fill background with aligned studio gradient to avoid visible letterbox borders
    if (drawY > 0) {
      ctx.fillStyle = bgTopColor;
      ctx.fillRect(0, 0, cw, drawY + 1);
    }
    if (drawY + drawH < ch) {
      ctx.fillStyle = bgBottomColor;
      ctx.fillRect(0, drawY + drawH - 1, cw, ch - (drawY + drawH) + 1);
    }

    const bgGradient = ctx.createLinearGradient(0, Math.max(0, drawY), 0, Math.min(ch, drawY + drawH));
    bgGradient.addColorStop(0, bgTopColor);
    bgGradient.addColorStop(1, bgBottomColor);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, drawY, cw, drawH);

    // Draw the machinery
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    lastRenderedIndexRef.current = targetIndex;
    lastRenderedImgRef.current = img;
    lastDimensionsRef.current = { w: cw, h: ch, dpr };
    lastBgRef.current = { top: bgTopColor, bot: bgBottomColor };
  }, [bgTopColor, bgBottomColor]);

  // Render loop / update handler
  const renderCurrent = useCallback((targetIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const dimsChanged =
      lastDimensionsRef.current.w !== cw ||
      lastDimensionsRef.current.h !== ch ||
      lastDimensionsRef.current.dpr !== dpr;

    const bgChanged =
      lastBgRef.current.top !== bgTopColor ||
      lastBgRef.current.bot !== bgBottomColor;

    // Request upcoming frames around target
    requestFrames(targetIndex);

    // Check if target frame is cached
    const exactImg = getCachedFrame(targetIndex);

    if (exactImg) {
      if (
        lastRenderedIndexRef.current !== targetIndex ||
        dimsChanged ||
        bgChanged ||
        lastRenderedImgRef.current !== exactImg
      ) {
        drawImageToCanvas(exactImg, targetIndex);
      }
      return;
    }

    // If target is not ready yet:
    // Safe fallback: render closest frame if we don't have anything rendered yet
    if (!lastRenderedImgRef.current || dimsChanged || bgChanged) {
      const fallbackImg = getClosestLoadedFrame(targetIndex);
      if (fallbackImg) {
        drawImageToCanvas(fallbackImg, targetIndex);
      }
    }

    // Load the target frame asynchronously and render as soon as it arrives
    loadFrame(targetIndex).then((loadedImg) => {
      // Only draw if this target is still the active frame or if no newer exact frame has rendered
      if (activeTargetIndexRef.current === targetIndex) {
        drawImageToCanvas(loadedImg, targetIndex);
      }
    }).catch(() => {
      // Graceful error handling: keep showing previous frame
    });
  }, [getCachedFrame, getClosestLoadedFrame, loadFrame, requestFrames, drawImageToCanvas, bgTopColor, bgBottomColor]);

  // Handle frameIndex or background changes via requestAnimationFrame
  useEffect(() => {
    const safeIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameIndex));
    activeTargetIndexRef.current = safeIndex;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      renderCurrent(safeIndex);
      rafIdRef.current = null;
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [frameIndex, renderCurrent]);

  // Handle window and element resize
  useEffect(() => {
    const handleResize = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        renderCurrent(activeTargetIndexRef.current);
        rafIdRef.current = null;
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [renderCurrent]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};
