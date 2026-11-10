import { gsap } from 'gsap';
import { NAVBAR_CONFIG } from './config.ts';
import type { NavbarAnimationOptions } from './index.ts';

/**
 * Creates navbar slide animation
 * @param elements - Navbar elements to animate
 * @param targetY - Target Y position
 * @returns GSAP tween instance
 */
export function createNavbarAnimation(
  elements: Element[],
  targetY: string,
  options: NavbarAnimationOptions,
): gsap.core.Tween {
  return gsap.to(elements, {
    y: targetY,
    duration: options.animationDuration,
    ease: options.animationEasing,
    overwrite: true,
  });
}

/**
 * Performs initial navbar slide-in animation
 * @param navbarElements - Navbar elements to animate
 * @param options - Animation options
 */
export function performInitialAnimation(
  navbarElements: Element[],
  options: NavbarAnimationOptions,
): void {
  gsap.set(navbarElements, { y: NAVBAR_CONFIG.position.hidden });
  createNavbarAnimation(
    navbarElements,
    NAVBAR_CONFIG.position.visible,
    options,
  );
}
