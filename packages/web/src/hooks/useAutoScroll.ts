import { RefObject, useEffect, useRef } from 'react';

type AutoScrollOptions = {
  /** Distance from bottom (px) within which auto-scroll stays enabled. */
  threshold?: number;
};

/**
 * Scrolls a container to the end only when the user is already near the bottom.
 * Uses instant scroll and requestAnimationFrame to avoid jank with long histories.
 */
export function useAutoScroll<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  sentinelRef: RefObject<HTMLElement | null>,
  deps: unknown[],
  options: AutoScrollOptions = {}
): void {
  const { threshold = 80 } = options;
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const onScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom <= threshold;
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => container.removeEventListener('scroll', onScroll);
  }, [containerRef, threshold]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      sentinelRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}