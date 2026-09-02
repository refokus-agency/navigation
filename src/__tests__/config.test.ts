import { describe, expect, it } from 'vitest';
import { NAV_ROOT_SELECTOR } from '../config.ts';
import { NAVBAR_CONFIG } from '../nav-anim/config.ts';
import { NAV_MENU_CONFIG } from '../nav-menu/config.ts';

describe('nav root selector', () => {
  it('should be the single selector both features attach to', () => {
    expect(NAVBAR_CONFIG.selectors.navbar).toBe(NAV_ROOT_SELECTOR);
    expect(NAV_MENU_CONFIG.selectors.root).toBe(NAV_ROOT_SELECTOR);
  });

  it('should be [data-nav-menu]', () => {
    expect(NAV_ROOT_SELECTOR).toBe('[data-nav-menu]');
  });
});
