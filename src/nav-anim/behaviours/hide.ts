import { gsap } from 'gsap';
import { NAVBAR_CONFIG } from '../config.ts';
import {
  createNavbarAnimation,
  performInitialAnimation,
} from '../initial-animation.ts';
import type { NavbarAnimationOptions, NavbarBehaviour } from '../types.ts';

/**
 * Determines if scroll distance is significant enough to trigger animation
 * @param currentScrollY - Current scroll position
 * @param lastScrollY - Scroll position at the last significant move
 * @returns Whether scroll is significant
 */
function isSignificantScroll(
  currentScrollY: number,
  lastScrollY: number,
): boolean {
  return (
    Math.abs(currentScrollY - lastScrollY) >= NAVBAR_CONFIG.scroll.threshold
  );
}

/**
 * Determines if user is scrolling down past threshold
 * @param currentScrollY - Current scroll position
 * @param lastScrollY - Scroll position at the last significant move
 * @returns Whether user is scrolling down past threshold
 */
function isScrollingDownPastThreshold(
  currentScrollY: number,
  lastScrollY: number,
): boolean {
  return (
    currentScrollY > lastScrollY &&
    currentScrollY > NAVBAR_CONFIG.scroll.threshold
  );
}

/**
 * Creates the hide/show behaviour for a single navbar element.
 *
 * The navbar slides in on initialization, slides out of the viewport once a
 * downward scroll clears the threshold, and slides back in on the way up.
 *
 * @param element - The navbar element this behaviour is bound to
 * @param options - Animation options
 * @returns A behaviour owning this element's state
 */
export function createHideBehaviour(
  element: Element,
  options: NavbarAnimationOptions,
): NavbarBehaviour {
  const targets = [element];

  let lastScrollY = window.scrollY;
  let isVisible = true;

  performInitialAnimation(targets, options);

  function showNavbar(): void {
    if (isVisible) return;

    createNavbarAnimation(targets, NAVBAR_CONFIG.position.visible, options);
    isVisible = true;
  }

  function hideNavbar(): void {
    if (!isVisible) return;

    createNavbarAnimation(targets, NAVBAR_CONFIG.position.hidden, options);
    isVisible = false;
  }

  return {
    onScroll(currentScrollY: number): void {
      if (!isSignificantScroll(currentScrollY, lastScrollY)) return;

      if (isScrollingDownPastThreshold(currentScrollY, lastScrollY)) {
        hideNavbar();
      } else {
        showNavbar();
      }

      lastScrollY = currentScrollY;
    },

    destroy(): void {
      gsap.killTweensOf(element);
      gsap.set(element, { clearProps: 'transform' });
    },
  };
}
