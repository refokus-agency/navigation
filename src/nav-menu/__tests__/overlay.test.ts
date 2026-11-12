import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initNavigationMenu } from '../index.ts';
import {
  firePointer,
  renderNavMenu,
  stubMatchMedia,
  stubResizeObserver,
} from './helpers.ts';

function setup({ inside = false, mobile = false, card = false } = {}) {
  stubResizeObserver();
  stubMatchMedia(mobile);
  const menu = renderNavMenu();
  const overlay = document.createElement('div');
  overlay.setAttribute('data-nav-overlay', '');
  if (inside) menu.root.append(overlay);
  else document.body.append(overlay);
  let toggle: HTMLElement | null = null;
  if (card) {
    menu.root.insertAdjacentHTML(
      'afterbegin',
      '<button type="button" data-nav-toggle>menu</button>',
    );
    menu.root
      .querySelector('[data-nav-list]')
      ?.setAttribute('data-nav-card', '');
    toggle = menu.root.querySelector('[data-nav-toggle]');
  }
  const instance = initNavigationMenu();
  if (!instance) throw new Error('init failed');
  return { menu, overlay, instance, toggle };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('overlay', () => {
  it('should start closed and aria-hidden', () => {
    const { overlay } = setup();
    expect(overlay.dataset.state).toBe('closed');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
  });

  it('should mirror the open state of the panels', () => {
    const { overlay, instance } = setup();
    instance.open('a');
    expect(overlay.dataset.state).toBe('open');
    instance.close();
    expect(overlay.dataset.state).toBe('closed');
  });

  it.each([
    ['outside', false],
    ['inside', true],
  ])('should close the open panel on press, %s the root', (_, inside) => {
    const { menu, overlay, instance } = setup({ inside });
    instance.open('a');
    overlay.click();
    expect(menu.root.dataset.state).toBe('closed');
    expect(overlay.dataset.state).toBe('closed');
  });

  it('should follow and close the mobile card', () => {
    const { overlay, toggle } = setup({ mobile: true, card: true });
    toggle?.click();
    expect(overlay.dataset.state).toBe('open');
    overlay.click();
    expect(overlay.dataset.state).toBe('closed');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  it('should change nothing without the attribute', () => {
    stubResizeObserver();
    stubMatchMedia(false);
    const menu = renderNavMenu();
    const instance = initNavigationMenu();
    instance?.open('a');
    expect(menu.root.dataset.state).toBe('open');
    expect(document.querySelector('[aria-hidden]')).toBeNull();
  });

  it('should restore the element and drop its listener on destroy', () => {
    stubResizeObserver();
    stubMatchMedia(false);
    const menu = renderNavMenu();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div data-nav-overlay aria-hidden="false"></div>',
    );
    const overlay = document.querySelector<HTMLElement>('[data-nav-overlay]');
    if (!overlay) throw new Error('missing overlay');
    const instance = initNavigationMenu();
    instance?.open('a');
    instance?.destroy();
    expect(overlay.dataset.state).toBeUndefined();
    expect(overlay.getAttribute('aria-hidden')).toBe('false');

    // The menu is still open; a press must no longer reach it.
    overlay.click();
    expect(menu.root.dataset.state).toBe('open');
  });
});

describe('overlay shared by two roots', () => {
  function twoRoots() {
    stubResizeObserver();
    stubMatchMedia(false);
    document.body.innerHTML = `
      <div data-nav-overlay></div>
      <nav id="a" data-nav-menu><div data-nav-item="x"><button data-nav-trigger>x</button><div data-nav-content="x">x</div></div></nav>
      <nav id="b" data-nav-menu><div data-nav-item="y"><button data-nav-trigger>y</button><div data-nav-content="y">y</div></div></nav>`;
    const overlay = document.querySelector<HTMLElement>('[data-nav-overlay]');
    if (!overlay) throw new Error('missing overlay');
    overlay.setAttribute('aria-hidden', 'false');
    const a = initNavigationMenu('#a');
    const b = initNavigationMenu('#b');
    return { overlay, a, b };
  }

  it('should give the overlay to the first root only', () => {
    const { overlay, a, b } = twoRoots();
    a?.open('x');
    b?.close();
    expect(overlay.dataset.state).toBe('open');
  });

  it('should restore the original aria-hidden and release the claim', () => {
    const { overlay, a, b } = twoRoots();
    b?.destroy();
    a?.destroy();
    expect(overlay.getAttribute('aria-hidden')).toBe('false');
    const again = initNavigationMenu('#b');
    again?.open('y');
    expect(overlay.dataset.state).toBe('open');
  });
});

describe('overlay press handling', () => {
  it('should close on click, not on pointerdown, so no click falls through', () => {
    const { menu, overlay, instance } = setup();
    instance.open('a');
    firePointer(overlay, 'pointerdown');
    expect(menu.root.dataset.state).toBe('open');
    overlay.click();
    expect(menu.root.dataset.state).toBe('closed');
  });

  it('should not close the mobile card on pointerdown over the overlay', () => {
    const { overlay, toggle } = setup({ mobile: true, card: true });
    toggle?.click();
    firePointer(overlay, 'pointerdown');
    expect(overlay.dataset.state).toBe('open');
  });

  it('should still close on a pointerdown elsewhere outside', () => {
    const { menu, instance } = setup();
    document.body.insertAdjacentHTML('beforeend', '<p id="o">x</p>');
    instance.open('a');
    firePointer(document.getElementById('o') as HTMLElement, 'pointerdown');
    expect(menu.root.dataset.state).toBe('closed');
  });
});

describe('overlay claim edges', () => {
  it('should not let a second root take an overlay inside the first', () => {
    stubResizeObserver();
    stubMatchMedia(false);
    document.body.innerHTML = `
      <div id="a"><div data-nav-item="x"><button data-nav-trigger>x</button><div data-nav-content="x">x</div></div><div data-nav-overlay></div></div>
      <div id="b"><div data-nav-item="y"><button data-nav-trigger>y</button><div data-nav-content="y">y</div></div></div>`;
    const overlay = document.querySelector<HTMLElement>('[data-nav-overlay]');
    const a = initNavigationMenu('#a');
    const b = initNavigationMenu('#b');
    a?.open('x');
    b?.close();
    expect(overlay?.dataset.state).toBe('open');
  });
});
