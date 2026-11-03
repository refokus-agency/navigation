import { NAV_MENU_CONFIG } from './config.ts';
import type { NavMenuContext } from './types.ts';

/**
 * The root's own breakpoint when [data-nav-breakpoint] is a plain integer from 1
 * to the configured maximum ("991"). An absent attribute uses the default
 * silently; anything else ("991px", " 991 ", "0991", "0", "9910") warns and
 * falls back to the default.
 */
function readBreakpoint(root: HTMLElement): number {
  const { attributes, mobile } = NAV_MENU_CONFIG;
  const value = root.getAttribute(attributes.breakpoint);
  if (value === null) return mobile.breakpoint;

  const breakpoint = /^[1-9]\d*$/.test(value) ? Number(value) : Number.NaN;
  if (breakpoint <= mobile.maxBreakpoint) return breakpoint;

  console.warn(
    `[nav-menu] Ignoring ${attributes.breakpoint}="${value}": expected a plain integer from 1 to ${mobile.maxBreakpoint} like "991". Using ${mobile.breakpoint}.`,
  );
  return mobile.breakpoint;
}

/**
 * Publishes [data-nav-mode] for CSS, wires [data-nav-back], and resets state on
 * breakpoint crossings and when the Webflow burger overlay closes.
 */
export function attachMobile({
  root,
  controller,
  cleanups,
}: NavMenuContext): void {
  const { selectors } = NAV_MENU_CONFIG;

  // Absent in SSR/jsdom — assume desktop rather than failing init.
  const mediaQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia(`(max-width: ${readBreakpoint(root)}px)`)
      : null;

  const applyMode = () => {
    root.dataset.navMode = mediaQuery?.matches ? 'mobile' : 'desktop';
  };
  applyMode();

  if (mediaQuery) {
    const onMediaQueryChange = () => {
      applyMode();
      controller.close();
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
      controller.close();
    };
    back.addEventListener('click', onClick);
    cleanups.push(() => back.removeEventListener('click', onClick));
  }

  const burger = root
    .closest(selectors.webflowNav)
    ?.querySelector<HTMLElement>(selectors.webflowBurger);

  if (burger && typeof MutationObserver !== 'undefined') {
    // Scan the whole batch, not just its first record: same-tick mutations
    // coalesce into one callback, and an open immediately followed by a close
    // leaves oldValues of ['false', 'true'] — so only `some` sees that the
    // overlay was open at all and a panel is now stranded behind it.
    const observer = new MutationObserver((mutations) => {
      const wasOpen = mutations.some(
        (mutation) => mutation.oldValue === 'true',
      );
      const isOpen = burger.getAttribute('aria-expanded') === 'true';
      if (wasOpen && !isOpen) controller.close();
    });
    observer.observe(burger, {
      attributes: true,
      attributeFilter: ['aria-expanded'],
      attributeOldValue: true,
    });

    cleanups.push(() => observer.disconnect());
  }
}
