import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../initial-animation.ts', () => ({
  performInitialAnimation: vi.fn(),
}));

vi.mock('../scroll-behaviour.ts', () => ({
  initScrollBehavior: vi.fn(),
}));

import { NAVBAR_CONFIG } from '../config.ts';
import {
  cachedNavbarElements,
  initNavbarAnimation,
  type InitNavbarAnimationOptions,
} from '../index.ts';
import { performInitialAnimation } from '../initial-animation.ts';
import { initScrollBehavior } from '../scroll-behaviour.ts';

const mockedPerformInitialAnimation = vi.mocked(performInitialAnimation);
const mockedInitScrollBehavior = vi.mocked(initScrollBehavior);

function mockNavbarQuery(elements: Element[]): void {
  Object.defineProperty(globalThis, 'document', {
    value: {
      querySelectorAll: (selector: string) => {
        if (selector === NAVBAR_CONFIG.selectors.navbar) {
          return elements;
        }

        return [];
      },
    },
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNavbarQuery([]);
});

describe('initNavbarAnimation', () => {
  it('should return false when navbar elements are not found', () => {
    expect(initNavbarAnimation()).toBe(false);
    expect(mockedPerformInitialAnimation).not.toHaveBeenCalled();
    expect(mockedInitScrollBehavior).not.toHaveBeenCalled();
  });

  it('should initialize animation and scroll behavior when navbar elements exist', () => {
    const navbarA = { id: 'a' } as unknown as Element;
    const navbarB = { id: 'b' } as unknown as Element;
    const options: InitNavbarAnimationOptions = {
      animationDuration: 0.8,
      animationEasing: 'power4.out',
    };

    mockNavbarQuery([navbarA, navbarB]);

    expect(initNavbarAnimation(options)).toBe(true);
    expect(cachedNavbarElements).toEqual([navbarA, navbarB]);
    expect(mockedPerformInitialAnimation).toHaveBeenCalledWith(
      [navbarA, navbarB],
      options,
    );
    expect(mockedInitScrollBehavior).toHaveBeenCalledWith(options);
  });

  it('should use default options when no options are provided', () => {
    const navbar = { id: 'only' } as unknown as Element;

    mockNavbarQuery([navbar]);

    expect(initNavbarAnimation()).toBe(true);
    expect(mockedPerformInitialAnimation).toHaveBeenCalledWith(
      [navbar],
      expect.objectContaining({
        animationDuration: 0.3,
        animationEasing: 'power2.inOut',
      }),
    );
    expect(mockedInitScrollBehavior).toHaveBeenCalledWith(
      expect.objectContaining({
        animationDuration: 0.3,
        animationEasing: 'power2.inOut',
      }),
    );
  });
});
