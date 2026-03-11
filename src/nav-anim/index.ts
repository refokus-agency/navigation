import { NAVBAR_CONFIG } from './config.ts';
import { performInitialAnimation } from './initial-animation.ts';
import { initScrollBehavior } from './scroll-behaviour.ts';

export type InitNavbarAnimationOptions = {
  animationDuration: number;
  animationEasing: string;
};

const DEFAULT_OPTIONS: InitNavbarAnimationOptions = {
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
};

export let cachedNavbarElements: Element[] = [];

/**
 * Initializes navbar animation system
 * @returns Whether initialization was successful
 */
export function initNavbarAnimation(
  options: InitNavbarAnimationOptions = DEFAULT_OPTIONS,
): boolean {
  const navbarElements = document.querySelectorAll(
    NAVBAR_CONFIG.selectors.navbar,
  );

  if (!navbarElements.length) return false;

  cachedNavbarElements = Array.from(navbarElements);
  performInitialAnimation(cachedNavbarElements, options);
  initScrollBehavior(options);

  return true;
}
