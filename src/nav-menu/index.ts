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
import { isInlineMobilePanels, NAV_MENU_CONFIG } from './config.ts';
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
  NavMenuPanels,
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
  inlineMobilePanels: false,
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
  const cleanups: NavMenuCleanup[] = [];
  // Kept out of `cleanups` until init succeeds, so it always runs last: panels
  // go back only after every other teardown has run.
  const { panels, restore: restorePanels } = relocatePanels(refs);

  try {
    const idPrefix = `nav-${++instanceCount}`;
    setupAria(root, refs, resolvedOptions, idPrefix);

    const renderer = createRenderer({ refs, options: resolvedOptions, root });
    const controller = createController({
      refs,
      options: resolvedOptions,
      renderer,
    });

    const context: NavMenuContext = {
      root,
      refs,
      controller,
      cleanups,
      panels,
      options: resolvedOptions,
      idPrefix,
      dismissHooks: { outside: [], link: [] },
    };

    cleanups.push(() => controller.destroy());

    attachTriggerClicks(context);
    if (resolvedOptions.interaction === 'hover') attachHoverEvents(context);
    attachDismiss(context);
    attachLinkClicks(context);
    attachKeyboardEvents(context);
    const openPanel = attachMobile(context);

    cleanups.push(
      renderer.observeResize(
        controller.getActiveValue,
        controller.getActiveTrigger,
      ),
    );
    cleanups.push(restorePanels);

    renderer.applyState(null, null);

    return {
      open: (value: string) => {
        // An unknown value is a full no-op: it must not close the open panel
        // or reveal the mobile card for nothing.
        if (!refs.triggerByValue.has(value) && !refs.contentMap.has(value)) {
          return;
        }
        openPanel(value);
      },
      close: () => controller.close(),
      destroy() {
        // Drained, so a second call is a no-op instead of tearing down (or
        // moving panels out of) a newer instance on the same root.
        const error = drain(cleanups);
        if (error) throw error.cause;
      },
    };
  } catch (error) {
    // Init is atomic: undo what was wired so far, panels last, and surface the
    // original failure rather than a teardown one.
    cleanups.push(restorePanels);
    drain(cleanups);
    throw error;
  }
}

/**
 * Runs and empties every cleanup, in order, even if an earlier one throws, so
 * panels are never stranded. Returns the first failure, wrapped so a thrown
 * `undefined` is still reported.
 */
function drain(cleanups: NavMenuCleanup[]): { cause: unknown } | null {
  let first: { cause: unknown } | null = null;
  for (const cleanup of cleanups.splice(0)) {
    try {
      cleanup();
    } catch (error) {
      first ??= { cause: error };
    }
  }
  return first;
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
    inlineMobilePanels: isInlineMobilePanels(root),
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

    const found = viewportContents.get(value) ?? findOwnedContent(item);
    // A "panel" wrapping the viewport is layout, not a panel: hiding it while
    // inactive would hide the viewport and every other panel with it.
    const content =
      found && viewport && found.contains(viewport) ? null : found;

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

/**
 * The item's first panel that is its own — a panel inside a nested item
 * belongs to that nested item, never to this one.
 */
function findOwnedContent(item: HTMLElement): HTMLElement | null {
  const { selectors } = NAV_MENU_CONFIG;

  for (const content of item.querySelectorAll<HTMLElement>(selectors.content)) {
    if (content.closest(selectors.item) === item) return content;
  }

  return null;
}

/** Where a relocated panel came from, so destroy() can put it back. */
interface PanelOrigin {
  parent: Node;
  nextSibling: Node | null;
  /** The live instance allowed to restore it; a re-init adopts the panel. */
  owner: symbol;
}

// Keyed by panel, so a second init on the same root (without destroying the
// first) adopts the panels the first one moved, and the stale handle's
// destroy() can no longer pull them out from under the live instance.
const relocated = new WeakMap<HTMLElement, PanelOrigin>();

/**
 * Owns where each panel authored inside its item (slot markup) sits: in the
 * shared viewport, so one element can animate between panel sizes, or back in
 * its item. Panels already authored in the viewport are never moved, and
 * without a viewport nothing moves.
 *
 * `attachMobile` places them: in the viewport, or back in their item in mobile
 * mode when `[data-nav-mobile-panels="inline"]` opts in. The origin stays recorded
 * while the instance owns the panel, wherever it currently sits, so a re-init
 * adopts it and a stale handle can touch neither. `restore` is the final undo:
 * it walks the moves backwards, so a recorded next sibling that was itself
 * moved is already back in place when it is used as anchor.
 */
function relocatePanels(refs: NavMenuRefs): {
  panels: NavMenuPanels;
  restore: NavMenuCleanup;
} {
  const { viewport, contentMap, itemValues } = refs;
  const owner = Symbol('nav-menu');
  const owned: HTMLElement[] = [];

  if (viewport) {
    for (const value of new Set(itemValues)) {
      const panel = contentMap.get(value);
      if (!panel?.parentNode) continue;

      const origin = relocated.get(panel);
      if (origin) {
        // Moved by an instance that is still live: take over its restore.
        origin.owner = owner;
        owned.push(panel);
      } else if (!viewport.contains(panel)) {
        relocated.set(panel, {
          parent: panel.parentNode,
          nextSibling: panel.nextSibling,
          owner,
        });
        owned.push(panel);
      }
    }
  }

  /** Back in its item. `reset` also drops what the renderer wrote. */
  const putBack = (panel: HTMLElement, reset: boolean): void => {
    const { parent, nextSibling } = relocated.get(panel) as PanelOrigin;
    // Moved inside the panel since init: putting it back would be a cycle.
    if (panel.contains(parent)) return;
    if (reset) resetRendererState(panel);
    else hideMoved(panel);
    // The anchor may have been removed or moved since init: append instead.
    const anchor = nextSibling?.parentNode === parent ? nextSibling : null;
    parent.insertBefore(panel, anchor);
  };

  const isMine = (panel: HTMLElement) => relocated.get(panel)?.owner === owner;

  const toViewport = () => {
    if (!viewport) return;
    for (const panel of owned) {
      if (isMine(panel) && !viewport.contains(panel)) {
        // Closed, but its exit may still be pending: it must not stay shown.
        hideMoved(panel);
        viewport.appendChild(panel);
      }
    }
  };

  const inline = () => {
    if (!viewport) return;
    for (const panel of [...owned].reverse()) {
      if (isMine(panel) && viewport.contains(panel)) putBack(panel, false);
    }
  };

  // No placement here: `attachMobile` places panels once, for the mode the menu
  // starts in, so none is ever moved twice at init.
  return {
    panels: { toViewport, inline },
    restore: () => {
      for (const panel of [...owned].reverse()) {
        if (!isMine(panel)) continue;
        const wasInViewport = viewport?.contains(panel) === true;
        if (wasInViewport) putBack(panel, true);
        else resetRendererState(panel);
        relocated.delete(panel);
      }
    },
  };
}

/**
 * A panel mid-session is closed (every crossing closes the menu first), but its
 * exit animation may not have ended, so hide it now rather than let it show in
 * its new home until the next render.
 */
function hideMoved(panel: HTMLElement): void {
  panel.style.display = 'none';
  delete panel.dataset.motion;
}

/**
 * Clears what the renderer wrote, so a restored panel is not left hidden,
 * inert or mid-animation in its item. Dropping `data-state` also neutralizes
 * any pending hide callback, which only acts on a panel still marked closed.
 */
function resetRendererState(panel: HTMLElement): void {
  panel.removeAttribute('data-state');
  panel.removeAttribute('data-motion');
  panel.removeAttribute('inert');
  panel.style.display = '';
  panel.style.pointerEvents = '';
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
