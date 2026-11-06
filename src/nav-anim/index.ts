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
import {
  cleanupNavbarAnimation,
  initScrollBehavior,
} from './scroll-behaviour.ts';

export type NavbarAnimationOptions = {
  animationDuration: number;
  animationEasing: string;
  /** When false, the navbar slides in once and never hides on scroll. */
  hideOnScroll: boolean;
  /** Scroll distance, in px, before the navbar hides or shows. */
  scrollThreshold: number;
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
  hideOnScroll: true,
  scrollThreshold: NAVBAR_CONFIG.scroll.threshold,
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

  const elements = Array.from(navbarElements);
  const resolvedOptions = resolveAnimOptions(elements[0] as Element, {
    ...DEFAULT_OPTIONS,
    ...options,
  });

  // A re-init must drop the previous singleton binding, even when it no
  // longer hides on scroll and so never reaches initScrollBehavior.
  cleanupNavbarAnimation();

  // The slide-in always runs, so the navbar appears even when it never hides.
  performInitialAnimation(elements, resolvedOptions);
  if (resolvedOptions.hideOnScroll) {
    initScrollBehavior(elements, resolvedOptions);
  }

  return true;
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

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

const readEaseAttr: AttributeReader<string> = (el, name) => {
  const value = el.getAttribute(name);
  return isEase(value) ? value : undefined;
};

/**
 * The first root's attributes override the merged JS options; read once, at
 * init. Every root is animated, but the state is a singleton, so one root
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
    hiddenOffset: isString(merged.hiddenOffset)
      ? merged.hiddenOffset
      : DEFAULT_OPTIONS.hiddenOffset,
    visibleOffset: isString(merged.visibleOffset)
      ? merged.visibleOffset
      : DEFAULT_OPTIONS.visibleOffset,
    pauseWhileMenuOpen: isBoolean(merged.pauseWhileMenuOpen)
      ? merged.pauseWhileMenuOpen
      : DEFAULT_OPTIONS.pauseWhileMenuOpen,
    shouldHide:
      typeof merged.shouldHide === 'function' ? merged.shouldHide : undefined,
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
