// Paystack Inline (popup) checkout. Keeps the customer INSIDE the PWA while they
// pay, instead of a full-page redirect to checkout.paystack.com. The redirect
// flow forced a cart-stash/restore dance and left users polling for minutes on
// return; the popup's onSuccess fires the moment the charge completes, and the
// payment-status view's first fetch then active-verifies against Paystack.
//
// The hosted authorizationUrl redirect is kept as a hard fallback for browsers
// where the inline script cannot load (blocked CDN, offline-first cache miss).

const INLINE_SCRIPT_SRC = 'https://js.paystack.co/v2/inline.js';
const SCRIPT_LOAD_TIMEOUT_MS = 8000;

export interface PaystackPopupCallbacks {
  onSuccess?: () => void;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
}

interface PaystackPopInstance {
  resumeTransaction: (accessCode: string, callbacks?: PaystackPopupCallbacks) => void;
}

declare global {
  interface Window {
    PaystackPop?: new () => PaystackPopInstance;
  }
}

let scriptLoader: Promise<boolean> | null = null;

/** Load the Paystack inline script once. Resolves false (never rejects) on failure. */
export function loadPaystackInline(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.PaystackPop) return Promise.resolve(true);
  scriptLoader ??= new Promise<boolean>(resolve => {
    const script = document.createElement('script');
    script.src = INLINE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.PaystackPop));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
    setTimeout(() => resolve(false), SCRIPT_LOAD_TIMEOUT_MS);
  });
  return scriptLoader;
}

export interface PaymentLaunch {
  authorizationUrl: string;
  accessCode?: string;
}

/**
 * Open Paystack checkout for an initialized transaction. Tries the inline popup
 * first; falls back to the hosted-page redirect. Returns which path was taken —
 * 'popup' means the caller should navigate to the payment-status view themselves
 * (the popup overlays it); 'redirect' means the page is already navigating away.
 */
export async function launchPaystackCheckout(
  launch: PaymentLaunch,
  callbacks: PaystackPopupCallbacks = {}
): Promise<'popup' | 'redirect'> {
  if (launch.accessCode) {
    const loaded = await loadPaystackInline();
    if (loaded && window.PaystackPop) {
      try {
        new window.PaystackPop().resumeTransaction(launch.accessCode, callbacks);
        return 'popup';
      } catch {
        // fall through to redirect
      }
    }
  }
  window.location.href = launch.authorizationUrl;
  return 'redirect';
}
