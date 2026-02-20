import { gsap } from 'gsap';
import { NAVBAR_CONFIG } from './config.ts';
import type { InitNavbarAnimationOptions } from './index.ts';

let scrollHandlerBound: (() => void) | null = null;

/**
 * Creates navbar slide animation
 * @param {Element[]} elements - Navbar elements to animate
 * @param {string} targetY - Target Y position
 * @returns {gsap.core.Tween} GSAP tween instance
 */
export function createNavbarAnimation(
  elements: Element[],
  targetY: string,
  options: InitNavbarAnimationOptions,
): gsap.core.Tween {
  return gsap.to(elements, {
    y: targetY,
    duration: options.animationDuration,
    ease: options.animationEasing,
    overwrite: true,
  });
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
 * Performs initial navbar slide-in animation
 * @param navbarElements - Navbar elements to animate
 * @param options - Animation options
 */
export function performInitialAnimation(
  navbarElements: Element[],
  options: InitNavbarAnimationOptions,
): void {
  gsap.set(navbarElements, { y: NAVBAR_CONFIG.position.hidden });
  createNavbarAnimation(
    navbarElements,
    NAVBAR_CONFIG.position.visible,
    options,
  );
}
