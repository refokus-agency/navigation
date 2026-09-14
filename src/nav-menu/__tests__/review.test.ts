import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_MENU_CONFIG } from '../config.ts';
import { initNavigationMenu } from '../index.ts';
import {
  firePointer,
  fireKey,
  type NavMenuMarkup,
  renderNavMenu,
  stubResizeObserver,
} from './helpers.ts';

const delayDuration = 200;
const closeDelay = NAV_MENU_CONFIG.timing.closeDelay;

let menu: NavMenuMarkup;

beforeEach(() => {
  stubResizeObserver();
  menu = renderNavMenu();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('hover guard on panel targets', () => {
  it('should ignore a touch pointerenter on the viewport', () => {
    vi.useFakeTimers();
    initNavigationMenu();

    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);
    firePointer(menu.trigger('a'), 'pointerleave');

    // A touchscreen laptop at desktop width: this must not clear the close
    // timer, because the matching pointerleave is filtered out.
    firePointer(menu.viewport, 'pointerenter', 'touch');

    vi.advanceTimersByTime(closeDelay);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });
});

describe('pending hover-open cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const startPendingOpen = () => {
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration - 50);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  };

  it('should cancel on a pointerdown outside the nav', () => {
    initNavigationMenu();
    startPendingOpen();

    firePointer(document.body, 'pointerdown');

    vi.advanceTimersByTime(delayDuration * 2);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should cancel on Escape', () => {
    initNavigationMenu();
    startPendingOpen();

    fireKey(menu.trigger('a'), 'Escape');

    vi.advanceTimersByTime(delayDuration * 2);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should cancel when the menu is closed programmatically', () => {
    const instance = initNavigationMenu();
    startPendingOpen();

    instance?.close();

    vi.advanceTimersByTime(delayDuration * 2);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should still open when only a stale close timer elapses', () => {
    initNavigationMenu();

    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);
    firePointer(menu.trigger('a'), 'pointerleave');
    vi.advanceTimersByTime(closeDelay + 400);

    // Re-entering schedules an open while a close timer is also pending; the
    // close firing must not cancel the open.
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);

    expect(menu.trigger('a').dataset.state).toBe('open');
  });
});

describe('several triggers in one item', () => {
  const markup = `
    <nav data-nav-menu>
      <div data-nav-list>
        <div data-nav-item="products">
          <button type="button" data-nav-trigger id="primary">P</button>
          <button type="button" data-nav-trigger id="secondary">P2</button>
        </div>
        <div data-nav-item="pricing">
          <button type="button" data-nav-trigger id="next">Pricing</button>
        </div>
      </div>
      <div data-nav-viewport>
        <div data-nav-content="products"><a href="/p">P</a></div>
        <div data-nav-content="pricing"><a href="/q">Q</a></div>
      </div>
    </nav>
  `;

  it('should give the secondary trigger ARIA without duplicating ids', () => {
    document.body.innerHTML = markup;
    initNavigationMenu();

    const primary = document.querySelector<HTMLElement>('#primary');
    const secondary = document.querySelector<HTMLElement>('#secondary');
    const content = document.querySelector<HTMLElement>(
      '[data-nav-content="products"]',
    );

    expect(secondary?.getAttribute('aria-expanded')).toBe('false');
    expect(secondary?.getAttribute('aria-controls')).toBe(content?.id);
    // Only the first trigger is named, and author ids are left alone.
    expect(primary?.id).toBe('primary');
    expect(content?.getAttribute('aria-labelledby')).toBe('primary');

    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should open from the secondary trigger on hover', () => {
    vi.useFakeTimers();
    document.body.innerHTML = markup;
    initNavigationMenu();

    const secondary = document.querySelector<HTMLElement>('#secondary');
    firePointer(secondary as HTMLElement, 'pointerenter');
    vi.advanceTimersByTime(delayDuration);

    expect(
      document.querySelector<HTMLElement>('[data-nav-content="products"]')
        ?.dataset.state,
    ).toBe('open');
  });

  it('should open from the secondary trigger on click', () => {
    document.body.innerHTML = markup;
    initNavigationMenu();

    document.querySelector<HTMLElement>('#secondary')?.click();

    expect(
      document.querySelector<HTMLElement>('[data-nav-content="products"]')
        ?.dataset.state,
    ).toBe('open');
  });

  it('should move arrow focus to the neighbour, not the first item', () => {
    document.body.innerHTML = markup;
    initNavigationMenu();

    const secondary = document.querySelector<HTMLElement>('#secondary');
    secondary?.focus();
    fireKey(secondary as HTMLElement, 'ArrowRight');

    expect(document.activeElement).toBe(document.querySelector('#next'));
  });
});

describe('two menus on one page', () => {
  it('should not emit duplicate ids for positional values', () => {
    document.body.innerHTML = `
      <nav data-nav-menu id="desktop">
        <div data-nav-list>
          <div data-nav-item>
            <button type="button" data-nav-trigger>a</button>
            <div data-nav-content>panel</div>
          </div>
        </div>
      </nav>
      <nav data-nav-menu id="mobile">
        <div data-nav-list>
          <div data-nav-item>
            <button type="button" data-nav-trigger>a</button>
            <div data-nav-content>panel</div>
          </div>
        </div>
      </nav>
    `;

    const roots = document.querySelectorAll<HTMLElement>('[data-nav-menu]');
    for (const root of roots) initNavigationMenu(root);

    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Each trigger must resolve to the panel in its own root.
    for (const root of roots) {
      const trigger = root.querySelector<HTMLElement>('[data-nav-trigger]');
      const content = root.querySelector<HTMLElement>('[data-nav-content]');
      expect(trigger?.getAttribute('aria-controls')).toBe(content?.id);
      expect(document.getElementById(content?.id as string)).toBe(content);
    }
  });
});

describe('triggers inside a panel', () => {
  it('should not register a nested item that Tab cannot reach', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="products">
            <button type="button" data-nav-trigger id="top">P</button>
          </div>
        </div>
        <div data-nav-viewport>
          <div data-nav-content="products">
            <div data-nav-item="column">
              <button type="button" data-nav-trigger id="inner">C</button>
            </div>
          </div>
        </div>
      </nav>
    `;
    initNavigationMenu();

    const inner = document.querySelector<HTMLElement>('#inner');
    const top = document.querySelector<HTMLElement>('#top');

    expect(inner?.hasAttribute('aria-expanded')).toBe(false);
    expect(inner?.dataset.state).toBeUndefined();

    // End must not be able to strand focus on an unreachable trigger.
    top?.focus();
    fireKey(top as HTMLElement, 'End');
    expect(document.activeElement).toBe(top);
  });
});

describe('a panel outside the viewport', () => {
  it('should keep itself open under the cursor', () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="a">
            <button type="button" data-nav-trigger>a</button>
            <div data-nav-content="a"><a href="/a">a</a></div>
          </div>
        </div>
        <div data-nav-viewport></div>
      </nav>
    `;
    initNavigationMenu();

    const trigger = document.querySelector<HTMLElement>('[data-nav-trigger]');
    const content = document.querySelector<HTMLElement>('[data-nav-content]');

    firePointer(trigger as HTMLElement, 'pointerenter');
    vi.advanceTimersByTime(delayDuration);
    expect(content?.dataset.state).toBe('open');

    firePointer(trigger as HTMLElement, 'pointerleave');
    firePointer(content as HTMLElement, 'pointerenter');
    vi.advanceTimersByTime(closeDelay * 4);

    expect(content?.dataset.state).toBe('open');
  });
});

describe('burger overlay batching', () => {
  it('should reset when an open and close land in the same tick', async () => {
    const instance = initNavigationMenu();
    const burger = document.querySelector<HTMLElement>('.w-nav-button');

    instance?.open('a');
    // Coalesced into one observer callback — a tracked flag would read
    // false -> false and miss the close entirely.
    burger?.setAttribute('aria-expanded', 'true');
    burger?.setAttribute('aria-expanded', 'false');
    await Promise.resolve();

    expect(menu.trigger('a').dataset.state).toBe('closed');
  });
});

describe('burger overlay batching, reopened in the same tick', () => {
  it('should stay open when the batch ends open', async () => {
    const instance = initNavigationMenu();
    const burger = document.querySelector<HTMLElement>('.w-nav-button');

    burger?.setAttribute('aria-expanded', 'true');
    await Promise.resolve();
    instance?.open('a');

    // true -> false -> true in one tick: oldValues are ['true', 'false'], so a
    // `some` on oldValue is true, but the overlay ends open and must not reset.
    burger?.setAttribute('aria-expanded', 'false');
    burger?.setAttribute('aria-expanded', 'true');
    await Promise.resolve();

    expect(menu.trigger('a').dataset.state).toBe('open');
  });
});

describe('teardown', () => {
  it('should clear hover timers through the cleanups array', () => {
    vi.useFakeTimers();
    const instance = initNavigationMenu();

    firePointer(menu.trigger('a'), 'pointerenter');
    instance?.destroy();

    vi.advanceTimersByTime(delayDuration * 2);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// Second review round: residual timer exposure and focus return with several
// triggers on one item.
// ---------------------------------------------------------------------------

describe('toggle-close during a pending hover-open', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should not reopen after a click-close', () => {
    initNavigationMenu();

    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(40);
    menu.trigger('a').click();
    menu.trigger('a').click();
    expect(menu.trigger('a').dataset.state).toBe('closed');

    vi.advanceTimersByTime(delayDuration);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should not reopen after an Enter-close', () => {
    initNavigationMenu();
    menu.trigger('a').focus();

    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(40);
    fireKey(menu.trigger('a'), 'Enter');
    fireKey(menu.trigger('a'), 'Enter');
    expect(menu.trigger('a').dataset.state).toBe('closed');

    vi.advanceTimersByTime(delayDuration);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });
});

describe('programmatic open during a pending close', () => {
  it('should not be undone by a stale close timer', () => {
    vi.useFakeTimers();
    const instance = initNavigationMenu();

    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);
    firePointer(menu.trigger('a'), 'pointerleave');

    instance?.open('b');
    vi.advanceTimersByTime(closeDelay);

    expect(menu.trigger('b').dataset.state).toBe('open');
  });
});

describe('focus return with several triggers on one item', () => {
  const markup = `
    <nav data-nav-menu>
      <div data-nav-list>
        <div data-nav-item="products">
          <a data-nav-trigger href="/products" id="text-link">Products</a>
          <button type="button" data-nav-trigger id="chevron">▾</button>
        </div>
        <div data-nav-item="pricing">
          <button type="button" data-nav-trigger id="pricing-trigger">P</button>
        </div>
      </div>
      <div data-nav-viewport>
        <div data-nav-content="products"><a href="/p" id="panel-link">P</a></div>
        <div data-nav-content="pricing"><a href="/q">Q</a></div>
      </div>
    </nav>
  `;

  it('should return Escape focus to the trigger that opened the panel', () => {
    document.body.innerHTML = markup;
    initNavigationMenu();

    const chevron = document.querySelector<HTMLElement>('#chevron');
    chevron?.click();
    fireKey(chevron as HTMLElement, 'Escape');

    expect(document.activeElement).toBe(chevron);
  });

  it('should return Shift+Tab focus to the trigger that opened the panel', () => {
    document.body.innerHTML = markup;
    initNavigationMenu();

    document.querySelector<HTMLElement>('#chevron')?.click();
    const panelLink = document.querySelector<HTMLElement>('#panel-link');
    panelLink?.focus();

    fireKey(panelLink as HTMLElement, 'Tab', { shiftKey: true });

    expect(document.activeElement).toBe(document.querySelector('#chevron'));
  });

  it('should Tab forward out of the panel, never back onto a passed trigger', () => {
    document.body.innerHTML = markup;
    initNavigationMenu();

    document.querySelector<HTMLElement>('#chevron')?.click();
    const panelLink = document.querySelector<HTMLElement>('#panel-link');
    panelLink?.focus();

    fireKey(panelLink as HTMLElement, 'Tab');

    expect(document.activeElement).toBe(
      document.querySelector('#pricing-trigger'),
    );
  });
});
