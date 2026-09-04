/**
 * Teardown for whatever is currently bound to an element.
 */
type Binding = () => void;

/**
 * One binding per element, keyed weakly so a detached navbar can be collected.
 *
 * `initNavbarAnimation` may be called again — a page transition re-running
 * entry code, say — without the previous handle being kept, and the second
 * call sees the same elements. Without this registry the first binding would
 * stay subscribed to the scroll source forever, invisible and unreachable.
 */
const bindings = new WeakMap<Element, Binding>();

/**
 * Tears down whatever is bound to an element, if anything.
 *
 * The entry is dropped before its teardown runs, so a binding that is being
 * replaced is fully gone by the time the replacement is built.
 *
 * @param element - The navbar element to unbind
 */
export function releaseCurrentBinding(element: Element): void {
  const teardown = bindings.get(element);

  if (!teardown) return;

  bindings.delete(element);

  teardown();
}

/**
 * Records the binding now in force for an element.
 *
 * @param element - The navbar element being bound
 * @param teardown - Undoes everything this binding installed
 */
export function registerBinding(element: Element, teardown: Binding): void {
  releaseCurrentBinding(element);

  bindings.set(element, teardown);
}

/**
 * Releases a binding, but only while it is still the element's current one.
 *
 * A handle superseded by a later `initNavbarAnimation` call has already been
 * torn down; calling `destroy()` on it must not touch the binding that
 * replaced it.
 *
 * @param element - The navbar element the binding was created for
 * @param teardown - The teardown handed to `registerBinding`
 */
export function releaseBinding(element: Element, teardown: Binding): void {
  if (bindings.get(element) !== teardown) return;

  releaseCurrentBinding(element);
}
