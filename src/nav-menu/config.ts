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
    webflowNav: '.w-nav',
    webflowBurger: '.w-nav-button',
  },
  attributes: {
    item: 'data-nav-item',
    content: 'data-nav-content',
    breakpoint: 'data-nav-breakpoint',
  },
  timing: {
    closeDelay: 150,
  },
  mobile: {
    /** Max viewport width in px for mobile mode, used when data-nav-breakpoint is absent or invalid. */
    breakpoint: 767,
  },
  editorClass: 'w-editor',
};
