import { NAVBAR_CONFIG } from './config.ts';
import type { NavbarAnimationOptions } from './index.ts';
import { createNavbarAnimation } from './initial-animation.ts';

/**
 * Binds scroll and focus handlers that show/hide the navbar elements. All
 * state lives in this closure, so instances are independent.
 * @returns A teardown that removes both listeners
 */
export function initScrollBehavior(
  elements: Element[],
  options: NavbarAnimationOptions,
): () => void {
  let lastScrollY = window.scrollY;
  let isNavbarVisible = true;

  const showNavbar = (): void => {
    if (isNavbarVisible) return;
    createNavbarAnimation(elements, NAVBAR_CONFIG.position.visible, options);
    isNavbarVisible = true;
  };

  const hideNavbar = (): void => {
    if (!isNavbarVisible) return;
    createNavbarAnimation(elements, NAVBAR_CONFIG.position.hidden, options);
    isNavbarVisible = false;
  };

  /**
   * Whether a dropdown panel (root `[data-state="open"]`) or the mobile card
   * is open. Hiding the bar then would strand the panel or the burger toggle.
   */
  const isMenuOpen = (): boolean =>
    elements.some(
      (element) =>
        element instanceof HTMLElement &&
        (element.dataset.state === 'open' ||
          element.querySelector(
            `${NAVBAR_CONFIG.selectors.card}[data-state="open"]`,
          ) !== null),
    );

  /** Reveals a hidden navbar when focus moves into it. */
  const handleFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (elements.some((element) => element.contains(target))) showNavbar();
  };

  const handleScroll = (): void => {
    const currentScrollY = window.scrollY;
    const threshold = options.scrollThreshold;

    if (Math.abs(currentScrollY - lastScrollY) < threshold) return;

    if (currentScrollY > lastScrollY && currentScrollY > threshold) {
      if (!isMenuOpen()) hideNavbar();
    } else {
      showNavbar();
    }

    lastScrollY = currentScrollY;
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('focusin', handleFocusIn);

  return () => {
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('focusin', handleFocusIn);
  };
}
