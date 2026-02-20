import { describe, it, expect } from 'vitest';
import { initNavAnim } from '../index.ts';

describe('initNavAnim', () => {
  it('should return "Hello World"', () => {
    expect(initNavAnim()).toBe('Hello World');
  });
});
