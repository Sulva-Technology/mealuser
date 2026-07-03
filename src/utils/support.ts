// Customer-facing support + legal entry points.
// Single source of truth so every screen (payment status, order detail, receipt,
// checkout error, profile) links to the same places and prefills the same context.

export const LEGAL_LINKS = {
  terms: 'https://mealdirect.com/terms',
  privacy: 'https://mealdirect.com/privacy',
  // NOTE: /refund-policy must exist on the marketing site. If it 404s, point this
  // at /terms#refunds until the standalone page ships.
  refundPolicy: 'https://mealdirect.com/refund-policy',
  helpCenter: 'https://mealdirect.com/support'
} as const;

// Support inbox. Using a mailto keeps support reachable with zero backend work;
// swap for a hosted ticket URL later without touching call sites.
export const SUPPORT_EMAIL = 'support@mealdirect.com';

export interface SupportContext {
  orderId?: string;
  orderNumber?: string;
  paymentReference?: string;
  status?: string;
  category?: string;
}

// Build a mailto: link that prefills the order/payment context so the customer
// doesn't have to hunt for reference numbers when reporting a payment/order issue.
export function buildSupportMailto(ctx: SupportContext = {}): string {
  const subjectBits = ['Meal Direct support'];
  if (ctx.category) subjectBits.push(ctx.category);
  if (ctx.orderNumber || ctx.orderId) subjectBits.push(`order ${ctx.orderNumber || ctx.orderId}`);
  const subject = subjectBits.join(' — ');

  const lines = [
    'Hi Meal Direct support,',
    '',
    'I need help with the following:',
    '',
    ctx.category ? `Issue: ${ctx.category}` : null,
    ctx.orderNumber ? `Order number: ${ctx.orderNumber}` : null,
    ctx.orderId ? `Order ID: ${ctx.orderId}` : null,
    ctx.paymentReference ? `Payment reference: ${ctx.paymentReference}` : null,
    ctx.status ? `Current status: ${ctx.status}` : null,
    '',
    '(Please describe what happened here.)'
  ].filter(Boolean);

  const body = lines.join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Best-effort clipboard copy that resolves to whether it succeeded, so callers can
// flip a "Copied" affordance without throwing on browsers that block clipboard.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
