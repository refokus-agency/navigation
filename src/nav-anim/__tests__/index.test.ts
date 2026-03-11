import { describe, it, expect } from 'vitest';
import { initNavAnim } from '../index.ts';

describe('initNavAnim', () => {
  it('should return false when navbar elements are not found', () => {
    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelectorAll: () => [],
      },
      configurable: true,
    });

    expect(initNavAnim()).toBe(false);
  });
});
