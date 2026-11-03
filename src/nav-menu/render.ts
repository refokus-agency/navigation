import type {
  NavMenuCleanup,
  NavMenuOptions,
  NavMenuRefs,
  NavMenuRenderer,
} from './types.ts';

/** Writes DOM state only — CSS owns every transition. */
export function createRenderer({
  refs,
  options,
  root,
}: {
  refs: NavMenuRefs;
  options: NavMenuOptions;
  root: HTMLElement;
}): NavMenuRenderer {
  // A panel that is neither entering nor leaving keeps its prior motion.
  const prevMotionMap = new Map<string, string | null>();

  // Tracked, never read back off `style.display`: display only flips once the
  // exit animation ends, so sniffing it made a reopen inside that window
  // animate from the stale size (constant via Enter, invisible via hover).
  let isViewportOpen = false;

  // `dir` is fixed for the instance, so order it once rather than per render.
  const ordered =
    options.dir === 'rtl' ? [...refs.itemValues].reverse() : refs.itemValues;

  function applyState(
    value: string | null,
    previousValue: string | null,
    activeTrigger: HTMLElement | null = null,
  ): void {
    const { viewport } = refs;
    const prevIdx = previousValue ? ordered.indexOf(previousValue) : -1;
    const currIdx = value ? ordered.indexOf(value) : -1;

    refs.contentMap.forEach((content, key) => {
      const isActive = key === value;
      const wasActive = key === previousValue;

      content.dataset.state = isActive ? 'open' : 'closed';
      content.style.pointerEvents = isActive ? '' : 'none';
      // Mounted through its exit animation, so drop it from the tab order now.
      if (isActive) content.removeAttribute('inert');
      else content.setAttribute('inert', '');

      const motion = computeMotion(key, isActive, wasActive, currIdx, prevIdx);
      if (motion) content.dataset.motion = motion;
      else delete content.dataset.motion;

      if (isActive) {
        show(content);
      } else if (wasActive && value) {
        // Switching panels — animate this content out independently
        hideAfterAnimation(content, () => hideContent(content));
      } else if (wasActive && !value) {
        // With a viewport, stay visible so its exit animation has something to
        // render and let its callback below clean up. Without one, this panel
        // owns its own exit, exactly as it does when switching.
        if (!viewport) hideAfterAnimation(content, () => hideContent(content));
      } else {
        hideContent(content);
      }
    });

    for (const {
      item,
      trigger,
      value: triggerValue,
      content,
    } of refs.entries) {
      const isOpen = triggerValue === value;
      // Accordion hook. Unconditional so a breakpoint crossing cannot strand
      // a stale `open` on an item.
      if (content) item.dataset.state = isOpen ? 'open' : 'closed';
      trigger.dataset.state = isOpen ? 'open' : 'closed';
      // A plain link must not announce collapsible content it does not have.
      if (content) trigger.setAttribute('aria-expanded', String(isOpen));
    }

    if (viewport) {
      viewport.dataset.state = value ? 'open' : 'closed';
      viewport.style.pointerEvents = value ? '' : 'none';

      if (value) {
        // Mounting from closed: size instantly, never from zero or a stale value.
        const isRemount = !isViewportOpen;
        show(viewport);
        if (isRemount) viewport.style.transition = 'none';
        sizeViewport(value, activeTrigger);
        if (isRemount) {
          void viewport.offsetHeight; // force reflow at the new size
          viewport.style.transition = '';
        }
        isViewportOpen = true;
      } else {
        isViewportOpen = false;
        hideAfterAnimation(viewport, () => {
          hide(viewport);
          refs.contentMap.forEach(hideContent);
        });
      }
    }

    // Without a viewport nothing sizes the panel, but a pill still needs the
    // trigger's geometry.
    if (!viewport && value) positionViewport(value, activeTrigger, null);

    root.dataset.state = value ? 'open' : 'closed';
  }

  function computeMotion(
    key: string,
    isActive: boolean,
    wasActive: boolean,
    currIdx: number,
    prevIdx: number,
  ): string | null {
    if (!isActive && !wasActive) {
      return prevMotionMap.get(key) ?? null;
    }

    let attr: string | null = null;
    if (currIdx !== prevIdx) {
      if (isActive && prevIdx !== -1) {
        attr = currIdx > prevIdx ? 'from-end' : 'from-start';
      }
      if (wasActive && currIdx !== -1) {
        attr = currIdx > prevIdx ? 'to-start' : 'to-end';
      }
    }

    prevMotionMap.set(key, attr);
    return attr;
  }

  function sizeViewport(
    value: string,
    activeTrigger: HTMLElement | null,
  ): void {
    const content = refs.contentMap.get(value);
    const { viewport } = refs;
    if (!content || !viewport) return;

    // The panel must carry no imposed size: `inset: 0` or `height: 100%` makes
    // this circular and it settles on the tallest panel. See README, Sizing rule.
    // Mobile clamps the width, where the viewport spans the overlay.
    const isMobile = root.dataset.navMode === 'mobile';
    viewport.style.setProperty(
      '--nav-viewport-width',
      isMobile ? '100%' : `${content.scrollWidth}px`,
    );
    viewport.style.setProperty(
      '--nav-viewport-height',
      `${content.scrollHeight}px`,
    );

    positionViewport(
      value,
      activeTrigger,
      isMobile ? null : content.scrollWidth,
    );
  }

  /**
   * Publishes the active trigger's geometry, and `--nav-viewport-x` when the
   * viewport opts in with `[data-nav-align="trigger"]`. The trigger vars are
   * relative to the root; `--nav-viewport-x` to the viewport's positioning
   * ancestor, so it can feed `left`/`translate` directly. `panelWidth` is null on mobile, where the panel spans the overlay.
   */
  function positionViewport(
    value: string,
    activeTrigger: HTMLElement | null,
    panelWidth: number | null,
  ): void {
    const { viewport } = refs;
    // The trigger that opened the panel, not the item's first: items may own several.
    const trigger = activeTrigger ?? refs.triggerByValue.get(value);
    if (!trigger) return;

    const rootRect = root.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    // Measured against the root, a stable reference that does not depend on
    // where the viewport happens to be positioned.
    root.style.setProperty(
      '--nav-trigger-x',
      `${triggerRect.left - rootRect.left}px`,
    );
    root.style.setProperty('--nav-trigger-width', `${triggerRect.width}px`);

    if (!viewport) return;
    if (viewport.dataset.navAlign !== 'trigger' || panelWidth === null) {
      viewport.style.removeProperty('--nav-viewport-x');
      return;
    }

    // --nav-viewport-x is the one value relative to the viewport's own
    // positioning ancestor, since it feeds that element's left/translate.
    // A fixed viewport has no offsetParent and is placed against the window,
    // not the root, so its origin is 0.
    const anchorLeft =
      getComputedStyle(viewport).position === 'fixed'
        ? 0
        : (viewport.offsetParent ?? root).getBoundingClientRect().left;
    const triggerX = triggerRect.left - anchorLeft;
    // Clamp inside the root so a trigger near the edge never pushes the panel out.
    const min = rootRect.left - anchorLeft;
    const max = Math.max(
      min,
      min + rootRect.width - renderedWidth(viewport, panelWidth),
    );
    const x = Math.min(Math.max(triggerX, min), max);
    viewport.style.setProperty('--nav-viewport-x', `${x}px`);
  }

  function observeResize(
    getActiveValue: () => string | null,
    getActiveTrigger: () => HTMLElement | null,
  ): NavMenuCleanup {
    const remeasure = () => {
      const value = getActiveValue();
      if (!value) return;
      if (refs.viewport) sizeViewport(value, getActiveTrigger());
      else positionViewport(value, getActiveTrigger(), null);
    };
    // Trigger geometry moves with the window even when no panel resizes.
    window.addEventListener('resize', remeasure);
    const stopWindow = () => window.removeEventListener('resize', remeasure);

    if (typeof ResizeObserver === 'undefined') return stopWindow;

    const observer = new ResizeObserver(remeasure);
    refs.contentMap.forEach((content) => {
      observer.observe(content);
    });
    // The list, not the root: an in-flow viewport animating its height resizes
    // the root every frame, which would re-measure the triggers on each one.
    observer.observe(refs.list ?? root);
    // A trigger resizing (font swap, label change) moves its siblings even when
    // neither the root nor any panel changes size.
    for (const trigger of refs.triggers) observer.observe(trigger);

    return () => {
      stopWindow();
      observer.disconnect();
    };
  }

  return { applyState, observeResize };
}

/**
 * The viewport's rendered width for a content width. Under `content-box` its
 * padding and border add to `width`; under `border-box` they sit inside it.
 * Read from the target width, not `offsetWidth`, which is mid-transition.
 */
function renderedWidth(viewport: HTMLElement, contentWidth: number): number {
  const style = getComputedStyle(viewport);
  if (style.boxSizing === 'border-box') return contentWidth;
  const extra =
    parseFloat(style.paddingLeft) +
    parseFloat(style.paddingRight) +
    parseFloat(style.borderLeftWidth) +
    parseFloat(style.borderRightWidth);
  return contentWidth + (Number.isFinite(extra) ? extra : 0);
}

// Inline, because Webflow's class-based display:flex beats [hidden] on specificity.
function show(element: HTMLElement): void {
  element.style.display = '';
}

function hide(element: HTMLElement): void {
  element.style.display = 'none';
}

function hideContent(element: HTMLElement): void {
  hide(element);
  delete element.dataset.motion;
}

/** Defers cleanup until the CSS exit animation ends; immediate if there is none. */
function hideAfterAnimation(
  element: HTMLElement,
  onDone: NavMenuCleanup,
): void {
  const onAnimationEnd = () => {
    if (element.dataset.state === 'closed') onDone();
  };
  element.addEventListener('animationend', onAnimationEnd, { once: true });

  requestAnimationFrame(() => {
    if (element.dataset.state !== 'closed') return;

    const animationName = getComputedStyle(element).animationName;
    if (!animationName || animationName === 'none') {
      element.removeEventListener('animationend', onAnimationEnd);
      onDone();
    }
  });
}
