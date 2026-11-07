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

    // Wait for requestAnimationFrame tick
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
});
