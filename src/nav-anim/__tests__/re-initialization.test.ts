import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVBAR_CONFIG } from '../config.ts';

const createNavbarAnimationMock = vi.fn();
const performInitialAnimationMock = vi.fn();

vi.mock('../initial-animation.ts', () => ({
  createNavbarAnimation: createNavbarAnimationMock,
  performInitialAnimation: performInitialAnimationMock,
}));

vi.mock('gsap', () => ({
  gsap: { killTweensOf: vi.fn(), set: vi.fn() },
}));

type EventMap = {
  [event: string]: Array<() => void>;
};

/**
 * The element every case re-initializes over. Identity matters: the registry
 * keys bindings by element, so both calls must see the same one.
 */
const navbarElement = {
  getAttribute: (name: string) =>
    name === NAVBAR_CONFIG.attributes.behaviour ? 'hide' : null,
} as unknown as Element;

function setupMockWindow(initialScrollY = 0): void {
  const listeners: EventMap = {};

  Object.defineProperty(globalThis, 'window', {
    value: {
      scrollY: initialScrollY,
      addEventListener: (eventName: string, callback: () => void) => {
        listeners[eventName] ??= [];
        listeners[eventName].push(callback);
      },
      removeEventListener: (eventName: string, callback: () => void) => {
        listeners[eventName] = (listeners[eventName] ?? []).filter(
          (registered) => registered !== callback,
        );
      },
      dispatchEvent: (event: { type: string }) => {
        for (const callback of Array.from(listeners[event.type] ?? [])) {
          callback();
        }
        return true;
      },
    },
    configurable: true,
  });
}

function setupMockDocument(): void {
  Object.defineProperty(globalThis, 'document', {
    value: {
      querySelectorAll: (selector: string) =>
        selector === NAVBAR_CONFIG.selectors.navbar ? [navbarElement] : [],
    },
    configurable: true,
  });
}

function scrollTo(scrollY: number): void {
  globalThis.window.scrollY = scrollY;
  globalThis.window.dispatchEvent(new Event('scroll'));
}

/**
 * Re-initialization used to be handled by `initScrollBehavior` replacing its
 * module-level state; it is now the element registry rebinding. These cases
 * came over from the old `scroll-behaviour.test.ts` and run against the real
 * index, registry, scroll source and hide behaviour — only the tween layer is
 * mocked — because it is the wiring between them that regresses.
 */
describe('re-initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMockWindow(0);
    setupMockDocument();
  });

  it('should hide on scroll-down after re-initialization even if previously hidden', async () => {
    const { initNavbarAnimation } = await import('../index.ts');
    const options = {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
    };

    initNavbarAnimation(options);

    scrollTo(NAVBAR_CONFIG.scroll.threshold + 20);

    globalThis.window.scrollY = 0;
    initNavbarAnimation(options);

    createNavbarAnimationMock.mockClear();

    scrollTo(NAVBAR_CONFIG.scroll.threshold + 20);

    expect(createNavbarAnimationMock).toHaveBeenCalledTimes(1);
    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      { ...options, compressBreakpoint: NAVBAR_CONFIG.compress.breakpoint },
    );
  });

  it('should use latest options on re-initialization', async () => {
    const { initNavbarAnimation } = await import('../index.ts');

    initNavbarAnimation({
      animationDuration: 0.1,
      animationEasing: 'power1.in',
    });
    initNavbarAnimation({
      animationDuration: 0.9,
      animationEasing: 'power4.inOut',
    });

    createNavbarAnimationMock.mockClear();

    scrollTo(NAVBAR_CONFIG.scroll.threshold + 10);

    expect(createNavbarAnimationMock).toHaveBeenCalledTimes(1);
    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      {
        animationDuration: 0.9,
        animationEasing: 'power4.inOut',
        compressBreakpoint: NAVBAR_CONFIG.compress.breakpoint,
      },
    );
  });

  it('should leave a single scroll subscriber behind after re-initialization', async () => {
    const { initNavbarAnimation } = await import('../index.ts');

    initNavbarAnimation();

    const handle = initNavbarAnimation() as { destroy: () => void };

    scrollTo(NAVBAR_CONFIG.scroll.threshold + 10);

    expect(createNavbarAnimationMock).toHaveBeenCalledTimes(1);

    handle.destroy();
    createNavbarAnimationMock.mockClear();

    scrollTo(0);

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });
});
