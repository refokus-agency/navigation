import { NAV_MENU_CONFIG } from './config.ts';
import { focusFirst, getTabbableCandidates } from './keyboard.ts';
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
 *
 * Returns the programmatic `open(value)` for the instance: in mobile mode it
 * opens the card first when it is closed, taking focus into the panel.
 */
export function attachMobile(context: NavMenuContext): (value: string) => void {
  const { root, refs, controller, cleanups } = context;
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

  const isMobile = () => root.dataset.navMode === 'mobile';
  const { openCard, closeCard } = attachCard(context, isMobile);

  const focusPanel = (value: string) => {
    const content = refs.contentMap.get(value);
    if (content) focusFirst(getTabbableCandidates(content));
  };

  // Accordion: land focus on the first link of the panel a user just opened.
  // Tied to activation, not to state: arrow-key traversal and programmatic
  // open() also change state and must not pull focus off the trigger. The one
  // exception is open() on a closed card (see the returned function below).
  const focusOpenedPanel = (trigger: HTMLElement) => {
    if (!isMobile()) return;
    const value = refs.valueByTrigger.get(trigger);
    if (!value || controller.getActiveValue() !== value) return;
    focusPanel(value);
  };
  // Registered after the pointer/keyboard modules, so state is already updated.
  for (const trigger of refs.triggers) {
    const onClick = () => focusOpenedPanel(trigger);
    trigger.addEventListener('click', onClick);
    cleanups.push(() => trigger.removeEventListener('click', onClick));
  }
  const onTriggerKey = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const trigger = (event.target as Element | null)?.closest<HTMLElement>(
      selectors.trigger,
    );
    if (trigger) focusOpenedPanel(trigger);
  };
  root.addEventListener('keydown', onTriggerKey);
  cleanups.push(() => root.removeEventListener('keydown', onTriggerKey));

  if (mediaQuery) {
    const onMediaQueryChange = () => {
      applyMode();
      closeCard();
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

  // Programmatic open(): in mobile mode a panel inside a closed (inert) card
  // is invisible, so the card opens with it. Deliberate exception to "open()
  // never moves focus": the caller is typically a CTA outside the nav, and the
  // opened card covers the page, so focus has to go in. openCard remembers the
  // CTA as the opener, so Escape hands focus back to it. When the card is
  // already open, focus stays where it is, like any other in-place open.
  return (value) => {
    const cardOpened = isMobile() && openCard();
    controller.open(value);
    if (cardOpened) focusPanel(value);
  };
}

/**
 * Opt-in `[data-nav-toggle]` / `[data-nav-card]` pair. Every toggle is wired,
 * so a close button inside the card works like the header's open button.
 * Returns `closeCard`, for breakpoint crossings, and `openCard`, for the
 * programmatic `open()`: it records the focused element as the opener (a CTA
 * outside the nav) and reports whether it actually opened a closed card. Both
 * no-op when there is no toggle or no card.
 */
function attachCard(
  {
    controller,
    renderer,
    cleanups,
    root,
    idPrefix,
    dismissHooks,
  }: NavMenuContext,
  isMobile: () => boolean,
): { openCard: () => boolean; closeCard: () => void } {
  const { selectors } = NAV_MENU_CONFIG;
  const toggles = [...root.querySelectorAll<HTMLElement>(selectors.toggle)];
  const card = root.querySelector<HTMLElement>(selectors.card);
  if (toggles.length === 0 || !card) {
    return { openCard: () => false, closeCard: () => {} };
  }

  card.id ||= `${idPrefix}-card`;
  for (const toggle of toggles) toggle.setAttribute('aria-controls', card.id);

  let isOpen = false;
  // The toggle that opened the card, so focus returns there on close — a close
  // button inside the card goes inert with it and cannot keep focus.
  let opener: HTMLElement | null = null;

  const render = () => {
    for (const toggle of toggles) {
      toggle.setAttribute('aria-expanded', String(isOpen));
    }
    renderer.setCardOpen(isOpen && isMobile());
    // Desktop never sees the card state: a consumer's natural
    // `[data-nav-card][data-state='closed'] { display: none }` would otherwise
    // hide the whole desktop menu. Crossing the breakpoint re-renders.
    if (!isMobile()) {
      delete card.dataset.state;
      card.removeAttribute('inert');
      return;
    }
    card.dataset.state = isOpen ? 'open' : 'closed';
    // A closed card must leave the tab order.
    if (isOpen) card.removeAttribute('inert');
    else card.setAttribute('inert', '');
  };

  const setOpen = (next: boolean) => {
    if (isOpen === next) {
      render();
      return;
    }
    isOpen = next;
    if (!next) controller.close();
    render();
  };

  const onToggleClick = (event: MouseEvent) => {
    if (!isMobile()) return;
    event.preventDefault();
    const toggle = event.currentTarget as HTMLElement;
    if (isOpen) {
      setOpen(false);
      // Only when the close control lived in the card: a header toggle keeps
      // the focus it already has.
      if (card.contains(toggle)) opener?.focus();
    } else {
      opener = toggle;
      setOpen(true);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    // A panel's own Escape handling already prevented default.
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (!isOpen || !isMobile()) return;
    setOpen(false);
    opener?.focus();
  };

  // Outside pointerdown/focusin (tapping or tabbing away strands the card over
  // the page) and followed links (which leave it covering where the user just
  // went) come from the shared paths in pointer.ts; the card only closes itself.
  const dismiss = () => {
    if (isOpen && isMobile()) setOpen(false);
  };
  dismissHooks.outside.push(dismiss);
  dismissHooks.link.push(dismiss);

  for (const toggle of toggles) {
    toggle.addEventListener('click', onToggleClick);
  }
  document.addEventListener('keydown', onKeyDown);
  cleanups.push(() => {
    for (const list of [dismissHooks.outside, dismissHooks.link]) {
      const index = list.indexOf(dismiss);
      if (index !== -1) list.splice(index, 1);
    }
    for (const toggle of toggles) {
      toggle.removeEventListener('click', onToggleClick);
      toggle.removeAttribute('aria-expanded');
      toggle.removeAttribute('aria-controls');
    }
    document.removeEventListener('keydown', onKeyDown);
    // Hand the card back: a leftover inert or data-state="closed" would leave
    // the menu dead and unreachable after a re-init.
    card.removeAttribute('inert');
    delete card.dataset.state;
    renderer.setCardOpen(false);
  });

  render();
  const openCard = () => {
    if (isOpen) return false;
    const active = document.activeElement;
    opener =
      active instanceof HTMLElement && active !== document.body ? active : null;
    setOpen(true);
    return true;
  };

  return { openCard, closeCard: () => setOpen(false) };
}
