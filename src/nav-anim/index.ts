import { NAVBAR_CONFIG } from './config.ts';
import { performInitialAnimation } from './initial-animation.ts';
import { initScrollBehavior } from './scroll-behaviour.ts';

export type NavbarAnimationOptions = {
  animationDuration: number;
  animationEasing: string;
  /** Minimum scroll distance (px) before the navbar shows or hides. */
  threshold: number;
  /** GSAP `y` value while hidden. */
  hiddenOffset: string;
  /** GSAP `y` value while visible. */
  visibleOffset: string;
  /** Never hide while the nav root has `[data-state="open"]`. */
  pauseWhileMenuOpen: boolean;
  /** Return `false` to veto hiding on a given scroll. */
  shouldHide?: () => boolean;
};

export type InitNavbarAnimationOptions = Partial<NavbarAnimationOptions>;

const DEFAULT_OPTIONS: NavbarAnimationOptions = {
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
  threshold: NAVBAR_CONFIG.scroll.threshold,
  hiddenOffset: NAVBAR_CONFIG.position.hidden,
  visibleOffset: NAVBAR_CONFIG.position.visible,
  pauseWhileMenuOpen: true,
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
