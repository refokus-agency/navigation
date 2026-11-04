import { NAV_ROOT_SELECTOR } from '../config.ts';

export const NAV_MENU_CONFIG = {
  selectors: {
    root: NAV_ROOT_SELECTOR,
    list: '[data-nav-list]',
    item: '[data-nav-item]',
    trigger: '[data-nav-trigger]',
    content: '[data-nav-content]',
    link: '[data-nav-link]',
    viewport: '[data-nav-viewport]',
    back: '[data-nav-back]',
    toggle: '[data-nav-toggle]',
    card: '[data-nav-card]',
    webflowNav: '.w-nav',
    webflowBurger: '.w-nav-button',
  },
  attributes: {
    item: 'data-nav-item',
    content: 'data-nav-content',
    delay: 'data-nav-delay',
    skipDelay: 'data-nav-skip-delay',
    closeDelay: 'data-nav-close-delay',
    orientation: 'data-nav-orientation',
    dir: 'data-nav-dir',
    triggerMode: 'data-nav-trigger-mode',
    breakpoint: 'data-nav-breakpoint',
  },
  timing: {
    closeDelay: 150,
  },
  mobile: {
    /** Max viewport width in px for mobile mode, used when data-nav-breakpoint is absent or invalid. */
    breakpoint: 767,
    /** Largest data-nav-breakpoint accepted, in px; larger values warn and fall back to the default. */
    maxBreakpoint: 4000,
  },
  editorClass: 'w-editor',
};

/** True when a trigger is a link that should navigate instead of toggling. */
export function isNavigateTrigger(trigger: HTMLElement): boolean {
  return (
    trigger.getAttribute(NAV_MENU_CONFIG.attributes.triggerMode) === 'navigate'
  );
}
