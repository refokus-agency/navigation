import { NAV_MENU_CONFIG } from './config.ts';
import { focusFirst, getTabbableCandidates } from './keyboard.ts';
import type { NavMenuContext } from './types.ts';

/**
 * Publishes [data-nav-mode] for CSS, wires [data-nav-back], and resets state on
 * breakpoint crossings and when the Webflow burger overlay closes.
 */
export function attachMobile(context: NavMenuContext): void {
  const { root, refs, controller, cleanups } = context;
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

  const isMobile = () => root.dataset.navMode === 'mobile';
  const closeCard = attachCard(context, isMobile);

  // Accordion: land focus on the first link of the panel a user just opened.
  // Tied to activation, not to state: arrow-key traversal and programmatic
  // open() also change state and must not pull focus off the trigger.
  const focusOpenedPanel = (trigger: HTMLElement) => {
    if (!isMobile()) return;
    const value = refs.valueByTrigger.get(trigger);
    if (!value || controller.getActiveValue() !== value) return;
    const content = refs.contentMap.get(value);
    if (content) focusFirst(getTabbableCandidates(content));
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
}

/**
 * Opt-in `[data-nav-toggle]` / `[data-nav-card]` pair. Returns a function that
 * closes the card, for breakpoint crossings. No-ops when either is absent.
 */
function attachCard(
  { root, controller, cleanups, idPrefix }: NavMenuContext,
  isMobile: () => boolean,
): () => void {
  const { selectors } = NAV_MENU_CONFIG;
  const toggle = root.querySelector<HTMLElement>(selectors.toggle);
  const card = root.querySelector<HTMLElement>(selectors.card);
  if (!toggle || !card) return () => {};

  card.id ||= `${idPrefix}-card`;
  toggle.setAttribute('aria-controls', card.id);

  let isOpen = false;

  const render = () => {
    toggle.setAttribute('aria-expanded', String(isOpen));
    card.dataset.state = isOpen ? 'open' : 'closed';
    // A closed mobile card must leave the tab order; desktop is never touched.
    if (isMobile() && !isOpen) card.setAttribute('inert', '');
    else card.removeAttribute('inert');
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
    setOpen(!isOpen);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    // A panel's own Escape handling already prevented default.
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (!isOpen || !isMobile()) return;
    setOpen(false);
    toggle.focus();
  };

  const onPointerDown = (event: Event) => {
    const target = event.target;
    if (!isOpen || !isMobile() || !(target instanceof Node)) return;
    if (card.contains(target) || toggle.contains(target)) return;
    setOpen(false);
  };

  // Leaving the nav by Tab strands an open card over the page.
  const onFocusIn = (event: Event) => {
    const target = event.target;
    if (!isOpen || !isMobile() || !(target instanceof Node)) return;
    if (!root.contains(target)) setOpen(false);
  };

  // A followed link leaves the card covering where the user just went. Plain
  // modifier-clicks keep it open, like panel links; triggers are not links.
  const onCardClick = (event: MouseEvent) => {
    if (!isOpen || !isMobile() || event.metaKey || event.ctrlKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest(`a[href], ${selectors.link}`);
    if (link && !link.closest(selectors.trigger)) setOpen(false);
  };

  toggle.addEventListener('click', onToggleClick);
  card.addEventListener('click', onCardClick);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('focusin', onFocusIn);
  cleanups.push(() => {
    toggle.removeEventListener('click', onToggleClick);
    card.removeEventListener('click', onCardClick);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('focusin', onFocusIn);
    // Hand the card back: a leftover inert or data-state="closed" would leave
    // the menu dead and unreachable after a re-init.
    card.removeAttribute('inert');
    delete card.dataset.state;
    toggle.removeAttribute('aria-expanded');
    toggle.removeAttribute('aria-controls');
  });

  render();
  return () => setOpen(false);
}
