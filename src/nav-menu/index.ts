/**
 * Accessible dropdown nav: hover delays, Tab-driven keyboard traversal, ARIA
 * wiring, and data attributes for CSS-driven animation. See the README for the
 * markup contract and the full list of CSS hooks.
 */

import {
  isNonNegativeNumber,
  isOneOf,
  readEnumAttr,
  readNumberAttr,
  resolveSetting,
} from '../attributes.ts';
import { NAV_MENU_CONFIG } from './config.ts';
import { createController } from './controller.ts';
import { attachKeyboardEvents } from './keyboard.ts';
import { attachMobile } from './mobile.ts';
import {
  attachDismiss,
  attachHoverEvents,
  attachLinkClicks,
  attachTriggerClicks,
} from './pointer.ts';
import { createRenderer } from './render.ts';
import type {
  InitNavigationMenuOptions,
  NavigationMenuInstance,
  NavMenuCleanup,
  NavMenuContext,
  NavMenuDirection,
  NavMenuEntry,
  NavMenuInteraction,
  NavMenuOptions,
  NavMenuOrientation,
  NavMenuRefs,
  ResolvedNavMenuOptions,
} from './types.ts';

// Ids must be unique per instance: the feature is built for several menus on
// one page (a desktop nav plus a mobile duplicate is the ordinary Webflow
// shape), and positional fallback values collide across roots.
let instanceCount = 0;

const DEFAULT_OPTIONS: ResolvedNavMenuOptions = {
  delayDuration: 200,
  skipDelayDuration: 300,
  closeDelay: NAV_MENU_CONFIG.timing.closeDelay,
  orientation: 'horizontal',
  dir: 'ltr',
  interaction: 'hover',
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

  const resolvedOptions = resolveMenuOptions(root, {
    ...DEFAULT_OPTIONS,
    ...options,
  });

  if (
    resolvedOptions.skipInWebflowEditor &&
    document.documentElement.classList.contains(NAV_MENU_CONFIG.editorClass)
  ) {
    return null;
  }

  warnInvalidInteraction(root);

  const refs = discoverRefs(root);
  const idPrefix = `nav-${++instanceCount}`;
  setupAria(root, refs, resolvedOptions, idPrefix);

  const renderer = createRenderer({ refs, options: resolvedOptions, root });
  const controller = createController({
    refs,
    options: resolvedOptions,
    renderer,
  });

  const cleanups: NavMenuCleanup[] = [];
  const context: NavMenuContext = {
    root,
    refs,
    controller,
    cleanups,
    options: resolvedOptions,
    idPrefix,
  };

  cleanups.push(() => controller.destroy());

  attachTriggerClicks(context);
  if (resolvedOptions.interaction === 'hover') attachHoverEvents(context);
  attachDismiss(context);
  attachLinkClicks(context);
  attachKeyboardEvents(context);
  attachMobile(context);

  cleanups.push(
    renderer.observeResize(
      controller.getActiveValue,
      controller.getActiveTrigger,
    ),
  );

  renderer.applyState(null, null);

  return {
    open: (value: string) => controller.open(value),
    close: () => controller.close(),
    destroy() {
      for (const cleanup of cleanups) cleanup();
    },
  };
}

const ORIENTATIONS = ['horizontal', 'vertical'] as const;
const DIRECTIONS = ['ltr', 'rtl'] as const;
const INTERACTIONS = ['hover', 'click'] as const;
const readOrientation = readEnumAttr<NavMenuOrientation>(ORIENTATIONS);
const readDirection = readEnumAttr<NavMenuDirection>(DIRECTIONS);
const readInteraction = readEnumAttr<NavMenuInteraction>(INTERACTIONS);

/**
 * Root attributes override the merged JS options; read once, at init. Invalid
 * values — attribute or JS — are skipped silently, down to the default.
 */
function resolveMenuOptions(
  root: HTMLElement,
  merged: NavMenuOptions,
): ResolvedNavMenuOptions {
  const { attributes } = NAV_MENU_CONFIG;

  return {
    ...merged,
    delayDuration: resolveSetting({
      attribute: readNumberAttr(root, attributes.delay),
      js: merged.delayDuration,
      isValid: isNonNegativeNumber,
      fallback: DEFAULT_OPTIONS.delayDuration,
    }),
    skipDelayDuration: resolveSetting({
      attribute: readNumberAttr(root, attributes.skipDelay),
      js: merged.skipDelayDuration,
      isValid: isNonNegativeNumber,
      fallback: DEFAULT_OPTIONS.skipDelayDuration,
    }),
    closeDelay: resolveSetting({
      attribute: readNumberAttr(root, attributes.closeDelay),
      js: merged.closeDelay,
      isValid: isNonNegativeNumber,
      fallback: DEFAULT_OPTIONS.closeDelay,
    }),
    orientation: resolveSetting({
      attribute: readOrientation(root, attributes.orientation),
      js: merged.orientation,
      isValid: isOneOf(ORIENTATIONS),
      fallback: DEFAULT_OPTIONS.orientation,
    }),
    dir: resolveSetting({
      attribute: readDirection(root, attributes.dir),
      js: merged.dir,
      isValid: isOneOf(DIRECTIONS),
      fallback: DEFAULT_OPTIONS.dir,
    }),
    interaction: resolveSetting({
      attribute: readInteraction(root, attributes.interaction),
      js: merged.interaction,
      isValid: isOneOf(INTERACTIONS),
      fallback: DEFAULT_OPTIONS.interaction,
    }),
  };
}

/**
 * The one exception to silent attribute resolution. A mistyped interaction
 * (`"Click"`, `"tap"`) silently becomes hover, which reads as "click mode is
 * broken" rather than as a typo — unlike a bad delay, whose fallback is merely
 * a slightly different timing. Resolution itself stays silent; this only says
 * what was ignored. Called after the Webflow editor check, so the Designer
 * never logs it.
 */
function warnInvalidInteraction(root: HTMLElement): void {
  const name = NAV_MENU_CONFIG.attributes.interaction;
  const attribute = root.getAttribute(name);
  if (attribute === null || readInteraction(root, name) !== undefined) return;
  console.warn(
    `[nav-menu] Ignoring ${name}="${attribute}": expected "hover" or "click". Falling back to the interaction option, else "hover".`,
  );
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
  options: ResolvedNavMenuOptions,
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
  NavMenuInteraction,
  NavMenuOptions,
  NavMenuOrientation,
} from './types.ts';
