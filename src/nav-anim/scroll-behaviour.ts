import { NAVBAR_CONFIG } from './config.ts';
import type { NavbarAnimationOptions } from './index.ts';
import { createNavbarAnimation } from './initial-animation.ts';

let lastScrollY = 0;
let isNavbarVisible = true;
let scrollHandlerBound: (() => void) | null = null;
let focusHandlerBound: ((event: FocusEvent) => void) | null = null;
let currentOptions: NavbarAnimationOptions | null = null;
let navbarElements: Element[] = [];

/**
 * Shows the navbar by sliding it down
 */
function showNavbar(): void {
  if (isNavbarVisible || navbarElements.length === 0 || !currentOptions) return;

  createNavbarAnimation(
    navbarElements,
    NAVBAR_CONFIG.position.visible,
    currentOptions,
  );
  isNavbarVisible = true;
}

/**
 * Hides the navbar by sliding it up
 */
function hideNavbar(): void {
  if (!isNavbarVisible || navbarElements.length === 0 || !currentOptions)
    return;

  createNavbarAnimation(
    navbarElements,
    NAVBAR_CONFIG.position.hidden,
    currentOptions,
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
 * Reveals a hidden navbar when focus moves into it, so tabbing back up never
 * lands on an off-screen element.
 */
function handleFocusIn(event: FocusEvent): void {
  const target = event.target;
  if (!(target instanceof Node)) return;

  const isInsideNavbar = navbarElements.some((element) =>
    element.contains(target),
  );

  if (isInsideNavbar) showNavbar();
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
 * Removes scroll and focus event listeners for cleanup
 */
export function cleanupNavbarAnimation(): void {
  if (scrollHandlerBound) {
    window.removeEventListener('scroll', scrollHandlerBound);
    scrollHandlerBound = null;
  }

  if (focusHandlerBound) {
    document.removeEventListener('focusin', focusHandlerBound);
    focusHandlerBound = null;
  }

  navbarElements = [];
  currentOptions = null;
}

/**
 * Initializes navbar scroll behavior
 */
export function initScrollBehavior(
  elements: Element[],
  options: NavbarAnimationOptions,
): void {
  if (scrollHandlerBound) {
    window.removeEventListener('scroll', scrollHandlerBound);
  }

  if (focusHandlerBound) {
    document.removeEventListener('focusin', focusHandlerBound);
  }

  currentOptions = options;
  navbarElements = elements;
  isNavbarVisible = true;
  lastScrollY = window.scrollY;

  scrollHandlerBound = handleScroll;
  window.addEventListener('scroll', scrollHandlerBound, { passive: true });

  focusHandlerBound = handleFocusIn;
  document.addEventListener('focusin', focusHandlerBound);
}
