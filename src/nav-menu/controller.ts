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
  let openTimer: Timer;
  let closeTimer: Timer;
  let skipTimer: Timer;
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

    if (value !== null) {
      clearTimeout(skipTimer);
      if (options.skipDelayDuration > 0) isOpenDelayed = false;
    } else {
      clearTimeout(skipTimer);
      skipTimer = setTimeout(() => {
        isOpenDelayed = true;
      }, options.skipDelayDuration);
    }

    renderer.applyState(value, previousValue);
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
        openTimer = setTimeout(() => {
          clearTimeout(closeTimer);
          setValue(value);
        }, options.delayDuration);
      }
    } else {
      clearTimeout(closeTimer);
      setValue(value);
    }
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
      setValue(null);
      if (pointerState) pointerState.wasClickClose = true;
    } else {
      setValue(value);
    }
  }

  function contentPointerEnter(): void {
    clearTimeout(closeTimer);
  }

  function contentPointerLeave(): void {
    startCloseTimer();
  }

  function startCloseTimer(): void {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(
      () => setValue(null),
      NAV_MENU_CONFIG.timing.closeDelay,
    );
  }

  function handleEscape(): HTMLElement | null {
    if (!activeValue) return null;

    const trigger = refs.triggerByValue.get(activeValue) ?? null;
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
    setValue,
    triggerPointerEnter,
    triggerPointerLeave,
    triggerClick,
    contentPointerEnter,
    contentPointerLeave,
    handleEscape,
    getActiveValue: () => activeValue,
    destroy,
  };
}
