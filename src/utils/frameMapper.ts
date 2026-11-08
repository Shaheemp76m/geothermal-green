/**
 * frameMapper.ts
 *
 * Maps global scroll progress [0, 1] to the correct phase and frame index
 * across all three phases, selecting only distinct frames in chronological
 * order to eliminate the every-5th-frame stutter caused by GIF rate conversion.
 *
 * Asset inventory:
 *   Raw frames on disk:
 *     Phase 01 — 269 frames (1920×1080 JPG)
 *     Phase 02 — 118 frames (1920×1080 JPG)
 *     Phase 03 — 179 frames (1920×1080 JPG)
 *     Raw total: 566 frames
 *
 * Consecutive duplicate analysis:
 *   Every 5th frame starting at frame 13 (frames 13, 18, 23, 28, ...) is an
 *   exact byte-for-byte duplicate of the preceding frame (12, 17, 22, 27, ...).
 *   - Phase 01: 52 duplicates removed -> 217 unique frames (1..269)
 *   - Phase 02: 22 duplicates removed -> 96 unique frames (1..117)
 *   - Phase 03: 34 duplicates removed -> 145 unique frames (1..179)
 *   - Total unique sequence: 217 + 96 + 145 = 458 distinct frames
 */

export interface FrameLocation {
  phase: 1 | 2 | 3;
  localIndex: number; // 0-based index within the phase's unique frames
  globalIndex: number; // 0-based index across all unique frames
  frameNumber?: number; // 1-based original file frame number on disk
}

export interface SequenceConfig {
  phase1Count: number;
  phase2Count: number;
  phase3Count: number;
  totalFrames: number;
  rawPhase1Count?: number;
  rawPhase2Count?: number;
  rawPhase3Count?: number;
  rawTotalFrames?: number;
}

export interface FrameDescriptor {
  phase: 1 | 2 | 3;
  localIndex: number;
  globalIndex: number;
  frameNumber: number;
  url: string;
}

/**
 * 1-based frame numbers for unique frames in Phase 01 (217 frames).
 * Duplicates removed: 13, 18, 23, 28, ..., 268 (every 5th frame starting at 13).
 */
export const PHASE_1_UNIQUE_FRAMES: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22,
  24, 25, 26, 27, 29, 30, 31, 32, 34, 35, 36, 37, 39, 40, 41, 42, 44, 45, 46, 47,
  49, 50, 51, 52, 54, 55, 56, 57, 59, 60, 61, 62, 64, 65, 66, 67, 69, 70, 71, 72,
  74, 75, 76, 77, 79, 80, 81, 82, 84, 85, 86, 87, 89, 90, 91, 92, 94, 95, 96, 97,
  99, 100, 101, 102, 104, 105, 106, 107, 109, 110, 111, 112, 114, 115, 116, 117, 119, 120, 121, 122,
  124, 125, 126, 127, 129, 130, 131, 132, 134, 135, 136, 137, 139, 140, 141, 142, 144, 145, 146, 147,
  149, 150, 151, 152, 154, 155, 156, 157, 159, 160, 161, 162, 164, 165, 166, 167, 169, 170, 171, 172,
  174, 175, 176, 177, 179, 180, 181, 182, 184, 185, 186, 187, 189, 190, 191, 192, 194, 195, 196, 197,
  199, 200, 201, 202, 204, 205, 206, 207, 209, 210, 211, 212, 214, 215, 216, 217, 219, 220, 221, 222,
  224, 225, 226, 227, 229, 230, 231, 232, 234, 235, 236, 237, 239, 240, 241, 242, 244, 245, 246, 247,
  249, 250, 251, 252, 254, 255, 256, 257, 259, 260, 261, 262, 264, 265, 266, 267, 269,
];

/**
 * 1-based frame numbers for unique frames in Phase 02 (96 frames).
 * Duplicates removed: 13, 18, 23, 28, ..., 118 (every 5th frame starting at 13).
 */
export const PHASE_2_UNIQUE_FRAMES: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22,
  24, 25, 26, 27, 29, 30, 31, 32, 34, 35, 36, 37, 39, 40, 41, 42, 44, 45, 46, 47,
  49, 50, 51, 52, 54, 55, 56, 57, 59, 60, 61, 62, 64, 65, 66, 67, 69, 70, 71, 72,
  74, 75, 76, 77, 79, 80, 81, 82, 84, 85, 86, 87, 89, 90, 91, 92, 94, 95, 96, 97,
  99, 100, 101, 102, 104, 105, 106, 107, 109, 110, 111, 112, 114, 115, 116, 117,
];

/**
 * 1-based frame numbers for unique frames in Phase 03 (145 frames).
 * Duplicates removed: 13, 18, 23, 28, ..., 178 (every 5th frame starting at 13).
 */
export const PHASE_3_UNIQUE_FRAMES: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22,
  24, 25, 26, 27, 29, 30, 31, 32, 34, 35, 36, 37, 39, 40, 41, 42, 44, 45, 46, 47,
  49, 50, 51, 52, 54, 55, 56, 57, 59, 60, 61, 62, 64, 65, 66, 67, 69, 70, 71, 72,
  74, 75, 76, 77, 79, 80, 81, 82, 84, 85, 86, 87, 89, 90, 91, 92, 94, 95, 96, 97,
  99, 100, 101, 102, 104, 105, 106, 107, 109, 110, 111, 112, 114, 115, 116, 117, 119, 120, 121, 122,
  124, 125, 126, 127, 129, 130, 131, 132, 134, 135, 136, 137, 139, 140, 141, 142, 144, 145, 146, 147,
  149, 150, 151, 152, 154, 155, 156, 157, 159, 160, 161, 162, 164, 165, 166, 167, 169, 170, 171, 172,
  174, 175, 176, 177, 179,
];

/**
 * Mapping from phase number (1, 2, 3) to its list of unique 1-based frame numbers.
 */
export const DEDUPLICATED_FRAMES: Record<1 | 2 | 3, readonly number[]> = {
  1: PHASE_1_UNIQUE_FRAMES,
  2: PHASE_2_UNIQUE_FRAMES,
  3: PHASE_3_UNIQUE_FRAMES,
};

/**
 * Flat array of all 458 deduplicated frame descriptors in chronological order.
 */
export const DEDUPLICATED_FRAME_INDEX_LIST: readonly FrameDescriptor[] = (() => {
  const list: FrameDescriptor[] = [];
  let globalIdx = 0;
  for (const phase of [1, 2, 3] as const) {
    const frames = DEDUPLICATED_FRAMES[phase];
    for (let localIdx = 0; localIdx < frames.length; localIdx++) {
      const frameNum = frames[localIdx];
      const padded = String(frameNum).padStart(3, '0');
      list.push({
        phase,
        localIndex: localIdx,
        globalIndex: globalIdx++,
        frameNumber: frameNum,
        url: `/sequences/phase-0${phase}/ezgif-frame-${padded}.jpg`,
      });
    }
  }
  return Object.freeze(list);
})();

export const SEQUENCE_CONFIG: SequenceConfig = {
  phase1Count: PHASE_1_UNIQUE_FRAMES.length, // 217
  phase2Count: PHASE_2_UNIQUE_FRAMES.length, // 96
  phase3Count: PHASE_3_UNIQUE_FRAMES.length, // 145
  totalFrames:
    PHASE_1_UNIQUE_FRAMES.length +
    PHASE_2_UNIQUE_FRAMES.length +
    PHASE_3_UNIQUE_FRAMES.length, // 458 unique frames
  rawPhase1Count: 269,
  rawPhase2Count: 118,
  rawPhase3Count: 179,
  rawTotalFrames: 269 + 118 + 179, // 566 raw frames
};

/**
 * Map a global unique frame index (0-based, 0..totalFrames-1) to its phase, local unique index,
 * and corresponding file frame number on disk.
 */
export function globalIndexToLocation(globalIndex: number): FrameLocation {
  const { phase1Count, phase2Count, totalFrames } = SEQUENCE_CONFIG;
  const idx = Math.max(0, Math.min(globalIndex, totalFrames - 1));

  if (idx < phase1Count) {
    return {
      phase: 1,
      localIndex: idx,
      globalIndex: idx,
      frameNumber: PHASE_1_UNIQUE_FRAMES[idx],
    };
  }

  if (idx < phase1Count + phase2Count) {
    const localIdx = idx - phase1Count;
    return {
      phase: 2,
      localIndex: localIdx,
      globalIndex: idx,
      frameNumber: PHASE_2_UNIQUE_FRAMES[localIdx],
    };
  }

  const localIdx = idx - phase1Count - phase2Count;
  return {
    phase: 3,
    localIndex: localIdx,
    globalIndex: idx,
    frameNumber: PHASE_3_UNIQUE_FRAMES[localIdx],
  };
}

/**
 * Map scroll progress [0, 1] to a global unique frame index [0, totalFrames - 1].
 */
export function progressToGlobalIndex(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  const { totalFrames } = SEQUENCE_CONFIG;
  return Math.round(clamped * (totalFrames - 1));
}

/**
 * Build the URL for a given phase and 0-based local index into the unique frame sequence.
 */
export function frameUrl(phase: 1 | 2 | 3, localIndex: number): string {
  const frames = DEDUPLICATED_FRAMES[phase];
  const safeIndex = Math.max(0, Math.min(localIndex, frames.length - 1));
  const frameNum = frames[safeIndex];
  const padded = String(frameNum).padStart(3, '0');
  return `/sequences/phase-0${phase}/ezgif-frame-${padded}.jpg`;
}

/**
 * Map scroll progress directly to a frame URL (convenience wrapper).
 */
export function progressToFrameUrl(progress: number): string {
  const globalIndex = progressToGlobalIndex(progress);
  const location = globalIndexToLocation(globalIndex);
  return frameUrl(location.phase, location.localIndex);
}
