import { NAV_MENU_CONFIG } from './config.ts';
import type { NavMenuContext } from './types.ts';

/**
 * Publishes [data-nav-mode] for CSS, wires [data-nav-back], and resets state on
 * breakpoint crossings and when the Webflow burger overlay closes.
 */
export function attachMobile({
  root,
  controller,
  cleanups,
}: NavMenuContext): void {
  const { selectors, mobile } = NAV_MENU_CONFIG;

  // Absent in SSR/jsdom — assume desktop rather than failing init.
  const mediaQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia(mobile.query)
      : null;

  const applyMode = () => {
    root.dataset.navMode = mediaQuery?.matches ? 'mobile' : 'desktop';
  };
  applyMode();

  if (mediaQuery) {
    const onMediaQueryChange = () => {
      applyMode();
      controller.setValue(null);
    };
    mediaQuery.addEventListener('change', onMediaQueryChange);
    cleanups.push(() =>
      mediaQuery.removeEventListener('change', onMediaQueryChange),
    );
  }

  const back = root.querySelector<HTMLElement>(selectors.back);
  if (back) {
    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      controller.setValue(null);
    };
    back.addEventListener('click', onClick);
    cleanups.push(() => back.removeEventListener('click', onClick));
  }

  const burger = root
    .closest(selectors.webflowNav)
    ?.querySelector<HTMLElement>(selectors.webflowBurger);

  if (burger && typeof MutationObserver !== 'undefined') {
    let wasOpen = burger.getAttribute('aria-expanded') === 'true';

    const observer = new MutationObserver(() => {
      const isOpen = burger.getAttribute('aria-expanded') === 'true';
      if (wasOpen && !isOpen) controller.setValue(null);
      wasOpen = isOpen;
    });
    observer.observe(burger, {
      attributes: true,
      attributeFilter: ['aria-expanded'],
    });

    cleanups.push(() => observer.disconnect());
  }
}
