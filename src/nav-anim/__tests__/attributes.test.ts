import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../initial-animation.ts', () => ({
  performInitialAnimation: vi.fn(),
}));

vi.mock('../scroll-behaviour.ts', () => ({
  cleanupNavbarAnimation: vi.fn(),
  initScrollBehavior: vi.fn(),
}));

import {
  type InitNavbarAnimationOptions,
  initNavbarAnimation,
  type NavbarAnimationOptions,
} from '../index.ts';
import { performInitialAnimation } from '../initial-animation.ts';
import {
  cleanupNavbarAnimation,
  initScrollBehavior,
} from '../scroll-behaviour.ts';

const mockedPerformInitialAnimation = vi.mocked(performInitialAnimation);
const mockedInitScrollBehavior = vi.mocked(initScrollBehavior);
const mockedCleanupNavbarAnimation = vi.mocked(cleanupNavbarAnimation);

/** Renders one `<nav data-nav-menu>` per attribute set, in order. */
function renderRoots(...roots: Record<string, string>[]): HTMLElement[] {
  document.body.innerHTML = '';
  return roots.map((attributes) => {
    const nav = document.createElement('nav');
    nav.setAttribute('data-nav-menu', '');
    for (const [name, value] of Object.entries(attributes)) {
      nav.setAttribute(name, value);
    }
    document.body.append(nav);
    return nav;
  });
}

function resolvedOptions(
  options: InitNavbarAnimationOptions = {},
): NavbarAnimationOptions {
  initNavbarAnimation(options);
  const call = mockedPerformInitialAnimation.mock.calls.at(-1);
  if (!call) throw new Error('performInitialAnimation was not called');
  return call[1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('nav-anim root attributes (AC-2)', () => {
  it('should read every nav-anim attribute from the root', () => {
    renderRoots({
      'data-nav-hide-on-scroll': 'false',
      'data-nav-scroll-threshold': '120',
      'data-nav-anim-duration': '0.8',
      'data-nav-anim-easing': 'power4.out',
    });

    expect(resolvedOptions()).toEqual({
      animationDuration: 0.8,
      animationEasing: 'power4.out',
      hideOnScroll: false,
      scrollThreshold: 120,
    });
  });

  it('should read the attributes from the first root only', () => {
    const roots = renderRoots(
      { 'data-nav-anim-duration': '0.8' },
      { 'data-nav-anim-duration': '2' },
    );

    expect(resolvedOptions().animationDuration).toBe(0.8);
    expect(mockedPerformInitialAnimation).toHaveBeenCalledWith(
      roots,
      expect.anything(),
    );
  });

  it('should read the attributes once, at init', () => {
    const [root] = renderRoots({ 'data-nav-scroll-threshold': '120' });
    const options = resolvedOptions();
    root?.setAttribute('data-nav-scroll-threshold', '10');

    expect(options.scrollThreshold).toBe(120);
  });
});

describe('nav-anim attribute precedence (AC-3)', () => {
  it('should prefer a valid attribute over the JS option', () => {
    renderRoots({
      'data-nav-anim-duration': '0.8',
      'data-nav-anim-easing': 'power4.out',
    });

    expect(
      resolvedOptions({ animationDuration: 2, animationEasing: 'none' }),
    ).toMatchObject({ animationDuration: 0.8, animationEasing: 'power4.out' });
  });
});

describe('nav-anim invalid attributes (AC-4)', () => {
  it('should fall back to a valid JS option for an invalid attribute', () => {
    renderRoots({
      'data-nav-anim-duration': '300ms',
      'data-nav-anim-easing': 'foo',
      'data-nav-hide-on-scroll': 'no',
      'data-nav-scroll-threshold': '20px',
    });

    expect(
      resolvedOptions({
        animationDuration: 0.6,
        animationEasing: 'power4.out',
        hideOnScroll: false,
        scrollThreshold: 80,
      }),
    ).toEqual({
      animationDuration: 0.6,
      animationEasing: 'power4.out',
      hideOnScroll: false,
      scrollThreshold: 80,
    });
  });

  it('should fall back to the default for empty attributes and no JS option', () => {
    renderRoots({
      'data-nav-anim-duration': '',
      'data-nav-anim-easing': '',
      'data-nav-hide-on-scroll': '',
      'data-nav-scroll-threshold': '',
    });

    expect(resolvedOptions()).toEqual({
      animationDuration: 0.3,
      animationEasing: 'power2.inOut',
      hideOnScroll: true,
      scrollThreshold: 50,
    });
  });

  it('should fall back to the default for an invalid JS option', () => {
    renderRoots({});

    expect(
      resolvedOptions({
        animationDuration: '0.6',
        animationEasing: 'foo',
        hideOnScroll: 'false',
        scrollThreshold: null,
      } as unknown as InitNavbarAnimationOptions),
    ).toEqual({
      animationDuration: 0.3,
      animationEasing: 'power2.inOut',
      hideOnScroll: true,
      scrollThreshold: 50,
    });
  });

  it('should neither log nor throw', () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(
      (method) => vi.spyOn(console, method).mockImplementation(() => {}),
    );
    renderRoots({
      'data-nav-anim-duration': 'slow',
      'data-nav-anim-easing': 'foo',
      'data-nav-hide-on-scroll': 'nope',
      'data-nav-scroll-threshold': ' 10 ',
    });

    expect(() => initNavbarAnimation()).not.toThrow();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('nav-anim numeric attributes (AC-5)', () => {
  it.each([
    ['0', 0],
    ['99999', 99999],
  ])(
    'should use data-nav-scroll-threshold="%s" as given',
    (value, expected) => {
      renderRoots({
        'data-nav-scroll-threshold': value,
        'data-nav-anim-duration': value,
      });

      expect(resolvedOptions()).toMatchObject({
        scrollThreshold: expected,
        animationDuration: expected,
      });
    },
  );

  it('should fall back to the JS option for a negative attribute', () => {
    renderRoots({
      'data-nav-scroll-threshold': '-20',
      'data-nav-anim-duration': '-20',
    });

    expect(
      resolvedOptions({ scrollThreshold: 10, animationDuration: 2 }),
    ).toMatchObject({ scrollThreshold: 10, animationDuration: 2 });
  });

  it('should fall back to the default for a negative JS option', () => {
    renderRoots({});

    expect(
      resolvedOptions({ scrollThreshold: -20, animationDuration: -1 }),
    ).toMatchObject({ scrollThreshold: 50, animationDuration: 0.3 });
  });
});

describe('hide on scroll (AC-6)', () => {
  it('should not bind scroll behavior when data-nav-hide-on-scroll is "false"', () => {
    renderRoots({ 'data-nav-hide-on-scroll': 'false' });

    expect(initNavbarAnimation()).toBe(true);
    expect(mockedPerformInitialAnimation).toHaveBeenCalledTimes(1);
    expect(mockedInitScrollBehavior).not.toHaveBeenCalled();
  });

  it('should not bind scroll behavior when hideOnScroll is false', () => {
    renderRoots({});

    initNavbarAnimation({ hideOnScroll: false });

    expect(mockedInitScrollBehavior).not.toHaveBeenCalled();
  });

  it('should bind scroll behavior when data-nav-hide-on-scroll is "true"', () => {
    renderRoots({ 'data-nav-hide-on-scroll': 'true' });

    initNavbarAnimation({ hideOnScroll: false });

    expect(mockedInitScrollBehavior).toHaveBeenCalledTimes(1);
  });

  it('should tear down an earlier binding when a re-init disables hide on scroll', () => {
    renderRoots({});
    initNavbarAnimation();
    renderRoots({ 'data-nav-hide-on-scroll': 'false' });

    initNavbarAnimation();

    expect(mockedInitScrollBehavior).toHaveBeenCalledTimes(1);
    expect(mockedCleanupNavbarAnimation).toHaveBeenCalledTimes(2);
  });
});

describe('nav-anim easing validation', () => {
  it.each([
    'constructor',
    'toString',
    'hasOwnProperty',
    'toString(1)',
    'constructor(1)',
  ])('should reject the Object.prototype name "%s" as an easing', (value) => {
    renderRoots({ 'data-nav-anim-easing': value });

    expect(resolvedOptions({ animationEasing: value }).animationEasing).toBe(
      'power2.inOut',
    );
  });

  it.each(['steps(abc)', 'back(x)'])(
    'should reject the malformed parameterised ease "%s"',
    (value) => {
      renderRoots({ 'data-nav-anim-easing': value });

      expect(resolvedOptions({ animationEasing: value }).animationEasing).toBe(
        'power2.inOut',
      );
    },
  );
});
