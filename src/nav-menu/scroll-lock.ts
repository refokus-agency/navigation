import { NAV_MENU_CONFIG } from './config.ts';

/** The slice of a Lenis instance the lock needs; everything is optional. */
type LenisLike = {
  stop?: () => void;
  start?: () => void;
  isStopped?: boolean;
};

const LENIS_PREVENT = 'data-lenis-prevent';

/**
 * Page-level state is shared by every lock: with two roots that each have a
 * card, the first `unlock` must not hand scroll back while the second card is
 * still open. The first lock saves and applies it, the last unlock restores it.
 */
let activeLocks = 0;
let savedOverflow: Array<{ element: HTMLElement; overflow: string }> = [];
let savedScrollY = 0;
let stoppedLenis: LenisLike | null = null;

function applyPageLock(): void {
  const { documentElement: html, body } = document;
  savedScrollY = window.scrollY;
  savedOverflow = [html, body].map((element) => ({
    element,
    overflow: element.style.overflow,
  }));
  for (const element of [html, body]) element.style.overflow = 'hidden';

  const lenis = (window as unknown as { lenis?: LenisLike }).lenis;
  if (lenis && typeof lenis.stop === 'function' && lenis.isStopped !== true) {
    lenis.stop();
    stoppedLenis = lenis;
  }
}

function releasePageLock(): void {
  for (const { element, overflow } of savedOverflow) {
    element.style.overflow = overflow;
  }
  savedOverflow = [];
  stoppedLenis?.start?.();
  stoppedLenis = null;
  if (window.scrollY !== savedScrollY) window.scrollTo(0, savedScrollY);
}

/**
 * Freezes page scroll while the mobile card is open, leaving the card's own
 * panels scrollable. Returns an idempotent `unlock` that undoes exactly what
 * this call changed; the page itself is only restored by the last open lock.
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
  if (activeLocks === 0) applyPageLock();
  activeLocks += 1;

  const marked = [
    card,
    ...root.querySelectorAll<HTMLElement>(NAV_MENU_CONFIG.selectors.content),
  ].filter((element) => !element.hasAttribute(LENIS_PREVENT));
  for (const element of marked) element.setAttribute(LENIS_PREVENT, '');

  let locked = true;
  return () => {
    if (!locked) return;
    locked = false;

    for (const element of marked) element.removeAttribute(LENIS_PREVENT);
    activeLocks -= 1;
    if (activeLocks === 0) releasePageLock();
  };
}
