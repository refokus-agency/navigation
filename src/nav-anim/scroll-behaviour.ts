import { NAVBAR_CONFIG } from './config.ts';
import { createNavbarAnimation } from './initial-animation.ts';
import {
  cachedNavbarElements,
  type InitNavbarAnimationOptions,
} from './index.ts';

let lastScrollY = 0;
let isNavbarVisible = true;
let scrollHandlerBound: (() => void) | null = null;
let getInitOptions: () => InitNavbarAnimationOptions;

/**
 * Shows the navbar by sliding it down
 */
function showNavbar(): void {
  if (isNavbarVisible || !cachedNavbarElements) return;

  createNavbarAnimation(
    cachedNavbarElements,
    NAVBAR_CONFIG.position.visible,
    getInitOptions(),
  );
  isNavbarVisible = true;
}

/**
 * Hides the navbar by sliding it up
 */
function hideNavbar(): void {
  if (!isNavbarVisible || !cachedNavbarElements) return;

  createNavbarAnimation(
    cachedNavbarElements,
    NAVBAR_CONFIG.position.hidden,
    getInitOptions(),
  );
  isNavbarVisible = false;
}

/**
 * Determines if scroll distance is significant enough to trigger animation
 * @param currentScrollY - Current scroll position
 * @returns Whether scroll is significant
 */
function isSignificantScroll(currentScrollY: number): boolean {
  return (
    Math.abs(currentScrollY - lastScrollY) >= NAVBAR_CONFIG.scroll.threshold
  );
}

/**
 * Determines if user is scrolling down past threshold
 * @param currentScrollY - Current scroll position
 * @returns Whether user is scrolling down past threshold
 */
function isScrollingDownPastThreshold(currentScrollY: number): boolean {
  return (
    currentScrollY > lastScrollY &&
    currentScrollY > NAVBAR_CONFIG.scroll.threshold
  );
}

/**
 * Handles scroll events to show/hide navbar based on direction
 */
function handleScroll(): void {
  const currentScrollY = window.scrollY;

  if (!isSignificantScroll(currentScrollY)) return;

  if (isScrollingDownPastThreshold(currentScrollY)) {
    hideNavbar();
  } else {
    showNavbar();
  }

  lastScrollY = currentScrollY;
}

/**
 * Removes scroll event listener for cleanup
 */
export function cleanupNavbarAnimation(): void {
  if (scrollHandlerBound) {
    window.removeEventListener('scroll', scrollHandlerBound);
    scrollHandlerBound = null;
  }
}

/**
 * Initializes navbar scroll behavior
 */
export function initScrollBehavior(options: InitNavbarAnimationOptions): void {
  // TODO: Refactor to avoid closure and allow dynamic option updates
  getInitOptions = () => options;

  lastScrollY = window.scrollY;
  scrollHandlerBound = handleScroll;
  window.addEventListener('scroll', scrollHandlerBound, { passive: true });
}
