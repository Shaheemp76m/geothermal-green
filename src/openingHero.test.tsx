// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OpeningHero } from './components/OpeningHero';

describe('OpeningHero Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders initial headline at heroProgress = 0', () => {
    render(<OpeningHero heroProgress={0} />);

    expect(screen.getByText('WAIT.')).not.toBeNull();
    expect(screen.getByText('WE ARE')).not.toBeNull();
    expect(screen.getByText('DESTROYING')).not.toBeNull();
    
    const natureEl = screen.getByText('NATURE.');
    expect(natureEl).not.toBeNull();
    expect(natureEl.style.color).toBe('rgb(224, 122, 44)'); // #E07A2C
  });

  it('renders INTRODUCING at heroProgress = 0.60 and hides headline', () => {
    render(<OpeningHero heroProgress={0.60} />);

    const introducingEl = screen.getByText('INTRODUCING');
    expect(introducingEl).not.toBeNull();
    expect(screen.queryByText('WAIT.')).toBeNull();
  });

  it('renders nothing at heroProgress = 0.95 (handoff to animation)', () => {
    const { container } = render(<OpeningHero heroProgress={0.95} />);
    expect(container.firstChild).toBeNull();
  });

  it('respects prefersReducedMotion', () => {
    render(<OpeningHero heroProgress={0.25} prefersReducedMotion={true} />);
    expect(screen.getByText('WAIT.')).not.toBeNull();
  });
});
