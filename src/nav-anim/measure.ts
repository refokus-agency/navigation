/**
 * Reads the rendered width of an element, in pixels.
 *
 * This is the one place the compress behaviour touches layout. It is injected
 * rather than called directly so the surrounding logic stays testable: jsdom
 * has no layout engine, so every measurement there is `0`.
 */
export type NavbarMeasurer = (element: Element) => number;

export const defaultMeasurer: NavbarMeasurer = (element) =>
  element.getBoundingClientRect().width;
