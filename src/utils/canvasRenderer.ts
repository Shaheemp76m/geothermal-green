/**
 * canvasRenderer.ts
 *
 * Manages a single HTML Canvas element.
 *
 * Responsibilities:
 *  - Cover-fit image scaling (preserves aspect ratio, fills viewport).
 *  - Latest-frame-wins rendering: coalesces rapid requests via rAF.
 *  - Discards obsolete frame requests cleanly to prevent stutter and tearing.
 *  - Seamlessly draws both ImageBitmap and HTMLImageElement.
 *  - ImageBitmap leverages pre-decoded GPU/memory textures for sub-millisecond blitting.
 *  - Device pixel ratio handling (capped at 1.5 for performance).
 */

export const MAX_DPR = 1.5;

export type DrawableFrame = ImageBitmap | HTMLImageElement;

export interface RendererState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  lastDrawnUrl: string | null;
  rafHandle: number | null;
  pendingUrl: string | null;
}

export function createRenderer(canvas: HTMLCanvasElement): RendererState {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  return {
    canvas,
    ctx,
    dpr,
    lastDrawnUrl: null,
    rafHandle: null,
    pendingUrl: null,
  };
}

/**
 * Resize the canvas to match the container while respecting DPR cap.
 * Returns true if the canvas was actually resized.
 */
export function resizeCanvas(state: RendererState): boolean {
  const canvas = state.canvas;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const targetW = Math.round(width * dpr);
  const targetH = Math.round(height * dpr);

  if (canvas.width === targetW && canvas.height === targetH && state.dpr === dpr) {
    return false;
  }

  canvas.width = targetW;
  canvas.height = targetH;
  state.dpr = dpr;
  state.ctx.scale(dpr, dpr);
  // After resize, force a redraw
  state.lastDrawnUrl = null;
  return true;
}

/**
 * Extract intrinsic width and height from either an ImageBitmap or HTMLImageElement.
 */
function getFrameDimensions(frame: DrawableFrame): { width: number; height: number } {
  if ('naturalWidth' in frame && frame.naturalWidth > 0 && frame.naturalHeight > 0) {
    return { width: frame.naturalWidth, height: frame.naturalHeight };
  }
  return { width: frame.width, height: frame.height };
}

/**
 * Cancel any pending animation frame and clear pending draw state.
 */
export function cancelPendingFrame(state: RendererState): void {
  if (state.rafHandle !== null) {
    cancelAnimationFrame(state.rafHandle);
    state.rafHandle = null;
  }
  state.pendingUrl = null;
}

/**
 * Schedule a draw request. If the frame is provided directly, queue it via rAF.
 * If not, record the pending URL so the caller can retry when it loads.
 * Uses latest-frame-wins coalescing via rAF: obsolete requests are discarded cleanly.
 */
export function scheduleFrame(
  state: RendererState,
  url: string,
  image: DrawableFrame | null
): void {
  // If this frame is already displayed and no pending draw is waiting, skip redundant work
  if (state.lastDrawnUrl === url && state.pendingUrl === null) {
    return;
  }

  // If this exact URL is already queued for the next animation frame with an image, avoid rescheduling
  if (state.pendingUrl === url && state.rafHandle !== null && image) {
    return;
  }

  state.pendingUrl = url;

  // Frame is still loading: discard any obsolete pending rAF draw
  if (!image) {
    if (state.rafHandle !== null) {
      cancelAnimationFrame(state.rafHandle);
      state.rafHandle = null;
    }
    return;
  }

  // Obsolete any previously scheduled rAF callback cleanly
  if (state.rafHandle !== null) {
    cancelAnimationFrame(state.rafHandle);
    state.rafHandle = null;
  }

  state.rafHandle = requestAnimationFrame(() => {
    state.rafHandle = null;
    // Only draw if this is still the latest requested frame
    if (state.pendingUrl === url) {
      drawFrame(state, image, url);
      state.pendingUrl = null;
    }
  });
}

/**
 * Draw a frame (ImageBitmap or HTMLImageElement) using cover-fit scaling on the canvas.
 * Drawing an ImageBitmap avoids main-thread decode spikes for sub-millisecond rendering.
 */
export function drawFrame(
  state: RendererState,
  image: DrawableFrame,
  url?: string
): void {
  const { canvas, ctx } = state;
  const dpr = state.dpr || Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const displayW = canvas.width / dpr;
  const displayH = canvas.height / dpr;

  const { width: imgW, height: imgH } = getFrameDimensions(image);

  if (imgW === 0 || imgH === 0 || displayW === 0 || displayH === 0) return;

  // Cover-fit: scale to fill the canvas, cropping symmetrically
  const scale = Math.max(displayW / imgW, displayH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = (displayW - drawW) / 2;
  const offsetY = (displayH - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  try {
    ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
    state.lastDrawnUrl =
      url ?? ('src' in image && typeof image.src === 'string' ? image.src : null);
  } catch {
    // Gracefully handle detached / closed ImageBitmap or invalid draw state
  }
}

/**
 * Fill the canvas with the background colour (used before first frame loads).
 */
export function fillBackground(state: RendererState, color = '#101114'): void {
  const { canvas, ctx } = state;
  const dpr = state.dpr || Math.min(window.devicePixelRatio || 1, MAX_DPR);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  state.lastDrawnUrl = null;
}
