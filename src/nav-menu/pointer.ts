import { NAV_MENU_CONFIG } from './config.ts';
import type { NavMenuContext } from './types.ts';

/** Mouse only — touch falls through to the click handler. */
export function attachPointerEvents({
  root,
  refs,
  controller,
  cleanups,
}: NavMenuContext): void {
  // One guard for all four handlers, so it cannot be dropped from one of them:
  // a touchscreen laptop at desktop width has isMobile() false, and an
  // unfiltered touch pointerenter would clear the close timer with no
  // pointerleave to follow it.
  const isMouseHover = (event: PointerEvent) =>
    event.pointerType === 'mouse' && root.dataset.navMode !== 'mobile';

  for (const { trigger, value } of refs.entries) {
    if (!refs.contentMap.has(value)) continue;

    const onEnter = (event: PointerEvent) => {
      if (!isMouseHover(event)) return;
      controller.triggerPointerEnter(value, trigger);
    };
    const onLeave = (event: PointerEvent) => {
      if (!isMouseHover(event)) return;
      controller.triggerPointerLeave(trigger);
    };
    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      controller.triggerClick(value, trigger);
    };

    trigger.addEventListener('pointerenter', onEnter);
    trigger.addEventListener('pointerleave', onLeave);
    trigger.addEventListener('click', onClick);

    cleanups.push(() => {
      trigger.removeEventListener('pointerenter', onEnter);
      trigger.removeEventListener('pointerleave', onLeave);
      trigger.removeEventListener('click', onClick);
    });
  }

  // Panels can fall back to living inside their item even when a viewport
  // exists, and such a panel needs its own hover target or the close timer
  // runs on under the cursor.
  const outsideViewport = [...refs.contentMap.values()].filter(
    (content) => !refs.viewport?.contains(content),
  );
  const hoverTargets = refs.viewport
    ? [refs.viewport, ...outsideViewport]
    : outsideViewport;

  for (const target of hoverTargets) {
    const onEnter = (event: PointerEvent) => {
      if (!isMouseHover(event)) return;
      controller.contentPointerEnter();
    };
    const onLeave = (event: PointerEvent) => {
      if (!isMouseHover(event)) return;
      controller.contentPointerLeave();
    };

    target.addEventListener('pointerenter', onEnter);
    target.addEventListener('pointerleave', onLeave);

    cleanups.push(() => {
      target.removeEventListener('pointerenter', onEnter);
      target.removeEventListener('pointerleave', onLeave);
    });
  }
}

export function attachDismiss({
  root,
  controller,
  cleanups,
}: NavMenuContext): void {
  const onOutside = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    // Not gated on getActiveValue(): it is still null while a hover-open is
    // only pending, and setValue(null) is what cancels that timer.
    if (!root.contains(target)) controller.close();
  };

  document.addEventListener('pointerdown', onOutside);
  document.addEventListener('focusin', onOutside);

  cleanups.push(() => {
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener('focusin', onOutside);
  });
}

/**
 * Whether a click on a link actually leaves the page (or its place in it).
 * Modifier-clicks open a new tab or window and the user stays here, and a
 * handler that called preventDefault (a modal opener, say) navigates nowhere —
 * dismissing on either would close the menu on a click that did nothing.
 */
export function isFollowedClick(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey
  );
}

export function attachLinkClicks({
  root,
  controller,
  cleanups,
}: NavMenuContext): void {
  const { selectors } = NAV_MENU_CONFIG;

  // A click that does not follow the link keeps the menu open.
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const link =
      target.closest(`${selectors.content} a`) ??
      target.closest(`${selectors.content} ${selectors.link}`);
    if (!link) return;

    if (isFollowedClick(event)) controller.close();
  };

  root.addEventListener('click', onClick);
  cleanups.push(() => root.removeEventListener('click', onClick));
}
