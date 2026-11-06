import { gsap } from 'gsap';
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
  it('should return null when navbar elements are not found', () => {
    expect(initNavbarAnimation()).toBeNull();
    expect(mockedPerformInitialAnimation).not.toHaveBeenCalled();
    expect(mockedInitScrollBehavior).not.toHaveBeenCalled();
  });

  it('should initialize animation and scroll behavior when navbar elements exist', () => {
    const [navbarA, navbarB] = renderNavbars(2);
    const options: InitNavbarAnimationOptions = {
      animationDuration: 0.8,
      animationEasing: 'power4.out',
    };

    expect(initNavbarAnimation(options)).not.toBeNull();
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

    expect(initNavbarAnimation()).not.toBeNull();
    expect(mockedPerformInitialAnimation).toHaveBeenCalledWith(
      navbars,
      DEFAULTS,
    );
    expect(mockedInitScrollBehavior).toHaveBeenCalledWith(navbars, DEFAULTS);
  });

  it('should merge partial options with defaults', () => {
    const navbars = renderNavbars(1);

    expect(initNavbarAnimation({ animationDuration: 0.8 })).not.toBeNull();
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

describe('initNavbarAnimation teardown handle', () => {
  it('should remove the scroll behavior and kill the tweens on destroy', () => {
    const navbars = renderNavbars(1);
    const removeScrollBehavior = vi.fn();
    mockedInitScrollBehavior.mockReturnValueOnce(removeScrollBehavior);
    const killTweensOf = vi.spyOn(gsap, 'killTweensOf');

    const nav = initNavbarAnimation();
    expect(removeScrollBehavior).not.toHaveBeenCalled();

    nav?.destroy();

    expect(removeScrollBehavior).toHaveBeenCalledTimes(1);
    expect(killTweensOf).toHaveBeenCalledWith(navbars);
  });

  it('should be safe to destroy twice', () => {
    renderNavbars(1);
    const removeScrollBehavior = vi.fn();
    mockedInitScrollBehavior.mockReturnValueOnce(removeScrollBehavior);

    const nav = initNavbarAnimation();
    nav?.destroy();
    nav?.destroy();

    expect(removeScrollBehavior).toHaveBeenCalledTimes(1);
  });

  it('should destroy cleanly when hideOnScroll is false', () => {
    renderNavbars(1);

    const nav = initNavbarAnimation({ hideOnScroll: false });

    expect(mockedInitScrollBehavior).not.toHaveBeenCalled();
    expect(() => nav?.destroy()).not.toThrow();
  });

  it('should keep two instances independent', () => {
    renderNavbars(1);
    const removeA = vi.fn();
    const removeB = vi.fn();
    mockedInitScrollBehavior
      .mockReturnValueOnce(removeA)
      .mockReturnValueOnce(removeB);

    const a = initNavbarAnimation();
    initNavbarAnimation();
    a?.destroy();

    expect(removeA).toHaveBeenCalledTimes(1);
    expect(removeB).not.toHaveBeenCalled();
  });
});
