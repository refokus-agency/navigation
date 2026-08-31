import { vi } from 'vitest';

export type NavMenuMarkup = {
  root: HTMLElement;
  trigger(value: string): HTMLElement;
  content(value: string): HTMLElement;
  viewport: HTMLElement;
};

/**
 * Builds the documented `[data-nav-menu]` structure with a shared viewport.
 */
export function renderNavMenu(
  values: string[] = ['a', 'b', 'c'],
): NavMenuMarkup {
  document.body.innerHTML = `
    <div class="w-nav">
      <a class="w-nav-button" aria-expanded="false" href="#">menu</a>
      <nav data-nav-menu>
        <div data-nav-list>
          ${values
            .map(
              (value) => `
                <div data-nav-item="${value}">
                  <button type="button" data-nav-trigger>${value}</button>
                </div>`,
            )
            .join('')}
          <div data-nav-item="plain">
            <a data-nav-link href="/plain">plain</a>
          </div>
        </div>
        <div data-nav-viewport>
          ${values
            .map(
              (value) => `
                <div data-nav-content="${value}">
                  <a href="/${value}">${value} link</a>
                </div>`,
            )
            .join('')}
        </div>
        <button type="button" data-nav-back>back</button>
      </nav>
    </div>
  `;

  const query = <T extends HTMLElement>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing element for "${selector}"`);
    return element;
  };

  return {
    root: query('[data-nav-menu]'),
    trigger: (value) => query(`[data-nav-item="${value}"] [data-nav-trigger]`),
    content: (value) => query(`[data-nav-content="${value}"]`),
    viewport: query('[data-nav-viewport]'),
  };
}

/**
 * jsdom implements neither PointerEvent nor ResizeObserver — the pointer
 * modules only read `pointerType`, so a tagged Event is enough.
 */
export function firePointer(
  element: Element,
  type: 'pointerenter' | 'pointerleave' | 'pointerdown',
  pointerType = 'mouse',
): void {
  const event = new Event(type, { bubbles: type === 'pointerdown' });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  element.dispatchEvent(event);
}

export function fireKey(
  element: Element,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  element.dispatchEvent(event);
  return event;
}

export function stubResizeObserver(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
}

export function stubMatchMedia(matches = false): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}
