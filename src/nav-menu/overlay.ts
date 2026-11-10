import type { NavMenuContext } from './types.ts';

/**
 * Opt-in `[data-nav-overlay]`. The renderer writes its `data-state`; this wires
 * the click-to-close and the init-time ARIA. It has its own listener because an
 * overlay inside the root is never "outside" for the dismiss handlers.
 * `closeCard` is the mobile card's close, a no-op without one.
 */
export function attachOverlay(
  { refs, controller, cleanups }: NavMenuContext,
  closeCard: () => void,
): void {
  const { overlay } = refs;
  if (!overlay) return;

  const hadAriaHidden = overlay.getAttribute('aria-hidden');
  overlay.setAttribute('aria-hidden', 'true');

  // On click, not pointerdown: closing on pointerdown lets a hidden overlay
  // stop taking events before the click, which then lands on the page below.
  const onClick = () => {
    controller.close();
    closeCard();
  };
  overlay.addEventListener('click', onClick);

  cleanups.push(() => {
    overlay.removeEventListener('click', onClick);
    if (hadAriaHidden === null) overlay.removeAttribute('aria-hidden');
    else overlay.setAttribute('aria-hidden', hadAriaHidden);
    delete overlay.dataset.state;
  });
}
