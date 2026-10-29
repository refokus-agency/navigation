import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_MENU_CONFIG } from '../config.ts';
import { initNavigationMenu } from '../index.ts';
import { renderNavMenu, stubResizeObserver } from './helpers.ts';

const DESIGN = NAV_MENU_CONFIG.designMode.attribute;

beforeEach(() => {
  stubResizeObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.className = '';
  document.body.innerHTML = '';
});

describe('design mode', () => {
  it('opens every panel inside the Designer instead of only doing nothing', () => {
    const menu = renderNavMenu(['products', 'solutions']);
    document.documentElement.classList.add(NAV_MENU_CONFIG.editorClass);

    expect(initNavigationMenu()).toBeNull();

    expect(menu.root.getAttribute(DESIGN)).toBe('');
    expect(menu.root.dataset.state).toBe('open');
    expect(menu.viewport.dataset.state).toBe('open');
    expect(menu.content('products').dataset.state).toBe('open');
    expect(menu.content('solutions').dataset.state).toBe('open');
    expect(menu.trigger('products').dataset.state).toBe('open');
  });

  it('applies outside the Designer when the root carries the attribute', () => {
    const menu = renderNavMenu(['products']);
    menu.root.setAttribute(DESIGN, '');

    expect(initNavigationMenu()).toBeNull();
    expect(menu.content('products').dataset.state).toBe('open');
  });

  it('wins over skipInWebflowEditor: false, because the attribute is explicit', () => {
    const menu = renderNavMenu(['products']);
    menu.root.setAttribute(DESIGN, '');
    document.documentElement.classList.add(NAV_MENU_CONFIG.editorClass);

    expect(
      initNavigationMenu(NAV_MENU_CONFIG.selectors.root, {
        skipInWebflowEditor: false,
      }),
    ).toBeNull();
    expect(menu.content('products').dataset.state).toBe('open');
  });

  it('leaves the live menu alone when the editor is opted out', () => {
    const menu = renderNavMenu(['products']);
    document.documentElement.classList.add(NAV_MENU_CONFIG.editorClass);

    expect(
      initNavigationMenu(NAV_MENU_CONFIG.selectors.root, {
        skipInWebflowEditor: false,
      }),
    ).not.toBeNull();
    expect(menu.root.hasAttribute(DESIGN)).toBe(false);
  });

  it('clears inert, aria-hidden and the inline hiding of a closed panel', () => {
    const menu = renderNavMenu(['products']);
    const content = menu.content('products');
    content.setAttribute('inert', '');
    content.setAttribute('aria-hidden', 'true');
    content.style.display = 'none';
    content.style.pointerEvents = 'none';

    initNavigationMenu(menu.root, {}); // live menu hides the panel
    content.setAttribute('inert', '');

    menu.root.setAttribute(DESIGN, '');
    initNavigationMenu(menu.root, {});

    expect(content.hasAttribute('inert')).toBe(false);
    expect(content.hasAttribute('aria-hidden')).toBe(false);
    expect(content.style.display).toBe('');
    expect(content.style.pointerEvents).toBe('');
  });

  it('binds no listeners, no observers and no ids', () => {
    const menu = renderNavMenu(['products']);
    document.documentElement.classList.add(NAV_MENU_CONFIG.editorClass);

    const windowAdd = vi.spyOn(window, 'addEventListener');
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const observer = vi.fn();
    vi.stubGlobal('ResizeObserver', observer);

    initNavigationMenu();

    expect(windowAdd).not.toHaveBeenCalled();
    expect(documentAdd).not.toHaveBeenCalled();
    expect(observer).not.toHaveBeenCalled();
    // ARIA wiring is the live menu's job: editing must not leave ids behind.
    expect(menu.trigger('products').id).toBe('');
    expect(menu.content('products').id).toBe('');
  });
});
