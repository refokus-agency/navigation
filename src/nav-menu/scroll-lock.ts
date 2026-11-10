import { NAV_MENU_CONFIG } from './config.ts';

/** The slice of a Lenis instance the lock needs; everything is optional. */
type LenisLike = {
  stop?: () => void;
  start?: () => void;
  isStopped?: boolean;
};

const LENIS_PREVENT = 'data-lenis-prevent';

/**
 * Freezes page scroll while the mobile card is open, leaving the card's own
 * panels scrollable. Returns an idempotent `unlock` that undoes exactly what
 * this call changed.
 *
 * - Native scroll: `overflow: hidden` on `<html>` and `<body>`. The scroll
 *   offset is untouched, so unlocking lands on the same position and fires no
 *   scroll event (nav-anim would otherwise read a jump and hide the bar).
 * - Lenis: it scrolls programmatically, which `overflow: hidden` does not stop,
 *   so `window.lenis` (the usual way sites expose it) is stopped and restarted.
 *   `data-lenis-prevent` on the card and panels lets them keep native scroll.
 */
export function lockPageScroll(
  root: HTMLElement,
  card: HTMLElement,
): () => void {
  const { documentElement: html, body } = document;
  const scrollY = window.scrollY;
  const previous = [html, body].map((element) => ({
    element,
    overflow: element.style.overflow,
  }));
  for (const element of [html, body]) element.style.overflow = 'hidden';

  const lenis = (window as unknown as { lenis?: LenisLike }).lenis;
  const stoppedLenis =
    !!lenis && typeof lenis.stop === 'function' && lenis.isStopped !== true;
  if (stoppedLenis) lenis.stop?.();

  const marked = [
    card,
    ...root.querySelectorAll<HTMLElement>(NAV_MENU_CONFIG.selectors.content),
  ].filter((element) => !element.hasAttribute(LENIS_PREVENT));
  for (const element of marked) element.setAttribute(LENIS_PREVENT, '');

  let locked = true;
  return () => {
    if (!locked) return;
    locked = false;

    for (const { element, overflow } of previous) {
      element.style.overflow = overflow;
    }
    for (const element of marked) element.removeAttribute(LENIS_PREVENT);
    if (stoppedLenis) lenis?.start?.();
    if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
  };
}
