import { NAVBAR_CONFIG } from './config.ts';
import { performInitialAnimation } from './initial-animation.ts';
import { initScrollBehavior } from './scroll-behaviour.ts';

export type NavbarAnimationOptions = {
  animationDuration: number;
  animationEasing: string;
};

export type InitNavbarAnimationOptions = Partial<NavbarAnimationOptions>;

const DEFAULT_OPTIONS: NavbarAnimationOptions = {
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
};

/**
 * Initializes navbar animation system
 * @returns Whether initialization was successful
 */
export function initNavbarAnimation(
  options: InitNavbarAnimationOptions = {},
): boolean {
  const navbarElements = document.querySelectorAll(
    NAVBAR_CONFIG.selectors.navbar,
  );

  if (!navbarElements.length) return false;

  const resolvedOptions: NavbarAnimationOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const elements = Array.from(navbarElements);
  performInitialAnimation(elements, resolvedOptions);
  initScrollBehavior(elements, resolvedOptions);

  return true;
}
