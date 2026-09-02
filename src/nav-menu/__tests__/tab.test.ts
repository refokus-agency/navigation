import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initNavigationMenu } from '../index.ts';
import {
  fireKey,
  type NavMenuMarkup,
  renderNavMenu,
  stubResizeObserver,
} from './helpers.ts';

/**
 * jsdom does not implement native Tab movement, so these assert the two
 * things the library controls: whether it takes over (defaultPrevented plus
 * where focus lands) or defers to the browser.
 */
const tab = (element: Element) => fireKey(element, 'Tab');
const shiftTab = (element: Element) =>
  fireKey(element, 'Tab', { shiftKey: true });

let menu: NavMenuMarkup;

beforeEach(() => {
  stubResizeObserver();
  menu = renderNavMenu();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Tab into an open panel', () => {
  it('should step from the trigger into the first panel link', () => {
    const instance = initNavigationMenu();
    instance?.open('a');
    menu.trigger('a').focus();

    const event = tab(menu.trigger('a'));

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(menu.content('a').querySelector('a'));
  });

  it('should defer to the browser when the panel is closed', () => {
    initNavigationMenu();
    menu.trigger('a').focus();

    expect(tab(menu.trigger('a')).defaultPrevented).toBe(false);
  });

  it('should close and move on when the open panel has nothing tabbable', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="a">
            <button type="button" data-nav-trigger>a</button>
          </div>
        </div>
        <div data-nav-viewport>
          <div data-nav-content="a">just text</div>
        </div>
      </nav>
    `;
    const instance = initNavigationMenu();
    const trigger = document.querySelector<HTMLElement>('[data-nav-trigger]');
    instance?.open('a');

    const event = tab(trigger as HTMLElement);

    expect(event.defaultPrevented).toBe(false);
    expect(
      document.querySelector<HTMLElement>('[data-nav-content]')?.dataset.state,
    ).toBe('closed');
  });
});

describe('Tab out of an open panel', () => {
  it('should close the panel and land on the next trigger', () => {
    const instance = initNavigationMenu();
    instance?.open('a');
    const link = menu.content('a').querySelector<HTMLElement>('a');
    link?.focus();

    const event = tab(link as HTMLElement);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(menu.trigger('b'));
    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should land on a plain nav link when it is the next stop', () => {
    const instance = initNavigationMenu();
    instance?.open('c');
    const link = menu.content('c').querySelector<HTMLElement>('a');
    link?.focus();

    tab(link as HTMLElement);

    expect(document.activeElement).toBe(
      document.querySelector('[data-nav-link]'),
    );
  });

  it('should leave the nav entirely when no nav stop follows', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="a">
            <button type="button" data-nav-trigger>a</button>
          </div>
        </div>
        <div data-nav-viewport>
          <div data-nav-content="a"><a href="/x" id="panel-link">x</a></div>
        </div>
      </nav>
      <button type="button" id="after">after the nav</button>
    `;
    const instance = initNavigationMenu();
    instance?.open('a');
    const link = document.querySelector<HTMLElement>('#panel-link');
    link?.focus();

    tab(link as HTMLElement);

    expect(document.activeElement).toBe(document.querySelector('#after'));
  });

  it('should defer to the browser mid-panel', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="a">
            <button type="button" data-nav-trigger>a</button>
          </div>
        </div>
        <div data-nav-viewport>
          <div data-nav-content="a">
            <a href="/1" id="first">1</a>
            <a href="/2" id="second">2</a>
            <a href="/3" id="third">3</a>
          </div>
        </div>
      </nav>
    `;
    const instance = initNavigationMenu();
    instance?.open('a');
    const second = document.querySelector<HTMLElement>('#second');

    expect(tab(second as HTMLElement).defaultPrevented).toBe(false);
    expect(shiftTab(second as HTMLElement).defaultPrevented).toBe(false);
    expect(
      document.querySelector<HTMLElement>('[data-nav-content]')?.dataset.state,
    ).toBe('open');
  });
});

describe('Shift+Tab back out of a panel', () => {
  it('should return to the owning trigger and keep the panel open', () => {
    const instance = initNavigationMenu();
    instance?.open('a');
    const link = menu.content('a').querySelector<HTMLElement>('a');
    link?.focus();

    const event = shiftTab(link as HTMLElement);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(menu.trigger('a'));
    expect(menu.content('a').dataset.state).toBe('open');
  });

  it('should close the panel when leaving the trigger backwards', () => {
    const instance = initNavigationMenu();
    instance?.open('a');
    menu.trigger('a').focus();

    const event = shiftTab(menu.trigger('a'));

    expect(event.defaultPrevented).toBe(false);
    expect(menu.content('a').dataset.state).toBe('closed');
  });
});

describe('leaving an unrelated stop', () => {
  it('should close a panel opened on another trigger', () => {
    const instance = initNavigationMenu();
    instance?.open('a');

    tab(menu.trigger('b'));

    expect(menu.content('a').dataset.state).toBe('closed');
  });

  it('should close a panel when tabbing off a plain link', () => {
    const instance = initNavigationMenu();
    instance?.open('a');

    tab(document.querySelector('[data-nav-link]') as HTMLElement);

    expect(menu.content('a').dataset.state).toBe('closed');
  });
});

describe('closed panels are not tab targets', () => {
  it('should mark a closing panel inert immediately', () => {
    const instance = initNavigationMenu();
    instance?.open('a');
    expect(menu.content('a').hasAttribute('inert')).toBe(false);

    instance?.open('b');
    // 'a' is still mounted for its exit animation, but must not be tabbable.
    expect(menu.content('a').hasAttribute('inert')).toBe(true);
    expect(menu.content('b').hasAttribute('inert')).toBe(false);
  });
});

describe('arrow keys stay out of panels', () => {
  it.each(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'Home', 'End'])(
    'should ignore %s pressed inside a panel',
    (key) => {
      const instance = initNavigationMenu();
      instance?.open('a');
      const link = menu.content('a').querySelector<HTMLElement>('a');
      link?.focus();

      const event = fireKey(link as HTMLElement, key);

      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(link);
    },
  );

  it('should still handle arrows on a trigger', () => {
    initNavigationMenu();
    menu.trigger('a').focus();

    expect(fireKey(menu.trigger('a'), 'ArrowRight').defaultPrevented).toBe(
      true,
    );
    expect(document.activeElement).toBe(menu.trigger('b'));
  });
});
