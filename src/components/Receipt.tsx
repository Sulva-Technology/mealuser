import React, { useEffect, useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency } from './CommonUI';
import { buildSupportMailto, copyToClipboard, LEGAL_LINKS } from '../utils/support';
import type { PaymentStatusResult } from '../types';
import {
  ArrowLeft,
  Copy,
  Check,
  HelpCircle,
  Share2,
  Printer,
  ShieldCheck,
  Utensils
} from 'lucide-react';

interface ReceiptProps {
  orderId: string;
}

// Human labels for order/payment status shown on the receipt.
const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  PICKED_UP: 'Picked up',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CONFIRMED: 'Completed',
  ESCALATED: 'Under review',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  EXPIRED: 'Expired',
  ADMINISTRATIVELY_COMPLETED: 'Completed'
};

const CopyRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-muted-grey">{label}</span>
      <button
        onClick={async () => {
          if (await copyToClipboard(value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }
        }}
        className="flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-strong hover:text-emerald-deep cursor-pointer min-w-0"
        title={`Copy ${label}`}
      >
        <span className="truncate max-w-[160px]">{value}</span>
        {copied ? <Check className="w-3 h-3 shrink-0" /> : <Copy className="w-3 h-3 shrink-0 opacity-60" />}
      </button>
    </div>
  );
};

// Reusable customer receipt. Renders from the local order record, enriched with the
// authoritative payment snapshot (reference, paid amount, paid-at) fetched on mount.
export const Receipt: React.FC<ReceiptProps> = ({ orderId }) => {
  const {
    orders,
    navigateTo,
    fetchPaymentStatus,
    refreshOrder,
    user,
    vendors: VENDORS,
    campuses: CAMPUSES,
    locations: PRESET_LOCATIONS,
    deliverySlots: DELIVERY_SLOTS
  } = useMealDirect();

  const order = orders.find(o => o.id === orderId);
  const [pay, setPay] = useState<PaymentStatusResult | null>(null);

  useEffect(() => {
    if (!order) { refreshOrder(orderId); return; }
    let cancelled = false;
    fetchPaymentStatus(orderId).then(s => { if (s && !cancelled) setPay(s); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, !!order]);

  if (!order) {
    return (
      <AppShell activeTab="orders">
        <div className="max-w-md mx-auto py-12 text-center">
          <GlassPanel className="p-8">
            <p className="text-sm font-bold text-emerald-strong">Receipt not available yet.</p>
            <p className="text-xs text-muted-grey mt-1">We couldn't find this order on this device.</p>
            <button onClick={() => navigateTo('/orders')} className="mt-4 px-4 py-2 bg-emerald-deep text-white rounded-xl text-xs font-bold cursor-pointer">
              View all orders
            </button>
          </GlassPanel>
        </div>
      </AppShell>
    );
  }

  const vendor = VENDORS.find(v => v.id === order.vendorId);
  const campus = CAMPUSES.find(c => c.id === order.campusId);
  const location = PRESET_LOCATIONS.find(l => l.id === order.locationId);
  const slot = DELIVERY_SLOTS.find(s => s.id === order.slotId);

  const reference = pay?.reference || order.paymentReference;
  const paidAmountKobo = pay?.paidAmountKobo ?? (order.status === 'PENDING_PAYMENT' ? 0 : order.totalKobo);
  const paidAt = pay?.paidAt;
  const isPaid = !!paidAmountKobo && order.status !== 'PENDING_PAYMENT';

  // Server order doesn't carry a service fee separately; derive any residual so the
  // itemised lines always reconcile to the real total.
  const derivedServiceFee = Math.max(
    0,
    order.totalKobo - order.subtotalKobo - order.deliveryFeeKobo
  );

  const supportHref = buildSupportMailto({
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentReference: reference,
    status: order.status,
    category: 'Receipt query'
  });

  const handleShare = async () => {
    const text = `Meal Direct receipt\nOrder ${order.orderNumber}\nReference ${reference || '—'}\nTotal ${(order.totalKobo / 100).toFixed(2)} NGN`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Meal Direct receipt', text }); return; } catch { /* fall through */ }
    }
    await copyToClipboard(text);
  };

  return (
    <AppShell activeTab="orders">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigateTo(`/orders/${orderId}`)}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-deep hover:underline cursor-pointer print:hidden"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to order</span>
        </button>

        <GlassPanel className="p-6 border-t-4 border-t-emerald-deep" id="receipt_card">
          {/* Brand header */}
          <div className="text-center pb-4 border-b border-dashed border-emerald-deep/20">
            <div className="inline-flex items-center gap-1.5 text-emerald-strong font-display font-black text-lg">
              <Utensils className="w-5 h-5 text-emerald-deep" />
              Meal Direct
            </div>
            <p className="text-[10px] text-muted-grey mt-0.5">Payment receipt</p>
            <span className={`inline-block mt-2 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full ${
              isPaid ? 'bg-emerald-deep/10 text-emerald-strong' : 'bg-amber-50 text-warning'
            }`}>
              {isPaid ? 'Paid' : (ORDER_STATUS_LABEL[order.status] || order.status)}
            </span>
          </div>

          {/* Reference block */}
          <div className="py-4 border-b border-dashed border-emerald-deep/20 text-xs">
            <CopyRow label="Order ID" value={order.orderNumber} />
            <CopyRow label="Payment reference" value={reference} />
            <div className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-muted-grey">Payment date</span>
              <span className="font-semibold text-ink-deep">
                {paidAt ? new Date(paidAt).toLocaleString() : new Date(order.createdAt).toLocaleString()}
              </span>
            </div>
            {user?.fullName && (
              <div className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-muted-grey">Customer</span>
                <span className="font-semibold text-ink-deep">{user.fullName}</span>
              </div>
            )}
          </div>

          {/* Fulfilment block */}
          <div className="py-4 border-b border-dashed border-emerald-deep/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-grey">Vendor</span>
              <span className="font-semibold text-ink-deep text-right">{vendor?.name || '—'}</span>
            </div>
            {campus && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-grey">Campus</span>
                <span className="font-semibold text-ink-deep text-right">{campus.name}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-grey">Delivery to</span>
              <span className="font-semibold text-ink-deep text-right max-w-[180px] truncate">{location?.name || '—'}</span>
            </div>
            {slot && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-grey">Slot</span>
                <span className="font-semibold text-ink-deep text-right">{slot.label}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="py-4 border-b border-dashed border-emerald-deep/20">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-grey mb-2.5">Items</h4>
            <div className="space-y-2">
              {order.items.map((it, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-deep truncate">{it.name}</p>
                    <span className="text-[10px] text-muted-grey">
                      {it.quantity} × <Currency kobo={it.priceKobo} />
                    </span>
                  </div>
                  <Currency kobo={it.priceKobo * it.quantity} className="font-bold text-ink-deep shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="py-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-grey">Subtotal</span>
              <Currency kobo={order.subtotalKobo} className="font-semibold text-ink-deep" />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-grey">Delivery fee</span>
              <Currency kobo={order.deliveryFeeKobo} className="font-semibold text-ink-deep" />
            </div>
            {derivedServiceFee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-grey">Service fee</span>
                <Currency kobo={derivedServiceFee} className="font-semibold text-ink-deep" />
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2.5 mt-1 border-t border-emerald-deep/15">
              <span className="font-black text-emerald-strong">{isPaid ? 'Total paid' : 'Total payable'}</span>
              <Currency kobo={order.totalKobo} className="text-base font-black text-emerald-strong" />
            </div>
            <div className="flex justify-between text-[10px] pt-1">
              <span className="text-muted-grey uppercase tracking-wide font-bold">Order status</span>
              <span className="font-bold text-emerald-strong uppercase">{ORDER_STATUS_LABEL[order.status] || order.status}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 print:hidden">
            <button
              onClick={() => navigateTo(`/orders/${orderId}`)}
              className="col-span-2 py-3 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              View order
            </button>
            <button
              onClick={handleShare}
              className="py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-emerald-deep/12 text-emerald-strong font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            <button
              onClick={() => window.print()}
              className="py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-emerald-deep/12 text-emerald-strong font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Save PDF
            </button>
            <a
              href={supportHref}
              className="col-span-2 py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-muted-grey font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Contact support
            </a>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-deep/8 flex items-center justify-center gap-1.5 text-[9px] text-muted-grey">
            <ShieldCheck className="w-3 h-3 text-emerald-deep" />
            <span>Secured by Paystack ·{' '}
              <a href={LEGAL_LINKS.refundPolicy} target="_blank" rel="noopener noreferrer" className="underline">Refund policy</a>
            </span>
          </div>
        </GlassPanel>
      </div>
    </AppShell>
  );
};
