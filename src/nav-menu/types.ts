export type NavMenuOrientation = 'horizontal' | 'vertical';

export type NavMenuDirection = 'ltr' | 'rtl';

export type NavMenuOptions = {
  /** Delay before a hovered trigger opens its panel, in ms. */
  delayDuration: number;
  /** Window after a close during which the next open is instant, in ms. */
  skipDelayDuration: number;
  orientation: NavMenuOrientation;
  dir: NavMenuDirection;
  /** No-op inside the Webflow Designer so panels stay editable in canvas. */
  skipInWebflowEditor: boolean;
  onValueChange?: (value: string | null) => void;
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
  applyState(value: string | null, previousValue: string | null): void;
  observeResize(getActiveValue: () => string | null): NavMenuCleanup;
};

export type NavMenuController = {
  setValue(value: string | null): void;
  /** Closes now and cancels a pending hover-open. */
  close(): void;
  triggerPointerEnter(value: string, trigger: HTMLElement): void;
  triggerPointerLeave(trigger: HTMLElement): void;
  triggerClick(value: string, trigger: HTMLElement): void;
  contentPointerEnter(): void;
  contentPointerLeave(): void;
  /** Closes the menu and returns the trigger that should regain focus. */
  handleEscape(): HTMLElement | null;
  getActiveValue(): string | null;
  destroy(): void;
};

export type NavMenuCleanup = () => void;

/** Shared argument bag for the event-attaching modules. */
export type NavMenuContext = {
  root: HTMLElement;
  refs: NavMenuRefs;
  controller: NavMenuController;
  cleanups: NavMenuCleanup[];
};

export type NavigationMenuInstance = {
  open(value: string): void;
  close(): void;
  destroy(): void;
};
