/**
 * Behaviour a navbar element opts into via the `r-navbar-behaviour` attribute.
 *
 * - `none` — the element is left completely alone. This is what an absent,
 *   empty, or unrecognised attribute resolves to.
 * - `hide` — slides the navbar out of the viewport on scroll down.
 * - `compress` — collapses the navbar into a compact form on scroll down.
 */
export type NavbarBehaviourName = 'none' | 'hide' | 'compress';

/**
 * Animation settings shared by every behaviour.
 */
export type NavbarAnimationOptions = {
  animationDuration: number;
  animationEasing: string;
  /**
   * Viewport width, in pixels, at or above which `compress` registers. Below
   * it the behaviour stays dormant and clears anything it wrote.
   */
  compressBreakpoint: number;
};

/**
 * A behaviour bound to a single navbar element. Each element gets its own
 * instance, so state never leaks between navbars on the same page.
 */
export type NavbarBehaviour = {
  /** Called with `window.scrollY` by the shared scroll source. */
  onScroll: (scrollY: number) => void;
  /** Kills in-flight tweens and clears every inline property it wrote. */
  destroy: () => void;
};

/**
 * Returned by `initNavbarAnimation`. Tears down every behaviour it created.
 */
export type NavbarAnimationHandle = {
  destroy: () => void;
};
