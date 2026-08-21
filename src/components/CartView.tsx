import React, { useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency, MessageModal } from './CommonUI';
import { resolveImage, handleImageError } from '../utils/images';
import { buildSupportMailto, LEGAL_LINKS } from '../utils/support';
import { isSlotAvailable, formatNGN } from '../utils/helpers';
import { launchPaystackCheckout } from '../utils/paystackPopup';
import {
  Trash2,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  ArrowRight,
  Loader2,
  CreditCard,
  Lock
} from 'lucide-react';

import emptyCartIllustration from '../assets/images/empty_cart_illustration_1781791204037.jpg';

// Persisted opt-out: once the user ticks "Don't show this again" in the confirm
// popup, Proceed goes straight to Paystack on subsequent orders.
const SKIP_CONFIRM_KEY = 'md_skip_order_confirm';

export const CartView: React.FC = () => {
  const {
    cart,
    user,
    navigateTo,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    getCartQuote,
    fetchOrderQuote,
    validatePromo,
    checkoutAndPay,
    getWallet,
    isOnline,
    savedLocationIds,
    setCurrentDateTimeLocation,
    locations: PRESET_LOCATIONS,
    deliverySlots: DELIVERY_SLOTS,
    menuItems: MENU_ITEMS,
    vendors: VENDORS
  } = useMealDirect();

  // Dialog + flow state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  // Large-order surcharge acceptance. Required before checkout when the server
  // quote reports the total exceeds the ₦2,490 standard cap.
  const [acceptLargeOrderSurcharge, setAcceptLargeOrderSurcharge] = useState(false);
  // v2 wallet + fee model
  const [paymentMethod, setPaymentMethod] = useState<import('../types').PaymentMethod>('paystack');
  const [wallet, setWallet] = useState<import('../types').Wallet | null>(null);
  const [pointDelivery, setPointDelivery] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getWallet().then(w => { if (!cancelled) setWallet(w); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Authoritative server quote (availability + real total). Loaded async; the
  // instant local estimate covers the gap until it arrives.
  const [serverQuote, setServerQuote] = useState<import('../types').ServerQuote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  // Promo code
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Pull the authoritative quote whenever the order shape changes. Same call the
  // old checkout page made — doing it here means availability + price are known
  // in the cart, before the user commits.
  React.useEffect(() => {
    if (!cart || !isOnline) return;
    let cancelled = false;
    setIsQuoteLoading(true);
    fetchOrderQuote(appliedPromo || undefined)
      .then(q => { if (!cancelled) setServerQuote(q); })
      .finally(() => { if (!cancelled) setIsQuoteLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.vendorId, cart?.deliveryLocationId, cart?.deliverySlotId, cart?.deliveryDate, JSON.stringify(cart?.items), isOnline, appliedPromo]);

  if (!cart || cart.items.length === 0) {
    return (
      <AppShell activeTab="cart">
        <div className="text-center py-16 bg-white rounded-3xl border border-emerald-deep/8 px-6 overflow-hidden flex flex-col items-center justify-center max-w-lg mx-auto" id="cart_empty_state">
          <div className="w-48 h-32 mb-6 rounded-2xl overflow-hidden shadow-sm relative">
            <img src={emptyCartIllustration} alt="Empty Cart" className="w-full h-full object-cover" />
          </div>
          <h2 className="font-display font-black text-xl text-emerald-strong">Your cart is empty</h2>
          <p className="text-xs text-muted-grey mt-2 max-w-sm mx-auto leading-relaxed">
            Pick a vendor and add some meals to get started.
          </p>
          <button
            onClick={() => navigateTo('/home')}
            className="mt-6 px-6 py-3 bg-emerald-deep hover:bg-emerald-strong text-white font-bold rounded-2xl text-xs cursor-pointer transition active:scale-95 shadow-lg shadow-emerald-deep/15"
          >
            Browse vendors
          </button>
        </div>
      </AppShell>
    );
  }

  // Precalculators
  const quote = getCartQuote();
  const activeLocation = PRESET_LOCATIONS.find(l => l.id === cart.deliveryLocationId);
  const activeSlot = DELIVERY_SLOTS.find(s => s.id === cart.deliverySlotId);
  const activeVendor = VENDORS.find(v => v.id === cart.vendorId);
  const roomNumberRequired = activeLocation?.type === 'Hostel';
  const roomNumberMissing = roomNumberRequired && roomNumber.trim().length === 0;

  // Same-day ordering: today is selectable (uses the LOCAL calendar date, not the
  // UTC date). Backend remains the final authority on per-slot cutoffs.
  const minOrderDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Authoritative figures when the server quote is present, else local estimate.
  const displaySubtotalKobo = serverQuote ? serverQuote.foodSubtotalKobo : quote.subtotalKobo;
  const displayDeliveryKobo = serverQuote ? serverQuote.deliveryFeeKobo : quote.deliveryFeeKobo;
  const displayTotalKobo = serverQuote ? serverQuote.totalKobo : quote.totalKobo;

  // Large-order surcharge — authoritative, from the server quote only. Never computed
  // client-side. The surcharge is already included in totalKobo.
  const exceedsStandardCap = serverQuote?.exceedsStandardCap ?? false;
  const largeOrderSurchargeKobo = serverQuote?.largeOrderSurchargeKobo ?? 0;
  // Must accept the surcharge before checkout when the cap is exceeded.
  const surchargeBlocksProceed = exceedsStandardCap && !acceptLargeOrderSurcharge;

  // Per-slot inventory: the quote reports remainingQuantity for the chosen date + slot.
  const unavailableItems = serverQuote
    ? serverQuote.items.filter(it => (it.remainingQuantity ?? Infinity) < it.quantity)
    : [];
  const hasUnavailable = unavailableItems.length > 0;

  // When online but the authoritative server quote never arrived, the shown total is
  // only a local estimate (missing service fee/discount/surcharge). Block checkout so
  // the user never pays against a wrong figure or hits a late backend rejection.
  const quoteUnavailable = isOnline && !isQuoteLoading && !serverQuote;

  // v2 wallet guards. Balance check is advisory (excludes any point surcharge the
  // backend adds); the server still enforces it and returns 402 on a real shortfall.
  const walletFrozen = wallet?.status === 'frozen';
  const walletBalanceKobo = wallet?.balanceKobo ?? 0;
  const walletShort = paymentMethod === 'wallet' && !!wallet && walletBalanceKobo < displayTotalKobo;
  const walletBlocks = paymentMethod === 'wallet' && (walletFrozen || walletShort);

  const blockProceed = hasUnavailable || isQuoteLoading || !isOnline || surchargeBlocksProceed || quoteUnavailable || roomNumberMissing || walletBlocks;

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoMsg(null);
    const res = await validatePromo(code);
    setPromoLoading(false);
    if (res.valid) {
      setAppliedPromo(code); // re-quotes with the code -> authoritative discount
      setPromoMsg({ ok: true, text: res.message || `Code applied${res.discountKobo ? ` — ₦${(res.discountKobo / 100).toFixed(0)} off` : ''}.` });
    } else {
      setAppliedPromo(null);
      setPromoMsg({ ok: false, text: res.message || 'Invalid or expired promo code.' });
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoMsg(null);
  };

  // Validate, then either open the confirm popup or (if opted out) pay immediately.
  const handleProceed = () => {
    setQuoteError(null);
    if (!isOnline) {
      setQuoteError('Cannot proceed in offline cache mode. Internet connection is required for inventory verification.');
      return;
    }
    if (quoteUnavailable) {
      setQuoteError('We could not confirm live pricing and availability. Check your connection and try again.');
      return;
    }
    if (!cart.deliveryLocationId) {
      setQuoteError('Please select a delivery location before proceeding.');
      return;
    }
    if (!quote.isValid) {
      setQuoteError(quote.errors[0] || 'Takeaway validation checks failed.');
      return;
    }
    if (hasUnavailable) {
      setQuoteError('Some items are sold out for this time slot. Change the delivery slot or date.');
      return;
    }
    if (exceedsStandardCap && !acceptLargeOrderSurcharge) {
      setQuoteError('Please accept the large-order surcharge to continue.');
      return;
    }
    if (roomNumberMissing) {
      setQuoteError('Please enter your hostel room number so the rider can find you.');
      return;
    }

    if (localStorage.getItem(SKIP_CONFIRM_KEY) === '1') {
      handleConfirmAndPay();
    } else {
      setShowConfirm(true);
    }
  };

  // The old checkout's launch-payment logic, now driven straight from the cart.
  const handleConfirmAndPay = () => {
    if (dontShowAgain) localStorage.setItem(SKIP_CONFIRM_KEY, '1');
    setShowConfirm(false);
    setErrorMessage(null);
    setIsCreatingOrder(true);

    // Single consolidated create-order → initialize-payment path (guarded against
    // double submission in the store), so one tap can never make two orders.
    checkoutAndPay(undefined, appliedPromo || undefined, exceedsStandardCap && acceptLargeOrderSurcharge, roomNumberRequired ? roomNumber : undefined, { paymentMethod, pointDelivery })
      .then(async ({ order, authorizationUrl, accessCode }) => {
        // Wallet orders are already paid — no Paystack step. Go straight to the order.
        if (paymentMethod === 'wallet' || !authorizationUrl) {
          navigateTo(`/orders/${order.id}`);
          return;
        }
        // Inline popup keeps the user in the app; the payment-status view behind it
        // polls (first fetch active-verifies), so callbacks only accelerate the
        // resolution. Hosted redirect remains the fallback inside launchPaystackCheckout.
        const statusPath = `/payment/status/${order.id}`;
        const mode = await launchPaystackCheckout(
          { authorizationUrl, accessCode },
          {
            onSuccess: () => navigateTo(statusPath),
            onCancel: () => navigateTo(`${statusPath}?status=cancelled`)
          }
        );
        if (mode === 'popup') navigateTo(statusPath);
      })
      .catch(err => {
        setIsCreatingOrder(false);
        const msg: string = err?.message || '';
        // v2 wallet: too little balance. Backend rejects with 402 and details.shortfallKobo.
        if (err?.status === 402 || err?.code === 'WALLET_INSUFFICIENT_BALANCE') {
          const shortfall = err?.details?.shortfallKobo;
          setErrorMessage(
            shortfall
              ? `Your wallet is short by ${formatNGN(shortfall)}. Top up your wallet or pay with card.`
              : 'Your wallet balance is too low for this order. Top up your wallet or pay with card.'
          );
          return;
        }
        // Only the surcharge-acceptance rejection re-opens the toggle inline. The
        // backend names the flag in its message, which is the reliable signal —
        // matching on VALIDATION_FAILED/400 alone would swallow unrelated 400s
        // (e.g. an orders_total_formula constraint failure) under a wrong prompt.
        const isSurchargeRejection = /acceptLargeOrderSurcharge/i.test(msg);
        if (isSurchargeRejection) {
          setAcceptLargeOrderSurcharge(false);
          setQuoteError('Order total exceeds the standard ₦2,490 cap. Please accept the large-order surcharge to continue.');
          return;
        }
        setErrorMessage(msg || 'We could not start checkout. Please try again.');
      });
  };

  const handleClearCart = () => {
    clearCart();
    setShowClearConfirm(false);
  };

  // While the order is being created + payment initialized, cover the cart with a
  // dedicated state so the Proceed button never looks frozen.
  if (isCreatingOrder) {
    return (
      <AppShell activeTab="cart">
        <div className="text-center py-16 bg-white rounded-3xl border border-emerald-deep/8 flex flex-col items-center justify-center p-6" id="order_creating_state">
          <Loader2 className="w-10 h-10 text-emerald-deep animate-spin mb-4" />
          <h3 className="font-display font-bold text-sm text-emerald-strong">Starting secure checkout…</h3>
          <p className="text-xs text-muted-grey mt-1 max-w-sm">
            Placing your order with <strong>{activeVendor?.name || 'the vendor'}</strong> and redirecting you to secure Paystack payment.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="cart">
      {/* Page Header */}
      <section className="mb-6" id="cart_header">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black tracking-widest text-emerald-deep uppercase bg-emerald-deep/5 px-2.5 py-1 rounded">REVIEW ORDER</span>
            <h2 className="font-display font-black text-2xl text-emerald-strong mt-1.5" id="cart_title">Your cart</h2>
            <p className="text-xs text-muted-grey">Review your items, delivery details, and total before you pay.</p>
          </div>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-xs font-bold text-danger hover:underline cursor-pointer flex items-center gap-1 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition"
            title="Reset current cart selection"
            id="clear_cart_trigger"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear cart</span>
          </button>
        </div>
      </section>

      {quoteError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-xs text-danger font-semibold rounded-2xl flex items-start gap-2 animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
          <span>{quoteError}</span>
        </div>
      )}

      <MessageModal
        open={!!errorMessage}
        message={errorMessage || ''}
        variant="error"
        title="Checkout couldn't continue"
        confirmLabel="Close"
        onClose={() => setErrorMessage(null)}
      />

      {/* Main Core Elements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="cart_workspace">
        {/* Left segment (Items list + dispatch specs) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card list of items */}
          <GlassPanel className="p-6">
            <h3 className="font-display font-bold text-sm text-emerald-strong mb-4">Takeaway items</h3>

            <div className="divide-y divide-emerald-deep/8">
              {cart.items.map(cartItem => {
                const dbItem = MENU_ITEMS.find(it => it.id === cartItem.menuItemId);
                // Fall back to the add-time snapshot so items never vanish when the
                // live catalog is empty for the selected slot/date. Only drop a row
                // if we truly have no data (no catalog hit and no snapshot).
                const name = dbItem?.name ?? cartItem.name;
                const priceKobo = dbItem?.priceKobo ?? cartItem.priceKobo;
                const imageUrl = dbItem?.imageUrl ?? cartItem.imageUrl;
                if (!name || priceKobo === undefined) return null;

                const itemTotalKobo = priceKobo * cartItem.quantity;
                const soldOut = unavailableItems.some(it => it.menuItemId === cartItem.menuItemId);

                return (
                  <div key={cartItem.menuItemId} className="py-4.5 first:pt-0 last:pb-0 flex gap-4">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-neutral-100">
                      <img src={resolveImage(imageUrl, name)} onError={handleImageError(name)} alt={name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-emerald-strong truncate">{name}</h4>
                        <Currency kobo={itemTotalKobo} className="text-xs text-ink-deep font-bold" />
                      </div>

                      {cartItem.soupName && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[9.5px] font-bold text-emerald-strong bg-emerald-deep/10 px-1.5 py-0.5 rounded">
                          🍲 {cartItem.soupName}
                        </span>
                      )}

                      {soldOut && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-danger bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-2.5 h-2.5" /> Sold out for selected slot
                        </span>
                      )}

                      {/* Quantity operations */}
                      <div className="flex items-center justify-between gap-4 mt-3">
                        <button
                          onClick={() => removeFromCart(cartItem.menuItemId)}
                          className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" /> Remove Item
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartItemQuantity(cartItem.menuItemId, cartItem.quantity - 1)}
                            className="bg-neutral-100 hover:bg-neutral-200 p-1.5 rounded-md text-xs font-bold cursor-pointer transition"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono font-bold w-6 text-center">{cartItem.quantity}</span>
                          <button
                            onClick={() => updateCartItemQuantity(cartItem.menuItemId, cartItem.quantity + 1)}
                            className="bg-neutral-100 hover:bg-neutral-200 p-1.5 rounded-md text-xs font-bold cursor-pointer transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassPanel>

          {/* Micro dispatch terminal indicators */}
          <GlassPanel className="p-6">
            <h3 className="font-display font-bold text-sm text-emerald-strong mb-4">Delivery details</h3>

            {/* Saved Delivery Locations Shortcuts */}
            {savedLocationIds.length > 0 && (
              <div className="mb-4 bg-emerald-deep/5 p-3 rounded-2xl border border-emerald-deep/10">
                <span className="text-[10px] font-bold text-emerald-strong uppercase tracking-wider block mb-2">⚡ Pinned Delivery Locations:</span>
                <div className="flex flex-wrap gap-1.5">
                  {savedLocationIds.map(locId => {
                    const loc = PRESET_LOCATIONS.find(l => l.id === locId);
                    if (!loc) return null;
                    const isSelected = cart.deliveryLocationId === locId;
                    return (
                      <button
                        key={locId}
                        onClick={() => {
                          setCurrentDateTimeLocation(cart.deliveryDate, cart.deliverySlotId, locId);
                          setRoomNumber('');
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border transition text-[10px] font-bold cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-deep text-white border-emerald-deep'
                            : 'bg-white border-neutral-200 text-ink-deep hover:border-emerald-deep/30 hover:bg-neutral-50/50'
                        }`}
                        title={`Select ${loc.name}`}
                      >
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span>{loc.name.split(' (')[0].replace('Terminal', '').trim()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-neutral-50/50 border border-neutral-100">
                <div className="flex items-center justify-between">
                  <span className="text-muted-grey font-semibold">Delivery location:</span>
                  <span className="font-bold text-emerald-strong flex items-center gap-1 text-right max-w-[200px] truncate">
                    <MapPin className="w-3.5 h-3.5 text-emerald-deep shrink-0" />
                    {activeLocation ? activeLocation.name : 'Not set'}
                  </span>
                </div>
                <select
                  value={cart.deliveryLocationId}
                  onChange={(e) => {
                    setCurrentDateTimeLocation(cart.deliveryDate, cart.deliverySlotId, e.target.value);
                    setRoomNumber('');
                  }}
                  className="w-full text-[11px] font-bold text-ink-deep bg-white border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-deep cursor-pointer mt-1"
                  id="cart_location_picker"
                >
                  <option value="" disabled>
                    Select delivery location…
                  </option>
                  {PRESET_LOCATIONS.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.zone})
                    </option>
                  ))}
                </select>
                {roomNumberRequired && (
                  <div className="mt-2">
                    <label className="text-[10px] text-muted-grey uppercase font-bold block mb-1">
                      Hostel room number
                    </label>
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value.slice(0, 32))}
                      placeholder="e.g. B12 or Room 204"
                      className="w-full text-[11px] font-bold text-ink-deep bg-white border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-deep"
                      id="cart_room_number_input"
                    />
                  </div>
                )}
              </div>

              <div className={`flex flex-col gap-1.5 p-3 rounded-xl border ${hasUnavailable ? 'bg-red-50/60 border-red-200' : 'bg-neutral-50/50 border-neutral-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-muted-grey font-semibold">Delivery slot:</span>
                  <span className="font-bold text-emerald-strong flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-deep" />
                    {activeSlot ? activeSlot.label : 'Select Slot'}
                  </span>
                </div>
                <select
                  value={cart.deliverySlotId}
                  onChange={(e) => {
                    setCurrentDateTimeLocation(cart.deliveryDate, e.target.value, cart.deliveryLocationId);
                  }}
                  className={`w-full text-[11px] font-bold text-ink-deep bg-white border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-deep cursor-pointer mt-1 ${hasUnavailable ? 'border-red-300' : 'border-neutral-200'}`}
                  id="cart_slot_picker"
                >
                  {DELIVERY_SLOTS.map(slot => {
                    // Slots lock 60 min before delivery. Disable closed ones so the user
                    // can't select a past slot for today and hit a late backend rejection.
                    const open = isSlotAvailable(slot.time, cart.deliveryDate);
                    return (
                      <option key={slot.id} value={slot.id} disabled={!open && slot.id !== cart.deliverySlotId}>
                        {slot.label}{open ? '' : ' — closed'}
                      </option>
                    );
                  })}
                </select>
                {hasUnavailable && (
                  <span className="text-[10px] font-bold text-danger mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    Sold out for this slot: {unavailableItems.map(it => it.name).join(', ')}. Pick another slot or date.
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-neutral-50/50 border border-neutral-100">
                <div className="flex items-center justify-between">
                  <span className="text-muted-grey font-semibold">Delivery date:</span>
                  <span className="font-bold text-emerald-strong flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-deep" />
                    {cart.deliveryDate}
                  </span>
                </div>
                <input
                  type="date"
                  value={cart.deliveryDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setCurrentDateTimeLocation(e.target.value, cart.deliverySlotId, cart.deliveryLocationId);
                    }
                  }}
                  min={minOrderDate}
                  className="w-full text-[11px] font-bold text-ink-deep bg-white border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-deep cursor-pointer mt-1"
                  id="cart_date_picker"
                />
                <span className="text-[10px] text-muted-grey mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-deep shrink-0" />
                  Same-day ordering available. Orders lock 60 minutes before the delivery slot.
                </span>
              </div>
            </div>

            <button
              onClick={() => navigateTo('/home')}
              className="mt-5 w-full py-3 bg-neutral-50 hover:bg-emerald-deep/5 border border-emerald-deep/12 rounded-xl text-xs font-bold text-emerald-strong cursor-pointer transition text-center"
            >
              ← Continue shopping / add more items
            </button>
          </GlassPanel>
        </div>

        {/* Right Segment (Quoting & Payment) */}
        <div className="space-y-6">
          <GlassPanel className="p-6 bg-emerald-strong text-white border-t-4 border-t-mango-warm">
            <h3 className="font-display text-base font-bold mb-4 text-white">Cost summary</h3>

            <div className="space-y-3.5 text-xs text-white/80 pt-2 pb-4 border-b border-white/12">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <Currency kobo={displaySubtotalKobo} className="text-white font-bold" />
              </div>

              <div className="flex justify-between">
                <span>Flat Delivery fee:</span>
                <Currency kobo={displayDeliveryKobo} className="text-white font-bold" />
              </div>

              {serverQuote && serverQuote.serviceFeeKobo > 0 && (
                <div className="flex justify-between">
                  <span>Takeaway fee:</span>
                  <Currency kobo={serverQuote.serviceFeeKobo} className="text-white font-bold" />
                </div>
              )}

              {serverQuote && serverQuote.discountKobo > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span className="text-mango-warm font-bold">- <Currency kobo={serverQuote.discountKobo} /></span>
                </div>
              )}

              {largeOrderSurchargeKobo > 0 && (
                <div className="flex justify-between">
                  <span>Large order surcharge:</span>
                  <Currency kobo={largeOrderSurchargeKobo} className="text-white font-bold" />
                </div>
              )}
            </div>

            {/* Promo code (moved from the old checkout page) */}
            <div className="py-4 border-b border-white/12">
              <label className="text-[10px] font-bold text-white/70 uppercase tracking-wider block mb-2">Promo Code</label>
              {appliedPromo ? (
                <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2.5 border border-white/15">
                  <span className="text-xs font-bold text-mango-warm font-mono uppercase">{appliedPromo}</span>
                  <button onClick={handleRemovePromo} className="text-[10px] font-bold text-white/70 hover:text-white underline cursor-pointer">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white/95 text-ink-deep text-xs font-bold font-mono uppercase placeholder:font-normal placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-mango-warm"
                    id="promo_code_input"
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    className="px-4 py-2.5 bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
                  >
                    {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                  </button>
                </div>
              )}
              {promoMsg && (
                <p className={`text-[10px] mt-2 font-semibold ${promoMsg.ok ? 'text-mango-warm' : 'text-red-200'}`}>
                  {promoMsg.text}
                </p>
              )}
            </div>

            <div className="flex justify-between items-baseline py-4 mb-4">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                Estimated Quote Total:
                {isQuoteLoading && <Loader2 className="w-3 h-3 animate-spin text-white/60" />}
                {!isQuoteLoading && !serverQuote && <span className="text-[8px] font-bold text-white/50 uppercase">(est)</span>}
              </span>
              <span className="text-xl font-black text-mango-warm select-all"><Currency kobo={displayTotalKobo} /></span>
            </div>

            {hasUnavailable && (
              <div className="mb-3 p-3 bg-red-500/15 border border-red-300/30 rounded-xl text-[10px] text-red-100 font-semibold">
                Out of stock for this date/slot: {unavailableItems.map(it => it.name).join(', ')}. Change the delivery slot or date above.
              </div>
            )}

            {quoteUnavailable && (
              <div className="mb-3 p-3 bg-red-500/15 border border-red-300/30 rounded-xl text-[10px] text-red-100 font-semibold flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>We couldn't confirm live pricing and availability. The total above is only an estimate — reconnect or retry before paying.</span>
              </div>
            )}

            {exceedsStandardCap && (
              <div className="mb-3 p-3 bg-mango-warm/15 border border-mango-warm/40 rounded-xl space-y-2.5" id="large_order_surcharge_notice">
                <p className="text-[11px] text-white font-semibold leading-relaxed flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-mango-warm shrink-0 mt-0.5" />
                  <span>Orders above ₦2,490 are charged an extra 1.5% + ₦100.</span>
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptLargeOrderSurcharge}
                    onChange={(e) => setAcceptLargeOrderSurcharge(e.target.checked)}
                    className="w-4 h-4 rounded accent-mango-warm cursor-pointer shrink-0"
                    id="accept_large_order_surcharge"
                  />
                  <span className="text-[11px] font-bold text-white">I accept the large-order surcharge</span>
                </label>
              </div>
            )}

            {/* v2 fee model: deliver-to-point surcharge opt-in */}
            <label className="mb-3 flex items-center gap-2.5 cursor-pointer select-none rounded-xl bg-white/5 border border-white/10 p-3">
              <input
                type="checkbox"
                checked={pointDelivery}
                onChange={(e) => setPointDelivery(e.target.checked)}
                className="w-4 h-4 rounded accent-mango-warm cursor-pointer shrink-0"
                id="point_delivery_toggle"
              />
              <span className="text-[11px] font-semibold text-white leading-tight">
                Deliver to my exact spot (hostel room / classroom)
                <span className="block text-[9px] font-normal text-white/50">Adds a small point-delivery surcharge.</span>
              </span>
            </label>

            {/* v2 wallet: payment method */}
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/60 mb-1.5">Payment method</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  disabled={!wallet}
                  className={`rounded-xl border p-3 text-left transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    paymentMethod === 'wallet' ? 'border-mango-warm bg-mango-warm/15' : 'border-white/15 bg-white/5'
                  }`}
                  id="pay_with_wallet_btn"
                >
                  <span className="block text-[11px] font-bold text-white">Wallet</span>
                  <span className="block text-[10px] font-semibold text-mango-warm">
                    {wallet ? formatNGN(wallet.balanceKobo) : 'Unavailable'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('paystack')}
                  className={`rounded-xl border p-3 text-left transition ${
                    paymentMethod === 'paystack' ? 'border-mango-warm bg-mango-warm/15' : 'border-white/15 bg-white/5'
                  }`}
                  id="pay_with_card_btn"
                >
                  <span className="block text-[11px] font-bold text-white">Card / Transfer</span>
                  <span className="block text-[10px] font-semibold text-white/50">via Paystack</span>
                </button>
              </div>
              {paymentMethod === 'wallet' && walletFrozen && (
                <p className="mt-2 text-[10px] font-semibold text-red-200">Your wallet is frozen. Choose card, or contact support.</p>
              )}
              {paymentMethod === 'wallet' && walletShort && !walletFrozen && (
                <p className="mt-2 text-[10px] font-semibold text-red-200">
                  Balance too low. Top up your wallet or pay with card.
                </p>
              )}
            </div>

            <button
              onClick={handleProceed}
              disabled={blockProceed}
              className={`w-full py-4 rounded-2xl font-bold text-xs transition duration-200 text-center flex items-center justify-center gap-2 ${
                blockProceed
                  ? 'bg-emerald-deep/20 text-neutral-400 cursor-not-allowed'
                  : 'bg-mango-warm text-emerald-strong hover:bg-amber-400 cursor-pointer shadow-lg active:scale-95'
              }`}
              id="proceed_to_checkout_btn"
            >
              {isQuoteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking availability…</span>
                </>
              ) : (
                <>
                  <span>{paymentMethod === 'wallet' ? 'Confirm & Pay from Wallet' : 'Confirm & Pay with Paystack'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-[9px] text-white/50 mt-3 text-center leading-relaxed flex items-center justify-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Final prices lock at payment. Secured by Paystack.
            </p>

            {/* Refund / cancellation summary + policy + support (checkout review) */}
            <div className="mt-3 pt-3 border-t border-white/10 text-[9px] text-white/60 leading-relaxed space-y-1.5">
              <p>
                You can cancel before the vendor accepts. After that, cancellations and refunds are handled by support.
                Refunds may take time to appear depending on your bank.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a href={LEGAL_LINKS.refundPolicy} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                  Refund policy
                </a>
                <a href={buildSupportMailto({ category: 'Checkout help' })} className="underline hover:text-white">
                  Contact support
                </a>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* Confirm Order Dialog */}
      {showConfirm && (
        <dialog open className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-emerald-deep/10 shadow-2xl flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center gap-2.5 text-emerald-strong font-display font-black text-base">
              <CreditCard className="w-5 h-5 text-emerald-deep" />
              <span>Confirm Your Order</span>
            </div>

            <div className="space-y-2.5 text-xs bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
              <div className="flex justify-between">
                <span className="text-muted-grey font-semibold">Items:</span>
                <span className="font-bold text-emerald-strong">{quote.itemCount} unit{quote.itemCount === 1 ? '' : 's'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-grey font-semibold">Delivery slot:</span>
                <span className="font-bold text-emerald-strong text-right">{activeSlot ? activeSlot.label : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-grey font-semibold">Date:</span>
                <span className="font-bold text-emerald-strong">{cart.deliveryDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-grey font-semibold">Location:</span>
                <span className="font-bold text-emerald-strong text-right max-w-[160px] truncate">{activeLocation ? activeLocation.name : '—'}</span>
              </div>
              {roomNumberRequired && (
                <div className="flex justify-between">
                  <span className="text-muted-grey font-semibold">Room:</span>
                  <span className="font-bold text-emerald-strong text-right max-w-[160px] truncate">{roomNumber.trim() || 'Required'}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 mt-1 border-t border-neutral-200">
                <span className="text-emerald-strong font-bold">Total to pay:</span>
                <span className="font-black text-emerald-deep text-sm"><Currency kobo={displayTotalKobo} /></span>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-deep cursor-pointer"
                id="skip_confirm_checkbox"
              />
              <span className="text-[11px] font-semibold text-muted-grey">Don't show this again — go straight to payment next time</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 bg-neutral-50 hover:bg-neutral-100 text-muted-grey font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Back to Cart
              </button>
              <button
                onClick={handleConfirmAndPay}
                className="flex-1 py-3 bg-mango-warm hover:bg-amber-400 text-emerald-strong font-bold text-xs rounded-xl transition cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
                id="confirm_and_pay_btn"
              >
                <CreditCard className="w-4 h-4" />
                Confirm & Pay
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Clear Cart Confirmation Dialog */}
      {showClearConfirm && (
        <dialog open className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-red-100 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2.5 text-danger font-bold text-xs">
              <AlertTriangle className="w-5 h-5 text-danger" />
              <span>Clear your cart?</span>
            </div>

            <p className="text-xs text-muted-grey leading-relaxed">
              This will remove all items from your cart. This can't be undone.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 bg-neutral-50 hover:bg-neutral-100 text-muted-grey font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Keep cart
              </button>
              <button
                onClick={handleClearCart}
                className="flex-1 py-2.5 bg-danger hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm shadow-red-200"
                id="confirm_clear_cart"
              >
                Empty Cart
              </button>
            </div>
          </div>
        </dialog>
      )}
    </AppShell>
  );
};
