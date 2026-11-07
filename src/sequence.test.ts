import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FRAMES, TOTAL_FRAMES, ORIGINAL_ASPECT_RATIO } from './framesData';

describe('GEOTHERM-X Sequence Verification', () => {
  it('has exactly 564 unique combined frames', () => {
    expect(TOTAL_FRAMES).toBe(564);
    expect(FRAMES.length).toBe(564);
  });

  it('correctly maps sequence 1 from index 0 to 268', () => {
    expect(FRAMES[0].sequence).toBe('sequence-01');
    expect(FRAMES[0].filename).toBe('ezgif-frame-001.jpg');
    expect(FRAMES[268].sequence).toBe('sequence-01');
    expect(FRAMES[268].filename).toBe('ezgif-frame-269.jpg');
  });

  it('correctly transitions from sequence 1 into sequence 2 without duplicate boundary', () => {
    // Frame 268 is seq1 final frame (269)
    // Frame 269 is seq2 frame 002 (seq2 frame 001 is omitted as duplicate of seq1 269)
    expect(FRAMES[268].sequence).toBe('sequence-01');
    expect(FRAMES[268].filename).toBe('ezgif-frame-269.jpg');

    expect(FRAMES[269].sequence).toBe('sequence-02');
    expect(FRAMES[269].filename).toBe('ezgif-frame-002.jpg');
  });

  it('correctly transitions from sequence 2 into sequence 3 without duplicate boundary', () => {
    // Frame 385 is seq2 final frame (118)
    // Frame 386 is seq3 frame 002 (seq3 frame 001 is omitted as duplicate of seq2 118)
    expect(FRAMES[385].sequence).toBe('sequence-02');
    expect(FRAMES[385].filename).toBe('ezgif-frame-118.jpg');

    expect(FRAMES[386].sequence).toBe('sequence-03');
    expect(FRAMES[386].filename).toBe('ezgif-frame-002.jpg');
  });

  it('ends at sequence 3 final frame (179) at index 563', () => {
    expect(FRAMES[563].sequence).toBe('sequence-03');
    expect(FRAMES[563].filename).toBe('ezgif-frame-179.jpg');
  });

  it('verifies all 564 frame files exist on disk in public/', () => {
    for (const frame of FRAMES) {
      const fullPath = path.resolve('public', frame.path.replace(/^\//, ''));
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it('verifies global progress mapping equation across 0..1', () => {
    const N = TOTAL_FRAMES;
    
    // At 0 progress
    expect(Math.round(0 * (N - 1))).toBe(0);
    // At 1 progress
    expect(Math.round(1 * (N - 1))).toBe(563);
    
    // Monotonicity check
    let prevIndex = -1;
    for (let i = 0; i <= 1000; i++) {
      const p = i / 1000;
      const idx = Math.max(0, Math.min(N - 1, Math.round(p * (N - 1))));
      expect(idx).toBeGreaterThanOrEqual(prevIndex);
      expect(idx).toBeLessThan(N);
      prevIndex = idx;
    }
  });

  it('verifies aspect ratio contain calculation for different viewport sizes', () => {
    const viewports = [
      { name: 'ultrawide desktop', w: 3440, h: 1440 },
      { name: '1080p desktop', w: 1920, h: 1080 },
      { name: 'square tablet', w: 1024, h: 1024 },
      { name: 'mobile portrait', w: 390, h: 844 },
      { name: 'mobile landscape', w: 844, h: 390 }
    ];

    for (const vp of viewports) {
      const canvasAspect = vp.w / vp.h;
      let drawW: number;
      let drawH: number;

      if (canvasAspect > ORIGINAL_ASPECT_RATIO) {
        drawH = vp.h;
        drawW = vp.h * ORIGINAL_ASPECT_RATIO;
      } else {
        drawW = vp.w;
        drawH = vp.w / ORIGINAL_ASPECT_RATIO;
      }

      // Must fit inside viewport (contain)
      expect(drawW).toBeLessThanOrEqual(vp.w + 0.001);
      expect(drawH).toBeLessThanOrEqual(vp.h + 0.001);

      // Must preserve exact aspect ratio
      const computedAspect = drawW / drawH;
      expect(Math.abs(computedAspect - ORIGINAL_ASPECT_RATIO)).toBeLessThan(0.001);
    }
  });
});
