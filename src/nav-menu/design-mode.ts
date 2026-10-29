import { NAV_MENU_CONFIG } from './config.ts';

/**
 * Opens every panel and drops the interaction state, so the nav can be edited
 * in the Webflow Designer — where the menu itself never runs.
 *
 * It writes only the hooks the live menu already writes for an open panel
 * (`[data-state="open"]`, no `inert`) and clears the inline hiding the renderer
 * applies. No listeners, no timers, no viewport measuring: this is a view of the
 * markup, not a menu.
 *
 * The root keeps `[data-nav-design-mode]` so a consumer's CSS can lay the panels
 * out for editing (stack them, drop the viewport's fixed height) without
 * affecting the published site.
 */
export function applyDesignMode(root: HTMLElement): void {
  const { selectors, designMode } = NAV_MENU_CONFIG;

  root.setAttribute(designMode.attribute, '');

  const open = (element: HTMLElement | null | undefined): void => {
    if (!element) return;
    element.dataset.state = 'open';
    element.removeAttribute('inert');
    element.removeAttribute('aria-hidden');
    element.style.display = '';
    element.style.pointerEvents = '';
  };

  open(root);
  open(root.querySelector<HTMLElement>(selectors.list));
  open(root.querySelector<HTMLElement>(selectors.viewport));

  for (const item of root.querySelectorAll<HTMLElement>(selectors.item)) {
    open(item);
  }

  for (const content of root.querySelectorAll<HTMLElement>(selectors.content)) {
    open(content);
  }

  // Triggers carry `data-state` in the live menu, and a closed trigger is what
  // most designs use to dim the label — worth keeping consistent while editing.
  for (const trigger of root.querySelectorAll<HTMLElement>(selectors.trigger)) {
    trigger.dataset.state = 'open';
  }
}
