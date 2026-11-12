import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockPageScroll } from '../scroll-lock.ts';

const html = () => document.documentElement;

function makeRoot(): { root: HTMLElement; card: HTMLElement } {
  const root = document.createElement('nav');
  const card = document.createElement('div');
  root.append(card);
  document.body.append(root);
  return { root, card };
}

afterEach(() => {
  delete (window as unknown as { lenis?: unknown }).lenis;
  html().style.overflow = '';
  document.body.style.overflow = '';
  document.body.innerHTML = '';
});

describe('lockPageScroll with overlapping locks', () => {
  it('should only restore the page when the last lock is released', () => {
    html().style.overflow = 'auto';
    const lenis = { stop: vi.fn(), start: vi.fn(), isStopped: false };
    (window as unknown as { lenis: unknown }).lenis = lenis;
    const a = makeRoot();
    const b = makeRoot();

    const unlockA = lockPageScroll(a.root, a.card);
    const unlockB = lockPageScroll(b.root, b.card);
    expect(html().style.overflow).toBe('hidden');
    expect(lenis.stop).toHaveBeenCalledTimes(1);

    unlockA();
    expect(html().style.overflow).toBe('hidden');
    expect(lenis.start).not.toHaveBeenCalled();

    unlockB();
    expect(html().style.overflow).toBe('auto');
    expect(lenis.start).toHaveBeenCalledTimes(1);
  });

  it('should ignore a repeated unlock', () => {
    const a = makeRoot();
    const b = makeRoot();
    const unlockA = lockPageScroll(a.root, a.card);
    const unlockB = lockPageScroll(b.root, b.card);

    unlockA();
    unlockA();
    expect(html().style.overflow).toBe('hidden');

    unlockB();
    expect(html().style.overflow).toBe('');
  });

  it('should scope data-lenis-prevent to each lock', () => {
    const a = makeRoot();
    const b = makeRoot();
    const unlockA = lockPageScroll(a.root, a.card);
    const unlockB = lockPageScroll(b.root, b.card);

    unlockA();
    expect(a.card.hasAttribute('data-lenis-prevent')).toBe(false);
    expect(b.card.hasAttribute('data-lenis-prevent')).toBe(true);
    unlockB();
  });
});
