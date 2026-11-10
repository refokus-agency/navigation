import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../initial-animation.ts', () => ({
  performInitialAnimation: vi.fn(),
}));

vi.mock('../scroll-behaviour.ts', () => ({
  cleanupNavbarAnimation: vi.fn(),
  initScrollBehavior: vi.fn(),
}));

import { NAVBAR_CONFIG } from '../config.ts';
import {
  type InitNavbarAnimationOptions,
  initNavbarAnimation,
} from '../index.ts';
import { performInitialAnimation } from '../initial-animation.ts';
import { initScrollBehavior } from '../scroll-behaviour.ts';

const mockedPerformInitialAnimation = vi.mocked(performInitialAnimation);
const mockedInitScrollBehavior = vi.mocked(initScrollBehavior);

/** Today's defaults; the new fields must not change what an empty init does. */
const DEFAULTS = {
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
  hideOnScroll: true,
  scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
};

/** Renders `count` real `<nav data-nav-menu>` roots. */
function renderNavbars(count: number): Element[] {
  document.body.innerHTML = '';
  return Array.from({ length: count }, () => {
    const nav = document.createElement('nav');
    nav.setAttribute('data-nav-menu', '');
    document.body.append(nav);
    return nav;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('initNavbarAnimation', () => {
  it('should return false when navbar elements are not found', () => {
    expect(initNavbarAnimation()).toBe(false);
    expect(mockedPerformInitialAnimation).not.toHaveBeenCalled();
    expect(mockedInitScrollBehavior).not.toHaveBeenCalled();
  });

  it('should initialize animation and scroll behavior when navbar elements exist', () => {
    const [navbarA, navbarB] = renderNavbars(2);
    const options: InitNavbarAnimationOptions = {
      animationDuration: 0.8,
      animationEasing: 'power4.out',
    };

    expect(initNavbarAnimation(options)).toBe(true);
    expect(mockedPerformInitialAnimation).toHaveBeenCalledWith(
      [navbarA, navbarB],
      { ...DEFAULTS, ...options },
    );
    expect(mockedInitScrollBehavior).toHaveBeenCalledWith([navbarA, navbarB], {
      ...DEFAULTS,
      ...options,
    });
  });

  it('should use default options when no options are provided', () => {
    const navbars = renderNavbars(1);

    expect(initNavbarAnimation()).toBe(true);
    expect(mockedPerformInitialAnimation).toHaveBeenCalledWith(
      navbars,
      DEFAULTS,
    );
    expect(mockedInitScrollBehavior).toHaveBeenCalledWith(navbars, DEFAULTS);
  });

  it('should merge partial options with defaults', () => {
    const navbars = renderNavbars(1);

    expect(initNavbarAnimation({ animationDuration: 0.8 })).toBe(true);
    expect(mockedPerformInitialAnimation).toHaveBeenCalledWith(navbars, {
      ...DEFAULTS,
      animationDuration: 0.8,
    });
    expect(mockedInitScrollBehavior).toHaveBeenCalledWith(navbars, {
      ...DEFAULTS,
      animationDuration: 0.8,
    });
  });
});
