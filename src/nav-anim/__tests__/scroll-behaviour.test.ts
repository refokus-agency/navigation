import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

type ScrollModule = typeof import('../scroll-behaviour.ts');

let loaded: ScrollModule | null = null;

/**
 * Each test gets a fresh module via resetModules, but the focus listener lives
 * on the real `document` — so without tearing the previous instance down, a
 * stale handler still receives events and trips over this file's fake elements.
 */
async function loadScrollModule(): Promise<ScrollModule> {
  loaded = await import('../scroll-behaviour.ts');
  return loaded;
}

describe('scroll behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    createNavbarAnimationMock.mockReset();
    setupMockWindow(0);
  });

  afterEach(() => {
    loaded?.cleanupNavbarAnimation();
    loaded = null;
    document.body.innerHTML = '';
  });

  it('should hide on downward significant scroll and show on upward significant scroll', async () => {
    const module = await loadScrollModule();
    const navbarElement = { id: 'nav' } as unknown as Element;

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      {
        animationDuration: 0.5,
        animationEasing: 'power1.out',
        hideOnScroll: true,
        scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
        hiddenOffset: NAVBAR_CONFIG.position.hidden,
        visibleOffset: NAVBAR_CONFIG.position.visible,
        pauseWhileMenuOpen: true,
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
        hideOnScroll: true,
        scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
        hiddenOffset: NAVBAR_CONFIG.position.hidden,
        visibleOffset: NAVBAR_CONFIG.position.visible,
        pauseWhileMenuOpen: true,
      },
    );
  });

  it('should show a hidden navbar when focus moves into it', async () => {
    const module = await loadScrollModule();
    // A real element is needed here: the focus path uses element.contains().
    const navbarElement = document.createElement('nav');
    const link = document.createElement('a');
    link.href = '#';
    navbarElement.append(link);
    document.body.append(navbarElement);

    const options = {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    };
    module.initScrollBehavior([navbarElement], options);

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));
    expect(createNavbarAnimationMock).toHaveBeenLastCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      options,
    );

    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(createNavbarAnimationMock).toHaveBeenLastCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.visible,
      options,
    );
  });

  it('should ignore focus landing outside the navbar', async () => {
    const module = await loadScrollModule();
    const navbarElement = document.createElement('nav');
    const outside = document.createElement('button');
    document.body.append(navbarElement, outside);

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));
    const callsAfterHide = createNavbarAnimationMock.mock.calls.length;

    outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(createNavbarAnimationMock.mock.calls.length).toBe(callsAfterHide);
  });

  it('should not re-show an already visible navbar on focus', async () => {
    const module = await loadScrollModule();
    const navbarElement = document.createElement('nav');
    document.body.append(navbarElement);

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    });

    navbarElement.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should remove the focus listener on cleanup', async () => {
    const module = await loadScrollModule();
    const navbarElement = document.createElement('nav');
    document.body.append(navbarElement);

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));

    module.cleanupNavbarAnimation();
    const callsAfterCleanup = createNavbarAnimationMock.mock.calls.length;

    navbarElement.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(createNavbarAnimationMock.mock.calls.length).toBe(callsAfterCleanup);
  });

  it('should ignore scroll changes below threshold', async () => {
    const module = await loadScrollModule();
    const navbarElement = { id: 'nav' } as unknown as Element;

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold - 1;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should remove listener on cleanup', async () => {
    const module = await loadScrollModule();
    const navbarElement = { id: 'nav' } as unknown as Element;

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.2,
      animationEasing: 'linear',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    });
    module.cleanupNavbarAnimation();

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 100;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should hide on scroll-down after re-initialization even if previously hidden', async () => {
    const module = await loadScrollModule();
    const navbarElement = { id: 'nav' } as unknown as Element;
    const options = {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    };

    module.initScrollBehavior([navbarElement], options);

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));

    globalThis.window.scrollY = 0;
    module.initScrollBehavior([navbarElement], options);

    createNavbarAnimationMock.mockClear();

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      options,
    );
  });

  it('should use latest options on re-initialization', async () => {
    const module = await loadScrollModule();
    const navbarElement = { id: 'nav' } as unknown as Element;

    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.1,
      animationEasing: 'power1.in',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    });
    module.initScrollBehavior([navbarElement], {
      animationDuration: 0.9,
      animationEasing: 'power4.inOut',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 10;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      {
        animationDuration: 0.9,
        animationEasing: 'power4.inOut',
        hideOnScroll: true,
        scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
        hiddenOffset: NAVBAR_CONFIG.position.hidden,
        visibleOffset: NAVBAR_CONFIG.position.visible,
        pauseWhileMenuOpen: true,
      },
    );
  });

  describe('custom scroll threshold (AC-8)', () => {
    const options = {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: 200,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    };

    it('should ignore scrolls below scrollThreshold', async () => {
      const module = await loadScrollModule();
      const navbarElement = { id: 'nav' } as unknown as Element;
      module.initScrollBehavior([navbarElement], options);

      // Past the default 50 px, inside the custom 200 px.
      globalThis.window.scrollY = 120;
      globalThis.window.dispatchEvent(new Event('scroll'));

      expect(createNavbarAnimationMock).not.toHaveBeenCalled();
    });

    it('should hide once the scroll passes scrollThreshold', async () => {
      const module = await loadScrollModule();
      const navbarElement = { id: 'nav' } as unknown as Element;
      module.initScrollBehavior([navbarElement], options);

      globalThis.window.scrollY = 260;
      globalThis.window.dispatchEvent(new Event('scroll'));

      expect(createNavbarAnimationMock).toHaveBeenCalledWith(
        [navbarElement],
        NAVBAR_CONFIG.position.hidden,
        options,
      );
    });
  });

  describe('offsets and open-panel pause', () => {
    const base = {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      hiddenOffset: NAVBAR_CONFIG.position.hidden,
      visibleOffset: NAVBAR_CONFIG.position.visible,
      pauseWhileMenuOpen: true,
    };

    function scrollDown(): void {
      globalThis.window.scrollY = 500;
      globalThis.window.dispatchEvent(new Event('scroll'));
    }

    it('uses custom hidden and visible offsets', async () => {
      const module = await loadScrollModule();
      const nav = document.createElement('nav');
      const options = { ...base, hiddenOffset: '-50%', visibleOffset: '10px' };
      module.initScrollBehavior([nav], options);

      scrollDown();
      expect(createNavbarAnimationMock).toHaveBeenLastCalledWith(
        [nav],
        '-50%',
        options,
      );

      globalThis.window.scrollY = 0;
      globalThis.window.dispatchEvent(new Event('scroll'));
      expect(createNavbarAnimationMock).toHaveBeenLastCalledWith(
        [nav],
        '10px',
        options,
      );
    });

    it('does not hide while a panel is open', async () => {
      const module = await loadScrollModule();
      const nav = document.createElement('nav');
      nav.dataset.state = 'open';
      module.initScrollBehavior([nav], base);

      scrollDown();
      expect(createNavbarAnimationMock).not.toHaveBeenCalled();
    });

    it('hides with a panel open when pauseWhileMenuOpen is false', async () => {
      const module = await loadScrollModule();
      const nav = document.createElement('nav');
      nav.dataset.state = 'open';
      module.initScrollBehavior([nav], { ...base, pauseWhileMenuOpen: false });

      scrollDown();
      expect(createNavbarAnimationMock).toHaveBeenCalledTimes(1);
    });

    it('lets shouldHide() veto hiding', async () => {
      const module = await loadScrollModule();
      const nav = document.createElement('nav');
      const shouldHide = vi.fn(() => false);
      module.initScrollBehavior([nav], { ...base, shouldHide });

      scrollDown();
      expect(shouldHide).toHaveBeenCalled();
      expect(createNavbarAnimationMock).not.toHaveBeenCalled();
    });
  });
});
