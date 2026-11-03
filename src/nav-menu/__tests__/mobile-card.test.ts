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

function setup(mobile = true) {
  stubResizeObserver();
  stubMatchMedia(mobile);
  const menu = renderNavMenu();
  menu.root.insertAdjacentHTML(
    'afterbegin',
    '<button type="button" data-nav-toggle>menu</button>',
  );
  card = menu.root.querySelector('[data-nav-list]') as HTMLElement;
  card.setAttribute('data-nav-card', '');
  toggle = menu.root.querySelector('[data-nav-toggle]') as HTMLElement;
  document.body.insertAdjacentHTML('beforeend', '<p id="outside">x</p>');
  return { menu, instance: initNavigationMenu() };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
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

  it('should do nothing on desktop', () => {
    setup(false);
    toggle.click();
    expect(card.dataset.state).toBe('closed');
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

  it('should not steal focus on arrow traversal or programmatic open', () => {
    const { menu, instance } = setup();
    menu.trigger('a').click();
    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'ArrowRight');
    expect(document.activeElement).toBe(menu.trigger('b'));
    menu.trigger('c').blur();
    instance?.open('c');
    expect(document.activeElement).not.toBe(
      menu.content('c').querySelector('a'),
    );
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
