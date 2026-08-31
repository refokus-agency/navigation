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
