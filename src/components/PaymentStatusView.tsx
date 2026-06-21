import React, { useEffect, useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency } from './CommonUI';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, ArrowRight, HelpCircle } from 'lucide-react';

interface PaymentStatusProps {
  orderId: string;
}

export const PaymentStatusView: React.FC<PaymentStatusProps> = ({ orderId }) => {
  const { orders, navigateTo, fetchPaymentStatus, refreshOrder } = useMealDirect();
  const [loadingState, setLoadingState] = useState<'polling' | 'success' | 'cancelled' | 'not_found'>('polling');

  // Parse custom parameters (Paystack callback may signal explicit cancel)
  const hashStr = window.location.hash || '';
  const isFail = hashStr.includes('status=cancelled');

  // Find target order
  const order = orders.find(o => o.id === orderId);

  useEffect(() => {
    if (isFail) {
      setLoadingState('cancelled');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // ~40s at 2s interval — webhook usually lands within seconds

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      const status = await fetchPaymentStatus(orderId);

      if (cancelled) return;

      if (status === null) {
        // Could be a transient network error or unknown order; keep trying a few times
        if (attempts >= MAX_ATTEMPTS) {
          setLoadingState(orders.some(o => o.id === orderId) ? 'cancelled' : 'not_found');
          return;
        }
      } else if (status.paid) {
        await refreshOrder(orderId);
        if (!cancelled) setLoadingState('success');
        return;
      } else if (status.terminalFail) {
        if (!cancelled) setLoadingState('cancelled');
        return;
      }

      if (attempts >= MAX_ATTEMPTS) {
        if (!cancelled) setLoadingState('cancelled');
        return;
      }

      setTimeout(poll, 2000);
    };

    poll();

    return () => { cancelled = true; };
  }, [orderId, isFail]);

  const handleContinueTrack = () => {
    navigateTo(`/orders/${orderId}`);
  };

  return (
    <AppShell activeTab="orders">
      <div className="max-w-md mx-auto py-12" id="payment_status_container">
        <GlassPanel className="p-8 text-center border-t-4 border-t-emerald-deep relative overflow-hidden">
          {loadingState === 'polling' && (
            <div className="flex flex-col items-center gap-4" id="payment_polling_state">
              <Loader2 className="w-12 h-12 text-emerald-deep animate-spin" />
              <div>
                <h3 className="font-display font-medium text-sm text-emerald-strong">Auditing Remittance Status...</h3>
                <p className="text-[10px] text-muted-grey mt-1">
                  Verifying transaction reference keys with central Paystack webhook dispatch tables. Keep tab open.
                </p>
              </div>
              <span className="text-[9px] text-muted-grey bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-100 font-mono">
                Order ID: {orderId}
              </span>
            </div>
          )}

          {loadingState === 'success' && order && (
            <div className="flex flex-col items-center gap-4" id="payment_success_state">
              <div className="w-12 h-12 rounded-full bg-emerald-deep/10 text-emerald-strong flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-emerald-strong">Payment Verified Clean! 🎉</h3>
                <p className="text-xs text-muted-grey mt-1 max-w-xs mx-auto">
                  Your order <strong>{order.orderNumber}</strong> was approved. Your takeaway is submitted to the kitchen.
                </p>
              </div>

              <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100 w-full text-xs space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-muted-grey font-medium">Payout Total:</span>
                  <span className="font-bold text-ink-deep font-mono">₦{(order.totalKobo / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-grey font-medium">Session Key:</span>
                  <span className="font-mono text-[10px] truncate max-w-[150px] text-emerald-strong">{order.requestId}</span>
                </div>
              </div>

              <button
                onClick={handleContinueTrack}
                className="mt-4 w-full py-3.5 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-deep/15"
                id="continue_track_success"
              >
                <span>Enter Order tracking Timeline</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {loadingState === 'cancelled' && (
            <div className="flex flex-col items-center gap-4" id="payment_fail_state">
              <div className="w-12 h-12 rounded-full bg-red-100 text-danger flex items-center justify-center">
                <XCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-danger">Transaction Cancelled or Failed</h3>
                <p className="text-xs text-muted-grey mt-1 max-w-xs mx-auto">
                  Paystack authorization was declined or aborted by the user. No funds were debited from your student bank.
                </p>
              </div>

              <div className="flex gap-2 w-full mt-4">
                <button
                  onClick={() => navigateTo('/home')}
                  className="flex-1 py-3 bg-neutral-50 hover:bg-neutral-100 text-muted-grey font-bold text-xs rounded-xl cursor-pointer transition"
                >
                  Return to Home
                </button>
                <button
                  onClick={() => navigateTo('/cart')}
                  className="flex-1 py-3 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center justify-center gap-1"
                  id="checkout_retry_btn"
                >
                  Configure Cart
                </button>
              </div>
            </div>
          )}

          {loadingState === 'not_found' && (
            <div className="flex flex-col items-center gap-4" id="payment_not_found_state">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-warning flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-warning">Order Record Not Found</h3>
                <p className="text-xs text-muted-grey mt-1 max-w-xs mx-auto">
                  Could not retrieve a pending payment invoice matches the session ID <code>{orderId}</code>.
                </p>
              </div>

              <button
                onClick={() => navigateTo('/home')}
                className="mt-4 w-full py-3 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          )}

          <div className="mt-8 pt-5 border-t border-emerald-deep/8 flex items-center justify-center gap-1.5 text-[10px] text-muted-grey">
            <HelpCircle className="w-4 h-4 text-emerald-deep" />
            <span>Need checkout refund help? Lodge query on support desk.</span>
          </div>
        </GlassPanel>
      </div>
    </AppShell>
  );
};
