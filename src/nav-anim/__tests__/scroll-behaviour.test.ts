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

let teardowns: Array<() => void> = [];

/**
 * The focus listener lives on the real `document` — so every instance a test
 * creates is torn down afterwards, or a stale handler still receives events
 * and trips over this file's fake elements.
 */
async function loadScrollModule(): Promise<ScrollModule> {
  const loaded = await import('../scroll-behaviour.ts');
  return {
    initScrollBehavior: (...args) => {
      const teardown = loaded.initScrollBehavior(...args);
      teardowns.push(teardown);
      return teardown;
    },
  };
}

describe('scroll behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    createNavbarAnimationMock.mockReset();
    setupMockWindow(0);
  });

  afterEach(() => {
    for (const teardown of teardowns) teardown();
    teardowns = [];
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
    });

    navbarElement.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should remove the focus listener on cleanup', async () => {
    const module = await loadScrollModule();
    const navbarElement = document.createElement('nav');
    document.body.append(navbarElement);

    const teardown = module.initScrollBehavior([navbarElement], {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));

    teardown();
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
    });

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold - 1;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should remove listener on cleanup', async () => {
    const module = await loadScrollModule();
    const navbarElement = { id: 'nav' } as unknown as Element;

    const teardown = module.initScrollBehavior([navbarElement], {
      animationDuration: 0.2,
      animationEasing: 'linear',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
    });
    teardown();

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 100;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should hide on scroll-down after a teardown and re-initialization', async () => {
    const module = await loadScrollModule();
    const navbarElement = { id: 'nav' } as unknown as Element;
    const options = {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
    };

    const teardown = module.initScrollBehavior([navbarElement], options);

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));

    teardown();
    globalThis.window.scrollY = 0;
    module.initScrollBehavior([navbarElement], options);

    createNavbarAnimationMock.mockClear();

    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).toHaveBeenCalledTimes(1);
    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      options,
    );
  });

  it('should keep two instances independent', async () => {
    const module = await loadScrollModule();
    const navbarA = { id: 'a' } as unknown as Element;
    const navbarB = { id: 'b' } as unknown as Element;
    const options = {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
    };

    const teardownA = module.initScrollBehavior([navbarA], options);
    module.initScrollBehavior([navbarB], options);

    teardownA();
    globalThis.window.scrollY = NAVBAR_CONFIG.scroll.threshold + 20;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(createNavbarAnimationMock).toHaveBeenCalledTimes(1);
    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarB],
      NAVBAR_CONFIG.position.hidden,
      options,
    );
  });

  it('should leave no scroll or focus listeners after teardown', async () => {
    const module = await loadScrollModule();
    const windowAdd = vi.spyOn(globalThis.window, 'addEventListener');
    const windowRemove = vi.spyOn(globalThis.window, 'removeEventListener');
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');

    const teardown = module.initScrollBehavior(
      [document.createElement('nav')],
      {
        animationDuration: 0.5,
        animationEasing: 'power1.out',
        hideOnScroll: true,
        scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
      },
    );
    teardown();

    expect(windowAdd).toHaveBeenCalledTimes(1);
    expect(windowRemove).toHaveBeenCalledTimes(1);
    expect(windowRemove.mock.calls[0]).toEqual([
      'scroll',
      windowAdd.mock.calls[0]?.[1],
    ]);
    expect(documentAdd).toHaveBeenCalledTimes(1);
    expect(documentRemove).toHaveBeenCalledTimes(1);
    expect(documentRemove.mock.calls[0]).toEqual([
      'focusin',
      documentAdd.mock.calls[0]?.[1],
    ]);
  });

  describe('custom scroll threshold (AC-8)', () => {
    const options = {
      animationDuration: 0.5,
      animationEasing: 'power1.out',
      hideOnScroll: true,
      scrollThreshold: 200,
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
});

describe('open menu pauses hiding', () => {
  const options = {
    animationDuration: 0.5,
    animationEasing: 'power1.out',
    hideOnScroll: true,
    scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
  };

  function scrollTo(y: number): void {
    globalThis.window.scrollY = y;
    globalThis.window.dispatchEvent(new Event('scroll'));
  }

  function renderNav(): { nav: HTMLElement; card: HTMLElement } {
    const nav = document.createElement('nav');
    const card = document.createElement('div');
    card.setAttribute('data-nav-card', '');
    nav.append(card);
    document.body.append(nav);
    return { nav, card };
  }

  beforeEach(() => {
    vi.resetModules();
    createNavbarAnimationMock.mockReset();
    setupMockWindow(0);
  });

  afterEach(() => {
    for (const teardown of teardowns) teardown();
    teardowns = [];
    document.body.innerHTML = '';
  });

  it('should not hide while a dropdown panel is open', async () => {
    const module = await loadScrollModule();
    const { nav } = renderNav();
    nav.dataset.state = 'open';
    module.initScrollBehavior([nav], options);

    scrollTo(500);
    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should not hide while the mobile card is open', async () => {
    const module = await loadScrollModule();
    const { nav, card } = renderNav();
    card.dataset.state = 'open';
    module.initScrollBehavior([nav], options);

    scrollTo(500);
    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should resume hiding on the next scroll after the menu closes', async () => {
    const module = await loadScrollModule();
    const { nav, card } = renderNav();
    card.dataset.state = 'open';
    module.initScrollBehavior([nav], options);

    scrollTo(500);
    card.dataset.state = 'closed';
    expect(createNavbarAnimationMock).not.toHaveBeenCalled();

    scrollTo(700);
    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [nav],
      NAVBAR_CONFIG.position.hidden,
      options,
    );
  });

  it('should still hide when a closed card is present', async () => {
    const module = await loadScrollModule();
    const { nav, card } = renderNav();
    card.dataset.state = 'closed';
    module.initScrollBehavior([nav], options);

    scrollTo(500);
    expect(createNavbarAnimationMock).toHaveBeenCalledTimes(1);
  });
});
