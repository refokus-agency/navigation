import { NAV_MENU_CONFIG } from './config.ts';
import type {
  NavMenuController,
  NavMenuOptions,
  NavMenuRefs,
  NavMenuRenderer,
} from './types.ts';

type TriggerPointerState = {
  wasClickClose: boolean;
  wasEscapeClose: boolean;
};

type Timer = ReturnType<typeof setTimeout> | undefined;

/** Owns the open/closed state machine and every hover timer. */
export function createController({
  refs,
  options,
  renderer,
}: {
  refs: NavMenuRefs;
  options: NavMenuOptions;
  renderer: NavMenuRenderer;
}): NavMenuController {
  let activeValue: string | null = null;
  let previousValue: string | null = null;
  // The trigger that actually opened the panel. An item may own several, and
  // focus must return to the one the user used, not the first in the item.
  let activeTrigger: HTMLElement | null = null;
  let openTimer: Timer;
  let closeTimer: Timer;
  let skipTimer: Timer;
  // Whether the active panel was opened by pointer hover rather than a click,
  // key or API call. A mouse click may only be swallowed on a hover-opened
  // panel; on any other it must still toggle.
  let openedByHover = false;
  // When false, opens are instant: a recent close skips delayDuration.
  let isOpenDelayed = true;

  const triggerPointerState = new Map<HTMLElement, TriggerPointerState>();
  for (const trigger of refs.triggers) {
    triggerPointerState.set(trigger, {
      wasClickClose: false,
      wasEscapeClose: false,
    });
  }

  function setValue(value: string | null): void {
    if (activeValue === value) return;
    previousValue = activeValue;
    activeValue = value;
    openedByHover = false;
    if (value === null) activeTrigger = null;

    if (value !== null) {
      clearTimeout(skipTimer);
      if (options.skipDelayDuration > 0) isOpenDelayed = false;
    } else {
      clearTimeout(skipTimer);
      skipTimer = setTimeout(() => {
        isOpenDelayed = true;
      }, options.skipDelayDuration);
    }

    renderer.applyState(value, previousValue, activeTrigger);
    options.onValueChange?.(value);
  }

  // Block reopening until the cursor leaves and re-enters; pointerleave resets.
  function triggerPointerEnter(value: string, trigger: HTMLElement): void {
    const pointerState = triggerPointerState.get(trigger);
    if (!pointerState) return;
    if (pointerState.wasClickClose || pointerState.wasEscapeClose) return;

    if (isOpenDelayed) {
      if (activeValue === value) {
        clearTimeout(closeTimer);
      } else {
        openTimer = setTimeout(
          () => openFromHover(value, trigger),
          options.delayDuration,
        );
      }
    } else {
      openFromHover(value, trigger);
    }
  }

  function openFromHover(value: string, trigger: HTMLElement): void {
    // Only a hover that opens a new panel counts: re-entering a panel a click
    // opened is a no-op in open() and must not relabel it as hover-opened.
    // open() clears the mark, so a re-entry keeps whatever it already was.
    const wasHoverOpened = activeValue === value && openedByHover;
    const isNewPanel = activeValue !== value;
    open(value, trigger);
    openedByHover = isNewPanel || wasHoverOpened;
  }

  function triggerPointerLeave(trigger: HTMLElement): void {
    const pointerState = triggerPointerState.get(trigger);
    clearTimeout(openTimer);
    startCloseTimer();

    if (pointerState) {
      pointerState.wasClickClose = false;
      pointerState.wasEscapeClose = false;
    }
  }

  function triggerClick(value: string, trigger: HTMLElement): void {
    const pointerState = triggerPointerState.get(trigger);

    if (activeValue === value) {
      close();
      if (pointerState) pointerState.wasClickClose = true;
    } else {
      open(value, trigger);
    }
  }

  function contentPointerEnter(): void {
    clearTimeout(closeTimer);
  }

  function contentPointerLeave(): void {
    startCloseTimer();
  }

  /**
   * The only two ways in from outside — `setValue` is deliberately not exposed.
   * Both cancel the pending timers, because an in-flight `openTimer` or
   * `closeTimer` is invisible to `getActiveValue()` and would otherwise undo
   * the transition a moment later: a double-click reopening what the second
   * click closed, or a stale close swallowing a programmatic open.
   */
  function open(value: string, trigger?: HTMLElement): void {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    activeTrigger = trigger ?? refs.triggerByValue.get(value) ?? null;
    openedByHover = false;
    setValue(value);
  }

  function close(): void {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    setValue(null);
  }

  function startCloseTimer(): void {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(
      () => setValue(null),
      NAV_MENU_CONFIG.timing.closeDelay,
    );
  }

  function handleEscape(): HTMLElement | null {
    // Even with nothing open, a hover-open may be in flight.
    clearTimeout(openTimer);
    if (!activeValue) return null;

    const trigger =
      activeTrigger ?? refs.triggerByValue.get(activeValue) ?? null;
    const pointerState = trigger ? triggerPointerState.get(trigger) : null;
    if (pointerState) pointerState.wasEscapeClose = true;
    setValue(null);

    return trigger;
  }

  function destroy(): void {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    clearTimeout(skipTimer);
  }

  return {
    open,
    close,
    triggerPointerEnter,
    triggerPointerLeave,
    triggerClick,
    contentPointerEnter,
    contentPointerLeave,
    handleEscape,
    getActiveValue: () => activeValue,
    consumeHoverOpen: (value) => {
      const hoverOpened = activeValue === value && openedByHover;
      openedByHover = false;
      return hoverOpened;
    },
    getActiveTrigger: () => activeTrigger,
    destroy,
  };
}
