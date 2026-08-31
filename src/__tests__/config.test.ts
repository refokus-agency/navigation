import { describe, expect, it } from 'vitest';
import { NAV_ROOT_SELECTOR } from '../config.ts';
import { NAVBAR_CONFIG } from '../nav-anim/config.ts';

describe('nav root selector', () => {
  it('should be the selector nav-anim attaches to', () => {
    expect(NAVBAR_CONFIG.selectors.navbar).toBe(NAV_ROOT_SELECTOR);
  });

  it('should be [data-nav-menu]', () => {
    expect(NAV_ROOT_SELECTOR).toBe('[data-nav-menu]');
  });
});
