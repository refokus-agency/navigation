import { beforeEach, describe, expect, it, vi } from 'vitest';

type EventMap = {
  [event: string]: Array<() => void>;
};

let listeners: EventMap = {};

function scrollListenerCount(): number {
  return (listeners.scroll ?? []).length;
}

function setupMockWindow(initialScrollY = 0): void {
  listeners = {};

  Object.defineProperty(globalThis, 'window', {
    value: {
      scrollY: initialScrollY,
      addEventListener: (eventName: string, callback: () => void) => {
        listeners[eventName] ??= [];
        listeners[eventName].push(callback);
      },
      removeEventListener: (eventName: string, callback: () => void) => {
        listeners[eventName] = (listeners[eventName] ?? []).filter(
          (registered) => registered !== callback,
        );
      },
      dispatchEvent: (event: { type: string }) => {
        for (const callback of Array.from(listeners[event.type] ?? [])) {
          callback();
        }
        return true;
      },
    },
    configurable: true,
  });
}

describe('scroll source', () => {
  beforeEach(() => {
    vi.resetModules();
    setupMockWindow(0);
  });

  it('should register a single scroll listener regardless of subscriber count', async () => {
    const { subscribeToScroll } = await import('../scroll-source.ts');

    expect(scrollListenerCount()).toBe(0);

    subscribeToScroll(vi.fn());
    subscribeToScroll(vi.fn());
    subscribeToScroll(vi.fn());

    expect(scrollListenerCount()).toBe(1);
  });

  it('should remove the listener only once the last subscriber unsubscribes', async () => {
    const { subscribeToScroll } = await import('../scroll-source.ts');

    const unsubscribeFirst = subscribeToScroll(vi.fn());
    const unsubscribeSecond = subscribeToScroll(vi.fn());

    unsubscribeFirst();
    expect(scrollListenerCount()).toBe(1);

    unsubscribeSecond();
    expect(scrollListenerCount()).toBe(0);
  });

  it('should fan the current scroll position out to every subscriber', async () => {
    const { subscribeToScroll } = await import('../scroll-source.ts');
    const first = vi.fn();
    const second = vi.fn();

    subscribeToScroll(first);
    subscribeToScroll(second);

    globalThis.window.scrollY = 240;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(first).toHaveBeenCalledWith(240);
    expect(second).toHaveBeenCalledWith(240);
  });

  it('should stop notifying a subscriber after it unsubscribes', async () => {
    const { subscribeToScroll } = await import('../scroll-source.ts');
    const subscriber = vi.fn();

    const unsubscribe = subscribeToScroll(subscriber);
    unsubscribe();

    globalThis.window.scrollY = 300;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(subscriber).not.toHaveBeenCalled();
  });

  it('should keep subscriptions sharing a function reference distinct', async () => {
    const { subscribeToScroll } = await import('../scroll-source.ts');
    const shared = vi.fn();

    const unsubscribeFirst = subscribeToScroll(shared);
    subscribeToScroll(shared);

    globalThis.window.scrollY = 100;
    globalThis.window.dispatchEvent(new Event('scroll'));

    // Two subscriptions, so two notifications — not one collapsed entry.
    expect(shared).toHaveBeenCalledTimes(2);

    // Unsubscribing one must not silence the other, nor drop the listener.
    unsubscribeFirst();
    shared.mockClear();

    globalThis.window.scrollY = 200;
    globalThis.window.dispatchEvent(new Event('scroll'));

    expect(shared).toHaveBeenCalledTimes(1);
    expect(scrollListenerCount()).toBe(1);
  });

  it('should tolerate unsubscribing twice', async () => {
    const { subscribeToScroll } = await import('../scroll-source.ts');

    const unsubscribeFirst = subscribeToScroll(vi.fn());
    const unsubscribeSecond = subscribeToScroll(vi.fn());

    unsubscribeFirst();
    unsubscribeFirst();

    expect(scrollListenerCount()).toBe(1);

    unsubscribeSecond();

    expect(scrollListenerCount()).toBe(0);
  });
});
