import type { NavMenuContext } from './types.ts';

/**
 * Opt-in `[data-nav-overlay]`. The renderer writes its `data-state`; this wires
 * the click-to-close and the init-time ARIA. It has its own listener because an
 * overlay inside the root is never "outside" for the dismiss handlers.
 * The mobile card closes through the shared `dismissHooks.outside`.
 */
export function attachOverlay({
  refs,
  controller,
  cleanups,
  dismissHooks,
}: NavMenuContext): void {
  const { overlay } = refs;
  if (!overlay) return;

  const hadAriaHidden = overlay.getAttribute('aria-hidden');
  overlay.setAttribute('aria-hidden', 'true');

  // On click, not pointerdown: closing on pointerdown lets a hidden overlay
  // stop taking events before the click, which then lands on the page below.
  const onClick = () => {
    // finally: the hooks (the mobile card) must close even if close() throws.
    try {
      controller.close();
    } finally {
      for (const hook of dismissHooks.outside) hook();
    }
  };
  overlay.addEventListener('click', onClick);

  cleanups.push(() => {
    overlay.removeEventListener('click', onClick);
    if (hadAriaHidden === null) overlay.removeAttribute('aria-hidden');
    else overlay.setAttribute('aria-hidden', hadAriaHidden);
    delete overlay.dataset.state;
  });
}
