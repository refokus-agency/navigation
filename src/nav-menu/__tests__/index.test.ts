import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_MENU_CONFIG } from '../config.ts';
import { initNavigationMenu } from '../index.ts';
import { renderNavMenu, stubResizeObserver } from './helpers.ts';

beforeEach(() => {
  stubResizeObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.className = '';
  document.body.innerHTML = '';
});

describe('initNavigationMenu', () => {
  it('should return null when no nav root is found', () => {
    document.body.innerHTML = '<div></div>';
    expect(initNavigationMenu()).toBeNull();
  });

  it('should accept an element as well as a selector', () => {
    const { root } = renderNavMenu();
    expect(initNavigationMenu(root)).not.toBeNull();
  });

  it('should no-op inside the Webflow Designer by default', () => {
    renderNavMenu();
    document.documentElement.classList.add(NAV_MENU_CONFIG.editorClass);

    expect(initNavigationMenu()).toBeNull();
  });

  it('should still initialize in the Designer when opted out', () => {
    renderNavMenu();
    document.documentElement.classList.add(NAV_MENU_CONFIG.editorClass);

    expect(
      initNavigationMenu(NAV_MENU_CONFIG.selectors.root, {
        skipInWebflowEditor: false,
      }),
    ).not.toBeNull();
  });

  it('should wire ARIA relationships between triggers and content', () => {
    const menu = renderNavMenu(['products']);
    initNavigationMenu();

    const trigger = menu.trigger('products');
    const content = menu.content('products');

    // Asserted as relationships, not literal ids: ids carry a per-instance
    // prefix so two menus on one page cannot collide.
    expect(trigger.id).not.toBe('');
    expect(content.id).not.toBe('');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(content.getAttribute('role')).toBe('region');
    expect(content.getAttribute('aria-labelledby')).toBe(trigger.id);
  });

  it('should set role and orientation hooks on root, list and viewport', () => {
    const menu = renderNavMenu();
    initNavigationMenu(NAV_MENU_CONFIG.selectors.root, {
      orientation: 'vertical',
    });

    expect(menu.root.getAttribute('role')).toBe('navigation');
    expect(menu.root.getAttribute('data-orientation')).toBe('vertical');
    expect(
      document
        .querySelector('[data-nav-list]')
        ?.getAttribute('data-orientation'),
    ).toBe('vertical');
    expect(menu.viewport.getAttribute('data-orientation')).toBe('vertical');
  });

  it('should preserve an author-provided role on the root', () => {
    const { root } = renderNavMenu();
    root.setAttribute('role', 'menubar');

    initNavigationMenu();

    expect(root.getAttribute('role')).toBe('menubar');
  });

  it('should backfill item values when the attribute is empty', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item>
            <button type="button" data-nav-trigger>first</button>
            <div data-nav-content>panel</div>
          </div>
        </div>
      </nav>
    `;

    initNavigationMenu();

    const item = document.querySelector('[data-nav-item]');
    expect(item?.getAttribute('data-nav-item')).toBe('item-0');
    expect(
      document
        .querySelector('[data-nav-content]')
        ?.getAttribute('data-nav-content'),
    ).toBe('item-0');
  });

  it('should give a non-focusable trigger a tabindex', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="a">
            <span data-nav-trigger>a</span>
            <div data-nav-content="a">panel</div>
          </div>
        </div>
      </nav>
    `;

    initNavigationMenu();

    expect(
      document.querySelector('[data-nav-trigger]')?.getAttribute('tabindex'),
    ).toBe('0');
  });

  it('should ignore items without a trigger', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="a"><a data-nav-link href="/a">a</a></div>
        </div>
      </nav>
    `;

    const menu = initNavigationMenu();

    expect(menu).not.toBeNull();
    expect(document.querySelector('[data-nav-item]')?.id).toBe('');
  });

  it('should expose open and close on the returned instance', () => {
    const menu = renderNavMenu();
    const instance = initNavigationMenu();

    instance?.open('b');
    expect(menu.trigger('b').dataset.state).toBe('open');
    expect(menu.root.dataset.state).toBe('open');

    instance?.close();
    expect(menu.trigger('b').dataset.state).toBe('closed');
    expect(menu.root.dataset.state).toBe('closed');
  });

  it('should report value changes through onValueChange', () => {
    renderNavMenu();
    const onValueChange = vi.fn();
    const instance = initNavigationMenu(NAV_MENU_CONFIG.selectors.root, {
      onValueChange,
    });

    instance?.open('a');
    instance?.close();

    expect(onValueChange.mock.calls).toEqual([['a'], [null]]);
  });

  it('should detach every listener on destroy', () => {
    const menu = renderNavMenu();
    const instance = initNavigationMenu();

    instance?.destroy();
    menu.trigger('a').click();

    expect(menu.trigger('a').dataset.state).toBe('closed');
  });
});

describe('trigger without a panel', () => {
  it('should not announce collapsible content', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="plain">
            <button type="button" data-nav-trigger>plain</button>
          </div>
        </div>
      </nav>
    `;

    const instance = initNavigationMenu();
    const trigger = document.querySelector<HTMLElement>('[data-nav-trigger]');
    instance?.open('plain');

    expect(trigger?.hasAttribute('aria-expanded')).toBe(false);
    expect(trigger?.hasAttribute('aria-controls')).toBe(false);
  });
});

describe('non-flat markup', () => {
  it('should toggle from a secondary trigger inside the same item', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="products">
            <button type="button" data-nav-trigger id="primary">P</button>
            <button type="button" data-nav-trigger id="secondary">P2</button>
            <div data-nav-content="products">panel</div>
          </div>
        </div>
      </nav>
    `;
    initNavigationMenu();

    const secondary = document.querySelector<HTMLElement>('#secondary');
    const content = document.querySelector<HTMLElement>('[data-nav-content]');

    secondary?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(content?.dataset.state).toBe('open');
  });

  it('should pair a trigger with its innermost item when items nest', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="outer">
            <div data-nav-item="inner">
              <button type="button" data-nav-trigger>inner</button>
              <div data-nav-content="inner">panel</div>
            </div>
          </div>
        </div>
      </nav>
    `;

    const instance = initNavigationMenu();
    const trigger = document.querySelector<HTMLElement>('[data-nav-trigger]');

    const content = document.querySelector<HTMLElement>('[data-nav-content]');
    expect(trigger?.id).toMatch(/-t-inner$/);
    expect(trigger?.getAttribute('aria-controls')).toBe(content?.id);

    instance?.open('inner');
    expect(trigger?.dataset.state).toBe('open');

    instance?.open('outer');
    expect(trigger?.dataset.state).toBe('closed');
  });
});
