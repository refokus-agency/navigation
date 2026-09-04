import { createCompressBehaviour } from './behaviours/compress.ts';
import { createHideBehaviour } from './behaviours/hide.ts';
import { NAVBAR_CONFIG } from './config.ts';
import {
  registerBinding,
  releaseBinding,
  releaseCurrentBinding,
} from './registry.ts';
import { subscribeToScroll } from './scroll-source.ts';
import type {
  NavbarAnimationHandle,
  NavbarAnimationOptions,
  NavbarBehaviour,
  NavbarBehaviourName,
} from './types.ts';

export type {
  NavbarAnimationHandle,
  NavbarAnimationOptions,
  NavbarBehaviourName,
} from './types.ts';

export type InitNavbarAnimationOptions = Partial<NavbarAnimationOptions>;

const DEFAULT_OPTIONS: NavbarAnimationOptions = {
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
  compressBreakpoint: NAVBAR_CONFIG.compress.breakpoint,
};

/**
 * Takes a caller-supplied number only when it is one worth using.
 *
 * `??` alone lets `NaN` through, and every comparison against `NaN` is false.
 * A `NaN` breakpoint would therefore pass the `window.innerWidth <` check at
 * every viewport width and register compress everywhere — including the mobile
 * widths the breakpoint exists to stay out of, where Webflow's own Navbar takes
 * over. That is the opposite of the failure the caller would expect.
 *
 * @param value - Caller-supplied value
 * @param fallback - Default to fall back to
 * @returns The value when it is a finite number, the fallback otherwise
 */
function resolveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Merges caller options over the defaults.
 *
 * Done per key rather than by spreading, because a spread lets an explicitly
 * `undefined` property overwrite the default with nothing — a consumer passing
 * `{ compressBreakpoint: config.breakpoint }` where that value happens to be
 * undefined would otherwise get a breakpoint no viewport can satisfy, and
 * compress would silently never run.
 *
 * @param options - Caller-supplied options
 * @returns Fully resolved options
 */
function resolveOptions(
  options: InitNavbarAnimationOptions,
): NavbarAnimationOptions {
  return {
    animationDuration: resolveNumber(
      options.animationDuration,
      DEFAULT_OPTIONS.animationDuration,
    ),
    animationEasing: options.animationEasing ?? DEFAULT_OPTIONS.animationEasing,
    compressBreakpoint: resolveNumber(
      options.compressBreakpoint,
      DEFAULT_OPTIONS.compressBreakpoint,
    ),
  };
}

/**
 * Reads the behaviour a navbar element opts into.
 *
 * An absent, empty, or unrecognised attribute resolves to `none`, which leaves
 * the element completely alone.
 *
 * @param element - The navbar element
 * @returns The resolved behaviour name
 */
function resolveBehaviourName(element: Element): NavbarBehaviourName {
  const value = element.getAttribute(NAVBAR_CONFIG.attributes.behaviour);

  if (value === null) return 'none';

  const normalized = value.trim().toLowerCase();

  if (normalized === 'hide') return 'hide';
  if (normalized === 'compress') return 'compress';

  if (normalized !== '') {
    console.warn(
      `[r-navbar] Unrecognised ${NAVBAR_CONFIG.attributes.behaviour}="${value}". Expected "hide" or "compress". Falling back to no behaviour.`,
    );
  }

  return 'none';
}

/**
 * Builds the behaviour a navbar element asked for.
 *
 * @param element - The navbar element
 * @param options - Resolved animation options
 * @returns The behaviour, or null when the element opted out
 */
function createBehaviour(
  element: Element,
  options: NavbarAnimationOptions,
): NavbarBehaviour | null {
  switch (resolveBehaviourName(element)) {
    case 'hide':
      return createHideBehaviour(element, options);
    case 'compress':
      return createCompressBehaviour(element, options);
    default:
      return null;
  }
}

/**
 * Initializes the navbar animation system.
 *
 * Every `[r-navbar]` element is inspected independently and gets its own
 * behaviour, selected by its `r-navbar-behaviour` attribute. Elements without
 * the attribute are left untouched.
 *
 * An element already bound by an earlier call is rebound rather than bound a
 * second time: its previous behaviour is torn down first. Re-initializing
 * without keeping the old handle — a page transition re-running entry code,
 * say — therefore replaces the binding instead of stacking another one on top
 * of it, and the superseded handle's `destroy()` becomes a no-op for that
 * element.
 *
 * The return value reports only whether a `[r-navbar]` element exists, so a
 * truthy handle does not mean anything is animating: elements can all have
 * opted out. That case — navbars present, none bound — warns, because it is
 * otherwise silent and is what an upgrade from a version predating the
 * behaviour attribute looks like.
 *
 * @param options - Animation options
 * @returns A handle exposing `destroy()`, or `false` when no navbar was found
 */
export function initNavbarAnimation(
  options: InitNavbarAnimationOptions = {},
): NavbarAnimationHandle | false {
  const navbarElements = document.querySelectorAll(
    NAVBAR_CONFIG.selectors.navbar,
  );

  if (!navbarElements.length) return false;

  const resolvedOptions = resolveOptions(options);

  const bindings: Array<{ element: Element; teardown: () => void }> = [];

  for (const element of Array.from(navbarElements)) {
    releaseCurrentBinding(element);

    const behaviour = createBehaviour(element, resolvedOptions);

    if (!behaviour) continue;

    const unsubscribe = subscribeToScroll(behaviour.onScroll);
    const teardown = (): void => {
      unsubscribe();
      behaviour.destroy();
    };

    bindings.push({ element, teardown });
    registerBinding(element, teardown);
  }

  if (!bindings.length) {
    console.warn(
      `[r-navbar] Found ${navbarElements.length} ${NAVBAR_CONFIG.selectors.navbar} element(s), but none opted into a behaviour. Add ${NAVBAR_CONFIG.attributes.behaviour}="hide" or ${NAVBAR_CONFIG.attributes.behaviour}="compress" to the ones that should animate.`,
    );
  }

  return {
    destroy(): void {
      for (const { element, teardown } of bindings.splice(0)) {
        releaseBinding(element, teardown);
      }
    },
  };
}
