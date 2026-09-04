type ScrollSubscriber = (scrollY: number) => void;

/**
 * Each subscription is wrapped in its own record so that two subscriptions
 * sharing a function reference stay distinct entries. Holding the functions
 * directly would collapse them into one, and unsubscribing either would silence
 * both.
 */
type ScrollSubscription = { notify: ScrollSubscriber };

const subscriptions = new Set<ScrollSubscription>();
let isListening = false;

/**
 * Fans the scroll position out to every subscriber.
 */
function handleScroll(): void {
  const { scrollY } = window;

  for (const subscription of Array.from(subscriptions)) {
    subscription.notify(scrollY);
  }
}

/**
 * Subscribes to the shared passive scroll listener.
 *
 * Exactly one `scroll` listener is registered on `window` regardless of how
 * many subscribers there are. It is attached on the first subscription and
 * removed once the last subscriber unsubscribes.
 *
 * @param subscriber - Called with `window.scrollY` on every scroll event
 * @returns Unsubscribe function
 */
export function subscribeToScroll(subscriber: ScrollSubscriber): () => void {
  const subscription: ScrollSubscription = { notify: subscriber };

  subscriptions.add(subscription);

  if (!isListening) {
    window.addEventListener('scroll', handleScroll, { passive: true });
    isListening = true;
  }

  return () => {
    if (!subscriptions.delete(subscription)) return;
    if (subscriptions.size > 0 || !isListening) return;

    window.removeEventListener('scroll', handleScroll);
    isListening = false;
  };
}
