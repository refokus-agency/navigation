export const NAVBAR_CONFIG = {
  position: {
    hidden: '-100%',
    visible: '0%',
  },
  scroll: {
    threshold: 50,
  },
  compress: {
    /**
     * Webflow's native Navbar with `data-collapse="medium"` takes over with its
     * own hamburger below 992px, so compress stays out of its way by default.
     */
    breakpoint: 992,
  },
  selectors: {
    navbar: '[r-navbar]',
    compressible: '[r-navbar-compress]',
  },
  attributes: {
    behaviour: 'r-navbar-behaviour',
  },
};
