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

  function applyState(
    value: string | null,
    previousValue: string | null,
  ): void {
    const { viewport } = refs;
    const ordered =
      options.dir === 'rtl'
        ? [...refs.itemValues].reverse()
        : [...refs.itemValues];
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
      } else if (wasActive && !value && viewport) {
        // Deliberately empty: stay visible so the viewport's exit animation
        // has something to render. The viewport's callback below cleans up.
      } else {
        hideContent(content);
      }
    });

    for (const { trigger, value: triggerValue, content } of refs.entries) {
      const isOpen = triggerValue === value;
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
        sizeViewport(value);
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

  function sizeViewport(value: string): void {
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
  }

  function observeResize(getActiveValue: () => string | null): NavMenuCleanup {
    if (!refs.viewport || typeof ResizeObserver === 'undefined') {
      return () => {};
    }

    const observer = new ResizeObserver(() => {
      const value = getActiveValue();
      if (value) sizeViewport(value);
    });
    refs.contentMap.forEach((content) => {
      observer.observe(content);
    });

    return () => observer.disconnect();
  }

  return { applyState, observeResize };
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
