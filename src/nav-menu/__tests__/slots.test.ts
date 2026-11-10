import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initNavigationMenu } from '../index.ts';
import {
  type NavMenuMarkup,
  renderSlotNavMenu,
  stubResizeObserver,
} from './helpers.ts';

let menu: NavMenuMarkup;

beforeEach(() => {
  stubResizeObserver();
  menu = renderSlotNavMenu();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.className = '';
  document.body.innerHTML = '';
});

describe('panel relocation', () => {
  it('should move each item panel into the viewport, paired with its value', () => {
    initNavigationMenu();

    for (const value of ['a', 'b', 'c']) {
      const content = menu.content(value);
      expect(content.parentElement).toBe(menu.viewport);
      expect(content.getAttribute('data-nav-content')).toBe(value);
    }
    expect(
      [...menu.viewport.children].map((child) =>
        child.getAttribute('data-nav-content'),
      ),
    ).toEqual(['a', 'b', 'c']);
  });

  it('should pair auto-generated item values with their moved panels', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-item>
          <a data-nav-link href="/plain">plain</a>
        </div>
        <div data-nav-item>
          <button type="button" data-nav-trigger>one</button>
          <div data-nav-content id="one-panel"><a href="/one">one</a></div>
        </div>
        <div data-nav-viewport></div>
      </nav>
    `;
    const viewport = document.querySelector('[data-nav-viewport]');
    const panel = document.querySelector<HTMLElement>('#one-panel');

    const instance = initNavigationMenu();
    instance?.open('item-1');

    expect(panel?.parentElement).toBe(viewport);
    expect(panel?.getAttribute('data-nav-content')).toBe('item-1');
    expect(panel?.dataset.state).toBe('open');
  });
});

describe('item panel ownership', () => {
  it('should relocate only the first of two owned panels', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-item="a">
          <button type="button" data-nav-trigger>a</button>
          <div data-nav-content id="first"><a href="/1">1</a></div>
          <div data-nav-content id="second"><a href="/2">2</a></div>
        </div>
        <div data-nav-viewport></div>
      </nav>
    `;
    const item = document.querySelector('[data-nav-item="a"]');
    const viewport = document.querySelector('[data-nav-viewport]');

    const instance = initNavigationMenu();
    instance?.open('a');

    expect(document.querySelector('#first')?.parentElement).toBe(viewport);
    expect(document.querySelector('#first')?.getAttribute('data-state')).toBe(
      'open',
    );
    expect(document.querySelector('#second')?.parentElement).toBe(item);
    expect(document.querySelector('#second')?.hasAttribute('data-state')).toBe(
      false,
    );
    expect(viewport?.children).toHaveLength(1);
  });

  it('should skip a panel that wraps the viewport instead of throwing', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-item="a" id="item-a">
          <button type="button" data-nav-trigger>a</button>
          <div data-nav-content id="panel-a"><a href="/a">a</a></div>
        </div>
        <div data-nav-item="b" id="item-b">
          <button type="button" data-nav-trigger>b</button>
          <div data-nav-content id="panel-b">
            <div data-nav-viewport></div>
          </div>
        </div>
      </nav>
    `;

    // Threw HierarchyRequestError before the guard, failing this test.
    const instance = initNavigationMenu();
    expect(document.querySelector('#panel-b')?.parentElement?.id).toBe(
      'item-b',
    );

    // The wrapper is not a panel: hiding it would hide the viewport too.
    instance?.open('a');
    const panelA = document.querySelector<HTMLElement>('#panel-a');
    expect(panelA?.dataset.state).toBe('open');
    const root = document.querySelector('[data-nav-menu]');
    for (
      let node: HTMLElement | null | undefined = panelA;
      node && node !== root;
      node = node.parentElement
    ) {
      expect(node.style.display).not.toBe('none');
    }

    instance?.destroy();
    expect(document.querySelector('#panel-a')?.parentElement?.id).toBe(
      'item-a',
    );
  });

  it('should never give a nested item panel to the outer item', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-item="outer">
          <button type="button" data-nav-trigger>outer</button>
          <div data-nav-item="inner">
            <button type="button" data-nav-trigger>inner</button>
            <div data-nav-content id="inner-panel"><a href="/i">i</a></div>
          </div>
          <div data-nav-content id="outer-panel"><a href="/o">o</a></div>
        </div>
        <div data-nav-viewport></div>
      </nav>
    `;

    initNavigationMenu();

    expect(
      document.querySelector('#outer-panel')?.getAttribute('data-nav-content'),
    ).toBe('outer');
    expect(
      document.querySelector('#inner-panel')?.getAttribute('data-nav-content'),
    ).toBe('inner');
  });
});

describe('destroy', () => {
  it('should put every relocated panel back where it was authored', () => {
    const before = structure(menu.root);

    initNavigationMenu()?.destroy();

    expect(structure(menu.root)).toBe(before);
    for (const value of ['a', 'b', 'c']) {
      expect(menu.content(value).parentElement).toBe(
        menu.trigger(value).parentElement,
      );
    }
    expect(menu.viewport.children).toHaveLength(0);
  });

  it('should restore a panel before its original next sibling', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-item>
          <button type="button" data-nav-trigger>one</button>
          <div data-nav-content id="panel"><a href="/one">one</a></div>
          <span id="after">after</span>
        </div>
        <div data-nav-viewport></div>
      </nav>
    `;
    const root = document.querySelector<HTMLElement>('[data-nav-menu]');
    const before = structure(root as HTMLElement);

    initNavigationMenu()?.destroy();

    expect(structure(root as HTMLElement)).toBe(before);
    expect(document.querySelector('#panel')?.nextElementSibling?.id).toBe(
      'after',
    );
  });

  it('should restore a panel whose original next sibling was removed', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-item id="item">
          <button type="button" data-nav-trigger>one</button>
          <div data-nav-content id="panel"><a href="/one">one</a></div><span id="after">after</span>
        </div>
        <div data-nav-viewport></div>
      </nav>
    `;
    const instance = initNavigationMenu();
    document.querySelector('#after')?.remove();

    expect(() => instance?.destroy()).not.toThrow();
    expect(document.querySelector('#panel')?.parentElement?.id).toBe('item');
  });

  it('should leave a newer instance alone when an old handle is destroyed again', () => {
    const first = initNavigationMenu();
    first?.destroy();
    initNavigationMenu();

    first?.destroy();

    for (const value of ['a', 'b', 'c']) {
      expect(menu.content(value).parentElement).toBe(menu.viewport);
    }
  });

  it('should leave a live re-init alone when the stale first handle is destroyed', () => {
    const first = initNavigationMenu();
    const second = initNavigationMenu();

    first?.destroy();

    for (const value of ['a', 'b', 'c']) {
      expect(menu.content(value).parentElement).toBe(menu.viewport);
    }

    second?.destroy();

    for (const value of ['a', 'b', 'c']) {
      expect(menu.content(value).parentElement).toBe(
        menu.trigger(value).parentElement,
      );
    }
  });

  it('should restore the other panels when one parent moved inside its panel', () => {
    const instance = initNavigationMenu();
    const itemA = menu.trigger('a').parentElement as HTMLElement;
    menu.content('a').appendChild(itemA);

    expect(() => instance?.destroy()).not.toThrow();
    for (const value of ['b', 'c']) {
      expect(menu.content(value).parentElement).toBe(
        menu.trigger(value).parentElement,
      );
    }
  });
});

describe('restored panels', () => {
  it('should carry no renderer state after destroy with a panel open', () => {
    const instance = initNavigationMenu();
    instance?.open('a');
    expect(menu.content('a').dataset.state).toBe('open');

    instance?.destroy();

    for (const value of ['a', 'b', 'c']) {
      expectPristine(menu.content(value));
      expect(menu.content(value).parentElement).toBe(
        menu.trigger(value).parentElement,
      );
    }
  });

  it('should carry no renderer state after destroy with every panel closed', () => {
    initNavigationMenu()?.destroy();

    for (const value of ['a', 'b', 'c']) {
      expectPristine(menu.content(value));
    }
  });

  it('should put panels back and rethrow when init fails after relocating', () => {
    const failure = new Error('matchMedia unavailable');
    vi.stubGlobal('matchMedia', () => {
      throw failure;
    });

    expect(() => initNavigationMenu()).toThrow(failure);

    for (const value of ['a', 'b', 'c']) {
      expect(menu.content(value).parentElement).toBe(
        menu.trigger(value).parentElement,
      );
      expectPristine(menu.content(value));
    }
    expect(menu.viewport.children).toHaveLength(0);
  });
});

describe('no relocation', () => {
  it('should move nothing in the Webflow editor', () => {
    document.documentElement.classList.add('w-editor');

    initNavigationMenu();

    for (const value of ['a', 'b', 'c']) {
      expect(menu.content(value).parentElement).toBe(
        menu.trigger(value).parentElement,
      );
    }
  });

  it('should move nothing when the root has no viewport', () => {
    menu.viewport.remove();

    initNavigationMenu();

    for (const value of ['a', 'b', 'c']) {
      expect(menu.content(value).parentElement).toBe(
        menu.trigger(value).parentElement,
      );
    }
  });

  it('should keep a viewport panel and leave the item panel in place', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-item="a" id="item">
          <button type="button" data-nav-trigger>a</button>
          <div data-nav-content id="item-panel"><a href="/i">i</a></div>
        </div>
        <div data-nav-viewport>
          <div data-nav-content="a" id="viewport-panel"><a href="/v">v</a></div>
        </div>
      </nav>
    `;

    initNavigationMenu()?.open('a');

    expect(document.querySelector('#item-panel')?.parentElement?.id).toBe(
      'item',
    );
    expect(
      document.querySelector('#viewport-panel')?.getAttribute('data-state'),
    ).toBe('open');
  });
});

/** Tag-and-nesting signature of a subtree, ignoring every attribute. */
function structure(element: Element): string {
  const children = [...element.children].map(structure).join('');
  const id =
    element.id && !element.id.startsWith('nav-') ? `#${element.id}` : '';
  return `<${element.tagName}${id}>${children}</${element.tagName}>`;
}

/** No state the renderer writes is left behind on the panel. */
function expectPristine(panel: HTMLElement): void {
  expect(panel.hasAttribute('data-state')).toBe(false);
  expect(panel.hasAttribute('data-motion')).toBe(false);
  expect(panel.hasAttribute('inert')).toBe(false);
  expect(panel.style.display).toBe('');
  expect(panel.style.pointerEvents).toBe('');
}
