import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NAVBAR_CONFIG } from '../../config.ts';
import type { NavbarMeasurer } from '../../measure.ts';

const {
  performInitialAnimationMock,
  killTweensOfMock,
  setMock,
  toMock,
  matchMediaMock,
} = vi.hoisted(() => ({
  performInitialAnimationMock: vi.fn(),
  killTweensOfMock: vi.fn(),
  setMock: vi.fn(),
  toMock: vi.fn(),
  matchMediaMock: vi.fn(),
}));

vi.mock('../../initial-animation.ts', () => ({
  createNavbarAnimation: vi.fn(),
  performInitialAnimation: performInitialAnimationMock,
}));

vi.mock('gsap', () => ({
  gsap: { killTweensOf: killTweensOfMock, set: setMock, to: toMock },
}));

import { createCompressBehaviour } from '../../behaviours/compress.ts';

const OPTIONS = {
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
  compressBreakpoint: 992,
};

/** Widths the stub measurer reports, keyed by the state being measured. */
const EXPANDED_WIDTH = 1180;
const COMPRESSED_WIDTH = 260;
const COMPRESSIBLE_WIDTH = 880;

type Stubs = {
  navbar: Element;
  compressible: Element | null;
  compressibleStyle: {
    width: string;
    display: string;
    overflow: string;
    minWidth: string;
  };
  measurer: Mock<NavbarMeasurer>;
};

/**
 * Builds a navbar stub whose measurer reports realistic widths. Because jsdom
 * has no layout, the stub keys off the subtree width the behaviour just set —
 * the same signal a real browser would resolve through layout.
 */
function createStubs({ withSubtree = true } = {}): Stubs {
  const compressibleStyle = {
    width: '',
    display: '',
    overflow: '',
    minWidth: '',
  };
  const compressible = withSubtree
    ? ({ style: compressibleStyle } as unknown as Element)
    : null;

  const navbar = {
    style: { width: '' },
    querySelector: (selector: string) =>
      selector === NAVBAR_CONFIG.selectors.compressible ? compressible : null,
  } as unknown as Element;

  const measurer = vi.fn((target: Element) => {
    if (target === compressible) return COMPRESSIBLE_WIDTH;
    return compressibleStyle.width === '0px'
      ? COMPRESSED_WIDTH
      : EXPANDED_WIDTH;
  });

  return { navbar, compressible, compressibleStyle, measurer };
}

function setupMockWindow({
  innerWidth = 1440,
  scrollY = 0,
  reducedMotion = false,
}: {
  innerWidth?: number;
  scrollY?: number;
  reducedMotion?: boolean;
} = {}): {
  fireResize: () => void;
} {
  const listeners: Record<string, Array<() => void>> = {};

  matchMediaMock.mockReturnValue({ matches: reducedMotion });

  Object.defineProperty(globalThis, 'window', {
    value: {
      innerWidth,
      scrollY,
      matchMedia: matchMediaMock,
      addEventListener: (name: string, callback: () => void) => {
        listeners[name] ??= [];
        listeners[name].push(callback);
      },
      removeEventListener: (name: string, callback: () => void) => {
        listeners[name] = (listeners[name] ?? []).filter(
          (registered) => registered !== callback,
        );
      },
    },
    configurable: true,
  });

  return {
    fireResize: () => {
      for (const callback of Array.from(listeners.resize ?? [])) callback();
    },
  };
}

/** Pulls the vars passed to the most recent gsap.to call targeting `target`. */
function tweenFor(target: unknown): Record<string, unknown> | undefined {
  const calls = toMock.mock.calls as unknown[][];
  const call = calls.filter(([element]) => element === target).at(-1);

  return call?.[1] as Record<string, unknown> | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  // ResizeObserver does not exist in jsdom; the behaviour guards on it.
  Reflect.deleteProperty(globalThis, 'ResizeObserver');
  setupMockWindow();
});

describe('compress behaviour', () => {
  it('should run the initial animation on creation', () => {
    const { navbar, measurer } = createStubs();

    createCompressBehaviour(navbar, OPTIONS, { measurer });

    expect(performInitialAnimationMock).toHaveBeenCalledWith([navbar], OPTIONS);
  });

  it('should be inert when the collapsing subtree is absent', () => {
    const { navbar, measurer } = createStubs({ withSubtree: false });

    const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
    behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

    expect(measurer).not.toHaveBeenCalled();
    expect(toMock).not.toHaveBeenCalled();
    expect(performInitialAnimationMock).not.toHaveBeenCalled();
  });

  it('should give each inert instance its own handler', () => {
    const first = createStubs({ withSubtree: false });
    const second = createStubs({ withSubtree: false });

    const firstBehaviour = createCompressBehaviour(first.navbar, OPTIONS, {
      measurer: first.measurer,
    });
    const secondBehaviour = createCompressBehaviour(second.navbar, OPTIONS, {
      measurer: second.measurer,
    });

    // A shared inert singleton would collapse into one scroll subscription.
    expect(firstBehaviour.onScroll).not.toBe(secondBehaviour.onScroll);
    expect(firstBehaviour.destroy).not.toBe(secondBehaviour.destroy);
  });

  it('should not animate at all under prefers-reduced-motion', () => {
    setupMockWindow({ reducedMotion: true });
    const { navbar, measurer } = createStubs();

    const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
    behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

    expect(performInitialAnimationMock).not.toHaveBeenCalled();
    expect(toMock).not.toHaveBeenCalled();
    expect(measurer).not.toHaveBeenCalled();
  });

  describe('above the breakpoint', () => {
    it('should compress to the measured compressed width on scroll down', () => {
      const { navbar, compressible, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

      expect(tweenFor(navbar)).toMatchObject({ width: COMPRESSED_WIDTH });
      expect(tweenFor(compressible)).toMatchObject({
        width: 0,
        autoAlpha: 0,
      });
    });

    it('should expand back to the measured widths on scroll up', () => {
      const { navbar, compressible, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);
      behaviour.onScroll(0);

      expect(tweenFor(navbar)).toMatchObject({ width: EXPANDED_WIDTH });
      expect(tweenFor(compressible)).toMatchObject({
        width: COMPRESSIBLE_WIDTH,
        autoAlpha: 1,
      });
    });

    it('should measure the compressed width with the subtree in flow', () => {
      const { navbar, compressibleStyle, measurer } = createStubs();
      const displaysDuringMeasurement: string[] = [];

      measurer.mockImplementation(() => {
        displaysDuringMeasurement.push(compressibleStyle.display);
        return compressibleStyle.width === '0px'
          ? COMPRESSED_WIDTH
          : EXPANDED_WIDTH;
      });

      createCompressBehaviour(navbar, OPTIONS, { measurer });

      // Removing the subtree from layout would also drop its flex gap, so the
      // navbar would be pinned narrower than its own content and whatever
      // follows the subtree would push out through the padding.
      expect(displaysDuringMeasurement).not.toContain('none');
      expect(displaysDuringMeasurement.length).toBeGreaterThan(0);
    });

    it('should free the subtree to collapse below its min-content width', () => {
      const { navbar, compressibleStyle, measurer } = createStubs();

      createCompressBehaviour(navbar, OPTIONS, { measurer });

      // Without this a flex item floors at min-content and never reaches 0.
      expect(compressibleStyle.minWidth).toBe('0');
      expect(compressibleStyle.overflow).toBe('hidden');
    });

    it('should restore the subtree width it borrowed while measuring', () => {
      const { navbar, compressibleStyle, measurer } = createStubs();

      compressibleStyle.width = '640px';
      createCompressBehaviour(navbar, OPTIONS, { measurer });

      expect(compressibleStyle.width).toBe('640px');
    });

    it('should never use overwrite: true', () => {
      const { navbar, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

      for (const [, vars] of toMock.mock.calls) {
        expect((vars as { overwrite: unknown }).overwrite).toBe('auto');
      }
    });

    it('should ignore scroll changes below threshold', () => {
      const { navbar, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold - 1);

      expect(toMock).not.toHaveBeenCalled();
    });

    it('should not re-compress while already compressed', () => {
      const { navbar, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);
      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 400);

      // One tween per target, not two.
      expect(toMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('below the breakpoint', () => {
    it('should not register', () => {
      setupMockWindow({ innerWidth: 991 });
      const { navbar, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

      expect(measurer).not.toHaveBeenCalled();
      expect(toMock).not.toHaveBeenCalled();
    });

    it('should clear what it wrote when the viewport crosses down', () => {
      const { fireResize } = setupMockWindow({ innerWidth: 1440 });
      const { navbar, compressible, measurer } = createStubs();

      createCompressBehaviour(navbar, OPTIONS, { measurer });
      globalThis.window.innerWidth = 800;
      fireResize();

      expect(setMock).toHaveBeenCalledWith([navbar, compressible], {
        clearProps: 'width,visibility,opacity',
      });
    });

    it('should not kill the entrance tween when crossing down', () => {
      const { fireResize } = setupMockWindow({ innerWidth: 1440 });
      const { navbar, compressible, measurer } = createStubs();

      createCompressBehaviour(navbar, OPTIONS, { measurer });
      globalThis.window.innerWidth = 800;
      fireResize();

      // An unscoped kill would take out the entrance tween too, stranding the
      // navbar part-way off-screen with a transform nothing clears.
      expect(killTweensOfMock).toHaveBeenCalledWith(
        [navbar, compressible],
        'width,opacity,visibility',
      );
      for (const [, props] of killTweensOfMock.mock.calls) {
        expect(props).toBeDefined();
      }
    });

    it('should restart the deadband from the current scroll on reactivation', () => {
      const { fireResize } = setupMockWindow({ innerWidth: 1440, scrollY: 0 });
      const { navbar, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });

      // Compress, then drop below the breakpoint.
      behaviour.onScroll(2000);
      globalThis.window.innerWidth = 800;
      fireResize();

      // The page moves on while the behaviour is dormant, then comes back.
      globalThis.window.scrollY = 4000;
      globalThis.window.innerWidth = 1440;
      fireResize();

      toMock.mockClear();

      // Scrolling *up* from 4000 must not read as a scroll down against the
      // stale 2000 reading. Against 4000 it is correctly an upward move, and
      // the navbar is already expanded, so nothing should animate at all.
      behaviour.onScroll(3900);

      expect(toMock).not.toHaveBeenCalled();
    });

    it('should register again when the viewport crosses back up', () => {
      const { fireResize } = setupMockWindow({ innerWidth: 800 });
      const { navbar, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });

      globalThis.window.innerWidth = 1440;
      fireResize();
      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

      expect(tweenFor(navbar)).toMatchObject({ width: COMPRESSED_WIDTH });
    });
  });

  describe('re-measurement', () => {
    it('should re-measure on a resize that stays above the breakpoint', () => {
      const { fireResize } = setupMockWindow({ innerWidth: 1440 });
      const { navbar, measurer } = createStubs();

      createCompressBehaviour(navbar, OPTIONS, { measurer });
      const measureCallsAtInit = measurer.mock.calls.length;

      globalThis.window.innerWidth = 1200;
      fireResize();

      // ResizeObserver cannot cover this while compressed — the navbar's own
      // box is pinned to an inline width, so it never reports a change.
      expect(measurer.mock.calls.length).toBeGreaterThan(measureCallsAtInit);
    });

    it('should defer a resize that lands mid-transition until the tween settles', () => {
      class StubResizeObserver {
        static instances: StubResizeObserver[] = [];
        callback: () => void;
        constructor(callback: () => void) {
          this.callback = callback;
          StubResizeObserver.instances.push(this);
        }
        observe() {}
        disconnect() {}
      }

      Object.defineProperty(globalThis, 'ResizeObserver', {
        value: StubResizeObserver,
        configurable: true,
      });

      const { navbar, measurer } = createStubs();
      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });

      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

      const measureCallsDuringTween = measurer.mock.calls.length;
      const observer = StubResizeObserver.instances[0];

      // Resize while the compress tween is still running.
      observer?.callback();

      expect(measurer.mock.calls.length).toBe(measureCallsDuringTween);

      // Settling the tween runs the deferred measurement.
      const onComplete = toMock.mock.calls.at(-1)?.[1]?.onComplete as
        | (() => void)
        | undefined;
      onComplete?.();

      expect(measurer.mock.calls.length).toBeGreaterThan(
        measureCallsDuringTween,
      );
    });
  });

  describe('destroy', () => {
    it('should clear inline properties and stop responding to scroll', () => {
      const { navbar, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
      behaviour.destroy();

      expect(setMock).toHaveBeenCalledWith(navbar, {
        clearProps: 'transform',
      });

      toMock.mockClear();
      behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

      expect(toMock).not.toHaveBeenCalled();
    });

    it('should stop reacting to resize', () => {
      const { fireResize } = setupMockWindow({ innerWidth: 800 });
      const { navbar, measurer } = createStubs();

      const behaviour = createCompressBehaviour(navbar, OPTIONS, { measurer });
      behaviour.destroy();

      globalThis.window.innerWidth = 1440;
      fireResize();

      expect(measurer).not.toHaveBeenCalled();
    });
  });
});
