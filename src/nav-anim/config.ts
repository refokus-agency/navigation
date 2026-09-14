import { NAV_ROOT_SELECTOR } from '../config.ts';

export const NAVBAR_CONFIG = {
  position: {
    hidden: '-100%',
    visible: '0%',
  },
  scroll: {
    threshold: 50,
  },
  selectors: {
    navbar: NAV_ROOT_SELECTOR,
  },
};
