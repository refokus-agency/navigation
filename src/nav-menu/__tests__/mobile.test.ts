import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initNavigationMenu } from '../index.ts';
import {
  type NavMenuMarkup,
  renderNavMenu,
  stubResizeObserver,
} from './helpers.ts';

type MediaQueryStub = {
  setMatches(matches: boolean): void;
  listenerCount(): number;
};

/** Minimal MediaQueryList stub whose `matches` can be flipped at will. */
function stubMatchMedia(initialMatches: boolean): MediaQueryStub {
  const listeners = new Set<() => void>();
  let matches = initialMatches;

  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));

  return {
    setMatches(next) {
      matches = next;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}

type ViewportStub = {
  setWidth(width: number): void;
  queries: string[];
};

/**
 * MediaQueryList stub that evaluates `(max-width: <n>px)` against a fake
 * viewport width, so `matches` depends on the breakpoint actually requested.
 */
function stubViewport(initialWidth: number): ViewportStub {
  const queries: string[] = [];
  const lists: Array<{ notify(): void }> = [];
  let width = initialWidth;

  vi.stubGlobal('matchMedia', (media: string) => {
    queries.push(media);
    const maxWidth = Number(/^\(max-width: (\d+)px\)$/.exec(media)?.[1]);
    const evaluate = () => width <= maxWidth;
    const listeners = new Set<() => void>();
    let previous = evaluate();
    lists.push({
      notify() {
        const current = evaluate();
        if (current === previous) return;
        previous = current;
        for (const listener of listeners) listener();
      },
    });

    return {
      media,
      get matches() {
        return evaluate();
      },
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
    };
  });

  return {
    setWidth(next) {
      width = next;
      for (const list of lists) list.notify();
    },
    queries,
  };
}

let menu: NavMenuMarkup;

beforeEach(() => {
  stubResizeObserver();
  menu = renderNavMenu();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('mobile mode', () => {
  it('should reflect the breakpoint on the root as data-nav-mode', () => {
    stubMatchMedia(true);
    initNavigationMenu();

    expect(menu.root.dataset.navMode).toBe('mobile');
  });

  it('should default to desktop above the breakpoint', () => {
    stubMatchMedia(false);
    initNavigationMenu();

    expect(menu.root.dataset.navMode).toBe('desktop');
  });

  it('should fall back to desktop when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    initNavigationMenu();

    expect(menu.root.dataset.navMode).toBe('desktop');
  });

  it('should close the menu when the breakpoint changes', () => {
    const mediaQuery = stubMatchMedia(false);
    const instance = initNavigationMenu();
    instance?.open('a');

    mediaQuery.setMatches(true);

    expect(menu.root.dataset.navMode).toBe('mobile');
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should drop the breakpoint listener on destroy', () => {
    const mediaQuery = stubMatchMedia(false);
    const instance = initNavigationMenu();
    expect(mediaQuery.listenerCount()).toBe(1);

    instance?.destroy();
    expect(mediaQuery.listenerCount()).toBe(0);
  });

  describe('configurable breakpoint', () => {
    it('should query the breakpoint set by data-nav-breakpoint', () => {
      const viewport = stubViewport(1024);
      menu.root.setAttribute('data-nav-breakpoint', '991');
      initNavigationMenu();

      expect(viewport.queries).toEqual(['(max-width: 991px)']);
    });

    it('should switch data-nav-mode at the custom breakpoint', () => {
      stubViewport(900);
      menu.root.setAttribute('data-nav-breakpoint', '991');
      initNavigationMenu();
      expect(menu.root.dataset.navMode).toBe('mobile');

      menu = renderNavMenu();
      stubViewport(1000);
      menu.root.setAttribute('data-nav-breakpoint', '991');
      initNavigationMenu();
      expect(menu.root.dataset.navMode).toBe('desktop');
    });

    it('should close the open panel when crossing the custom breakpoint', () => {
      const viewport = stubViewport(1000);
      menu.root.setAttribute('data-nav-breakpoint', '991');
      const instance = initNavigationMenu();
      instance?.open('a');

      viewport.setWidth(900);

      expect(menu.root.dataset.navMode).toBe('mobile');
      expect(menu.trigger('a').dataset.state).toBe('closed');
    });

    it.each([
      ['absent', null],
      ['non-numeric', 'abc'],
      ['zero', '0'],
      ['negative', '-5'],
      ['suffixed', '991px'],
      ['padded', ' 991 '],
      ['fractional', '991.5'],
      ['unsafe integer', '99999999999999999999'],
    ])('should fall back to 767px when the value is %s', (_label, value) => {
      const viewport = stubViewport(1024);
      if (value !== null) menu.root.setAttribute('data-nav-breakpoint', value);

      expect(() => initNavigationMenu()).not.toThrow();
      expect(viewport.queries).toEqual(['(max-width: 767px)']);
    });

    it('should read the breakpoint per root', () => {
      const viewport = stubViewport(1024);
      const second = menu.root.cloneNode(true) as HTMLElement;
      document.body.append(second);
      menu.root.setAttribute('data-nav-breakpoint', '991');
      second.setAttribute('data-nav-breakpoint', '1200');

      initNavigationMenu(menu.root);
      initNavigationMenu(second);

      expect(viewport.queries).toEqual([
        '(max-width: 991px)',
        '(max-width: 1200px)',
      ]);
      expect(menu.root.dataset.navMode).toBe('desktop');
      expect(second.dataset.navMode).toBe('mobile');
    });
  });
});

describe('back button', () => {
  it('should close the open panel and prevent navigation', () => {
    stubMatchMedia(true);
    const instance = initNavigationMenu();
    instance?.open('a');

    const back = document.querySelector<HTMLElement>('[data-nav-back]');
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    back?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });
});

describe('Webflow burger overlay', () => {
  it('should reset state when the overlay closes', async () => {
    stubMatchMedia(true);
    const instance = initNavigationMenu();
    const burger = document.querySelector<HTMLElement>('.w-nav-button');

    // MutationObserver callbacks are microtask-scheduled and batched, so the
    // open must be flushed before the close for the transition to register.
    burger?.setAttribute('aria-expanded', 'true');
    await Promise.resolve();

    instance?.open('a');
    burger?.setAttribute('aria-expanded', 'false');
    await Promise.resolve();

    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should keep state while the overlay opens', async () => {
    stubMatchMedia(true);
    const instance = initNavigationMenu();
    const burger = document.querySelector<HTMLElement>('.w-nav-button');

    instance?.open('a');
    burger?.setAttribute('aria-expanded', 'true');
    await Promise.resolve();

    expect(menu.trigger('a').dataset.state).toBe('open');
  });
});
