import { NAVBAR_CONFIG } from './config.ts';

/**
 * Whether a scroll move is large enough to act on.
 *
 * The deadband keeps small jitter — a trackpad settling, a rubber-band bounce —
 * from flipping the navbar back and forth.
 *
 * @param currentScrollY - Current scroll position
 * @param lastScrollY - Scroll position at the last significant move
 * @returns Whether the move clears the threshold
 */
export function isSignificantScroll(
  currentScrollY: number,
  lastScrollY: number,
): boolean {
  return (
    Math.abs(currentScrollY - lastScrollY) >= NAVBAR_CONFIG.scroll.threshold
  );
}

/**
 * Whether the page is moving down and is far enough from the top to react.
 *
 * The second clause keeps the navbar in its resting state around the very top
 * of the page, where a downward move is usually the tail of an overscroll.
 *
 * @param currentScrollY - Current scroll position
 * @param lastScrollY - Scroll position at the last significant move
 * @returns Whether the page is scrolling down past the threshold
 */
export function isScrollingDownPastThreshold(
  currentScrollY: number,
  lastScrollY: number,
): boolean {
  return (
    currentScrollY > lastScrollY &&
    currentScrollY > NAVBAR_CONFIG.scroll.threshold
  );
}
