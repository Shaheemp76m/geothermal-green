/**
 * canvasRenderer.ts
 *
 * Manages a single HTML Canvas element.
 *
 * Responsibilities:
 *  - Cover-fit image scaling (preserves aspect ratio, fills viewport).
 *  - Latest-frame-wins rendering: coalesces rapid requests via rAF.
 *  - Tracks the last drawn frame to avoid redundant redraws.
 *  - Device pixel ratio handling (capped at 1.5 for performance).
 */

export const MAX_DPR = 1.5;

export interface RendererState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  lastDrawnUrl: string | null;
  rafHandle: number | null;
  pendingUrl: string | null;
}

export function createRenderer(canvas: HTMLCanvasElement): RendererState {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  return {
    canvas,
    ctx,
    lastDrawnUrl: null,
    rafHandle: null,
    pendingUrl: null,
  };
}

/**
 * Resize the canvas to match the container while respecting DPR.
 * Returns true if the canvas was actually resized.
 */
export function resizeCanvas(state: RendererState): boolean {
  const canvas = state.canvas;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const targetW = Math.round(width * dpr);
  const targetH = Math.round(height * dpr);

  if (canvas.width === targetW && canvas.height === targetH) return false;

  canvas.width = targetW;
  canvas.height = targetH;
  state.ctx.scale(dpr, dpr);
  // After resize, force a redraw
  state.lastDrawnUrl = null;
  return true;
}

/**
 * Schedule a draw request. If the image is provided directly, draw it.
 * If not, record the pending URL so the caller can retry when it loads.
 * Uses latest-frame-wins: only the most recently requested frame is drawn.
 */
export function scheduleFrame(
  state: RendererState,
  url: string,
  image: HTMLImageElement | null
): void {
  state.pendingUrl = url;

  if (!image) return; // Will be drawn when image loads

  if (state.rafHandle !== null) {
    cancelAnimationFrame(state.rafHandle);
  }

  state.rafHandle = requestAnimationFrame(() => {
    state.rafHandle = null;
    // Only draw if this is still the latest requested frame
    if (state.pendingUrl === url) {
      drawFrame(state, image);
      state.pendingUrl = null;
    }
  });
}

/**
 * Draw an image using cover-fit scaling on the canvas.
 */
export function drawFrame(
  state: RendererState,
  image: HTMLImageElement
): void {
  const { canvas, ctx } = state;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const displayW = canvas.width / dpr;
  const displayH = canvas.height / dpr;

  const imgW = image.naturalWidth || image.width;
  const imgH = image.naturalHeight || image.height;

  if (imgW === 0 || imgH === 0 || displayW === 0 || displayH === 0) return;

  // Cover-fit: scale to fill the canvas, cropping symmetrically
  const scale = Math.max(displayW / imgW, displayH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = (displayW - drawW) / 2;
  const offsetY = (displayH - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, offsetX, offsetY, drawW, drawH);

  state.lastDrawnUrl = image.src;
}

/**
 * Fill the canvas with the background colour (used before first frame loads).
 */
export function fillBackground(state: RendererState, color = '#101114'): void {
  const { canvas, ctx } = state;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
}
