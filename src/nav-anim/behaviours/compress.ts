import { gsap } from 'gsap';
import { NAVBAR_CONFIG } from '../config.ts';
import { performInitialAnimation } from '../initial-animation.ts';
import { defaultMeasurer, type NavbarMeasurer } from '../measure.ts';
import type { NavbarAnimationOptions, NavbarBehaviour } from '../types.ts';

type NavbarWidths = {
  /** Natural width of the navbar with the collapsing subtree in place. */
  expanded: number;
  /** Natural width of the navbar with the collapsing subtree removed. */
  compressed: number;
  /** Natural width of the collapsing subtree itself. */
  compressible: number;
};

export type CompressBehaviourDeps = {
  /** Injected so the logic is testable where layout does not exist. */
  measurer?: NavbarMeasurer;
};

/**
 * A behaviour that does nothing, for the cases where compress cannot run.
 *
 * Built per call rather than shared: a single module-level instance would give
 * every inert navbar the same `onScroll` reference, and subscribers are held by
 * identity.
 */
function createInertBehaviour(): NavbarBehaviour {
  return {
    onScroll: () => {},
    destroy: () => {},
  };
}

/**
 * Whether the user asked for reduced motion.
 *
 * `matchMedia` is absent in jsdom, so its absence is treated as no preference.
 */
function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Creates the compress behaviour for a single navbar element.
 *
 * The navbar slides in on initialization, then collapses to a compact width on
 * scroll down — dropping the `[r-navbar-compress]` subtree while everything
 * else stays put — and expands again on the way up.
 *
 * Unlike hide, which animates to a percentage, compress animates to measured
 * pixel widths. That brings the measurement rules with it: measuring while a
 * transition is on screen disturbs the inline widths the tween owns, so a
 * re-measure requested mid-transition is deferred until the tween settles.
 *
 * @param element - The navbar element this behaviour is bound to
 * @param options - Animation options
 * @param deps - Injectable seams, for testing
 * @returns A behaviour owning this element's state, inert if it cannot run
 */
export function createCompressBehaviour(
  element: Element,
  options: NavbarAnimationOptions,
  deps: CompressBehaviourDeps = {},
): NavbarBehaviour {
  // Nothing animates under reduced motion — the navbar is left exactly as it is.
  if (prefersReducedMotion()) return createInertBehaviour();

  const compressible = element.querySelector(
    NAVBAR_CONFIG.selectors.compressible,
  );

  // The markup may land after the code ships, so a missing subtree is not an
  // error — the behaviour simply does nothing.
  if (!compressible) return createInertBehaviour();

  const measurer = deps.measurer ?? defaultMeasurer;
  const elementStyle = (element as HTMLElement).style;
  const compressibleStyle = (compressible as HTMLElement).style;

  let lastScrollY = window.scrollY;
  let widths: NavbarWidths | null = null;
  let isActive = false;
  let isCompressed = false;
  let isAnimating = false;
  let isRemeasurePending = false;
  let resizeObserver: ResizeObserver | null = null;

  /**
   * Reads the expanded and compressed widths in one synchronous pass.
   *
   * Inline widths are cleared to read the natural values. Because nothing
   * yields, the browser never paints an intermediate state, so this cannot
   * flash — but it does force layout, and it must never run while a tween owns
   * those same inline widths.
   *
   * The compressed width is measured with the subtree at zero width rather than
   * removed from layout, because that is the state the tween actually lands on.
   * `display: none` would also drop the subtree's flex gap, pinning the navbar
   * narrower than its own content and pushing whatever follows the subtree out
   * through the padding.
   */
  function measureWidths(): NavbarWidths {
    const savedElementWidth = elementStyle.width;
    const savedCompressibleWidth = compressibleStyle.width;

    elementStyle.width = '';
    compressibleStyle.width = '';

    const expanded = measurer(element);
    const compressibleWidth = measurer(compressible as Element);

    compressibleStyle.width = '0px';
    const compressed = measurer(element);

    elementStyle.width = savedElementWidth;
    compressibleStyle.width = savedCompressibleWidth;

    return { expanded, compressed, compressible: compressibleWidth };
  }

  /**
   * Pins the navbar to the widths its current state implies.
   *
   * Expanded is represented by no inline width at all, so the navbar keeps
   * responding to layout on its own until the next compression.
   */
  function applyCurrentState(): void {
    if (!widths) return;

    if (isCompressed) {
      gsap.set(element, { width: widths.compressed });
      gsap.set(compressible, { width: 0, autoAlpha: 0 });
      return;
    }

    gsap.set([element, compressible], { clearProps: 'width' });
    gsap.set(compressible, { autoAlpha: 1 });
  }

  /**
   * Re-reads the widths, deferring if a transition is currently on screen.
   */
  function refreshMeasurements(): void {
    if (!isActive) return;

    if (isAnimating) {
      isRemeasurePending = true;
      return;
    }

    widths = measureWidths();
    applyCurrentState();
  }

  /**
   * Runs a compress or expand transition.
   */
  function runTransition(
    elementWidth: number,
    compressibleWidth: number,
    compressibleAlpha: number,
  ): void {
    isAnimating = true;

    const shared = {
      duration: options.animationDuration,
      ease: options.animationEasing,
      overwrite: 'auto' as const,
    };

    gsap.to(element, { ...shared, width: elementWidth });
    gsap.to(compressible, {
      ...shared,
      width: compressibleWidth,
      autoAlpha: compressibleAlpha,
      onComplete: () => {
        isAnimating = false;

        // Hand the expanded state back to layout so the navbar keeps
        // responding to content and viewport changes on its own.
        if (!isCompressed) {
          gsap.set([element, compressible], { clearProps: 'width' });
        }

        if (isRemeasurePending) {
          isRemeasurePending = false;
          refreshMeasurements();
        }
      },
    });
  }

  function compressNavbar(): void {
    if (isCompressed || !widths) return;

    isCompressed = true;
    runTransition(widths.compressed, 0, 0);
  }

  function expandNavbar(): void {
    if (!isCompressed || !widths) return;

    isCompressed = false;
    runTransition(widths.expanded, widths.compressible, 1);
  }

  function activate(): void {
    if (isActive) return;

    isActive = true;
    // Scroll may have moved while the behaviour was dormant, so the deadband
    // has to restart from where the page actually is. A stale reading here
    // reads a later scroll up as a scroll down and compresses the wrong way.
    lastScrollY = window.scrollY;
    // Keeps the subtree's children from spilling out as its width goes to 0.
    compressibleStyle.overflow = 'hidden';
    // A flex item defaults to `min-width: auto`, which floors it at its
    // min-content width — the tween to 0 would clamp partway and the subtree
    // would never fully collapse. Both of these are set before measuring so the
    // compressed width is read under the same rules the tween runs under.
    compressibleStyle.minWidth = '0';

    widths = measureWidths();

    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(refreshMeasurements);
      resizeObserver.observe(element);
      resizeObserver.observe(compressible as Element);
    }
  }

  function deactivate(): void {
    if (!isActive) return;

    isActive = false;
    isCompressed = false;
    isAnimating = false;
    isRemeasurePending = false;
    widths = null;

    resizeObserver?.disconnect();
    resizeObserver = null;

    // Scoped to the properties compress owns. An unscoped kill would also take
    // out the entrance tween, which animates `y` — crossing below the
    // breakpoint mid-entrance would leave the navbar stranded part-way
    // off-screen with a transform nothing goes on to clear.
    gsap.killTweensOf([element, compressible], 'width,opacity,visibility');
    gsap.set([element, compressible], {
      clearProps: 'width,visibility,opacity',
    });
    compressibleStyle.overflow = '';
    compressibleStyle.minWidth = '';
  }

  /**
   * Compress only registers at or above the configured breakpoint. Webflow's
   * native Navbar takes over below it with its own hamburger menu.
   */
  function syncBreakpoint(): void {
    if (window.innerWidth < options.compressBreakpoint) {
      deactivate();
      return;
    }

    if (isActive) {
      // ResizeObserver cannot see this one. While compressed, the navbar
      // carries an inline pixel width and the subtree is pinned at 0, so
      // neither box changes when the viewport does and the observer never
      // fires — leaving the expand tween aiming at a stale width.
      refreshMeasurements();
      return;
    }

    activate();
  }

  // The entrance runs regardless of the breakpoint — only the compression on
  // scroll is gated.
  performInitialAnimation([element], options);
  syncBreakpoint();

  window.addEventListener('resize', syncBreakpoint, { passive: true });

  return {
    onScroll(currentScrollY: number): void {
      if (!isActive) return;

      if (
        Math.abs(currentScrollY - lastScrollY) < NAVBAR_CONFIG.scroll.threshold
      ) {
        return;
      }

      if (
        currentScrollY > lastScrollY &&
        currentScrollY > NAVBAR_CONFIG.scroll.threshold
      ) {
        compressNavbar();
      } else {
        expandNavbar();
      }

      lastScrollY = currentScrollY;
    },

    destroy(): void {
      window.removeEventListener('resize', syncBreakpoint);
      deactivate();
      gsap.killTweensOf(element);
      gsap.set(element, { clearProps: 'transform' });
    },
  };
}
