import { isMobileMode, isNavigateTrigger, NAV_MENU_CONFIG } from './config.ts';
import type { NavMenuContext } from './types.ts';

/**
 * A click from a mouse, as opposed to keyboard activation (`detail === 0`) or
 * a touch tap. Deliberately not `pointerType === 'mouse'`: engines that
 * dispatch a plain MouseEvent leave it undefined.
 */
function isMouseClick(event: MouseEvent): boolean {
  return event.detail > 0 && (event as PointerEvent).pointerType !== 'touch';
}

/** Trigger clicks toggle in both modes — touch always lands here. */
export function attachTriggerClicks({
  refs,
  controller,
  cleanups,
}: NavMenuContext): void {
  for (const { trigger, value } of refs.entries) {
    if (!refs.contentMap.has(value)) continue;

    const onClick = (event: MouseEvent) => {
      // Read per click so the attribute can change after init. Navigate mode
      // leaves the link alone in both interaction modes: its panel opens from
      // hover (hover mode) or the keyboard.
      if (isNavigateTrigger(trigger)) return;
      event.preventDefault();
      // Hover already opened this panel, so the first mouse click must not
      // close it. Never true in click mode (no hover opens) or mobile mode.
      if (isMouseClick(event) && controller.consumeHoverOpen(value)) return;
      controller.triggerClick(value, trigger);
    };

    trigger.addEventListener('click', onClick);
    cleanups.push(() => trigger.removeEventListener('click', onClick));
  }
}

/**
 * Hover mode only — click mode never calls this, so no hover timer can ever be
 * scheduled. Mouse only: touch falls through to the click handler.
 */
export function attachHoverEvents({
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
    event.pointerType === 'mouse' && !isMobileMode(root);

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

    trigger.addEventListener('pointerenter', onEnter);
    trigger.addEventListener('pointerleave', onLeave);

    cleanups.push(() => {
      trigger.removeEventListener('pointerenter', onEnter);
      trigger.removeEventListener('pointerleave', onLeave);
    });
  }

  // Without a viewport, panels live inside their item, and such a panel needs
  // its own hover target or the close timer runs on under the cursor. (With
  // one, init has already relocated every panel into it.)
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
  dismissHooks,
}: NavMenuContext): void {
  const onOutside = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (root.contains(target)) return;
    // Not gated on getActiveValue(): it is still null while a hover-open is
    // only pending, and setValue(null) is what cancels that timer.
    // finally: the hooks (the mobile card) must close even if close() throws.
    try {
      controller.close();
    } finally {
      for (const hook of dismissHooks.outside) hook();
    }
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
  dismissHooks,
}: NavMenuContext): void {
  const { selectors } = NAV_MENU_CONFIG;
  // Triggers, back controls and toggles are not links, even when authored as
  // <a href> (Webflow's default).
  const controls = `${selectors.trigger}, ${selectors.back}, ${selectors.toggle}`;

  // A click that does not follow the link keeps the menu open.
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || !isFollowedClick(event)) return;

    const panelLink =
      target.closest(`${selectors.content} a`) ??
      target.closest(`${selectors.content} ${selectors.link}`);
    const link = target.closest(`a[href], ${selectors.link}`);
    try {
      if (panelLink) controller.close();
    } finally {
      if (link && !link.closest(controls)) {
        for (const hook of dismissHooks.link) hook();
      }
    }
  };

  root.addEventListener('click', onClick);
  cleanups.push(() => root.removeEventListener('click', onClick));
}
