import { describe, it, expect } from 'vitest';
import { initNavbarAnimation } from '../index.ts';

describe('initNavbarAnimation', () => {
  it('should return false when navbar elements are not found', () => {
    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelectorAll: () => [],
      },
      configurable: true,
    });

    expect(initNavbarAnimation()).toBe(false);
  });
});
