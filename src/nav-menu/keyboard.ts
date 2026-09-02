import { NAV_MENU_CONFIG } from './config.ts';
import type {
  NavMenuContext,
  NavMenuController,
  NavMenuRefs,
} from './types.ts';

/**
 * WAI-ARIA Disclosure Navigation: Tab is the primary path and traverses
 * triggers *and* open panel links. Arrows are secondary and trigger-scoped.
 */
export function attachKeyboardEvents({
  root,
  refs,
  controller,
  cleanups,
}: NavMenuContext): void {
  const onKeyDown = (event: KeyboardEvent) =>
    handleKeyDown(event, root, refs, controller);

  root.addEventListener('keydown', onKeyDown);
  cleanups.push(() => root.removeEventListener('keydown', onKeyDown));
}

function handleKeyDown(
  event: KeyboardEvent,
  root: HTMLElement,
  refs: NavMenuRefs,
  controller: NavMenuController,
): void {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  if (event.key === 'Escape') {
    const trigger = controller.handleEscape();
    if (trigger) {
      event.preventDefault();
      trigger.focus();
    }
    return;
  }

  if (event.key === 'Tab') {
    handleTab(event, root, refs, controller, target);
    return;
  }

  const trigger = target.closest<HTMLElement>(
    NAV_MENU_CONFIG.selectors.trigger,
  );
  // Trigger-scoped, so arrows in a panel's search field stay native.
  if (!trigger) return;

  handleTriggerKey(event, root, refs, controller, trigger);
}

function handleTriggerKey(
  event: KeyboardEvent,
  root: HTMLElement,
  refs: NavMenuRefs,
  controller: NavMenuController,
  trigger: HTMLElement,
): void {
  const isHorizontal =
    (root.getAttribute('data-orientation') || 'horizontal') === 'horizontal';
  const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
  const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
  const entryKey = isHorizontal ? 'ArrowDown' : 'ArrowRight';

  switch (event.key) {
    case nextKey:
      event.preventDefault();
      moveFocus(1, refs, controller, trigger);
      break;

    case prevKey:
      event.preventDefault();
      moveFocus(-1, refs, controller, trigger);
      break;

    case entryKey: {
      const active = controller.getActiveValue();
      if (!active) break;
      event.preventDefault();
      const content = refs.contentMap.get(active);
      if (content) focusFirst(getTabbableCandidates(content));
      break;
    }

    case 'Home':
      event.preventDefault();
      refs.triggers[0]?.focus();
      break;

    case 'End':
      event.preventDefault();
      refs.triggers[refs.triggers.length - 1]?.focus();
      break;

    case 'Enter':
    case ' ': {
      // Via the DOM, so a secondary trigger in an item is still toggleable.
      const value =
        refs.valueByTrigger.get(trigger) ??
        trigger
          .closest(NAV_MENU_CONFIG.selectors.item)
          ?.getAttribute(NAV_MENU_CONFIG.attributes.item);

      if (value && refs.contentMap.has(value)) {
        event.preventDefault();
        // Bypasses the wasClickClose guard on purpose: Enter may reopen.
        if (controller.getActiveValue() === value) controller.setValue(null);
        else controller.setValue(value);
      }
      break;
    }
  }
}

/**
 * A panel in a shared viewport is not a DOM sibling of its trigger, so drive
 * the order explicitly: trigger → its open panel → next nav stop.
 */
function handleTab(
  event: KeyboardEvent,
  root: HTMLElement,
  refs: NavMenuRefs,
  controller: NavMenuController,
  target: Element,
): void {
  const activeValue = controller.getActiveValue();
  const goingBack = event.shiftKey;
  const triggerValue = refs.valueByTrigger.get(target as HTMLElement);

  if (triggerValue !== undefined) {
    const isOwnPanelOpen = activeValue !== null && activeValue === triggerValue;

    if (!goingBack && isOwnPanelOpen) {
      const content = refs.contentMap.get(triggerValue);
      const candidates = content ? getTabbableCandidates(content) : [];

      if (candidates.length > 0) {
        event.preventDefault();
        focusFirst(candidates);
        return;
      }
      // Nothing to step into.
      controller.close();
      return;
    }

    // Moving to a sibling stop abandons any open panel; backwards includes ours.
    if (activeValue !== null && (goingBack || activeValue !== triggerValue)) {
      controller.close();
    }
    return;
  }

  const panel = activeValue ? refs.contentMap.get(activeValue) : undefined;

  if (activeValue && panel?.contains(target)) {
    const candidates = getTabbableCandidates(panel);
    const index = candidates.indexOf(target as HTMLElement);

    if (goingBack && index === 0) {
      event.preventDefault();
      refs.triggerByValue.get(activeValue)?.focus();
      return;
    }

    if (!goingBack && index === candidates.length - 1) {
      event.preventDefault();
      // Before closing: closing marks the panel inert, which would blur us.
      const next = nextNavStop(root, refs, activeValue);
      if (next) next.focus();
      else focusAfterRoot(root);
      controller.close();
      return;
    }

    return;
  }

  // Any other stop in the nav: leaving it strands the open panel.
  if (activeValue !== null) controller.close();
}

/** Triggers and plain links, never panel contents. */
function navStops(root: HTMLElement, refs: NavMenuRefs): HTMLElement[] {
  const scope = refs.list ?? root;

  return getTabbableCandidates(scope).filter((element) => {
    for (const content of refs.contentMap.values()) {
      if (content.contains(element)) return false;
    }
    return true;
  });
}

function nextNavStop(
  root: HTMLElement,
  refs: NavMenuRefs,
  value: string,
): HTMLElement | null {
  const trigger = refs.triggerByValue.get(value);
  if (!trigger) return null;

  const stops = navStops(root, refs);
  const index = stops.indexOf(trigger);
  if (index === -1) return null;

  return stops[index + 1] ?? null;
}

/** Steps out of the nav entirely, to the next tabbable element on the page. */
function focusAfterRoot(root: HTMLElement): void {
  const following = Node.DOCUMENT_POSITION_FOLLOWING;

  const next = getTabbableCandidates(document.body).find(
    (element) =>
      !root.contains(element) &&
      (root.compareDocumentPosition(element) & following) !== 0 &&
      (element.checkVisibility?.() ?? true),
  );

  next?.focus();
}

function moveFocus(
  direction: number,
  refs: NavMenuRefs,
  controller: NavMenuController,
  from: HTMLElement,
): void {
  if (refs.triggers.length === 0) return;

  const index = refs.triggers.indexOf(from);
  let next = index + direction;
  if (next < 0) next = refs.triggers.length - 1;
  if (next >= refs.triggers.length) next = 0;

  const trigger = refs.triggers[next];
  if (!trigger) return;

  trigger.focus();

  if (controller.getActiveValue()) {
    const value = refs.valueByTrigger.get(trigger);
    if (value && refs.contentMap.has(value)) controller.setValue(value);
    else controller.setValue(null);
  }
}

function getTabbableCandidates(container: HTMLElement): HTMLElement[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const element = node as HTMLElement & {
        type?: string;
        disabled?: boolean;
      };
      if (element.tagName === 'INPUT' && element.type === 'hidden') {
        return NodeFilter.FILTER_SKIP;
      }
      if (element.disabled || element.hidden) return NodeFilter.FILTER_SKIP;

      return element.tabIndex >= 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  const candidates: HTMLElement[] = [];
  while (walker.nextNode()) candidates.push(walker.currentNode as HTMLElement);

  return candidates;
}

function focusFirst(candidates: HTMLElement[]): boolean {
  const previous = document.activeElement;

  for (const candidate of candidates) {
    if (candidate === previous) return true;
    candidate.focus();
    if (document.activeElement !== previous) return true;
  }

  return false;
}
