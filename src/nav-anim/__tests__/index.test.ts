import { gsap } from 'gsap';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../initial-animation.ts', () => ({
  performInitialAnimation: vi.fn(),
}));

vi.mock('../scroll-behaviour.ts', () => ({
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
    expect(killTweensOf).toHaveBeenCalledWith(navbars, 'y');
    killTweensOf.mockRestore();
  });

  it('should leave a consumer tween and an authored transform alone', () => {
    const [navbar] = renderNavbars(1) as HTMLElement[];
    if (!navbar) throw new Error('navbar missing');
    gsap.set(navbar, { xPercent: -50 });
    const consumerTween = gsap.to(navbar, { opacity: 0.5, duration: 10 });

    // The module's own hide, as the real animation would leave it.
    gsap.set(navbar, { yPercent: -100 });
    const nav = initNavbarAnimation();
    nav?.destroy();

    expect(gsap.getTweensOf(navbar)).toContain(consumerTween);
    expect(gsap.getProperty(navbar, 'xPercent')).toBe(-50);
    expect(gsap.getProperty(navbar, 'yPercent')).toBe(0);
    expect(navbar.style.transform).toContain('-50%');
    consumerTween.kill();
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

  it('should replace the first instance when init runs a second time', () => {
    renderNavbars(1);
    const removeA = vi.fn();
    const removeB = vi.fn();
    mockedInitScrollBehavior
      .mockReturnValueOnce(removeA)
      .mockReturnValueOnce(removeB);

    initNavbarAnimation();
    expect(removeA).not.toHaveBeenCalled();

    initNavbarAnimation();

    expect(removeA).toHaveBeenCalledTimes(1);
    expect(removeB).not.toHaveBeenCalled();
  });

  it('should leave only one scroll behavior live after repeated inits', () => {
    renderNavbars(1);
    const removers = [vi.fn(), vi.fn(), vi.fn()];
    for (const remove of removers) {
      mockedInitScrollBehavior.mockReturnValueOnce(remove);
    }

    for (let i = 0; i < removers.length; i++) initNavbarAnimation();

    expect(removers[0]).toHaveBeenCalledTimes(1);
    expect(removers[1]).toHaveBeenCalledTimes(1);
    expect(removers[2]).not.toHaveBeenCalled();
  });

  it('should not let a stale handle destroy its replacement', () => {
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

  it('should still replace when the previous instance did not hide on scroll', () => {
    renderNavbars(1);
    const removeB = vi.fn();
    mockedInitScrollBehavior.mockReturnValueOnce(removeB);

    initNavbarAnimation({ hideOnScroll: false });
    const killTweensOf = vi.spyOn(gsap, 'killTweensOf');
    initNavbarAnimation();

    expect(killTweensOf).toHaveBeenCalledWith(expect.anything(), 'y');
    expect(removeB).not.toHaveBeenCalled();
    killTweensOf.mockRestore();
  });
});
