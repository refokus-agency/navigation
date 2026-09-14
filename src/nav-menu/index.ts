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

// Ids must be unique per instance: the feature is built for several menus on
// one page (a desktop nav plus a mobile duplicate is the ordinary Webflow
// shape), and positional fallback values collide across roots.
let instanceCount = 0;

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
  setupAria(root, refs, resolvedOptions, `nav-${++instanceCount}`);

  const renderer = createRenderer({ refs, options: resolvedOptions, root });
  const controller = createController({
    refs,
    options: resolvedOptions,
    renderer,
  });

  const cleanups: NavMenuCleanup[] = [];
  const context: NavMenuContext = { root, refs, controller, cleanups };

  cleanups.push(() => controller.destroy());

  attachPointerEvents(context);
  attachDismiss(context);
  attachLinkClicks(context);
  attachKeyboardEvents(context);
  attachMobile(context);

  cleanups.push(renderer.observeResize(controller.getActiveValue));

  renderer.applyState(null, null);

  return {
    open: (value: string) => controller.open(value),
    close: () => controller.close(),
    destroy() {
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
  const viewportContents = indexViewportContents(viewport);

  items.forEach((item, index) => {
    const owned = [
      ...item.querySelectorAll<HTMLElement>(selectors.trigger),
    ].filter(
      (trigger) =>
        // A nested item owns its own triggers, and a trigger inside a panel is
        // not a nav stop — Tab cannot reach it, so it must not become an entry.
        trigger.closest(selectors.item) === item &&
        trigger.closest(selectors.content) === null,
    );
    if (owned.length === 0) return;

    const value = item.getAttribute(attributes.item) || `item-${index}`;
    item.setAttribute(attributes.item, value);

    const content =
      viewportContents.get(value) ??
      item.querySelector<HTMLElement>(selectors.content);

    if (content) {
      content.setAttribute(attributes.content, value);
      contentMap.set(value, content);
    }

    itemValues.push(value);

    // One entry per trigger: an item may carry several, and each needs its own
    // pointer wiring, ARIA and pointer-state slot.
    for (const trigger of owned) {
      entries.push({ item, trigger, value, content });
      triggers.push(trigger);
      valueByTrigger.set(trigger, value);
      if (!triggerByValue.has(value)) triggerByValue.set(value, trigger);
    }
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

function indexViewportContents(
  viewport: HTMLElement | null,
): Map<string, HTMLElement> {
  const byValue = new Map<string, HTMLElement>();
  if (!viewport) return byValue;

  const { selectors, attributes } = NAV_MENU_CONFIG;

  for (const content of viewport.querySelectorAll<HTMLElement>(
    selectors.content,
  )) {
    const value = content.getAttribute(attributes.content);
    if (value && !byValue.has(value)) byValue.set(value, content);
  }

  return byValue;
}

function setupAria(
  root: HTMLElement,
  refs: NavMenuRefs,
  options: NavMenuOptions,
  idPrefix: string,
): void {
  if (!root.getAttribute('role')) root.setAttribute('role', 'navigation');
  root.setAttribute('data-orientation', options.orientation);

  refs.list?.setAttribute('data-orientation', options.orientation);
  refs.viewport?.setAttribute('data-orientation', options.orientation);

  const labelled = new Set<string>();

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

    const contentId = content.id || `${idPrefix}-c-${value}`;

    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', contentId);

    content.id = contentId;
    content.setAttribute('role', 'region');
    content.setAttribute('data-orientation', options.orientation);

    // Only the first trigger for a value is named, so several triggers sharing
    // a panel cannot produce duplicate ids.
    if (labelled.has(value)) continue;
    labelled.add(value);

    // Never clobber an author id: a label, anchor or existing aria-* reference
    // may already point at this element.
    const triggerId = trigger.id || `${idPrefix}-t-${value}`;
    trigger.id = triggerId;
    content.setAttribute('aria-labelledby', triggerId);
  }
}

export type {
  InitNavigationMenuOptions,
  NavigationMenuInstance,
  NavMenuDirection,
  NavMenuOptions,
  NavMenuOrientation,
} from './types.ts';
