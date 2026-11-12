export type NavMenuOrientation = 'horizontal' | 'vertical';

export type NavMenuDirection = 'ltr' | 'rtl';

export type NavMenuInteraction = 'hover' | 'click';

export type NavMenuOptions = {
  /** Delay before a hovered trigger opens its panel, in ms. */
  delayDuration: number;
  /** Window after a close during which the next open is instant, in ms. */
  skipDelayDuration: number;
  /** Grace period after the pointer leaves before the panel closes, in ms. */
  closeDelay?: number;
  orientation: NavMenuOrientation;
  dir: NavMenuDirection;
  /**
   * What opens a panel with the mouse. Overridden by `data-nav-interaction` on
   * the root. Optional so option objects written before it existed still
   * typecheck; it is always resolved internally.
   */
  interaction?: NavMenuInteraction;
  /** No-op inside the Webflow Designer so panels stay editable in canvas. */
  skipInWebflowEditor: boolean;
  onValueChange?: (value: string | null) => void;
};

/**
 * Internal only — not re-exported: options after defaults are applied.
 * `closeDelay` and `interaction` stay optional on the public `NavMenuOptions`
 * so adding them was not a breaking type change. `interaction` is always
 * resolved, so `pointer.ts` can never read `undefined` as click mode.
 */
export type ResolvedNavMenuOptions = NavMenuOptions & {
  closeDelay: number;
  interaction: NavMenuInteraction;
};

export type InitNavigationMenuOptions = Partial<NavMenuOptions>;

export type NavMenuEntry = {
  item: HTMLElement;
  trigger: HTMLElement;
  value: string;
  content: HTMLElement | null;
};

export type NavMenuRefs = {
  list: HTMLElement | null;
  viewport: HTMLElement | null;
  entries: NavMenuEntry[];
  triggers: HTMLElement[];
  itemValues: string[];
  triggerByValue: Map<string, HTMLElement>;
  valueByTrigger: Map<HTMLElement, string>;
  contentMap: Map<string, HTMLElement>;
  /** Opt-in backdrop; inside or outside the root. */
  overlay: HTMLElement | null;
};

export type NavMenuRenderer = {
  applyState(
    value: string | null,
    previousValue: string | null,
    activeTrigger?: HTMLElement | null,
  ): void;
  /** Mobile card state, so the overlay covers it as well as the panels. */
  setCardOpen(open: boolean): void;
  observeResize(
    getActiveValue: () => string | null,
    getActiveTrigger: () => HTMLElement | null,
  ): NavMenuCleanup;
};

export type NavMenuController = {
  /**
   * The only two state entry points. `setValue` is intentionally not exposed:
   * both of these cancel the pending hover timers, and a caller reaching past
   * them would reintroduce the transition-undone-a-moment-later class of bug.
   */
  open(value: string, trigger?: HTMLElement): void;
  close(): void;
  triggerPointerEnter(value: string, trigger: HTMLElement): void;
  triggerPointerLeave(trigger: HTMLElement): void;
  triggerClick(value: string, trigger: HTMLElement): void;
  contentPointerEnter(): void;
  contentPointerLeave(): void;
  /** Closes the menu and returns the trigger that should regain focus. */
  handleEscape(): HTMLElement | null;
  getActiveValue(): string | null;
  /**
   * Whether `value` is open because pointer hover opened it. Clears the
   * mark, so only the first click after a hover-open is swallowed.
   */
  consumeHoverOpen(value: string): boolean;
  /** The trigger that opened the active panel, for focus return. */
  getActiveTrigger(): HTMLElement | null;
  destroy(): void;
};

export type NavMenuCleanup = () => void;

/** Shared argument bag for the event-attaching modules. */
export type NavMenuContext = {
  root: HTMLElement;
  refs: NavMenuRefs;
  controller: NavMenuController;
  renderer: NavMenuRenderer;
  cleanups: NavMenuCleanup[];
  /**
   * Escape consumers tried, in order, when no panel is open. Each returns the
   * element to refocus if it consumed the key, else null. Lets the keyboard
   * module own Escape outright instead of others inferring from
   * `defaultPrevented` which listener ran first.
   */
  escapeFallbacks: Array<() => HTMLElement | null>;
  options: ResolvedNavMenuOptions;
  /** Per-instance id prefix, so generated ids never collide across roots. */
  idPrefix: string;
  /**
   * Extra teardown run by the shared dismiss paths in pointer.ts: `outside` on a
   * pointerdown/focusin beyond the root, `link` on a followed click on a link
   * inside it. Lets the mobile card close with the panel without listening twice.
   */
  dismissHooks: { outside: Array<() => void>; link: Array<() => void> };
};

export type NavigationMenuInstance = {
  open(value: string): void;
  close(): void;
  destroy(): void;
};
