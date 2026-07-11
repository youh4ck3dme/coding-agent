import { vi } from 'vitest';

/** Apple iPhone Air (2025) — CSS viewport per yesviz.com */
export const IPHONE_AIR_17 = {
  name: 'iPhone Air',
  width: 420,
  height: 912,
  devicePixelRatio: 3,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
} as const;

export function applyViewport(viewport: typeof IPHONE_AIR_17): void {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: viewport.width
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: viewport.height
  });
  Object.defineProperty(window, 'outerWidth', {
    writable: true,
    configurable: true,
    value: viewport.width
  });
  Object.defineProperty(window, 'outerHeight', {
    writable: true,
    configurable: true,
    value: viewport.height
  });
  Object.defineProperty(window, 'devicePixelRatio', {
    writable: true,
    configurable: true,
    value: viewport.devicePixelRatio
  });
  Object.defineProperty(window.navigator, 'userAgent', {
    writable: true,
    configurable: true,
    value: viewport.userAgent
  });

  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const portrait = query.includes('orientation: portrait');
    const minWidth420 = /min-width:\s*420px/.test(query);
    const minHeight912 = /min-height:\s*912px/.test(query);
    const retina = query.includes('min-device-pixel-ratio: 3');
    const matches =
      (portrait && minWidth420) ||
      minWidth420 ||
      minHeight912 ||
      retina ||
      query.includes('max-width');

    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    };
  });
}