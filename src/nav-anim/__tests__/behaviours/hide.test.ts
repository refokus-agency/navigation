import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVBAR_CONFIG } from '../../config.ts';

const createNavbarAnimationMock = vi.fn();
const performInitialAnimationMock = vi.fn();
const killTweensOfMock = vi.fn();
const setMock = vi.fn();

vi.mock('../../initial-animation.ts', () => ({
  createNavbarAnimation: createNavbarAnimationMock,
  performInitialAnimation: performInitialAnimationMock,
}));

vi.mock('gsap', () => ({
  gsap: {
    killTweensOf: killTweensOfMock,
    set: setMock,
  },
}));

const OPTIONS = {
  animationDuration: 0.5,
  animationEasing: 'power1.out',
};

function setupMockWindow(initialScrollY = 0): void {
  Object.defineProperty(globalThis, 'window', {
    value: { scrollY: initialScrollY },
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMockWindow(0);
});

describe('hide behaviour', () => {
  it('should run the initial animation on creation', async () => {
    const { createHideBehaviour } = await import('../../behaviours/hide.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    createHideBehaviour(navbarElement, OPTIONS);

    expect(performInitialAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      OPTIONS,
    );
  });

  it('should hide on downward significant scroll and show on upward significant scroll', async () => {
    const { createHideBehaviour } = await import('../../behaviours/hide.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    const behaviour = createHideBehaviour(navbarElement, OPTIONS);

    behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [navbarElement],
      NAVBAR_CONFIG.position.hidden,
      OPTIONS,
    );

    behaviour.onScroll(0);

    expect(createNavbarAnimationMock).toHaveBeenNthCalledWith(
      2,
      [navbarElement],
      NAVBAR_CONFIG.position.visible,
      OPTIONS,
    );
  });

  it('should ignore scroll changes below threshold', async () => {
    const { createHideBehaviour } = await import('../../behaviours/hide.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    const behaviour = createHideBehaviour(navbarElement, OPTIONS);

    behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold - 1);

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should not re-hide while already hidden', async () => {
    const { createHideBehaviour } = await import('../../behaviours/hide.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    const behaviour = createHideBehaviour(navbarElement, OPTIONS);

    behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);
    behaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 200);

    expect(createNavbarAnimationMock).toHaveBeenCalledTimes(1);
  });

  it('should seed lastScrollY from the current scroll position', async () => {
    setupMockWindow(1000);

    const { createHideBehaviour } = await import('../../behaviours/hide.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    const behaviour = createHideBehaviour(navbarElement, OPTIONS);

    // A move smaller than the threshold from 1000 is still not significant.
    behaviour.onScroll(1000 + NAVBAR_CONFIG.scroll.threshold - 1);

    expect(createNavbarAnimationMock).not.toHaveBeenCalled();
  });

  it('should keep per-element state independent across behaviours', async () => {
    const { createHideBehaviour } = await import('../../behaviours/hide.ts');
    const first = { id: 'first' } as unknown as Element;
    const second = { id: 'second' } as unknown as Element;

    const firstBehaviour = createHideBehaviour(first, OPTIONS);
    createHideBehaviour(second, OPTIONS);

    firstBehaviour.onScroll(NAVBAR_CONFIG.scroll.threshold + 20);

    // Only the element whose behaviour was driven should have animated.
    expect(createNavbarAnimationMock).toHaveBeenCalledTimes(1);
    expect(createNavbarAnimationMock).toHaveBeenCalledWith(
      [first],
      NAVBAR_CONFIG.position.hidden,
      OPTIONS,
    );
  });

  it('should kill tweens and clear inline properties on destroy', async () => {
    const { createHideBehaviour } = await import('../../behaviours/hide.ts');
    const navbarElement = { id: 'nav' } as unknown as Element;

    const behaviour = createHideBehaviour(navbarElement, OPTIONS);
    behaviour.destroy();

    expect(killTweensOfMock).toHaveBeenCalledWith(navbarElement);
    expect(setMock).toHaveBeenCalledWith(navbarElement, {
      clearProps: 'transform',
    });
  });
});
