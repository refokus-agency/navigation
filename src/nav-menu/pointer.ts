import { NAV_MENU_CONFIG } from './config.ts';
import type { NavMenuContext } from './types.ts';

/** Mouse only — touch falls through to the click handler. */
export function attachPointerEvents({
  root,
  refs,
  controller,
  cleanups,
}: NavMenuContext): void {
  const isMobile = () => root.dataset.navMode === 'mobile';

  for (const { trigger, value } of refs.entries) {
    if (!refs.contentMap.has(value)) continue;

    const onEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || isMobile()) return;
      controller.triggerPointerEnter(value, trigger);
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || isMobile()) return;
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

  const hoverTargets = refs.viewport
    ? [refs.viewport]
    : [...refs.contentMap.values()];

  for (const target of hoverTargets) {
    const onEnter = () => {
      if (isMobile()) return;
      controller.contentPointerEnter();
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || isMobile()) return;
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
    if (controller.getActiveValue() && !root.contains(target)) {
      controller.setValue(null);
    }
  };

  document.addEventListener('pointerdown', onOutside);
  document.addEventListener('focusin', onOutside);

  cleanups.push(() => {
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener('focusin', onOutside);
  });
}

export function attachLinkClicks({
  root,
  controller,
  cleanups,
}: NavMenuContext): void {
  const { selectors } = NAV_MENU_CONFIG;

  // meta/ctrl keeps it open so opening in a new tab does not lose context.
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const link =
      target.closest(`${selectors.content} a`) ??
      target.closest(`${selectors.content} ${selectors.link}`);
    if (!link) return;

    if (!event.metaKey && !event.ctrlKey) {
      controller.setValue(null);
    }
  };

  root.addEventListener('click', onClick);
  cleanups.push(() => root.removeEventListener('click', onClick));
}
