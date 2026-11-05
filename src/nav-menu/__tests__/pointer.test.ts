import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_MENU_CONFIG } from '../config.ts';
import { initNavigationMenu } from '../index.ts';
import {
  firePointer,
  type NavMenuMarkup,
  renderNavMenu,
  stubResizeObserver,
} from './helpers.ts';

// Mirrors DEFAULT_OPTIONS in nav-menu/index.ts
const delayDuration = 200;
const skipDelayDuration = 300;
const closeDelay = NAV_MENU_CONFIG.timing.closeDelay;

let menu: NavMenuMarkup;

beforeEach(() => {
  vi.useFakeTimers();
  stubResizeObserver();
  menu = renderNavMenu();
  initNavigationMenu();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('hover behavior', () => {
  it('should open only after delayDuration elapses', () => {
    firePointer(menu.trigger('a'), 'pointerenter');

    vi.advanceTimersByTime(delayDuration - 1);
    expect(menu.trigger('a').dataset.state).toBe('closed');

    vi.advanceTimersByTime(1);
    expect(menu.trigger('a').dataset.state).toBe('open');
  });

  it('should cancel a pending open when the pointer leaves early', () => {
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration - 50);
    firePointer(menu.trigger('a'), 'pointerleave');

    vi.advanceTimersByTime(delayDuration);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should switch panels instantly while inside the skip window', () => {
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);
    firePointer(menu.trigger('a'), 'pointerleave');
    vi.advanceTimersByTime(closeDelay);

    expect(menu.trigger('a').dataset.state).toBe('closed');

    firePointer(menu.trigger('b'), 'pointerenter');
    expect(menu.trigger('b').dataset.state).toBe('open');
  });

  it('should re-pay the open delay once the skip window expires', () => {
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);
    firePointer(menu.trigger('a'), 'pointerleave');
    vi.advanceTimersByTime(closeDelay + skipDelayDuration);

    firePointer(menu.trigger('b'), 'pointerenter');
    expect(menu.trigger('b').dataset.state).toBe('closed');

    vi.advanceTimersByTime(delayDuration);
    expect(menu.trigger('b').dataset.state).toBe('open');
  });

  it('should close after closeDelay once the pointer leaves', () => {
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);
    firePointer(menu.trigger('a'), 'pointerleave');

    vi.advanceTimersByTime(closeDelay - 1);
    expect(menu.trigger('a').dataset.state).toBe('open');

    vi.advanceTimersByTime(1);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should stay open while the pointer is over the viewport', () => {
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);
    firePointer(menu.trigger('a'), 'pointerleave');
    firePointer(menu.viewport, 'pointerenter');

    vi.advanceTimersByTime(closeDelay * 4);
    expect(menu.trigger('a').dataset.state).toBe('open');

    firePointer(menu.viewport, 'pointerleave');
    vi.advanceTimersByTime(closeDelay);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should ignore non-mouse pointers', () => {
    firePointer(menu.trigger('a'), 'pointerenter', 'touch');

    vi.advanceTimersByTime(delayDuration * 2);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should ignore hover while in mobile mode', () => {
    menu.root.dataset.navMode = 'mobile';
    firePointer(menu.trigger('a'), 'pointerenter');

    vi.advanceTimersByTime(delayDuration * 2);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });
});

describe('click behavior', () => {
  it('should toggle the panel and prevent trigger navigation', () => {
    const opened = menu
      .trigger('a')
      .dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );

    expect(opened).toBe(false);
    expect(menu.trigger('a').dataset.state).toBe('open');

    menu.trigger('a').click();
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should let a navigate-mode trigger follow its link without toggling', () => {
    menu.trigger('a').setAttribute('data-nav-trigger-mode', 'navigate');

    const notPrevented = menu
      .trigger('a')
      .dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );

    expect(notPrevented).toBe(true);
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  describe('click on a hover-opened trigger', () => {
    const openByHover = () => {
      firePointer(menu.trigger('a'), 'pointerenter');
      vi.advanceTimersByTime(delayDuration);
      expect(menu.trigger('a').dataset.state).toBe('open');
    };
    const click = (init: MouseEventInit & { pointerType?: string }) => {
      const { pointerType, ...rest } = init;
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ...rest,
      });
      if (pointerType) {
        Object.defineProperty(event, 'pointerType', { value: pointerType });
      }
      menu.trigger('a').dispatchEvent(event);
    };

    it('should stay open on a mouse click', () => {
      openByHover();
      click({ detail: 1 });
      expect(menu.trigger('a').dataset.state).toBe('open');

      // And must not block hover re-entry like a click-close does.
      firePointer(menu.trigger('a'), 'pointerleave');
      firePointer(menu.trigger('a'), 'pointerenter');
      vi.advanceTimersByTime(delayDuration);
      expect(menu.trigger('a').dataset.state).toBe('open');
    });

    it('should still toggle a panel a mouse click opened', () => {
      click({ detail: 1 });
      expect(menu.trigger('a').dataset.state).toBe('open');

      click({ detail: 1 });
      expect(menu.trigger('a').dataset.state).toBe('closed');
    });

    it('should toggle once a click has taken over a hover-opened panel', () => {
      openByHover();
      click({ detail: 0 });
      click({ detail: 1 });
      expect(menu.trigger('a').dataset.state).toBe('open');
      click({ detail: 1 });
      expect(menu.trigger('a').dataset.state).toBe('closed');
    });

    it('should close on keyboard activation (detail 0)', () => {
      openByHover();
      click({ detail: 0 });
      expect(menu.trigger('a').dataset.state).toBe('closed');
    });

    it('should close on a touch tap', () => {
      openByHover();
      click({ detail: 1, pointerType: 'touch' });
      expect(menu.trigger('a').dataset.state).toBe('closed');
    });

    it('should open a closed trigger on a mouse click', () => {
      click({ detail: 1 });
      expect(menu.trigger('a').dataset.state).toBe('open');
    });

    it('should still toggle on a mouse click in mobile mode', () => {
      document
        .querySelector('[data-nav-menu]')
        ?.setAttribute('data-nav-mode', 'mobile');
      click({ detail: 1 });
      click({ detail: 1 });
      expect(menu.trigger('a').dataset.state).toBe('closed');
    });
  });

  it('should require leaving the trigger before hover can reopen it', () => {
    menu.trigger('a').click();
    menu.trigger('a').click();

    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration * 2);
    expect(menu.trigger('a').dataset.state).toBe('closed');

    firePointer(menu.trigger('a'), 'pointerleave');
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);
    expect(menu.trigger('a').dataset.state).toBe('open');
  });
});

describe('dismissal', () => {
  it('should close on a pointerdown outside the nav', () => {
    menu.trigger('a').click();

    firePointer(document.body, 'pointerdown');
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should stay open on a pointerdown inside the nav', () => {
    menu.trigger('a').click();

    firePointer(menu.viewport, 'pointerdown');
    expect(menu.trigger('a').dataset.state).toBe('open');
  });

  it('should close when focus moves outside the nav', () => {
    menu.trigger('a').click();

    document.body.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should close when a link inside a panel is clicked', () => {
    menu.trigger('a').click();

    menu.content('a').querySelector('a')?.click();
    expect(menu.trigger('a').dataset.state).toBe('closed');
  });

  it('should keep the menu open on a meta-clicked panel link', () => {
    menu.trigger('a').click();

    menu
      .content('a')
      .querySelector('a')
      ?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          metaKey: true,
        }),
      );
    expect(menu.trigger('a').dataset.state).toBe('open');
  });

  it('should not close when a link outside any panel is clicked', () => {
    menu.trigger('a').click();

    document.querySelector<HTMLElement>('[data-nav-link]')?.click();
    expect(menu.trigger('a').dataset.state).toBe('open');
  });
});
