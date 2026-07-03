import React, { useEffect, useRef, useState } from 'react';
import { derivePaymentPollingState, useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency } from './CommonUI';
import { buildSupportMailto, copyToClipboard } from '../utils/support';
import type { PaymentStatusResult } from '../types';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  Receipt as ReceiptIcon,
  ShieldCheck
} from 'lucide-react';

interface PaymentStatusProps {
  orderId: string;
}

// Screen states. Backend is the source of truth; Paystack callback query params are
// only used to short-circuit an *explicit* user cancel — never to claim success.
type PayScreen =
  | 'checking'
  | 'success'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'already_paid'
  | 'not_found';

// Small copy-to-clipboard chip used for reference / order id.
const CopyChip: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 w-full">
      <span className="text-muted-grey font-medium shrink-0">{label}</span>
      <button
        onClick={async () => {
          if (await copyToClipboard(value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }
        }}
        className="flex items-center gap-1 font-mono text-[10px] text-emerald-strong hover:text-emerald-deep cursor-pointer min-w-0"
        title={`Copy ${label}`}
      >
        <span className="truncate max-w-[150px]">{value}</span>
        {copied ? <Check className="w-3 h-3 shrink-0" /> : <Copy className="w-3 h-3 shrink-0 opacity-60" />}
      </button>
    </div>
  );
};

export const PaymentStatusView: React.FC<PaymentStatusProps> = ({ orderId }) => {
  const {
    orders,
    navigateTo,
    fetchPaymentStatus,
    refreshOrder,
    payOrder,
    vendors: VENDORS,
    locations: PRESET_LOCATIONS,
    deliverySlots: DELIVERY_SLOTS
  } = useMealDirect();

  // Paystack may append ?status=cancelled (or reference=...) on return. We only trust
  // an explicit cancel signal to skip polling; confirmation always comes from backend.
  const hashStr = window.location.hash || '';
  const explicitCancel = /status=cancelled|status=abandoned/.test(hashStr);

  const order = orders.find(o => o.id === orderId);

  // Latest authoritative payment snapshot (reference/amount) for display.
  const [payStatus, setPayStatus] = useState<PaymentStatusResult | null>(null);
  const [screen, setScreen] = useState<PayScreen>(explicitCancel ? 'cancelled' : 'checking');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // If the order is ALREADY settled when the user lands here (e.g. re-opening the
  // link, or refreshing after it confirmed), show "already paid" instead of polling.
  const orderAlreadySettled =
    !!order &&
    !['PENDING_PAYMENT', 'CANCELLED', 'EXPIRED'].includes(order.status);

  // Resolve display fields (backend snapshot wins, else the local order record).
  const vendor = VENDORS.find(v => v.id === order?.vendorId);
  const location = PRESET_LOCATIONS.find(l => l.id === order?.locationId);
  const slot = DELIVERY_SLOTS.find(s => s.id === order?.slotId);
  const reference = payStatus?.reference || order?.paymentReference;
  const amountKobo = payStatus?.paidAmountKobo ?? payStatus?.expectedAmountKobo ?? order?.totalKobo ?? 0;
  const orderNumber = order?.orderNumber;

  useEffect(() => {
    cancelledRef.current = false;

    if (explicitCancel) {
      setScreen('cancelled');
      return;
    }
    if (orderAlreadySettled) {
      setScreen('already_paid');
      // Still refresh once so the reference/amount are current.
      fetchPaymentStatus(orderId).then(s => { if (s && !cancelledRef.current) setPayStatus(s); });
      return;
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 20; // ~40s at 2s — webhook/active-verify usually lands in seconds

    const poll = async () => {
      if (cancelledRef.current) return;
      attempts += 1;

      const status = await fetchPaymentStatus(orderId);
      if (cancelledRef.current) return;
      if (status) setPayStatus(status);

      if (status?.paid) {
        await refreshOrder(orderId);
        if (!cancelledRef.current) setScreen('success');
        return;
      }

      // Distinguish an outright gateway failure from a cancel/expiry.
      if (status?.terminalFail) {
        if (!cancelledRef.current) {
          setScreen(status.rawPaymentStatus === 'failed' ? 'failed' : 'cancelled');
        }
        return;
      }

      const nextState = derivePaymentPollingState({
        paymentStatus: status,
        hasKnownOrder: orders.some(o => o.id === orderId),
        attemptsExhausted: attempts >= MAX_ATTEMPTS,
        explicitCancel: false
      });

      if (nextState === 'success') { if (!cancelledRef.current) setScreen('success'); return; }
      if (nextState === 'cancelled') { if (!cancelledRef.current) setScreen('cancelled'); return; }
      if (nextState === 'not_found') { if (!cancelledRef.current) setScreen('not_found'); return; }
      if (nextState === 'pending_verification') { if (!cancelledRef.current) setScreen('pending'); return; }

      if (attempts >= MAX_ATTEMPTS) {
        if (!cancelledRef.current) setScreen('pending');
        return;
      }
      setTimeout(poll, 2000);
    };

    poll();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, explicitCancel, orderAlreadySettled]);

  // Manual "Verify payment again" — a single authoritative re-check on demand.
  const handleVerifyAgain = async () => {
    setActionError(null);
    setIsVerifying(true);
    try {
      const status = await fetchPaymentStatus(orderId);
      if (status) setPayStatus(status);
      if (status?.paid) {
        await refreshOrder(orderId);
        setScreen('success');
      } else if (status?.terminalFail) {
        setScreen(status.rawPaymentStatus === 'failed' ? 'failed' : 'cancelled');
      } else if (status) {
        setScreen('pending');
      } else {
        setActionError('Could not reach the payment service. Check your connection and try again.');
      }
    } catch (e: any) {
      setActionError(e?.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // "Try payment again" — re-initialize Paystack for the SAME pending order (no new order).
  const handleRetryPayment = async () => {
    setActionError(null);
    setIsRetrying(true);
    try {
      const authUrl = await payOrder(orderId);
      window.location.href = authUrl;
    } catch (e: any) {
      setIsRetrying(false);
      setActionError(e?.message || 'Could not restart payment. Please try again.');
    }
  };

  const supportHref = buildSupportMailto({
    orderId,
    orderNumber,
    paymentReference: reference,
    status: order?.status,
    category: 'Payment issue'
  });

  const viewOrderBtn = (
    <button
      onClick={() => navigateTo(`/orders/${orderId}`)}
      className="w-full py-3.5 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-deep/15"
    >
      <span>View order</span>
      <ArrowRight className="w-4 h-4" />
    </button>
  );

  const viewReceiptBtn = (
    <button
      onClick={() => navigateTo(`/orders/${orderId}/receipt`)}
      className="w-full py-3 bg-neutral-50 hover:bg-neutral-100 border border-emerald-deep/12 text-emerald-strong font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
    >
      <ReceiptIcon className="w-4 h-4" />
      <span>View receipt</span>
    </button>
  );

  const supportBtn = (
    <a
      href={supportHref}
      className="w-full py-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-muted-grey font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
    >
      <HelpCircle className="w-4 h-4" />
      <span>Contact support</span>
    </a>
  );

  const verifyAgainBtn = (
    <button
      onClick={handleVerifyAgain}
      disabled={isVerifying}
      className="w-full py-3 bg-emerald-deep/10 hover:bg-emerald-deep/15 disabled:opacity-50 text-emerald-strong font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
    >
      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      <span>Verify payment again</span>
    </button>
  );

  const retryPaymentBtn = (
    <button
      onClick={handleRetryPayment}
      disabled={isRetrying}
      className="w-full py-3.5 bg-mango-warm hover:bg-amber-400 disabled:opacity-50 text-emerald-strong font-black text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
    >
      {isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
      <span>Try payment again</span>
    </button>
  );

  // Compact reference/order/amount block reused across states.
  const detailBlock = (opts: { showAmount?: boolean } = {}) => (
    <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100 w-full text-xs space-y-2 text-left">
      <CopyChip label="Order ID" value={orderNumber || orderId} />
      <CopyChip label="Payment reference" value={reference} />
      {opts.showAmount && amountKobo > 0 && (
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="text-muted-grey font-medium">Amount paid</span>
          <Currency kobo={amountKobo} className="font-bold text-ink-deep" />
        </div>
      )}
    </div>
  );

  return (
    <AppShell activeTab="orders">
      <div className="max-w-md mx-auto py-12" id="payment_status_container">
        <GlassPanel className="p-8 text-center border-t-4 border-t-emerald-deep relative overflow-hidden">

          {actionError && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-danger font-semibold text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* 1. CHECKING */}
          {screen === 'checking' && (
            <div className="flex flex-col items-center gap-4" id="payment_polling_state">
              <Loader2 className="w-12 h-12 text-emerald-deep animate-spin" />
              <div>
                <h3 className="font-display font-bold text-base text-emerald-strong">Checking your payment</h3>
                <p className="text-[11px] text-muted-grey mt-1 max-w-xs mx-auto leading-relaxed">
                  Confirming with our payment service. This can take a few seconds — please keep this tab open.
                </p>
              </div>
              {detailBlock()}
            </div>
          )}

          {/* 2. SUCCESS */}
          {screen === 'success' && (
            <div className="flex flex-col items-center gap-4" id="payment_success_state">
              <div className="w-12 h-12 rounded-full bg-emerald-deep/10 text-emerald-strong flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-emerald-strong">Payment successful 🎉</h3>
                <p className="text-xs text-muted-grey mt-1 max-w-xs mx-auto">
                  Your order{orderNumber ? <strong> {orderNumber}</strong> : ''} is confirmed and sent to{' '}
                  <strong>{vendor?.name || 'the kitchen'}</strong>.
                </p>
              </div>
              {detailBlock({ showAmount: true })}
              {(location || slot) && (
                <div className="text-[11px] text-muted-grey w-full text-left px-1">
                  {location && <div>Delivery to <strong className="text-emerald-strong">{location.name}</strong></div>}
                  {slot && <div>Slot: <strong className="text-emerald-strong">{slot.label}</strong></div>}
                </div>
              )}
              <div className="flex flex-col gap-2.5 w-full mt-2">
                {viewOrderBtn}
                {viewReceiptBtn}
              </div>
            </div>
          )}

          {/* 3. PENDING — careful, non-committal copy */}
          {screen === 'pending' && (
            <div className="flex flex-col items-center gap-4" id="payment_pending_state">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-warning flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-warning">Payment confirmation pending</h3>
                <p className="text-xs text-muted-grey mt-1 max-w-xs mx-auto leading-relaxed">
                  Payment confirmation is still pending. If you were debited, please do not pay again immediately —
                  we are checking your payment.
                </p>
              </div>
              {detailBlock()}
              <div className="flex flex-col gap-2.5 w-full mt-2">
                {verifyAgainBtn}
                {supportBtn}
                <button
                  onClick={() => navigateTo('/orders')}
                  className="w-full py-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-muted-grey font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Return to orders
                </button>
              </div>
            </div>
          )}

          {/* 4. FAILED / NOT CONFIRMED — no "no funds debited" claim */}
          {screen === 'failed' && (
            <div className="flex flex-col items-center gap-4" id="payment_failed_state">
              <div className="w-12 h-12 rounded-full bg-red-100 text-danger flex items-center justify-center">
                <XCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-danger">We could not confirm this payment</h3>
                <p className="text-xs text-muted-grey mt-1 max-w-xs mx-auto leading-relaxed">
                  If you were debited, do not pay again immediately — contact support with your reference and we will
                  reconcile it.
                </p>
              </div>
              {detailBlock()}
              <div className="flex flex-col gap-2.5 w-full mt-2">
                {retryPaymentBtn}
                {verifyAgainBtn}
                {supportBtn}
                <button
                  onClick={() => navigateTo('/cart')}
                  className="w-full py-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-muted-grey font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Return to cart
                </button>
              </div>
            </div>
          )}

          {/* 5. CANCELLED / ABANDONED */}
          {screen === 'cancelled' && (
            <div className="flex flex-col items-center gap-4" id="payment_cancelled_state">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-warning flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-warning">Payment was not completed</h3>
                <p className="text-xs text-muted-grey mt-1 max-w-xs mx-auto leading-relaxed">
                  You can try again now, or head back to your cart. If you think you were charged, contact support with
                  your reference.
                </p>
              </div>
              {detailBlock()}
              <div className="flex flex-col gap-2.5 w-full mt-2">
                {retryPaymentBtn}
                {supportBtn}
                <button
                  onClick={() => navigateTo('/cart')}
                  className="w-full py-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-muted-grey font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Return to cart
                </button>
              </div>
            </div>
          )}

          {/* 6. ALREADY PAID — no further payment attempt */}
          {screen === 'already_paid' && (
            <div className="flex flex-col items-center gap-4" id="payment_already_paid_state">
              <div className="w-12 h-12 rounded-full bg-emerald-deep/10 text-emerald-strong flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-emerald-strong">This order has already been paid</h3>
                <p className="text-xs text-muted-grey mt-1 max-w-xs mx-auto">
                  No further payment is needed for order{orderNumber ? <strong> {orderNumber}</strong> : ''}.
                </p>
              </div>
              {detailBlock({ showAmount: true })}
              <div className="flex flex-col gap-2.5 w-full mt-2">
                {viewOrderBtn}
                {viewReceiptBtn}
              </div>
            </div>
          )}

          {/* NOT FOUND */}
          {screen === 'not_found' && (
            <div className="flex flex-col items-center gap-4" id="payment_not_found_state">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-warning flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-warning">Order not found</h3>
                <p className="text-xs text-muted-grey mt-1 max-w-xs mx-auto">
                  We couldn't find a payment for this session. If you were charged, contact support with any reference
                  you have.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 w-full mt-2">
                {supportBtn}
                <button
                  onClick={() => navigateTo('/orders')}
                  className="w-full py-3 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Return to orders
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 pt-5 border-t border-emerald-deep/8 flex items-center justify-center gap-1.5 text-[10px] text-muted-grey">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-deep" />
            <span>Payments are processed securely by Paystack.</span>
          </div>
        </GlassPanel>
      </div>
    </AppShell>
  );
};
