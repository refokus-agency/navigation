import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_MENU_CONFIG } from '../config.ts';
import { initNavigationMenu } from '../index.ts';
import { type NavMenuMarkup, renderNavMenu } from './helpers.ts';

let menu: NavMenuMarkup;
let resizeCallbacks: ResizeObserverCallback[];
let disconnectCount: number;

/** Captures observer callbacks so tests can drive a resize directly. */
function stubCapturingResizeObserver(): void {
  resizeCallbacks = [];
  disconnectCount = 0;

  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        disconnectCount += 1;
      }
    },
  );
}

function setScrollSize(element: HTMLElement, width: number, height: number) {
  Object.defineProperty(element, 'scrollWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(element, 'scrollHeight', {
    value: height,
    configurable: true,
  });
}

/**
 * Captures every write to an element's style attribute, so the transient
 * `transition: none` used during a remount is observable.
 */
function recordStyleWrites(
  element: HTMLElement,
): () => { history: string; writes: number } {
  const observer = new MutationObserver(() => {});
  observer.observe(element, {
    attributes: true,
    attributeFilter: ['style'],
    attributeOldValue: true,
  });

  return () => {
    // Each record's oldValue is the attribute *before* that write, so the
    // records plus the current value reconstruct the whole sequence.
    const records = observer.takeRecords();
    observer.disconnect();

    const history = [
      ...records.map((record) => record.oldValue ?? ''),
      element.getAttribute('style') ?? '',
    ].join(' | ');

    return { history, writes: records.length };
  };
}

/** Runs the requestAnimationFrame callback that gates deferred hiding. */
function flushFrame(): void {
  vi.advanceTimersByTime(32);
}

beforeEach(() => {
  vi.useFakeTimers();
  stubCapturingResizeObserver();
  menu = renderNavMenu();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('state hooks', () => {
  it('should start fully closed and hide the viewport after the frame', () => {
    initNavigationMenu();

    expect(menu.root.dataset.state).toBe('closed');
    expect(menu.viewport.dataset.state).toBe('closed');
    expect(menu.viewport.style.pointerEvents).toBe('none');
    expect(menu.content('a').style.display).toBe('none');

    flushFrame();
    expect(menu.viewport.style.display).toBe('none');
  });

  it('should reveal only the active content and restore pointer events', () => {
    const instance = initNavigationMenu();
    flushFrame();

    instance?.open('b');

    expect(menu.content('b').dataset.state).toBe('open');
    expect(menu.content('b').style.display).toBe('');
    expect(menu.content('b').style.pointerEvents).toBe('');
    expect(menu.content('a').dataset.state).toBe('closed');
    expect(menu.content('a').style.pointerEvents).toBe('none');
    expect(menu.viewport.style.display).toBe('');
    expect(menu.viewport.dataset.state).toBe('open');
  });

  it('should keep the closing content mounted until the viewport hides', () => {
    const instance = initNavigationMenu();
    flushFrame();
    instance?.open('a');

    instance?.close();
    expect(menu.content('a').style.display).toBe('');

    flushFrame();
    expect(menu.content('a').style.display).toBe('none');
    expect(menu.viewport.style.display).toBe('none');
  });

  it('should apply size without transition when reopening mid-exit', () => {
    // The exit animation is still running (no flushFrame), so display is not
    // yet 'none'. Reopening must still mount instantly, exactly as it does
    // after the animation has finished — this is the keyboard-vs-mouse gap.
    setScrollSize(menu.content('a'), 400, 300);
    const instance = initNavigationMenu();
    flushFrame();

    instance?.open('a');
    instance?.close();

    const writes = recordStyleWrites(menu.viewport);
    instance?.open('a');

    expect(writes().history).toContain('transition: none');
    expect(menu.viewport.style.transition).toBe('');
  });

  it('should animate the size when switching between open panels', () => {
    const instance = initNavigationMenu();
    flushFrame();
    instance?.open('a');

    // Already open — the size must transition, so no override is written.
    const writes = recordStyleWrites(menu.viewport);
    instance?.open('b');

    expect(writes().history).not.toContain('transition: none');
  });

  it('should not leave the transition override on the viewport', () => {
    // First open mounts with transition:none so the size doesn't animate
    // from zero — the override must be cleared again straight after.
    const instance = initNavigationMenu();
    flushFrame();

    instance?.open('a');
    expect(menu.viewport.style.transition).toBe('');
  });
});

describe('motion direction hooks', () => {
  it('should not set motion on a first open', () => {
    const instance = initNavigationMenu();
    instance?.open('a');

    expect(menu.content('a').dataset.motion).toBeUndefined();
  });

  it('should mark forward switches from-end/to-start', () => {
    const instance = initNavigationMenu();
    instance?.open('a');
    instance?.open('b');

    expect(menu.content('b').dataset.motion).toBe('from-end');
    expect(menu.content('a').dataset.motion).toBe('to-start');
  });

  it('should mark backward switches from-start/to-end', () => {
    const instance = initNavigationMenu();
    instance?.open('b');
    instance?.open('a');

    expect(menu.content('a').dataset.motion).toBe('from-start');
    expect(menu.content('b').dataset.motion).toBe('to-end');
  });

  it('should mirror the direction under dir: rtl', () => {
    const instance = initNavigationMenu(NAV_MENU_CONFIG.selectors.root, {
      dir: 'rtl',
    });
    instance?.open('a');
    instance?.open('b');

    expect(menu.content('b').dataset.motion).toBe('from-start');
    expect(menu.content('a').dataset.motion).toBe('to-end');
  });

  it('should clear motion when the menu closes entirely', () => {
    const instance = initNavigationMenu();
    instance?.open('a');
    instance?.open('b');
    instance?.close();

    expect(menu.content('b').dataset.motion).toBeUndefined();
  });
});

describe('viewport sizing', () => {
  it('should publish the active content size as custom properties', () => {
    setScrollSize(menu.content('a'), 480, 320);
    const instance = initNavigationMenu();
    flushFrame();

    instance?.open('a');

    expect(menu.viewport.style.getPropertyValue('--nav-viewport-width')).toBe(
      '480px',
    );
    expect(menu.viewport.style.getPropertyValue('--nav-viewport-height')).toBe(
      '320px',
    );
  });

  it('should clamp the width to 100% in mobile mode', () => {
    setScrollSize(menu.content('a'), 480, 320);
    const instance = initNavigationMenu();
    menu.root.dataset.navMode = 'mobile';

    instance?.open('a');

    expect(menu.viewport.style.getPropertyValue('--nav-viewport-width')).toBe(
      '100%',
    );
    expect(menu.viewport.style.getPropertyValue('--nav-viewport-height')).toBe(
      '320px',
    );
  });

  it('should resize the viewport when the open content changes size', () => {
    setScrollSize(menu.content('a'), 480, 320);
    const instance = initNavigationMenu();
    instance?.open('a');

    setScrollSize(menu.content('a'), 480, 500);
    for (const callback of resizeCallbacks) {
      callback([], {} as ResizeObserver);
    }

    expect(menu.viewport.style.getPropertyValue('--nav-viewport-height')).toBe(
      '500px',
    );
  });

  it('should not resize while the menu is closed', () => {
    setScrollSize(menu.content('a'), 480, 320);
    const instance = initNavigationMenu();
    instance?.open('a');
    instance?.close();

    setScrollSize(menu.content('a'), 480, 500);
    for (const callback of resizeCallbacks) {
      callback([], {} as ResizeObserver);
    }

    expect(menu.viewport.style.getPropertyValue('--nav-viewport-height')).toBe(
      '320px',
    );
  });

  it('should disconnect the observer on destroy', () => {
    const instance = initNavigationMenu();
    instance?.destroy();

    expect(disconnectCount).toBe(1);
  });
});

describe('markup without a viewport', () => {
  it('should hide and show content in place', () => {
    document.body.innerHTML = `
      <nav data-nav-menu>
        <div data-nav-list>
          <div data-nav-item="a">
            <button type="button" data-nav-trigger>a</button>
            <div data-nav-content="a">panel a</div>
          </div>
        </div>
      </nav>
    `;

    const instance = initNavigationMenu();
    const content = document.querySelector<HTMLElement>('[data-nav-content]');

    expect(content?.style.display).toBe('none');

    instance?.open('a');
    expect(content?.style.display).toBe('');
    expect(content?.dataset.state).toBe('open');

    // Without a viewport the panel owns its own exit, so it stays mounted for
    // the animation exactly as it does when switching panels.
    instance?.close();
    expect(content?.style.display).toBe('');

    flushFrame();
    expect(content?.style.display).toBe('none');
  });
});

describe('trigger geometry', () => {
  function rect(left: number, width: number): DOMRect {
    return {
      left,
      width,
      right: left + width,
      top: 0,
      bottom: 0,
      height: 0,
      x: left,
      y: 0,
      toJSON() {},
    } as DOMRect;
  }

  function setup(align?: string) {
    if (align) menu.viewport.dataset.navAlign = align;
    vi.spyOn(menu.root, 'getBoundingClientRect').mockReturnValue(
      rect(100, 600),
    );
    vi.spyOn(menu.trigger('a'), 'getBoundingClientRect').mockReturnValue(
      rect(150, 80),
    );
    vi.spyOn(menu.trigger('c'), 'getBoundingClientRect').mockReturnValue(
      rect(620, 70),
    );
    setScrollSize(menu.content('a'), 200, 100);
    setScrollSize(menu.content('c'), 200, 100);
    const instance = initNavigationMenu();
    flushFrame();
    return instance;
  }

  const prop = (el: HTMLElement, name: string) =>
    el.style.getPropertyValue(name);

  it('should publish the active trigger x and width on the root', () => {
    const instance = setup();
    instance?.open('a');

    expect(prop(menu.root, '--nav-trigger-x')).toBe('50px');
    expect(prop(menu.root, '--nav-trigger-width')).toBe('80px');
    instance?.open('c');
    expect(prop(menu.root, '--nav-trigger-x')).toBe('520px');
    expect(prop(menu.root, '--nav-trigger-width')).toBe('70px');
  });

  it('should not publish --nav-viewport-x by default', () => {
    setup()?.open('a');
    expect(prop(menu.viewport, '--nav-viewport-x')).toBe('');
  });

  it('should anchor the panel to its trigger with data-nav-align="trigger"', () => {
    setup('trigger')?.open('a');
    expect(prop(menu.viewport, '--nav-viewport-x')).toBe('50px');
  });

  it('should clamp the panel inside the root', () => {
    setup('trigger')?.open('c');
    // trigger at 520, panel 200 wide, root 600 wide -> max 400
    expect(prop(menu.viewport, '--nav-viewport-x')).toBe('400px');
  });

  it('should recompute on window resize', () => {
    const instance = setup('trigger');
    instance?.open('a');
    vi.spyOn(menu.trigger('a'), 'getBoundingClientRect').mockReturnValue(
      rect(200, 80),
    );

    window.dispatchEvent(new Event('resize'));

    expect(prop(menu.root, '--nav-trigger-x')).toBe('100px');
    expect(prop(menu.viewport, '--nav-viewport-x')).toBe('100px');
  });
});

describe('trigger geometry with several triggers per item', () => {
  it('should measure the trigger that opened the panel, not the first', () => {
    const chevron = document.createElement('button');
    chevron.type = 'button';
    chevron.setAttribute('data-nav-trigger', '');
    menu.trigger('a').after(chevron);

    const rectOf = (left: number, width: number) =>
      ({
        left,
        width,
        right: left + width,
        top: 0,
        bottom: 0,
        height: 0,
        x: left,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    vi.spyOn(menu.root, 'getBoundingClientRect').mockReturnValue(
      rectOf(100, 600),
    );
    vi.spyOn(menu.trigger('a'), 'getBoundingClientRect').mockReturnValue(
      rectOf(154, 60),
    );
    vi.spyOn(chevron, 'getBoundingClientRect').mockReturnValue(rectOf(225, 20));

    initNavigationMenu();
    flushFrame();
    chevron.click();

    expect(menu.root.style.getPropertyValue('--nav-trigger-x')).toBe('125px');
    expect(menu.root.style.getPropertyValue('--nav-trigger-width')).toBe(
      '20px',
    );
  });
});

describe('trigger geometry without a viewport', () => {
  it('should still publish the trigger geometry on open and resize', () => {
    menu.viewport.replaceWith(...Array.from(menu.viewport.children));
    const rectOf = (left: number, width: number) =>
      ({
        left,
        width,
        right: left + width,
        top: 0,
        bottom: 0,
        height: 0,
        x: left,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    vi.spyOn(menu.root, 'getBoundingClientRect').mockReturnValue(
      rectOf(100, 600),
    );
    const trigger = menu.trigger('a');
    const spy = vi
      .spyOn(trigger, 'getBoundingClientRect')
      .mockReturnValue(rectOf(150, 80));

    const instance = initNavigationMenu();
    flushFrame();
    instance?.open('a');

    expect(menu.root.style.getPropertyValue('--nav-trigger-x')).toBe('50px');
    expect(menu.root.style.getPropertyValue('--nav-trigger-width')).toBe(
      '80px',
    );

    spy.mockReturnValue(rectOf(200, 90));
    window.dispatchEvent(new Event('resize'));
    expect(menu.root.style.getPropertyValue('--nav-trigger-x')).toBe('100px');
  });
});

describe('trigger geometry reference points', () => {
  it('should measure trigger vars from the root, not the viewport offsetParent', () => {
    const rectOf = (left: number, width: number) =>
      ({
        left,
        width,
        right: left + width,
        top: 0,
        bottom: 0,
        height: 0,
        x: left,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    const anchor = document.createElement('div');
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(rectOf(160, 500));
    Object.defineProperty(menu.viewport, 'offsetParent', {
      value: anchor,
      configurable: true,
    });
    menu.viewport.dataset.navAlign = 'trigger';
    vi.spyOn(menu.root, 'getBoundingClientRect').mockReturnValue(
      rectOf(100, 600),
    );
    vi.spyOn(menu.trigger('a'), 'getBoundingClientRect').mockReturnValue(
      rectOf(300, 80),
    );
    setScrollSize(menu.content('a'), 200, 100);

    const instance = initNavigationMenu();
    flushFrame();
    instance?.open('a');

    // root-relative: 300 - 100
    expect(menu.root.style.getPropertyValue('--nav-trigger-x')).toBe('200px');
    // anchor-relative: 300 - 160, within [min=-60, max=340]
    expect(menu.viewport.style.getPropertyValue('--nav-viewport-x')).toBe(
      '140px',
    );
  });
});

describe('viewport clamp with padding and border', () => {
  function open(boxSizing: string) {
    const rectOf = (left: number, width: number) =>
      ({
        left,
        width,
        right: left + width,
        top: 0,
        bottom: 0,
        height: 0,
        x: left,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    menu.viewport.dataset.navAlign = 'trigger';
    menu.viewport.style.boxSizing = boxSizing;
    menu.viewport.style.padding = '0 24px';
    menu.viewport.style.border = '2px solid';
    vi.spyOn(menu.root, 'getBoundingClientRect').mockReturnValue(
      rectOf(0, 700),
    );
    vi.spyOn(menu.trigger('c'), 'getBoundingClientRect').mockReturnValue(
      rectOf(650, 50),
    );
    setScrollSize(menu.content('c'), 200, 100);
    const instance = initNavigationMenu();
    flushFrame();
    instance?.open('c');
    return menu.viewport.style.getPropertyValue('--nav-viewport-x');
  }

  it('should include padding and border under content-box', () => {
    // rendered width 200 + 48 + 4 = 252 -> max x = 700 - 252
    expect(open('content-box')).toBe('448px');
  });

  it('should not double count them under border-box', () => {
    expect(open('border-box')).toBe('500px');
  });
});

describe('fixed viewport', () => {
  it('should anchor --nav-viewport-x to the window, not the root', () => {
    const rectOf = (left: number, width: number) =>
      ({
        left,
        width,
        right: left + width,
        top: 0,
        bottom: 0,
        height: 0,
        x: left,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    menu.viewport.dataset.navAlign = 'trigger';
    menu.viewport.style.position = 'fixed';
    vi.spyOn(menu.root, 'getBoundingClientRect').mockReturnValue(
      rectOf(150, 900),
    );
    vi.spyOn(menu.trigger('a'), 'getBoundingClientRect').mockReturnValue(
      rectOf(304.5, 80),
    );
    setScrollSize(menu.content('a'), 200, 100);

    const instance = initNavigationMenu();
    flushFrame();
    instance?.open('a');

    expect(menu.viewport.style.getPropertyValue('--nav-viewport-x')).toBe(
      '304.5px',
    );
    // the root-relative trigger var is unaffected
    expect(menu.root.style.getPropertyValue('--nav-trigger-x')).toBe('154.5px');
  });
});
