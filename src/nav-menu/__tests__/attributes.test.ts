import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import type { NavMenuOptions } from '../../index.ts';
import { NAV_MENU_CONFIG } from '../config.ts';
import { initNavigationMenu } from '../index.ts';
import type { InitNavigationMenuOptions } from '../types.ts';
import {
  firePointer,
  type NavMenuMarkup,
  renderNavMenu,
  stubResizeObserver,
} from './helpers.ts';

const { root: rootSelector } = NAV_MENU_CONFIG.selectors;

let menu: NavMenuMarkup;

function setAttributes(attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) {
    menu.root.setAttribute(name, value);
  }
}

function init(options: InitNavigationMenuOptions = {}) {
  return initNavigationMenu(rootSelector, options);
}

/** Hovers `value` and reports how many ms it took to open, up to `limit`. */
function measureOpenDelay(value: string, limit = 2000): number {
  firePointer(menu.trigger(value), 'pointerenter');
  for (let elapsed = 0; elapsed <= limit; elapsed += 1) {
    // The first step advances 0 ms, so a zero-delay timer still counts as 0.
    vi.advanceTimersByTime(elapsed === 0 ? 0 : 1);
    if (menu.trigger(value).dataset.state === 'open') return elapsed;
  }
  return Number.POSITIVE_INFINITY;
}

beforeEach(() => {
  vi.useFakeTimers();
  stubResizeObserver();
  menu = renderNavMenu();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('nav-menu root attributes (AC-1)', () => {
  it('should read data-nav-delay from the root', () => {
    setAttributes({ 'data-nav-delay': '50' });
    init();

    expect(measureOpenDelay('a')).toBe(50);
  });

  it('should read data-nav-skip-delay from the root', () => {
    setAttributes({ 'data-nav-skip-delay': '1000' });
    init();

    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(200);
    firePointer(menu.trigger('a'), 'pointerleave');
    vi.advanceTimersByTime(150);
    expect(menu.trigger('a').dataset.state).toBe('closed');

    // Past the default 300 ms window, still inside the 1000 ms one.
    vi.advanceTimersByTime(500);
    firePointer(menu.trigger('b'), 'pointerenter');
    expect(menu.trigger('b').dataset.state).toBe('open');
  });

  it('should read data-nav-orientation from the root', () => {
    setAttributes({ 'data-nav-orientation': 'vertical' });
    init();

    expect(menu.root.getAttribute('data-orientation')).toBe('vertical');
    expect(menu.viewport.getAttribute('data-orientation')).toBe('vertical');
  });

  it('should read data-nav-dir from the root', () => {
    setAttributes({ 'data-nav-dir': 'rtl' });
    const instance = init();

    instance?.open('a');
    instance?.open('b');

    expect(menu.content('b').dataset.motion).toBe('from-start');
    expect(menu.content('a').dataset.motion).toBe('to-end');
  });

  it('should read the attributes once, at init', () => {
    setAttributes({ 'data-nav-delay': '50' });
    init();
    setAttributes({ 'data-nav-delay': '500' });

    expect(measureOpenDelay('a')).toBe(50);
  });

  it('should resolve each root independently', () => {
    document.body.innerHTML = `
      <nav id="one" data-nav-menu data-nav-orientation="vertical"></nav>
      <nav id="two" data-nav-menu></nav>
    `;
    const one = document.getElementById('one') as HTMLElement;
    const two = document.getElementById('two') as HTMLElement;

    initNavigationMenu(one);
    initNavigationMenu(two);

    expect(one.getAttribute('data-orientation')).toBe('vertical');
    expect(two.getAttribute('data-orientation')).toBe('horizontal');
  });
});

describe('nav-menu attribute precedence (AC-3)', () => {
  it('should prefer a valid attribute over the JS option', () => {
    setAttributes({
      'data-nav-delay': '50',
      'data-nav-orientation': 'vertical',
    });
    init({ delayDuration: 500, orientation: 'horizontal' });

    expect(menu.root.getAttribute('data-orientation')).toBe('vertical');
    expect(measureOpenDelay('a')).toBe(50);
  });
});

describe('nav-menu invalid attributes (AC-4)', () => {
  it('should fall back to a valid JS option for an invalid attribute', () => {
    setAttributes({
      'data-nav-delay': '300ms',
      'data-nav-orientation': 'vertcal',
    });
    init({ delayDuration: 100, orientation: 'vertical' });

    expect(menu.root.getAttribute('data-orientation')).toBe('vertical');
    expect(measureOpenDelay('a')).toBe(100);
  });

  it('should fall back to the default for an empty attribute and no JS option', () => {
    setAttributes({
      'data-nav-delay': '',
      'data-nav-orientation': 'Vertical',
      'data-nav-dir': 'RTL',
    });
    const instance = init();

    expect(menu.root.getAttribute('data-orientation')).toBe('horizontal');
    instance?.open('a');
    instance?.open('b');
    expect(menu.content('b').dataset.motion).toBe('from-end');
    instance?.close();
    vi.advanceTimersByTime(1000);
    expect(measureOpenDelay('a')).toBe(200);
  });

  it('should fall back to the default for an invalid JS option', () => {
    init({
      delayDuration: '50',
      orientation: 'diagonal',
    } as unknown as InitNavigationMenuOptions);

    expect(menu.root.getAttribute('data-orientation')).toBe('horizontal');
    expect(measureOpenDelay('a')).toBe(200);
  });

  it('should neither log nor throw', () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(
      (method) => vi.spyOn(console, method).mockImplementation(() => {}),
    );
    setAttributes({
      'data-nav-delay': '300ms',
      'data-nav-skip-delay': ' 200 ',
      'data-nav-close-delay': 'soon',
      'data-nav-orientation': 'vertcal',
      'data-nav-dir': 'up',
    });

    expect(() => init()).not.toThrow();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('nav-menu numeric attributes (AC-5)', () => {
  it('should use "0" as given', () => {
    setAttributes({ 'data-nav-delay': '0' });
    init();

    expect(measureOpenDelay('a')).toBe(0);
  });

  it('should use "99999" as given', () => {
    setAttributes({ 'data-nav-delay': '99999' });
    init();

    expect(measureOpenDelay('a', 3000)).toBe(Number.POSITIVE_INFINITY);
    vi.advanceTimersByTime(99999);
    expect(menu.trigger('a').dataset.state).toBe('open');
  });

  it('should fall back to the JS option for a negative attribute', () => {
    setAttributes({ 'data-nav-delay': '-20' });
    init({ delayDuration: 500 });

    expect(measureOpenDelay('a')).toBe(500);
  });

  it('should fall back to the default for a negative JS option', () => {
    init({ delayDuration: -20 });

    expect(measureOpenDelay('a')).toBe(200);
  });
});

describe('close delay (AC-7)', () => {
  /** Opens `a` by hover, leaves it, and reports how long it stayed open. */
  function measureCloseDelay(limit = 2000): number {
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(1000);
    expect(menu.trigger('a').dataset.state).toBe('open');

    firePointer(menu.trigger('a'), 'pointerleave');
    for (let elapsed = 0; elapsed <= limit; elapsed += 1) {
      vi.advanceTimersByTime(elapsed === 0 ? 0 : 1);
      if (menu.trigger('a').dataset.state === 'closed') return elapsed;
    }
    return Number.POSITIVE_INFINITY;
  }

  it('should wait data-nav-close-delay ms before a hover close', () => {
    setAttributes({ 'data-nav-close-delay': '500' });
    init();

    expect(measureCloseDelay()).toBe(500);
  });

  it('should wait closeDelay ms before a hover close', () => {
    init({ closeDelay: 500 });

    expect(measureCloseDelay()).toBe(500);
  });

  it('should prefer data-nav-close-delay over closeDelay', () => {
    setAttributes({ 'data-nav-close-delay': '40' });
    init({ closeDelay: 500 });

    expect(measureCloseDelay()).toBe(40);
  });

  it('should fall back to the default for a negative closeDelay', () => {
    init({ closeDelay: -20 });

    expect(measureCloseDelay()).toBe(150);
  });

  it('should fall back to the default for a negative data-nav-close-delay', () => {
    setAttributes({ 'data-nav-close-delay': '-20' });
    init();

    expect(measureCloseDelay()).toBe(150);
  });

  it('should keep closeDelay optional on the public NavMenuOptions type', () => {
    // Compiles only while closeDelay is optional: `pnpm typecheck` covers tests.
    const options: NavMenuOptions = {
      delayDuration: 200,
      skipDelayDuration: 300,
      orientation: 'horizontal',
      dir: 'ltr',
      skipInWebflowEditor: true,
    };

    expect(options).not.toHaveProperty('closeDelay');
    expectTypeOf<NavMenuOptions['closeDelay']>().toEqualTypeOf<
      number | undefined
    >();
  });

  it('should wait 150 ms by default', () => {
    init();

    expect(measureCloseDelay()).toBe(150);
  });
});
