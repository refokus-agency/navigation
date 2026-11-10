import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initNavigationMenu } from '../index.ts';
import {
  fireKey,
  firePointer,
  renderNavMenu,
  stubMatchMedia,
  stubResizeObserver,
} from './helpers.ts';

let toggle: HTMLElement;
let card: HTMLElement;

function setup(
  mobile = true,
  extraMarkup = '',
  toggleMarkup = '<button type="button" data-nav-toggle>menu</button>',
) {
  stubResizeObserver();
  stubMatchMedia(mobile);
  const menu = renderNavMenu();
  menu.root.insertAdjacentHTML('afterbegin', toggleMarkup);
  card = menu.root.querySelector('[data-nav-list]') as HTMLElement;
  card.setAttribute('data-nav-card', '');
  toggle = menu.root.querySelector('[data-nav-toggle]') as HTMLElement;
  card.insertAdjacentHTML('beforeend', extraMarkup);
  document.body.insertAdjacentHTML('beforeend', '<p id="outside">x</p>');
  return { menu, instance: initNavigationMenu() };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('mobile card', () => {
  it('should wire aria and start closed', () => {
    setup();
    expect(toggle.getAttribute('aria-controls')).toBe(card.id);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(card.dataset.state).toBe('closed');
  });

  it('should open and close on toggle click', () => {
    setup();
    toggle.click();
    expect(card.dataset.state).toBe('open');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(card.dataset.state).toBe('closed');
  });

  it('should wire every toggle, such as a close button inside the card', () => {
    setup(
      true,
      '<button type="button" data-nav-toggle id="close">close</button>',
    );
    const close = document.getElementById('close') as HTMLElement;
    expect(close.getAttribute('aria-controls')).toBe(card.id);
    expect(close.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    expect(close.getAttribute('aria-expanded')).toBe('true');
    close.click();
    expect(card.dataset.state).toBe('closed');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(close.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('should not close the card on tap inside any toggle', () => {
    setup();
    toggle.click();
    firePointer(toggle, 'pointerdown');
    expect(card.dataset.state).toBe('open');
  });

  it('should open from an <a href> toggle without immediately closing', () => {
    setup(true, '', '<a href="#" data-nav-toggle>menu</a>');
    toggle.click();
    expect(card.dataset.state).toBe('open');
  });

  it('should close on Escape and refocus the toggle', () => {
    setup();
    toggle.click();
    fireKey(document.body, 'Escape');
    expect(card.dataset.state).toBe('closed');
    expect(document.activeElement).toBe(toggle);
  });

  it('should close on outside click but not inside', () => {
    const { menu } = setup();
    toggle.click();
    firePointer(menu.trigger('a'), 'pointerdown');
    expect(card.dataset.state).toBe('open');
    firePointer(
      document.getElementById('outside') as HTMLElement,
      'pointerdown',
    );
    expect(card.dataset.state).toBe('closed');
  });

  it('should not treat a tap in a panel outside the card as outside', () => {
    const { menu } = setup();
    toggle.click();
    menu.trigger('a').click();
    expect(card.contains(menu.content('a'))).toBe(false);
    firePointer(
      menu.content('a').querySelector('a') as HTMLElement,
      'pointerdown',
    );
    expect(card.dataset.state).toBe('open');
    expect(menu.content('a').dataset.state).toBe('open');
  });

  it('should close the card when a link in an outside panel is followed', () => {
    const { menu } = setup();
    toggle.click();
    menu.trigger('a').click();
    (menu.content('a').querySelector('a') as HTMLElement).click();
    expect(card.dataset.state).toBe('closed');
  });

  it('should keep the card open when an <a href> back control is tapped', () => {
    const { menu } = setup();
    card.insertAdjacentHTML('beforeend', '<a href="#" data-nav-back>back</a>');
    toggle.click();
    menu.trigger('a').click();
    (card.querySelector('a[data-nav-back]') as HTMLElement).click();
    expect(card.dataset.state).toBe('open');
  });

  it('should close an open panel along with the card', () => {
    const { menu } = setup();
    toggle.click();
    menu.trigger('a').click();
    toggle.click();
    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should only let Escape close the panel first, then the card', () => {
    const { menu } = setup();
    toggle.click();
    menu.trigger('a').click();
    fireKey(menu.trigger('a'), 'Escape');
    expect(menu.content('a').dataset.state).toBe('closed');
    expect(card.dataset.state).toBe('open');
  });

  it('should do nothing on desktop and leave the card unmarked', () => {
    setup(false);
    toggle.click();
    expect(card.dataset.state).toBeUndefined();
    expect(card.hasAttribute('inert')).toBe(false);
  });

  it('should add and remove card state as the breakpoint is crossed', () => {
    const listeners = new Set<() => void>();
    let matches = false;
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    }));
    stubResizeObserver();
    const menu = renderNavMenu();
    menu.root.insertAdjacentHTML(
      'afterbegin',
      '<button type="button" data-nav-toggle>menu</button>',
    );
    card = menu.root.querySelector('[data-nav-list]') as HTMLElement;
    card.setAttribute('data-nav-card', '');
    initNavigationMenu();
    const cross = (next: boolean) => {
      matches = next;
      for (const listener of listeners) listener();
    };

    expect(card.dataset.state).toBeUndefined();
    cross(true);
    expect(card.dataset.state).toBe('closed');
    expect(card.hasAttribute('inert')).toBe(true);
    cross(false);
    expect(card.dataset.state).toBeUndefined();
    expect(card.hasAttribute('inert')).toBe(false);
  });

  it('should stop listening and hand the card back on destroy', () => {
    const { instance } = setup();
    expect(card.hasAttribute('inert')).toBe(true);
    instance?.destroy();
    expect(card.hasAttribute('inert')).toBe(false);
    expect(card.dataset.state).toBeUndefined();
    expect(toggle.hasAttribute('aria-expanded')).toBe(false);
    toggle.click();
    expect(card.dataset.state).toBeUndefined();
  });

  it('should close when focus leaves the nav', () => {
    setup();
    toggle.click();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    expect(card.dataset.state).toBe('closed');
  });

  it('should close when a link in the card is followed', () => {
    const { menu } = setup();
    toggle.click();
    (menu.root.querySelector('[data-nav-link]') as HTMLElement).click();
    expect(card.dataset.state).toBe('closed');
  });

  it('should stay open when a link click is not followed', () => {
    const { menu } = setup();
    const link = menu.root.querySelector('[data-nav-link]') as HTMLElement;
    link.addEventListener('click', (event) => event.preventDefault());
    toggle.click();
    link.click();
    expect(card.dataset.state).toBe('open');
  });

  it('should stay open for a shift-click on a link', () => {
    const { menu } = setup();
    toggle.click();
    (menu.root.querySelector('[data-nav-link]') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true, shiftKey: true }),
    );
    expect(card.dataset.state).toBe('open');
  });

  it('should keep a panel open for unfollowed clicks on its links', () => {
    const { menu } = setup();
    toggle.click();
    menu.trigger('a').click();
    const link = menu.content('a').querySelector('a') as HTMLElement;
    link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, shiftKey: true }),
    );
    expect(menu.content('a').dataset.state).toBe('open');
    link.addEventListener('click', (event) => event.preventDefault());
    link.click();
    expect(menu.content('a').dataset.state).toBe('open');
  });

  it('should stay open for a modifier-click on a link', () => {
    const { menu } = setup();
    toggle.click();
    (menu.root.querySelector('[data-nav-link]') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true, ctrlKey: true }),
    );
    expect(card.dataset.state).toBe('open');
  });
});

describe('mobile accordion', () => {
  it('should keep one panel open and mirror state on items', () => {
    const { menu } = setup();
    menu.trigger('a').click();
    menu.trigger('b').click();
    const item = (v: string) =>
      menu.root.querySelector(`[data-nav-item="${v}"]`) as HTMLElement;
    expect(item('a').dataset.state).toBe('closed');
    expect(item('b').dataset.state).toBe('open');
    expect(menu.content('a').dataset.state).toBe('closed');
    expect(menu.content('b').dataset.state).toBe('open');
  });

  it('should focus the first link on open', () => {
    const { menu } = setup();
    menu.trigger('a').click();
    expect(document.activeElement).toBe(menu.content('a').querySelector('a'));
  });

  it('should focus the first link on Enter too', () => {
    const { menu } = setup();
    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'Enter');
    expect(document.activeElement).toBe(menu.content('a').querySelector('a'));
  });

  it('should keep focus on the trigger during arrow traversal', () => {
    const { menu } = setup();
    menu.trigger('a').click();
    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'ArrowRight');
    // The next panel opened, yet focus stayed on its trigger.
    expect(menu.content('b').dataset.state).toBe('open');
    expect(document.activeElement).toBe(menu.trigger('b'));
  });

  it('should not move focus on a programmatic open', () => {
    const { menu, instance } = setup();
    menu.trigger('b').focus();
    instance?.open('c');
    expect(menu.content('c').dataset.state).toBe('open');
    // Exact element, so focus landing anywhere else fails the test.
    expect(document.activeElement).toBe(menu.trigger('b'));
  });

  it('should mirror item state on desktop so a crossing cannot strand it', () => {
    const { menu } = setup(false);
    const item = menu.root.querySelector('[data-nav-item="a"]') as HTMLElement;
    menu.trigger('a').click();
    expect(item.dataset.state).toBe('open');
    menu.trigger('b').click();
    expect(item.dataset.state).toBe('closed');
  });
});

describe('mobile card page scroll lock', () => {
  const html = () => document.documentElement;

  afterEach(() => {
    delete (window as unknown as { lenis?: unknown }).lenis;
    html().style.overflow = '';
    document.body.style.overflow = '';
  });

  it('should freeze page scroll while open and restore it on close', () => {
    html().style.overflow = 'auto';
    setup();
    toggle.click();
    expect(html().style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');

    toggle.click();
    expect(html().style.overflow).toBe('auto');
    expect(document.body.style.overflow).toBe('');
  });

  it('should keep the scroll position untouched across open and close', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    setup();
    toggle.click();
    toggle.click();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('should not lock on desktop', () => {
    setup(false);
    toggle.click();
    expect(html().style.overflow).toBe('');
  });

  it('should unlock when the viewport grows to desktop', () => {
    let matches = true;
    let notify: (() => void) | undefined;
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => {
        notify = listener;
      },
      removeEventListener: () => {},
    }));
    stubResizeObserver();
    const menu = renderNavMenu();
    menu.root.insertAdjacentHTML(
      'afterbegin',
      '<button type="button" data-nav-toggle>menu</button>',
    );
    menu.root
      .querySelector('[data-nav-list]')
      ?.setAttribute('data-nav-card', '');
    initNavigationMenu();
    menu.root.querySelector<HTMLElement>('[data-nav-toggle]')?.click();
    expect(html().style.overflow).toBe('hidden');

    matches = false;
    notify?.();
    expect(html().style.overflow).toBe('');
  });

  it('should unlock on destroy', () => {
    const { instance } = setup();
    toggle.click();
    instance?.destroy();
    expect(html().style.overflow).toBe('');
  });

  it('should stop and restart Lenis and let the card scroll natively', () => {
    const lenis = { stop: vi.fn(), start: vi.fn(), isStopped: false };
    (window as unknown as { lenis: unknown }).lenis = lenis;
    setup();

    toggle.click();
    expect(lenis.stop).toHaveBeenCalledTimes(1);
    expect(card.hasAttribute('data-lenis-prevent')).toBe(true);

    toggle.click();
    expect(lenis.start).toHaveBeenCalledTimes(1);
    expect(card.hasAttribute('data-lenis-prevent')).toBe(false);
  });

  it('should leave an already-stopped Lenis alone', () => {
    const lenis = { stop: vi.fn(), start: vi.fn(), isStopped: true };
    (window as unknown as { lenis: unknown }).lenis = lenis;
    setup();

    toggle.click();
    toggle.click();
    expect(lenis.stop).not.toHaveBeenCalled();
    expect(lenis.start).not.toHaveBeenCalled();
  });
});
