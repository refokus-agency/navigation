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
};

export type NavMenuRenderer = {
  applyState(
    value: string | null,
    previousValue: string | null,
    activeTrigger?: HTMLElement | null,
  ): void;
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
  /** The trigger that opened the active panel, for focus return. */
  getActiveTrigger(): HTMLElement | null;
  destroy(): void;
};

export type NavMenuCleanup = () => void;

/** Where slot panels currently sit; moves are structural, never animated. */
export type NavMenuPanels = {
  /** Moves slot panels into the shared viewport (desktop placement). */
  toViewport(): void;
  /** Moves slot panels back into their item, hidden until the next open. */
  inline(): void;
};

/** Shared argument bag for the event-attaching modules. */
export type NavMenuContext = {
  root: HTMLElement;
  refs: NavMenuRefs;
  controller: NavMenuController;
  cleanups: NavMenuCleanup[];
  panels: NavMenuPanels;
  options: ResolvedNavMenuOptions;
  /** Per-instance id prefix, so generated ids never collide across roots. */
  idPrefix: string;
};

export type NavigationMenuInstance = {
  open(value: string): void;
  close(): void;
  destroy(): void;
};
