// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ContinuousFrameSequence } from './components/ContinuousFrameSequence';

describe('ContinuousFrameSequence Component', () => {
  let mockContext: any;

  beforeEach(() => {
    const mockGradient = { addColorStop: vi.fn() };
    mockContext = {
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
      fillStyle: ''
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type: string) => {
      if (type === '2d') return mockContext;
      return null;
    });

    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
      configurable: true,
      value: 1280
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
      configurable: true,
      value: 720
    });
  });

  it('renders canvas element cleanly inside container', () => {
    const mockImage = new Image();
    const getCachedFrame = vi.fn().mockReturnValue(mockImage);
    const getClosestLoadedFrame = vi.fn().mockReturnValue(mockImage);
    const loadFrame = vi.fn().mockResolvedValue(mockImage);
    const requestFrames = vi.fn();

    const { container } = render(
      <ContinuousFrameSequence
        frameIndex={0}
        getCachedFrame={getCachedFrame}
        getClosestLoadedFrame={getClosestLoadedFrame}
        loadFrame={loadFrame}
        requestFrames={requestFrames}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.style.display).toBe('block');
  });

  it('calls requestFrames on mount and frame updates', async () => {
    const mockImage = new Image();
    const getCachedFrame = vi.fn().mockReturnValue(mockImage);
    const getClosestLoadedFrame = vi.fn().mockReturnValue(mockImage);
    const loadFrame = vi.fn().mockResolvedValue(mockImage);
    const requestFrames = vi.fn();

    const { rerender } = render(
      <ContinuousFrameSequence
        frameIndex={0}
        getCachedFrame={getCachedFrame}
        getClosestLoadedFrame={getClosestLoadedFrame}
        loadFrame={loadFrame}
        requestFrames={requestFrames}
      />
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(requestFrames).toHaveBeenCalledWith(0);

    rerender(
      <ContinuousFrameSequence
        frameIndex={268}
        getCachedFrame={getCachedFrame}
        getClosestLoadedFrame={getClosestLoadedFrame}
        loadFrame={loadFrame}
        requestFrames={requestFrames}
      />
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(requestFrames).toHaveBeenCalledWith(268);
  });

  it('renders full-screen cover on laptop viewport (1440x900)', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
      configurable: true,
      value: 1440
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
      configurable: true,
      value: 900
    });

    const mockImage = new Image();
    const getCachedFrame = vi.fn().mockReturnValue(mockImage);
    const getClosestLoadedFrame = vi.fn().mockReturnValue(mockImage);
    const loadFrame = vi.fn().mockResolvedValue(mockImage);
    const requestFrames = vi.fn();

    render(
      <ContinuousFrameSequence
        frameIndex={0}
        getCachedFrame={getCachedFrame}
        getClosestLoadedFrame={getClosestLoadedFrame}
        loadFrame={loadFrame}
        requestFrames={requestFrames}
      />
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockContext.drawImage).toHaveBeenCalled();
    const calls = mockContext.drawImage.mock.calls;
    const lastCall = calls[calls.length - 1];
    // drawImage(img, drawX, drawY, drawW, drawH)
    const [, drawX, drawY, drawW, drawH] = lastCall;
    // On 1440x900 (16:10 laptop), cover fills full height (900) and expands width (1600):
    expect(drawH).toBe(900);
    expect(drawW).toBe(1600);
    expect(drawX).toBe(-80);
    expect(drawY).toBe(0);
  });

  it('renders contain mode on mobile viewport (390x844)', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
      configurable: true,
      value: 390
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
      configurable: true,
      value: 844
    });

    const mockImage = new Image();
    const getCachedFrame = vi.fn().mockReturnValue(mockImage);
    const getClosestLoadedFrame = vi.fn().mockReturnValue(mockImage);
    const loadFrame = vi.fn().mockResolvedValue(mockImage);
    const requestFrames = vi.fn();

    render(
      <ContinuousFrameSequence
        frameIndex={0}
        getCachedFrame={getCachedFrame}
        getClosestLoadedFrame={getClosestLoadedFrame}
        loadFrame={loadFrame}
        requestFrames={requestFrames}
      />
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockContext.drawImage).toHaveBeenCalled();
    const calls = mockContext.drawImage.mock.calls;
    const lastCall = calls[calls.length - 1];
    const [, drawX, drawY, drawW, drawH] = lastCall;
    // On 390x844 mobile, contain fits width (390) and preserves 16:9 height (219.375) without cropping:
    expect(drawW).toBe(390);
    expect(Math.round(drawH)).toBe(219);
    expect(drawX).toBe(0);
    expect(Math.round(drawY)).toBe(312);
  });
});
