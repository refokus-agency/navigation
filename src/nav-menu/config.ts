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
  },
  timing: {
    closeDelay: 150,
  },
  mobile: {
    query: '(max-width: 767px)',
  },
  editorClass: 'w-editor',
};
