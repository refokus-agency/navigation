/**
 * Accessible dropdown nav: hover delays, Tab-driven keyboard traversal, ARIA
 * wiring, and data attributes for CSS-driven animation. See the README for the
 * markup contract and the full list of CSS hooks.
 */

import { NAV_MENU_CONFIG } from './config.ts';
import { createController } from './controller.ts';
import { attachKeyboardEvents } from './keyboard.ts';
import { attachMobile } from './mobile.ts';
import {
  attachDismiss,
  attachLinkClicks,
  attachPointerEvents,
} from './pointer.ts';
import { createRenderer } from './render.ts';
import type {
  InitNavigationMenuOptions,
  NavigationMenuInstance,
  NavMenuCleanup,
  NavMenuContext,
  NavMenuEntry,
  NavMenuOptions,
  NavMenuRefs,
} from './types.ts';

const DEFAULT_OPTIONS: NavMenuOptions = {
  delayDuration: 200,
  skipDelayDuration: 300,
  orientation: 'horizontal',
  dir: 'ltr',
  skipInWebflowEditor: true,
};

export function initNavigationMenu(
  rootOrSelector: string | HTMLElement = NAV_MENU_CONFIG.selectors.root,
  options: InitNavigationMenuOptions = {},
): NavigationMenuInstance | null {
  const root =
    typeof rootOrSelector === 'string'
      ? document.querySelector<HTMLElement>(rootOrSelector)
      : rootOrSelector;

  if (!root) return null;

  const resolvedOptions: NavMenuOptions = { ...DEFAULT_OPTIONS, ...options };

  if (
    resolvedOptions.skipInWebflowEditor &&
    document.documentElement.classList.contains(NAV_MENU_CONFIG.editorClass)
  ) {
    return null;
  }

  const refs = discoverRefs(root);
  setupAria(root, refs, resolvedOptions);

  const renderer = createRenderer({ refs, options: resolvedOptions, root });
  const controller = createController({
    refs,
    options: resolvedOptions,
    renderer,
  });

  const cleanups: NavMenuCleanup[] = [];
  const context: NavMenuContext = { root, refs, controller, cleanups };

  attachPointerEvents(context);
  attachDismiss(context);
  attachLinkClicks(context);
  attachKeyboardEvents(context);
  attachMobile(context);

  cleanups.push(renderer.observeResize(controller.getActiveValue));

  renderer.applyState(null, null);

  return {
    open: (value: string) => controller.setValue(value),
    close: () => controller.setValue(null),
    destroy() {
      controller.destroy();
      for (const cleanup of cleanups) cleanup();
    },
  };
}

function discoverRefs(root: HTMLElement): NavMenuRefs {
  const { selectors, attributes } = NAV_MENU_CONFIG;

  const list = root.querySelector<HTMLElement>(selectors.list);
  const viewport = root.querySelector<HTMLElement>(selectors.viewport);

  const entries: NavMenuEntry[] = [];
  const triggers: HTMLElement[] = [];
  const itemValues: string[] = [];
  const triggerByValue = new Map<string, HTMLElement>();
  const valueByTrigger = new Map<HTMLElement, string>();
  const contentMap = new Map<string, HTMLElement>();

  const items = root.querySelectorAll<HTMLElement>(selectors.item);

  items.forEach((item, index) => {
    const trigger = item.querySelector<HTMLElement>(selectors.trigger);
    if (!trigger) return;

    // With nested items the outer one also matches its child's trigger.
    if (trigger.closest(selectors.item) !== item) return;

    const value = item.getAttribute(attributes.item) || `item-${index}`;
    item.setAttribute(attributes.item, value);

    const content =
      findViewportContent(viewport, value) ??
      item.querySelector<HTMLElement>(selectors.content);

    if (content) {
      content.setAttribute(attributes.content, value);
      contentMap.set(value, content);
    }

    entries.push({ item, trigger, value, content });
    triggers.push(trigger);
    itemValues.push(value);
    triggerByValue.set(value, trigger);
    valueByTrigger.set(trigger, value);
  });

  return {
    list,
    viewport,
    entries,
    triggers,
    itemValues,
    triggerByValue,
    valueByTrigger,
    contentMap,
  };
}

function findViewportContent(
  viewport: HTMLElement | null,
  value: string,
): HTMLElement | null {
  if (!viewport) return null;

  const { selectors, attributes } = NAV_MENU_CONFIG;
  const contents = viewport.querySelectorAll<HTMLElement>(selectors.content);

  for (const content of contents) {
    if (content.getAttribute(attributes.content) === value) return content;
  }

  return null;
}

function setupAria(
  root: HTMLElement,
  refs: NavMenuRefs,
  options: NavMenuOptions,
): void {
  if (!root.getAttribute('role')) root.setAttribute('role', 'navigation');
  root.setAttribute('data-orientation', options.orientation);

  refs.list?.setAttribute('data-orientation', options.orientation);
  refs.viewport?.setAttribute('data-orientation', options.orientation);

  for (const { trigger, value } of refs.entries) {
    if (
      trigger.tagName !== 'BUTTON' &&
      trigger.tagName !== 'A' &&
      !trigger.hasAttribute('tabindex')
    ) {
      trigger.setAttribute('tabindex', '0');
    }

    // By value, not entry.content: duplicate values must share one panel id.
    const content = refs.contentMap.get(value);
    if (!content) continue;

    const triggerId = `nav-t-${value}`;
    const contentId = `nav-c-${value}`;

    trigger.id = triggerId;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', contentId);

    content.id = contentId;
    content.setAttribute('role', 'region');
    content.setAttribute('aria-labelledby', triggerId);
    content.setAttribute('data-orientation', options.orientation);
  }
}

export type {
  InitNavigationMenuOptions,
  NavigationMenuInstance,
  NavMenuDirection,
  NavMenuOptions,
  NavMenuOrientation,
} from './types.ts';
