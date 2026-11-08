/**
 * frameMapper.ts
 *
 * Maps global scroll progress [0, 1] to the correct phase and frame index
 * across all three phases, accounting for shared boundary frames if any.
 *
 * Asset inventory (determined from ZIP inspection):
 *   Phase 01 — 269 frames  (1920×1080 JPG, avg 43.6 KB)
 *   Phase 02 — 118 frames  (1920×1080 JPG, avg 63.0 KB)
 *   Phase 03 — 179 frames  (1920×1080 JPG, avg 38.8 KB)
 *
 * Boundary analysis:
 *   Phase 01 last frame  != Phase 02 first frame  (no shared boundary)
 *   Phase 02 last frame  != Phase 03 first frame  (no shared boundary)
 *
 * Duplicate frames per phase (every 5th frame, GIF conversion artifact):
 *   Phase 01: 52 duplicate pairs
 *   Phase 02: 22 duplicate pairs
 *   Phase 03: 34 duplicate pairs
 *   These are intentional source duplicates and are preserved as-is.
 *
 * Total sequence: 269 + 118 + 179 = 566 frames
 */

export interface FrameLocation {
  phase: 1 | 2 | 3;
  localIndex: number; // 0-based index within the phase
  globalIndex: number; // 0-based index across all frames
}

export interface SequenceConfig {
  phase1Count: number;
  phase2Count: number;
  phase3Count: number;
  totalFrames: number;
}

export const SEQUENCE_CONFIG: SequenceConfig = {
  phase1Count: 269,
  phase2Count: 118,
  phase3Count: 179,
  totalFrames: 269 + 118 + 179, // 566
};

/**
 * Map a global frame index (0-based) to its phase and local index.
 */
export function globalIndexToLocation(globalIndex: number): FrameLocation {
  const { phase1Count, phase2Count } = SEQUENCE_CONFIG;
  const idx = Math.max(0, Math.min(globalIndex, SEQUENCE_CONFIG.totalFrames - 1));

  if (idx < phase1Count) {
    return { phase: 1, localIndex: idx, globalIndex: idx };
  }

  if (idx < phase1Count + phase2Count) {
    return { phase: 2, localIndex: idx - phase1Count, globalIndex: idx };
  }

  return {
    phase: 3,
    localIndex: idx - phase1Count - phase2Count,
    globalIndex: idx,
  };
}

/**
 * Map scroll progress [0, 1] to a global frame index.
 */
export function progressToGlobalIndex(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  const { totalFrames } = SEQUENCE_CONFIG;
  return Math.round(clamped * (totalFrames - 1));
}

/**
 * Build the URL for a given phase and 0-based local index.
 */
export function frameUrl(phase: 1 | 2 | 3, localIndex: number): string {
  const phaseDir = `phase-0${phase}`;
  const frameNum = String(localIndex + 1).padStart(3, '0');
  return `/sequences/${phaseDir}/ezgif-frame-${frameNum}.jpg`;
}

/**
 * Map scroll progress directly to a URL (convenience wrapper).
 */
export function progressToFrameUrl(progress: number): string {
  const globalIndex = progressToGlobalIndex(progress);
  const location = globalIndexToLocation(globalIndex);
  return frameUrl(location.phase, location.localIndex);
}
