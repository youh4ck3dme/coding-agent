import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyViewport, IPHONE_AIR_17 } from './viewports';

describe('applyViewport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures iPhone Air 17 CSS viewport dimensions', () => {
    applyViewport(IPHONE_AIR_17);

    expect(window.innerWidth).toBe(420);
    expect(window.innerHeight).toBe(912);
    expect(window.outerWidth).toBe(420);
    expect(window.outerHeight).toBe(912);
    expect(window.devicePixelRatio).toBe(3);
    expect(window.navigator.userAgent).toContain('iPhone');
  });

  it('mocks matchMedia for portrait and retina queries', () => {
    applyViewport(IPHONE_AIR_17);

    expect(window.matchMedia('(orientation: portrait) and (min-width: 420px)').matches).toBe(true);
    expect(window.matchMedia('(-webkit-min-device-pixel-ratio: 3)').matches).toBe(true);
  });
});