import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_MENU_CONFIG } from '../config.ts';
import { initNavigationMenu } from '../index.ts';
import type {
  InitNavigationMenuOptions,
  NavigationMenuInstance,
  NavMenuOptions,
} from '../types.ts';
import {
  fireKey,
  firePointer,
  type NavMenuMarkup,
  renderNavMenu,
  stubResizeObserver,
} from './helpers.ts';

// Passed explicitly by init(), so the tests own the hover delay.
const delayDuration = 200;
const closeDelay = NAV_MENU_CONFIG.timing.closeDelay;

let menu: NavMenuMarkup;

function init(
  attribute: string | null,
  options: InitNavigationMenuOptions = {},
): NavigationMenuInstance | null {
  if (attribute !== null) {
    menu.root.setAttribute(NAV_MENU_CONFIG.attributes.interaction, attribute);
  }
  return initNavigationMenu(menu.root, { delayDuration, ...options });
}

/** Whether a mouse hover alone opens a panel — the observable mode. */
function hoverOpens(): boolean {
  firePointer(menu.trigger('a'), 'pointerenter');
  vi.advanceTimersByTime(delayDuration + closeDelay);
  return menu.trigger('a').dataset.state === 'open';
}

beforeEach(() => {
  vi.useFakeTimers();
  stubResizeObserver();
  menu = renderNavMenu();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('public options type', () => {
  it('should accept a full NavMenuOptions without interaction', () => {
    // Type-level guard, enforced by `pnpm typecheck`: `interaction` was added
    // after release, so it must stay optional for consumers.
    const options: NavMenuOptions = {
      delayDuration,
      skipDelayDuration: 300,
      orientation: 'horizontal',
      dir: 'ltr',
      skipInWebflowEditor: true,
    };
    init(null, options);

    expect(hoverOpens()).toBe(true);
  });
});

describe('invalid data-nav-interaction', () => {
  it.each(['tap', '', 'Click'])(
    'should warn about attribute %j and fall back',
    (attribute) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      init(attribute, { interaction: 'click' });

      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]?.[0]).toContain(`"${attribute}"`);
      expect(hoverOpens()).toBe(false);
    },
  );

  it.each([null, 'hover', 'click'])(
    'should not warn for attribute %j',
    (attribute) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      init(attribute);

      expect(warn).not.toHaveBeenCalled();
    },
  );
});

describe('interaction mode resolution', () => {
  it('should read data-nav-interaction from the root at init', () => {
    init('click');

    expect(hoverOpens()).toBe(false);
  });

  it.each([
    ['click', 'hover', false],
    ['hover', 'click', true],
  ] as const)(
    'should let attribute "%s" override the JS option "%s"',
    (attribute, option, opens) => {
      init(attribute, { interaction: option });

      expect(hoverOpens()).toBe(opens);
    },
  );

  it.each([
    [null, 'click', false],
    ['tap', 'click', false],
    ['', 'click', false],
    ['Click', 'click', false],
    ['tap', 'tap', true],
    [null, undefined, true],
  ])(
    'should fall back from attribute %j to the JS option %j',
    (attribute, option, opens) => {
      // Browser-bundle callers are untyped, so an invalid option must be survivable.
      init(attribute, {
        interaction: option,
      } as unknown as InitNavigationMenuOptions);

      expect(hoverOpens()).toBe(opens);
    },
  );
});

describe('read once at init', () => {
  it.each([
    ['click', 'hover', false],
    ['hover', 'click', true],
  ])(
    'should keep "%s" after the attribute changes to "%s"',
    (initial, changed, opens) => {
      init(initial);
      menu.root.setAttribute(NAV_MENU_CONFIG.attributes.interaction, changed);

      expect(hoverOpens()).toBe(opens);
    },
  );
});

describe('hover mode', () => {
  it('should open on hover and toggle on click, as before', () => {
    init('hover');

    expect(hoverOpens()).toBe(true);

    menu.trigger('a').click();
    expect(menu.trigger('a').dataset.state).toBe('closed');

    menu.trigger('a').click();
    expect(menu.trigger('a').dataset.state).toBe('open');
  });
});

describe('click mode', () => {
  let instance: NavigationMenuInstance | null;

  beforeEach(() => {
    instance = init('click');
  });

  it('should not open a panel on mouse hover', () => {
    firePointer(menu.trigger('a'), 'pointerenter');
    vi.advanceTimersByTime(delayDuration);

    expect(menu.trigger('a').dataset.state).toBe('closed');
    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should not open a panel on touch pointerenter', () => {
    firePointer(menu.trigger('a'), 'pointerenter', 'touch');
    vi.advanceTimersByTime(delayDuration + closeDelay);

    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should not open a panel on click after destroy', () => {
    instance?.destroy();
    menu.trigger('a').click();

    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should toggle a panel on trigger click', () => {
    menu.trigger('a').click();
    expect(menu.content('a').dataset.state).toBe('open');

    menu.trigger('a').click();
    expect(menu.content('a').dataset.state).toBe('closed');
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
    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should switch panels when another trigger is clicked', () => {
    menu.trigger('a').click();
    menu.trigger('b').click();

    expect(menu.content('a').dataset.state).toBe('closed');
    expect(menu.content('b').dataset.state).toBe('open');
  });

  it('should keep the panel open when the pointer leaves', () => {
    menu.trigger('a').click();

    firePointer(menu.trigger('a'), 'pointerleave');
    firePointer(menu.viewport, 'pointerenter');
    firePointer(menu.viewport, 'pointerleave');
    vi.advanceTimersByTime(closeDelay + delayDuration);

    expect(menu.content('a').dataset.state).toBe('open');
  });

  it('should close on an outside click', () => {
    menu.trigger('a').click();
    firePointer(document.body, 'pointerdown');

    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should close on Escape', () => {
    menu.trigger('a').click();
    fireKey(menu.content('a'), 'Escape');

    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should close on a link click inside the panel', () => {
    menu.trigger('a').click();
    menu.content('a').querySelector('a')?.click();

    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should close when focus leaves the nav', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    menu.trigger('a').click();

    outside.focus();

    expect(menu.content('a').dataset.state).toBe('closed');
  });
});

describe.each(['hover', 'click'])('keyboard in %s mode', (mode) => {
  beforeEach(() => {
    init(mode);
  });

  it('should toggle with Enter and Space', () => {
    menu.trigger('a').focus();

    fireKey(menu.trigger('a'), 'Enter');
    expect(menu.content('a').dataset.state).toBe('open');

    fireKey(menu.trigger('a'), ' ');
    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should close on Escape and return focus to the trigger', () => {
    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'Enter');
    menu.content('a').querySelector('a')?.focus();

    fireKey(menu.content('a'), 'Escape');

    expect(menu.content('a').dataset.state).toBe('closed');
    expect(document.activeElement).toBe(menu.trigger('a'));
  });

  it('should Tab from the trigger into its open panel', () => {
    menu.trigger('a').focus();
    fireKey(menu.trigger('a'), 'Enter');

    const event = fireKey(menu.trigger('a'), 'Tab');

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(menu.content('a').querySelector('a'));
  });

  it('should move between triggers with the arrow keys', () => {
    menu.trigger('a').focus();

    fireKey(menu.trigger('a'), 'ArrowRight');

    expect(document.activeElement).toBe(menu.trigger('b'));
  });
});
