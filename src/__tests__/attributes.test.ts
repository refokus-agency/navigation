import { describe, expect, it } from 'vitest';
import {
  readBooleanAttr,
  readEnumAttr,
  readNumberAttr,
  resolveSetting,
} from '../attributes.ts';

function withAttribute(value?: string): Element {
  const element = document.createElement('div');
  if (value !== undefined) element.setAttribute('data-x', value);
  return element;
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

describe('resolveSetting precedence (AC-3)', () => {
  it('should prefer a valid attribute over the JS option and the fallback', () => {
    expect(
      resolveSetting({
        attribute: 50,
        js: 100,
        isValid: isNumber,
        fallback: 200,
      }),
    ).toBe(50);
  });

  it('should prefer a valid JS option over the fallback', () => {
    expect(
      resolveSetting({
        attribute: undefined,
        js: 100,
        isValid: isNumber,
        fallback: 200,
      }),
    ).toBe(100);
  });
});

describe('invalid, empty and missing values (AC-4)', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['a unit suffix', '300ms'],
    ['padding', ' 200 '],
    ['a word', 'fast'],
    ['a trailing dot', '5.'],
    ['an explicit plus sign', '+5'],
    ['an exponent', '1e3'],
  ])('readNumberAttr should reject %s', (_label, value) => {
    expect(readNumberAttr(withAttribute(value), 'data-x')).toBeUndefined();
  });

  it.each([
    ['.5', 0.5],
    ['-.5', -0.5],
  ])(
    'readNumberAttr should accept the leading-dot decimal "%s"',
    (value, expected) => {
      expect(readNumberAttr(withAttribute(value), 'data-x')).toBe(expected);
    },
  );

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['a typo', 'vertcal'],
    ['a different case', 'Vertical'],
  ])('readEnumAttr should reject %s', (_label, value) => {
    const read = readEnumAttr(['horizontal', 'vertical'] as const);
    expect(read(withAttribute(value), 'data-x')).toBeUndefined();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['a non-boolean', 'yes'],
    ['a different case', 'False'],
  ])('readBooleanAttr should reject %s', (_label, value) => {
    expect(readBooleanAttr(withAttribute(value), 'data-x')).toBeUndefined();
  });

  it('should read exact valid values', () => {
    const read = readEnumAttr(['horizontal', 'vertical'] as const);
    expect(read(withAttribute('vertical'), 'data-x')).toBe('vertical');
    expect(readBooleanAttr(withAttribute('false'), 'data-x')).toBe(false);
    expect(readBooleanAttr(withAttribute('true'), 'data-x')).toBe(true);
    expect(readNumberAttr(withAttribute('0.5'), 'data-x')).toBe(0.5);
  });

  it('should fall back to the default when the JS option is invalid', () => {
    expect(
      resolveSetting({
        attribute: undefined,
        js: '100',
        isValid: isNumber,
        fallback: 200,
      }),
    ).toBe(200);
  });
});

describe('numeric attributes (AC-5)', () => {
  it.each([
    ['0', 0],
    ['-20', -20],
    ['99999', 99999],
    ['-0.5', -0.5],
  ])('readNumberAttr should read %s unclamped', (value, expected) => {
    expect(readNumberAttr(withAttribute(value), 'data-x')).toBe(expected);
  });
});
