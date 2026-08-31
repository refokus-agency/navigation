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

    instance?.close();
    expect(content?.style.display).toBe('none');
  });
});
