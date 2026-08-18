import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createHideBehaviourMock, subscribeToScrollMock } = vi.hoisted(() => ({
  createHideBehaviourMock: vi.fn(),
  subscribeToScrollMock: vi.fn(),
}));

vi.mock('../behaviours/hide.ts', () => ({
  createHideBehaviour: createHideBehaviourMock,
}));

vi.mock('../scroll-source.ts', () => ({
  subscribeToScroll: subscribeToScrollMock,
}));

import { NAVBAR_CONFIG } from '../config.ts';
import {
  type InitNavbarAnimationOptions,
  initNavbarAnimation,
} from '../index.ts';

/**
 * Builds a stub navbar element carrying the given behaviour attribute.
 * `undefined` means the attribute is absent entirely.
 */
function navbarStub(behaviour?: string): Element {
  return {
    getAttribute: (name: string) =>
      name === NAVBAR_CONFIG.attributes.behaviour && behaviour !== undefined
        ? behaviour
        : null,
  } as unknown as Element;
}

function mockNavbarQuery(elements: Element[]): void {
  Object.defineProperty(globalThis, 'document', {
    value: {
      querySelectorAll: (selector: string) =>
        selector === NAVBAR_CONFIG.selectors.navbar ? elements : [],
    },
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNavbarQuery([]);

  createHideBehaviourMock.mockImplementation(() => ({
    onScroll: vi.fn(),
    destroy: vi.fn(),
  }));
  subscribeToScrollMock.mockImplementation(() => vi.fn());
});

describe('initNavbarAnimation', () => {
  it('should return false when navbar elements are not found', () => {
    expect(initNavbarAnimation()).toBe(false);
    expect(createHideBehaviourMock).not.toHaveBeenCalled();
    expect(subscribeToScrollMock).not.toHaveBeenCalled();
  });

  it('should return a truthy handle when navbar elements exist', () => {
    mockNavbarQuery([navbarStub('hide')]);

    const handle = initNavbarAnimation();

    expect(handle).toBeTruthy();
    expect(typeof (handle as { destroy: () => void }).destroy).toBe('function');
  });

  it('should create the hide behaviour and subscribe it to the scroll source', () => {
    const navbar = navbarStub('hide');
    const options: InitNavbarAnimationOptions = {
      animationDuration: 0.8,
      animationEasing: 'power4.out',
    };

    mockNavbarQuery([navbar]);
    initNavbarAnimation(options);

    expect(createHideBehaviourMock).toHaveBeenCalledWith(
      navbar,
      expect.objectContaining(options),
    );
    expect(subscribeToScrollMock).toHaveBeenCalledTimes(1);
  });

  it('should use default options when no options are provided', () => {
    mockNavbarQuery([navbarStub('hide')]);
    initNavbarAnimation();

    expect(createHideBehaviourMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        animationDuration: 0.3,
        animationEasing: 'power2.inOut',
      }),
    );
  });

  it('should merge partial options with defaults', () => {
    mockNavbarQuery([navbarStub('hide')]);
    initNavbarAnimation({ animationDuration: 0.8 });

    expect(createHideBehaviourMock).toHaveBeenCalledWith(expect.anything(), {
      animationDuration: 0.8,
      animationEasing: 'power2.inOut',
    });
  });

  it('should ignore explicitly undefined options rather than clobbering defaults', () => {
    mockNavbarQuery([navbarStub('hide')]);

    // A consumer forwarding a value from their own config that happens to be
    // undefined would otherwise end up with no default at all.
    initNavbarAnimation({
      animationDuration: undefined,
      animationEasing: undefined,
    });

    expect(createHideBehaviourMock).toHaveBeenCalledWith(expect.anything(), {
      animationDuration: 0.3,
      animationEasing: 'power2.inOut',
    });
  });

  describe('behaviour attribute', () => {
    it.each([
      ['absent', undefined],
      ['empty', ''],
      ['whitespace', '   '],
      ['unrecognised', 'slide'],
    ])('should register nothing when the attribute is %s', (_label, value) => {
      mockNavbarQuery([navbarStub(value)]);

      const handle = initNavbarAnimation();

      expect(handle).toBeTruthy();
      expect(createHideBehaviourMock).not.toHaveBeenCalled();
      expect(subscribeToScrollMock).not.toHaveBeenCalled();
    });

    it.each([['hide'], ['HIDE'], [' hide ']])(
      'should register the hide behaviour for %s',
      (value) => {
        mockNavbarQuery([navbarStub(value)]);
        initNavbarAnimation();

        expect(createHideBehaviourMock).toHaveBeenCalledTimes(1);
      },
    );

    it('should resolve each element independently', () => {
      mockNavbarQuery([navbarStub('hide'), navbarStub(), navbarStub('hide')]);
      initNavbarAnimation();

      expect(createHideBehaviourMock).toHaveBeenCalledTimes(2);
      expect(subscribeToScrollMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('handle', () => {
    it('should unsubscribe and destroy every behaviour', () => {
      const destroy = vi.fn();
      const unsubscribe = vi.fn();

      createHideBehaviourMock.mockReturnValue({ onScroll: vi.fn(), destroy });
      subscribeToScrollMock.mockReturnValue(unsubscribe);
      mockNavbarQuery([navbarStub('hide'), navbarStub('hide')]);

      const handle = initNavbarAnimation();
      (handle as { destroy: () => void }).destroy();

      expect(unsubscribe).toHaveBeenCalledTimes(2);
      expect(destroy).toHaveBeenCalledTimes(2);
    });

    it('should be idempotent', () => {
      const destroy = vi.fn();
      const unsubscribe = vi.fn();

      createHideBehaviourMock.mockReturnValue({ onScroll: vi.fn(), destroy });
      subscribeToScrollMock.mockReturnValue(unsubscribe);
      mockNavbarQuery([navbarStub('hide')]);

      const handle = initNavbarAnimation() as { destroy: () => void };
      handle.destroy();
      handle.destroy();

      expect(destroy).toHaveBeenCalledTimes(1);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should produce independent handles across calls', () => {
      const firstDestroy = vi.fn();
      const secondDestroy = vi.fn();

      createHideBehaviourMock
        .mockReturnValueOnce({ onScroll: vi.fn(), destroy: firstDestroy })
        .mockReturnValueOnce({ onScroll: vi.fn(), destroy: secondDestroy });
      mockNavbarQuery([navbarStub('hide')]);

      const first = initNavbarAnimation() as { destroy: () => void };
      const second = initNavbarAnimation() as { destroy: () => void };

      expect(first).not.toBe(second);

      first.destroy();

      expect(firstDestroy).toHaveBeenCalledTimes(1);
      expect(secondDestroy).not.toHaveBeenCalled();
    });
  });
});
