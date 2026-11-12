import { gsap } from 'gsap';
import {
  type AttributeReader,
  isBoolean,
  isNonNegativeNumber,
  readBooleanAttr,
  readNumberAttr,
  resolveSetting,
} from '../attributes.ts';
import { NAVBAR_CONFIG } from './config.ts';
import { performInitialAnimation } from './initial-animation.ts';
import { initScrollBehavior } from './scroll-behaviour.ts';

export type NavbarAnimationOptions = {
  animationDuration: number;
  animationEasing: string;
  /** When false, the navbar slides in once and never hides on scroll. */
  hideOnScroll: boolean;
  /** Scroll distance, in px, before the navbar hides or shows. */
  scrollThreshold: number;
};

export type InitNavbarAnimationOptions = Partial<NavbarAnimationOptions>;

export type NavbarAnimationInstance = {
  /**
   * Removes the scroll and focus listeners, kills the navbar's `y` tweens and
   * resets its `y` to 0. Safe to call more than once.
   */
  destroy: () => void;
};

const DEFAULT_OPTIONS: NavbarAnimationOptions = {
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
  hideOnScroll: true,
  scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
};

/**
 * The live instance. Every instance animates the same `[data-nav-menu]`
 * roots, so only one may be live: a second init takes over from the first
 * rather than stacking listeners or leaving two instances fighting over the
 * nav's position.
 */
let current: NavbarAnimationInstance | null = null;

/**
 * Initializes navbar animation. A second call destroys the previous instance
 * first, so re-initializing (e.g. after a page transition) never leaks
 * listeners.
 * @returns The handle, or `null` when no nav root is on the page
 */
export function initNavbarAnimation(
  options: InitNavbarAnimationOptions = {},
): NavbarAnimationInstance | null {
  const navbarElements = document.querySelectorAll(
    NAVBAR_CONFIG.selectors.navbar,
  );

  if (!navbarElements.length) return null;

  const elements = Array.from(navbarElements);
  const resolvedOptions = resolveAnimOptions(elements[0] as Element, {
    ...DEFAULT_OPTIONS,
    ...options,
  });

  current?.destroy();

  // The slide-in always runs, so the navbar appears even when it never hides.
  performInitialAnimation(elements, resolvedOptions);
  const removeScrollBehavior = resolvedOptions.hideOnScroll
    ? initScrollBehavior(elements, resolvedOptions)
    : undefined;

  let destroyed = false;
  const instance: NavbarAnimationInstance = {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      if (current === instance) current = null;
      removeScrollBehavior?.();
      // Only the `y` this module drives: a consumer's own tweens and an
      // authored transform (e.g. a centering `translateX`) are left alone.
      // `clearProps` is not an option here: GSAP clears the whole transform
      // for any transform prop, and `-100%` is stored as `yPercent`.
      gsap.killTweensOf(elements, 'y');
      gsap.set(elements, { y: 0, yPercent: 0 });
    },
  };
  current = instance;
  return instance;
}

/**
 * Any name GSAP resolves to an ease function; `"foo"` resolves to nothing.
 * GSAP looks the base name (before any `(`) up in a plain object, so
 * `Object.prototype` members such as `"constructor"` or `"toString(1)"` resolve
 * to builtins and must be rejected explicitly. Malformed arguments
 * (`"steps(abc)"`) still resolve to a function, but one that returns `NaN`, so
 * the candidate is probed once.
 */
const isEase = (value: unknown): value is string => {
  if (typeof value !== 'string' || value === '') return false;
  const baseName = value.split('(')[0] ?? '';
  if (baseName in Object.prototype) return false;
  const ease = gsap.parseEase(value);
  return typeof ease === 'function' && Number.isFinite(ease(0.5));
};

const readEaseAttr: AttributeReader<string> = (el, name) => {
  const value = el.getAttribute(name);
  return isEase(value) ? value : undefined;
};

/**
 * The first root's attributes override the merged JS options; read once, at
 * init. Every root is animated by one instance, so the first root
 * decides. Invalid values — attribute or JS — are skipped silently.
 */
function resolveAnimOptions(
  firstRoot: Element,
  merged: NavbarAnimationOptions,
): NavbarAnimationOptions {
  const { attributes } = NAVBAR_CONFIG;

  return {
    hideOnScroll: resolveSetting({
      attribute: readBooleanAttr(firstRoot, attributes.hideOnScroll),
      js: merged.hideOnScroll,
      isValid: isBoolean,
      fallback: DEFAULT_OPTIONS.hideOnScroll,
    }),
    scrollThreshold: resolveSetting({
      attribute: readNumberAttr(firstRoot, attributes.scrollThreshold),
      js: merged.scrollThreshold,
      isValid: isNonNegativeNumber,
      fallback: DEFAULT_OPTIONS.scrollThreshold,
    }),
    animationDuration: resolveSetting({
      attribute: readNumberAttr(firstRoot, attributes.animDuration),
      js: merged.animationDuration,
      isValid: isNonNegativeNumber,
      fallback: DEFAULT_OPTIONS.animationDuration,
    }),
    animationEasing: resolveSetting({
      attribute: readEaseAttr(firstRoot, attributes.animEasing),
      js: merged.animationEasing,
      isValid: isEase,
      fallback: DEFAULT_OPTIONS.animationEasing,
    }),
  };
}
