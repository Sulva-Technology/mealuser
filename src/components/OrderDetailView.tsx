import React, { useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency, LoadingSkeleton } from './CommonUI';
import { DeliveredAnimation } from './DeliveredAnimation';
import { LiveTrackerPip } from './LiveTrackerPip';
import {
  ArrowLeft,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  Copy,
  Check,
  Send,
  Star,
  Play,
  HelpCircle,
  ClipboardList
} from 'lucide-react';
import { Escalation, OrderStatus } from '../types';

interface OrderDetailProps {
  orderId: string;
}

export const OrderDetailView: React.FC<OrderDetailProps> = ({ orderId }) => {
  const {
    orders,
    navigateTo,
    confirmDelivery,
    cancelOrder,
    progressOrderStatus,
    escalations,
    createEscalation,
    reviews,
    createReview,
    isOnline,
    locations: PRESET_LOCATIONS,
    deliverySlots: DELIVERY_SLOTS,
    vendors: VENDORS,
    menuItems: MENU_ITEMS
  } = useMealDirect();

  // URL state checking
  const hash = window.location.hash || '';
  const isEscalatePage = hash.endsWith('/escalate');
  const isReviewPage = hash.endsWith('/review');

  // Copy state
  const [copied, setCopied] = useState(false);

  // Form states for support escalations
  const [escalateCategory, setEscalateCategory] = useState<Escalation['category']>('NON_DELIVERY');
  const [escalateDescription, setEscalateDescription] = useState('');
  const [escalateSubmitted, setEscalateSubmitted] = useState(false);

  // Form states for reviews
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewHoverStar, setReviewHoverStar] = useState<number | null>(null);

  // Celebration state for delivered status trigger
  const [showDeliveredCelebration, setShowDeliveredCelebration] = useState(false);
  
  // Find order
  const order = orders.find(o => o.id === orderId);

  // Status Change observation
  const [lastStatus, setLastStatus] = useState<string>(order ? order.status : '');

  React.useEffect(() => {
    if (order && order.status === 'DELIVERED' && lastStatus !== 'DELIVERED') {
      setShowDeliveredCelebration(true);
    }
    if (order) {
      setLastStatus(order.status);
    }
  }, [order?.status, lastStatus]);

  if (!order) {
    return (
      <AppShell activeTab="orders">
        <div className="text-center py-12 bg-white rounded-2xl border border-red-200">
          <ShieldAlert className="w-12 h-12 text-danger mx-auto mb-3" />
          <p className="text-sm font-bold text-emerald-strong">Order record '{orderId}' is not found.</p>
          <button onClick={() => navigateTo('/orders')} className="mt-4 px-4 py-2 bg-emerald-deep text-white rounded-xl text-xs font-bold cursor-pointer">
            View All Orders
          </button>
        </div>
      </AppShell>
    );
  }

  const activeVendor = VENDORS.find(v => v.id === order.vendorId);
  const activeLocation = PRESET_LOCATIONS.find(l => l.id === order.locationId);
  const activeSlot = DELIVERY_SLOTS.find(s => s.id === order.slotId);

  // Check related support tickets
  const relatedEscalations = escalations.filter(e => e.orderId === orderId);

  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmReceipt = () => {
    confirmDelivery(order.id);
  };

  const handleCancelOrder = () => {
    cancelOrder(order.id);
    setShowCancelModal(false);
    setTimeout(() => {
      navigateTo('/orders');
    }, 1000);
  };

  const handleRefreshStatus = () => {
    progressOrderStatus(order.id);
  };

  const handleSubmitEscalation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateDescription.trim()) return;

    createEscalation(order.id, escalateCategory, escalateDescription);
    setEscalateSubmitted(true);
    setTimeout(() => {
      navigateTo(`/orders/${orderId}`);
    }, 1200);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    createReview(order.id, reviewRating, reviewComment);
    setReviewSubmitted(true);
    setTimeout(() => {
      navigateTo(`/orders/${orderId}`);
    }, 1200);
  };

  // RENDER ESCALATING FORM SCREEN
  if (isEscalatePage) {
    return (
      <AppShell activeTab="orders">
        <button
          onClick={() => navigateTo(`/orders/${orderId}`)}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-deep hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tracker Details</span>
        </button>

        <section className="mb-6">
          <h2 className="font-display font-black text-2xl text-emerald-strong">Report Order Issue</h2>
          <p className="text-xs text-muted-grey">Lodge structured query to the Venite Dispatch Operations center.</p>
        </section>

        {escalateSubmitted ? (
          <GlassPanel className="p-8 text-center border-t-4 border-t-red-500 max-w-md mx-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-strong mx-auto mb-4 animate-bounce" />
            <h3 className="font-display font-bold text-base text-emerald-strong">Ticket Logged Securely ✅</h3>
            <p className="text-xs text-muted-grey mt-1">Our helpdesk manager was notified. apology logs are processing. Standby.</p>
          </GlassPanel>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="escalation_form_wrapper">
            <form onSubmit={handleSubmitEscalation} className="md:col-span-2 space-y-6">
              <GlassPanel className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-muted-grey block mb-1.5 uppercase">Issue Classification Category</label>
                    <select
                      value={escalateCategory}
                      onChange={(e) => setEscalateCategory(e.target.value as any)}
                      className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-deep cursor-pointer"
                    >
                      <option value="NON_DELIVERY">Non-Delivery (Takeaway has not arrived at terminal desk)</option>
                      <option value="INCOMPLETE_OR_WRONG_FOOD">Incomplete or Incorrect items found in box</option>
                      <option value="QUALITY">Quality / Cold temperature issues</option>
                      <option value="PACKAGING">Packaging seal / Spoons missing</option>
                      <option value="DELAY">Unacceptable Dispatch Delay</option>
                      <option value="OTHER">Other general campus logistics query</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-grey block mb-1.5 uppercase">Lodge Description Details</label>
                    <textarea
                      placeholder="Be specific. Incomplete orders undergo camera inspection at the meal kitchen before credit resolution..."
                      rows={4}
                      value={escalateDescription}
                      onChange={(e) => setEscalateDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-deep resize-none leading-relaxed"
                      required
                    />
                  </div>
                </div>
              </GlassPanel>

              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-4 bg-danger hover:bg-red-700 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-lg shadow-red-200 flex items-center justify-center gap-1"
                id="submit_escalate_form"
              >
                <Send className="w-4 h-4" />
                Submit support ticket
              </button>
            </form>

            {/* Context parameters sidebar card */}
            <div>
              <GlassPanel className="p-5 bg-neutral-50/50 border border-emerald-deep/10">
                <h4 className="font-display font-bold text-xs text-emerald-strong mb-3">Order Context details</h4>
                
                <div className="space-y-4 text-xs grayscale-[30%] opacity-80">
                  <div>
                    <span className="text-[9px] text-muted-grey block uppercase font-bold">Takeway Code</span>
                    <span className="font-mono font-bold text-emerald-strong">{order.orderNumber}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-grey block uppercase font-bold">Kitchen Partner</span>
                    <span className="font-bold text-ink-deep">{activeVendor?.name}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-grey block uppercase font-bold">Flat remitted</span>
                    <Currency kobo={order.totalKobo} className="font-mono font-bold text-ink-deep" />
                  </div>
                </div>
              </GlassPanel>
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  // RENDER GUEST REVIEW FORM SCREEN
  if (isReviewPage) {
    return (
      <AppShell activeTab="orders">
        <button
          onClick={() => navigateTo(`/orders/${orderId}`)}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-deep hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tracker Details</span>
        </button>

        <section className="mb-6">
          <h2 className="font-display font-black text-2xl text-emerald-strong font-bold">Rate Meal & Kitchen</h2>
          <p className="text-xs text-muted-grey">Your reviews grade partner scorecards directly for campus dispatch.</p>
        </section>

        {reviewSubmitted ? (
          <GlassPanel className="p-8 text-center border-t-4 border-t-mango-warm max-w-md mx-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-strong mx-auto mb-4 animate-bounce" />
            <h3 className="font-display font-bold text-base text-emerald-strong">Review Logged! ⭐</h3>
            <p className="text-xs text-muted-grey mt-1">Thank you. Your feedback inspires launch kitchens.</p>
          </GlassPanel>
        ) : (
          <div className="max-w-md mx-auto">
            <form onSubmit={handleSubmitReview} className="space-y-6">
              <GlassPanel className="p-6">
                {/* Custom Stars Selection HUD */}
                <div className="text-center mb-6">
                  <span className="text-[10px] font-bold text-muted-grey block mb-2 uppercase">Select Star Rating</span>
                  
                  <div className="flex items-center justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map(starNum => {
                      const isLit = reviewHoverStar !== null ? (starNum <= reviewHoverStar) : (starNum <= reviewRating);
                      return (
                        <button
                          key={starNum}
                          type="button"
                          onMouseEnter={() => setReviewHoverStar(starNum)}
                          onMouseLeave={() => setReviewHoverStar(null)}
                          onClick={() => setReviewRating(starNum)}
                          className="p-1 cursor-pointer transition transform active:scale-90"
                          id={`star_selector_${starNum}`}
                        >
                          <Star className={`w-8 h-8 transition duration-150 ${
                            isLit
                              ? 'fill-mango-warm stroke-mango-warm text-mango-warm scale-105'
                              : 'text-neutral-300 hover:text-mango-warm'
                          }`} />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[11px] font-bold block mt-2 text-emerald-strong uppercase tracking-wide">
                    {reviewRating === 1 && '1/5 Poor Hygiene / Taste'}
                    {reviewRating === 2 && '2/5 Below Expectations'}
                    {reviewRating === 3 && '3/5 Tolerable and Moderate'}
                    {reviewRating === 4 && '4/5 Very Delicious'}
                    {reviewRating === 5 && '5/5 Outstanding Meal & Packaging'}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-grey block mb-1.5 uppercase">Write Comments feedback</label>
                  <textarea
                    placeholder="Describe packaging quality, food temperature, spice ratios, or spoons accuracy..."
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-deep resize-none leading-relaxed"
                  />
                </div>
              </GlassPanel>

              <button
                type="submit"
                className="w-full py-4.5 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer shadow-emerald-deep/15 active:scale-95 transition"
                id="submit_review_form"
              >
                Log Partner Review
              </button>
            </form>
          </div>
        )}
      </AppShell>
    );
  }

  // STANDARD HIGH FIDELITY TRACKER DETAILS RENDER
  return (
    <AppShell activeTab="orders">
      {showDeliveredCelebration && (
        <DeliveredAnimation
          orderNumber={order.orderNumber}
          onDismiss={() => setShowDeliveredCelebration(false)}
        />
      )}
      <button
        onClick={() => navigateTo('/orders')}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-deep hover:underline cursor-pointer"
        id="back-to-orders-list"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dispatch Log</span>
      </button>

      {/* 1. Header order HUD bar */}
      <section className="mb-6" id="order_hud">
        <GlassPanel className="p-5 border-l-4 border-l-mango-warm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono font-bold text-emerald-strong bg-emerald-deep/5 px-2 py-0.5 rounded border border-emerald-deep/8 select-all">
                {order.orderNumber}
              </span>
              <button
                onClick={handleCopyOrderNumber}
                className="text-[10px] bg-neutral-100 hover:bg-neutral-200 hover:text-emerald-deep text-muted-grey p-1 rounded-md transition flex items-center gap-0.5 cursor-pointer border border-neutral-200"
                title="Copy order ID number"
                id="copy_order_id_btn"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-strong" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[10px] text-muted-grey mt-1.5">Submitted: {new Date(order.createdAt).toLocaleDateString()} • Dispatch terminal desk fallback lookup</p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[9px] text-muted-grey block uppercase font-bold">Remitted checkout total:</span>
            <Currency kobo={order.totalKobo} className="text-base font-black text-emerald-strong select-all" />
          </div>
        </GlassPanel>

        {/* Picture in Picture Live Tracker Widget */}
        <LiveTrackerPip order={order} />
      </section>

      {/* 2. Live status refresh — pulls the latest authoritative status from the backend */}
      {['CONFIRMED', 'CANCELLED', 'REFUNDED'].indexOf(order.status) === -1 && (
        <section className="mb-6" id="status_refresh_box">
          <div className="bg-emerald-deep/5 border border-emerald-deep/12 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-deep/10 text-emerald-strong flex items-center justify-center font-display font-medium text-xs scale-90">
                ★
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-strong">Live Order Status</h4>
                <p className="text-[9px] text-muted-grey mt-0.5">Status updates automatically. Tap refresh to check for the latest dispatch update now.</p>
              </div>
            </div>

            <button
              onClick={handleRefreshStatus}
              disabled={!isOnline}
              className="px-4 py-2 bg-emerald-strong hover:bg-emerald-deep disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] rounded-xl flex items-center gap-1 cursor-pointer transition active:scale-95 shadow-xs"
              id="refresh_status_btn"
            >
              <Play className="w-3 h-3 text-mango-warm fill-mango-warm" />
              <span>Refresh Status</span>
            </button>
          </div>
        </section>
      )}

      {/* 3. Render tracking timeline list */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6" id="order_tracking_details_stage">
        {/* Left segments tracking timeline */}
        <div className="md:col-span-2 space-y-6">
          <GlassPanel className="p-6">
            <h3 className="font-display font-bold text-sm text-emerald-strong mb-6 flex items-center gap-1.5">
              <Clock className="w-4.5 h-4.5 text-emerald-deep" />
              Real-Time Dispatch Timeline
            </h3>

            {/* Custom dynamic timeline stack */}
            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-100">
              {order.statusHistory.slice().reverse().map((hist, histIdx) => {
                const isLatest = histIdx === 0;
                
                return (
                  <div key={histIdx} className="flex gap-4 relative animate-fade-in">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border z-10 ${
                      isLatest
                        ? 'bg-emerald-deep text-white border-emerald-strong shadow shadow-emerald-deep/20 scale-105'
                        : 'bg-white text-muted-grey border-neutral-200'
                    }`}>
                      <span className="text-[10px]">{isLatest ? '★' : '•'}</span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className={`text-xs font-bold leading-normal ${isLatest ? 'text-emerald-strong text-sm' : 'text-neutral-500'}`}>
                          {hist.title}
                        </h4>
                        <span className="text-[9px] text-muted-grey font-mono">{new Date(hist.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <p className="text-[10px] text-muted-grey mt-1 leading-relaxed">{hist.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Delivery Confirmation Gateway trigger */}
            {order.status === 'DELIVERED' && (
              <div className="mt-8 pt-6 border-t border-emerald-deep/8 text-center bg-emerald-deep/5 -mx-6 -mb-6 p-6 rounded-b-2xl animate-fade-in" id="confirm_receipt_gateway">
                <CheckCircle2 className="w-10 h-10 text-emerald-deep mx-auto mb-3 animate-pulse" />
                <h4 className="text-xs font-bold text-emerald-strong">Takeaway Arrived at Destination Desk Terminal</h4>
                <p className="text-[10px] text-muted-grey max-w-sm mx-auto mt-1 leading-relaxed">
                  The dispatcher has marked your lunch/dinner batch as delivered. Please verify packaging seals and click below to finalize.
                </p>

                <button
                  onClick={handleConfirmReceipt}
                  className="mt-4 px-6 py-3 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl cursor-pointer transition shadow shadow-emerald-deep/15 active:scale-95 inline-flex items-center gap-1.5"
                  id="confirm_delivery_action_btn"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Dispatch Receipt</span>
                </button>
              </div>
            )}
          </GlassPanel>

          {/* Related Support Logs case if active */}
          {relatedEscalations.length > 0 && (
            <GlassPanel className="p-6 border-t-[4px] border-t-red-500">
              <h3 className="font-display font-bold text-sm text-danger mb-4 flex items-center gap-1.5" id="related_support_cases">
                <ShieldAlert className="w-4.5 h-4.5 text-danger" />
                Active Support Ticket Logs
              </h3>

              <div className="space-y-4">
                {relatedEscalations.map((esc, eIdx) => (
                  <div key={eIdx} className="bg-red-50/40 border border-red-100 p-4 rounded-xl text-xs flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-red-100/60 pb-2">
                      <span className="font-bold text-danger">Issue: {esc.category.replace(/_/g, ' ')}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${esc.status === 'RESOLVED' ? 'bg-emerald-deep/10 text-emerald-strong' : 'bg-red-100 text-red-700 animate-pulse'}`}>
                        {esc.status}
                      </span>
                    </div>
                    <p className="text-muted-grey text-[11px] leading-relaxed italic">"{esc.description}"</p>
                    {esc.replyMessage && (
                      <div className="mt-2 bg-white/70 p-3 rounded-lg border border-neutral-100 text-[10px] text-emerald-strong leading-normal">
                        <strong>Lead Agent Resolution Response:</strong> {esc.replyMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}

          {/* Itemized summary list */}
          <GlassPanel className="p-6">
            <h3 className="font-display font-bold text-sm text-emerald-strong mb-4">Packaged takeaways Details</h3>

            <div className="divide-y divide-emerald-deep/6">
              {order.items.map((it, iIdx) => (
                <div key={iIdx} className="py-3.5 first:pt-0 last:pb-0 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-emerald-strong truncate">{it.name}</p>
                      <span className="text-[10px] text-muted-grey block mt-0.5">Plastic Spoons: {it.spoonsCount} • Quantity: {it.quantity}x</span>
                    </div>
                    <Currency kobo={it.priceKobo * it.quantity} className="font-mono text-ink-deep font-bold shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          {order.specialInstructions && (
            <GlassPanel className="p-6 border-l-4 border-l-amber-500 bg-amber-500/5 animate-fade-in">
              <h3 className="font-display font-bold text-sm text-emerald-strong mb-3 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Special Instructions</span>
              </h3>
              <p className="text-xs text-[#2A3B34] leading-relaxed font-semibold bg-white/80 p-3.5 rounded-xl border border-emerald-deep/10 shadow-xs whitespace-pre-wrap">
                {order.specialInstructions}
              </p>
            </GlassPanel>
          )}
        </div>

        {/* Right Segments Meta panel */}
        <div className="space-y-6">
          <GlassPanel className="p-5 text-xs bg-neutral-50/50 border border-emerald-deep/10 space-y-4">
            <h4 className="font-display font-bold text-ink-deep border-b border-neutral-200/60 pb-2.5">Academic Kitchen Partner</h4>
            
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100">
                <img src={activeVendor?.imageUrl} alt={activeVendor?.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h5 className="font-bold text-emerald-strong">{activeVendor?.name}</h5>
                <p className="text-[10.5px] text-muted-grey mt-0.5">Campus lead certified chef</p>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="p-5 text-xs bg-neutral-50/50 border border-emerald-deep/10 space-y-3">
            <h4 className="font-display font-medium text-xs text-ink-deep border-b border-neutral-200/60 pb-2.5">Dispatch schedule Metadata</h4>
            
            <div>
              <span className="text-[9px] text-[#617069] uppercase font-semibold">Location Desk</span>
              <p className="font-bold text-emerald-strong truncate mt-0.5">{activeLocation?.name}</p>
              <span className="text-[10px] text-[#617069] font-medium block mt-0.5">Group zone: {activeLocation?.zone}</span>
            </div>

            <div>
              <span className="text-[9px] text-[#617069] uppercase font-semibold">Target delivery window</span>
              <p className="font-bold text-emerald-strong mt-0.5">{activeSlot?.label}</p>
            </div>
          </GlassPanel>

          {/* Active client feedback review summary */}
          {order.hasReview && (
            <GlassPanel className="p-5 text-xs bg-amber-500/5 border border-amber-500/10 space-y-3 animate-fade-in">
              <h4 className="font-display font-medium text-xs text-ink-deep border-b border-emerald-deep/10 pb-2 flex items-center gap-1 font-black">
                <Star className="w-4 h-4 fill-mango-warm text-mango-warm" />
                <span>Your Dining Review</span>
              </h4>
              {reviews.filter(r => r.orderId === orderId).map((rev, revIdx) => (
                <div key={revIdx} className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: rev.rating }).map((_, s) => (
                      <Star key={s} className="w-3.5 h-3.5 fill-mango-warm text-mango-warm" />
                    ))}
                    {Array.from({ length: 5 - rev.rating }).map((_, s) => (
                      <Star key={s} className="w-3.5 h-3.5 text-neutral-300" />
                    ))}
                  </div>
                  {rev.comment && (
                    <p className="text-muted-grey italic leading-relaxed">"{rev.comment}"</p>
                  )}
                  <p className="text-[9px] text-muted-grey uppercase font-bold">
                    Submitted: {new Date(rev.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </GlassPanel>
          )}

          {/* Core contextual actions footer block */}
          <div className="flex flex-col gap-3">
            {['DELIVERED', 'CONFIRMED'].includes(order.status) && !order.hasReview && (
              <button
                onClick={() => navigateTo(`/orders/${orderId}/review`)}
                className="w-full py-3.5 bg-mango-warm hover:bg-amber-400 text-emerald-strong font-black text-xs rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm"
                id="review_timeline_trigger"
              >
                <MessageSquare className="w-4 h-4 text-emerald-strong" />
                <span>Write Kitchen Review</span>
              </button>
            )}

            {['CANCELLED', 'REFUNDED'].indexOf(order.status) === -1 && !order.hasEscalation && (
              <button
                onClick={() => navigateTo(`/orders/${orderId}/escalate`)}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-danger border border-red-200 font-bold text-xs rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1"
                id="escalation_trigger_active"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Lodge Support Escalation</span>
              </button>
            )}

            {/* Cancel Order Action */}
            {['PENDING_PAYMENT', 'PAID', 'ACCEPTED'].includes(order.status) && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full py-3 bg-neutral-100/50 hover:bg-neutral-200 text-neutral-500 font-bold text-xs rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1"
              >
                <span>Cancel Order</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <dialog open className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent backdrop:bg-black/85 backdrop:backdrop-blur-xs m-auto outline-none w-full h-full animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full border border-neutral-200 shadow-2xl flex flex-col gap-6 relative shadow-emerald-deep/5">
            <h3 className="font-display font-black text-xl text-emerald-strong text-center">Cancel Order?</h3>
            <p className="text-xs text-muted-grey text-center leading-relaxed">
              Are you sure you want to cancel {order.orderNumber}? If you have already paid, refund credits may take up to 48 hours to process.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleCancelOrder}
                className="w-full py-3.5 bg-danger hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
              >
                Yes, Cancel Order
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="w-full py-3.5 bg-neutral-100 hover:bg-neutral-200 text-emerald-strong font-bold text-xs rounded-xl transition cursor-pointer"
              >
                No, Keep It
              </button>
            </div>
          </div>
        </dialog>
      )}
    </AppShell>
  );
};
