import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVBAR_CONFIG } from '../config.ts';

const createNavbarAnimationMock = vi.fn();

vi.mock('../initial-animation.ts', () => ({
  createNavbarAnimation: createNavbarAnimationMock,
}));

type EventMap = {
  [event: string]: Array<() => void>;
};

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
        (listeners[event.type] ?? []).forEach((callback) => callback());
        return true;
      },
    },
    configurable: true,
  });
}

describe('scroll behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    createNavbarAnimationMock.mockReset();
    setupMockWindow(0);
  });

  it('should hide on downward significant scroll and show on upward significant scroll', async () => {
    const module = await import('../scroll-behaviour.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      {
        animationDuration: 0.5,
        animationEasing: 'power1.out',
      },
    );

    globalThis.window.scrollY = 0;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).toHaveBeenNthCalledWith(
      2,
      [navbarElement],
      NAVBAR_CONFIG.position.visible,
      {
        animationDuration: 0.5,
        animationEasing: 'power1.out',
      },
    );
  });

  it('should ignore scroll changes below threshold', async () => {
    const module = await import('../scroll-behaviour.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold - 1;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should remove listener on cleanup', async () => {
    const module = await import('../scroll-behaviour.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.2,
      animationEasing: 'linear',
    });
    module.cleanupNavbarAnimation();

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 100;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should use latest options on re-initialization', async () => {
    const module = await import('../scroll-behaviour.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.1,
      animationEasing: 'power1.in',
    });
    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.9,
      animationEasing: 'power4.inOut',
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 10;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      {
        animationDuration: 0.9,
        animationEasing: 'power4.inOut',
      },
    );
  });
});
