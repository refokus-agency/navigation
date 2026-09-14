import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_MENU_CONFIG } from '../config.ts';
import { initNavigationMenu } from '../index.ts';
import {
  fireKey,
  type NavMenuMarkup,
  renderNavMenu,
  stubResizeObserver,
} from './helpers.ts';

let menu: NavMenuMarkup;

beforeEach(() => {
  stubResizeObserver();
  menu = renderNavMenu();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('keyboard navigation (horizontal)', () => {
  beforeEach(() => {
    initNavigationMenu();
  });

  it('should move focus between triggers with ArrowRight/ArrowLeft', () => {
    menu.trigger('a').focus();

    fireKey(menu.trigger('a'), 'ArrowRight');
    expect(document.activeElement).toBe(menu.trigger('b'));

    fireKey(menu.trigger('b'), 'ArrowLeft');
    expect(document.activeElement).toBe(menu.trigger('a'));
  });

  it('should wrap focus at both ends', () => {
    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'ArrowLeft');
    expect(document.activeElement).toBe(menu.trigger('c'));

    fireKey(menu.trigger('c'), 'ArrowRight');
    expect(document.activeElement).toBe(menu.trigger('a'));
  });

  it('should jump to the first and last trigger with Home/End', () => {
    menu.trigger('b').focus();

    fireKey(menu.trigger('b'), 'End');
    expect(document.activeElement).toBe(menu.trigger('c'));

    fireKey(menu.trigger('c'), 'Home');
    expect(document.activeElement).toBe(menu.trigger('a'));
  });

  it('should follow the focused trigger while a panel is open', () => {
    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'Enter');
    expect(menu.trigger('a').dataset.state).toBe('open');

    fireKey(menu.trigger('a'), 'ArrowRight');
    expect(menu.trigger('a').dataset.state).toBe('closed');
    expect(menu.trigger('b').dataset.state).toBe('open');
  });

  it('should toggle the focused panel with Enter and Space', () => {
    menu.trigger('a').focus();

    fireKey(menu.trigger('a'), 'Enter');
    expect(menu.trigger('a').dataset.state).toBe('open');

    fireKey(menu.trigger('a'), ' ');
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should let Enter reopen a panel closed by click on the same trigger', () => {
    menu.trigger('a').click();
    menu.trigger('a').click();
    expect(menu.trigger('a').dataset.state).toBe('closed');

    fireKey(menu.trigger('a'), 'Enter');
    expect(menu.trigger('a').dataset.state).toBe('open');
  });

  it('should move focus into the open panel with ArrowDown', () => {
    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'Enter');

    fireKey(menu.trigger('a'), 'ArrowDown');
    expect(document.activeElement).toBe(menu.content('a').querySelector('a'));
  });

  it('should ignore ArrowDown when nothing is open', () => {
    menu.trigger('a').focus();

    const event = fireKey(menu.trigger('a'), 'ArrowDown');
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(menu.trigger('a'));
  });

  it('should close on Escape and return focus to the trigger', () => {
    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'Enter');

    menu.content('a').querySelector<HTMLElement>('a')?.focus();
    fireKey(menu.content('a'), 'Escape');

    expect(menu.trigger('a').dataset.state).toBe('closed');
    expect(document.activeElement).toBe(menu.trigger('a'));
  });

  it('should leave Escape unhandled when nothing is open', () => {
    const event = fireKey(menu.trigger('a'), 'Escape');
    expect(event.defaultPrevented).toBe(false);
  });

  it('should block hover reopen after an Escape close', () => {
    vi.useFakeTimers();

    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'Enter');
    fireKey(menu.trigger('a'), 'Escape');

    const enter = new Event('pointerenter');
    Object.defineProperty(enter, 'pointerType', { value: 'mouse' });
    menu.trigger('a').dispatchEvent(enter);

    vi.advanceTimersByTime(1000);
    expect(menu.trigger('a').dataset.state).toBe('closed');

    vi.useRealTimers();
  });

  it('should ignore Enter on a trigger without content', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="a"><button type="button" data-nav-trigger>a</button></div>
        </div>
      </nav>
    `;
    initNavigationMenu();

    const trigger = document.querySelector<HTMLElement>('[data-nav-trigger]');
    const event = fireKey(trigger as HTMLElement, 'Enter');

    expect(event.defaultPrevented).toBe(false);
  });
});

describe('keyboard navigation (vertical)', () => {
  it('should use ArrowDown/ArrowUp to move and ArrowRight to enter', () => {
    initNavigationMenu(NAV_MENU_CONFIG.selectors.root, {
      orientation: 'vertical',
    });

    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'ArrowDown');
    expect(document.activeElement).toBe(menu.trigger('b'));

    fireKey(menu.trigger('b'), 'ArrowUp');
    expect(document.activeElement).toBe(menu.trigger('a'));

    fireKey(menu.trigger('a'), 'Enter');
    fireKey(menu.trigger('a'), 'ArrowRight');
    expect(document.activeElement).toBe(menu.content('a').querySelector('a'));
  });
});
