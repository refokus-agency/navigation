/**
 * Shared root-attribute resolution for both features. Precedence is always
 * attribute → JS option → default. Values match exactly — no trimming, no case
 * folding — and anything unparseable is skipped silently.
 */

/** `undefined` means the attribute is missing, empty or invalid. */
export type AttributeReader<T> = (el: Element, name: string) => T | undefined;

export type SettingSource<T> = {
  attribute: T | undefined;
  /** Untyped on purpose: browser-bundle callers pass anything. */
  js: unknown;
  isValid: (value: unknown) => value is T;
  fallback: T;
};

/** `"0.5"`, `".5"`, `"-20"`; not `"5."`, `"+5"`, `"1e3"` or `"300ms"`. */
const NUMBER_PATTERN = /^-?(\d+(\.\d+)?|\.\d+)$/;

export const readNumberAttr: AttributeReader<number> = (el, name) => {
  const value = el.getAttribute(name);
  return value !== null && NUMBER_PATTERN.test(value)
    ? Number(value)
    : undefined;
};

export function readEnumAttr<T extends string>(
  allowed: readonly T[],
): AttributeReader<T> {
  const isAllowed = isOneOf(allowed);
  return (el, name) => {
    const value = el.getAttribute(name);
    return isAllowed(value) ? value : undefined;
  };
}

export const readBooleanAttr: AttributeReader<boolean> = (el, name) => {
  const value = el.getAttribute(name);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

export function resolveSetting<T>(source: SettingSource<T>): T {
  if (source.attribute !== undefined) return source.attribute;
  return source.isValid(source.js) ? source.js : source.fallback;
}

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

export function isOneOf<T extends string>(
  allowed: readonly T[],
): (value: unknown) => value is T {
  return (value): value is T =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value);
}
