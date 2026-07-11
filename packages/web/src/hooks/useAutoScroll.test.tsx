import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutoScroll } from './useAutoScroll';

function ScrollHarness({ ticks }: { ticks: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useAutoScroll(containerRef, sentinelRef, [ticks]);

  return (
    <div ref={containerRef} data-testid="container" style={{ height: 100, overflow: 'auto' }}>
      <div style={{ height: 400 }}>content</div>
      <div ref={sentinelRef} data-testid="sentinel" />
    </div>
  );
}

describe('useAutoScroll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scrolls sentinel into view when deps change', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    });

    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(<ScrollHarness ticks={1} />);
    rerender(<ScrollHarness ticks={2} />);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'end' });
  });

  it('does not scroll when user is far from bottom', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    });

    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { rerender, getByTestId } = render(<ScrollHarness ticks={1} />);
    const container = getByTestId('container');
    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true, configurable: true });
    container.dispatchEvent(new Event('scroll'));

    scrollIntoView.mockClear();
    rerender(<ScrollHarness ticks={2} />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});