import React, { useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency, MessageModal } from './CommonUI';
import { resolveImage, handleImageError } from '../utils/images';
import {
  Trash2,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  ArrowRight,
  Loader2,
  CreditCard,
  ClipboardList,
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
    updateCartItemSpoons,
    removeFromCart,
    clearCart,
    getCartQuote,
    fetchOrderQuote,
    validatePromo,
    createOrder,
    payOrder,
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
  const [specialInstructions, setSpecialInstructions] = useState('');

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
          <h2 className="font-display font-black text-xl text-emerald-strong">Your Takeaway Cart is Empty</h2>
          <p className="text-xs text-muted-grey mt-2 max-w-sm mx-auto leading-relaxed">
            Choose a kitchen partner from the Home Dashboard and assemble your custom compostable box.
          </p>
          <button
            onClick={() => navigateTo('/home')}
            className="mt-6 px-6 py-3 bg-emerald-deep hover:bg-emerald-strong text-white font-bold rounded-2xl text-xs cursor-pointer transition active:scale-95 shadow-lg shadow-emerald-deep/15"
          >
            Browse Active Vendors
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

  // Authoritative figures when the server quote is present, else local estimate.
  const displaySubtotalKobo = serverQuote ? serverQuote.foodSubtotalKobo : quote.subtotalKobo;
  const displayDeliveryKobo = serverQuote ? serverQuote.deliveryFeeKobo : quote.deliveryFeeKobo;
  const displayTotalKobo = serverQuote ? serverQuote.totalKobo : quote.totalKobo;

  // Per-slot inventory: the quote reports remainingQuantity for the chosen date + slot.
  const unavailableItems = serverQuote
    ? serverQuote.items.filter(it => (it.remainingQuantity ?? Infinity) < it.quantity)
    : [];
  const hasUnavailable = unavailableItems.length > 0;

  const blockProceed = quote.spoonCount > 3 || hasUnavailable || isQuoteLoading || !isOnline;

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
    if (!quote.isValid) {
      setQuoteError(quote.errors[0] || 'Takeaway validation checks failed.');
      return;
    }
    if (hasUnavailable) {
      setQuoteError('Some items are sold out for this time slot. Change the delivery slot or date.');
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

    createOrder(specialInstructions, appliedPromo || undefined)
      .then(async orderResult => {
        try {
          const authUrl = await payOrder(orderResult.id);
          window.location.href = authUrl; // redirect out to Paystack
        } catch (paymentErr: any) {
          setIsCreatingOrder(false);
          setErrorMessage(paymentErr.message || 'Payment initialization failed.');
        }
      })
      .catch(err => {
        setIsCreatingOrder(false);
        setErrorMessage(err.message || 'Failed to lock checkout inventory quotas. Try adjusting your order.');
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
          <h3 className="font-display font-bold text-sm text-emerald-strong">Securing Ingredient Inventory...</h3>
          <p className="text-xs text-muted-grey mt-1 max-w-sm">
            Communicating with <strong>{activeVendor?.name || 'the kitchen'}</strong>. Reserving your delivery slot and redirecting to secure Paystack payment.
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
            <span className="text-[10px] font-black tracking-widest text-emerald-deep uppercase bg-emerald-deep/5 px-2.5 py-1 rounded">BASKET REVIEW</span>
            <h2 className="font-display font-black text-2xl text-emerald-strong mt-1.5" id="cart_title">Your Customized Takeaway Box</h2>
            <p className="text-xs text-muted-grey">Review items, spoon counts, and authoritative dispatcher schedules.</p>
          </div>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-xs font-bold text-danger hover:underline cursor-pointer flex items-center gap-1 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition"
            title="Reset current cart selection"
            id="clear_cart_trigger"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Delete Drawer</span>
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
            <h3 className="font-display font-bold text-sm text-emerald-strong mb-4">Takeway Items Selection</h3>

            <div className="divide-y divide-emerald-deep/8">
              {cart.items.map(cartItem => {
                const dbItem = MENU_ITEMS.find(it => it.id === cartItem.menuItemId);
                if (!dbItem) return null;

                const itemTotalKobo = dbItem.priceKobo * cartItem.quantity;
                const soldOut = unavailableItems.some(it => it.menuItemId === cartItem.menuItemId);

                return (
                  <div key={cartItem.menuItemId} className="py-4.5 first:pt-0 last:pb-0 flex gap-4">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-neutral-100">
                      <img src={resolveImage(dbItem.imageUrl, dbItem.name)} onError={handleImageError(dbItem.name)} alt={dbItem.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-emerald-strong truncate">{dbItem.name}</h4>
                        <Currency kobo={itemTotalKobo} className="text-xs text-ink-deep font-bold" />
                      </div>

                      {soldOut && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-danger bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-2.5 h-2.5" /> Sold out for selected slot
                        </span>
                      )}

                      {/* Customized Spoons counter */}
                      <div className="flex items-center gap-1.5 mt-2 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-100 max-w-xs justify-between">
                        <span className="text-[10px] text-muted-grey font-semibold">Takeaway Spoons limit:</span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateCartItemSpoons(cartItem.menuItemId, cartItem.spoonsCount - 1)}
                            className="bg-neutral-200/50 hover:bg-neutral-200 w-5 h-5 rounded-md text-[10px] font-bold cursor-pointer transition flex items-center justify-center text-ink-deep"
                          >
                            -
                          </button>
                          <span className="text-[10px] font-mono font-bold text-emerald-strong w-4 text-center">{cartItem.spoonsCount}</span>
                          <button
                            onClick={() => updateCartItemSpoons(cartItem.menuItemId, cartItem.spoonsCount + 1)}
                            className="bg-neutral-200/50 hover:bg-neutral-200 w-5 h-5 rounded-md text-[10px] font-bold cursor-pointer transition flex items-center justify-center text-ink-deep"
                          >
                            +
                          </button>
                        </div>
                      </div>

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
            <h3 className="font-display font-bold text-sm text-emerald-strong mb-4">Designated Dispatch target</h3>

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
                  <span className="text-muted-grey font-semibold">Dispatch location desk:</span>
                  <span className="font-bold text-emerald-strong flex items-center gap-1 text-right max-w-[200px] truncate">
                    <MapPin className="w-3.5 h-3.5 text-emerald-deep shrink-0" />
                    {activeLocation ? activeLocation.name : 'Not set'}
                  </span>
                </div>
                <select
                  value={cart.deliveryLocationId}
                  onChange={(e) => {
                    setCurrentDateTimeLocation(cart.deliveryDate, cart.deliverySlotId, e.target.value);
                  }}
                  className="w-full text-[11px] font-bold text-ink-deep bg-white border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-deep cursor-pointer mt-1"
                  id="cart_location_picker"
                >
                  {PRESET_LOCATIONS.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.zone})
                    </option>
                  ))}
                </select>
              </div>

              <div className={`flex flex-col gap-1.5 p-3 rounded-xl border ${hasUnavailable ? 'bg-red-50/60 border-red-200' : 'bg-neutral-50/50 border-neutral-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-muted-grey font-semibold">Delivery schedule slot:</span>
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
                  {DELIVERY_SLOTS.map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label}
                    </option>
                  ))}
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
                  <span className="text-muted-grey font-semibold">Target dispatch Date:</span>
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
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full text-[11px] font-bold text-ink-deep bg-white border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-deep cursor-pointer mt-1"
                  id="cart_date_picker"
                />
              </div>
            </div>

            <button
              onClick={() => navigateTo('/home')}
              className="mt-5 w-full py-3 bg-neutral-50 hover:bg-emerald-deep/5 border border-emerald-deep/12 rounded-xl text-xs font-bold text-emerald-strong cursor-pointer transition text-center"
            >
              ← Continue Shopping / Add More Items
            </button>
          </GlassPanel>

          {/* Special Delivery & Kitchen Instructions (moved from the old checkout page) */}
          <GlassPanel className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4.5 h-4.5 text-emerald-deep" />
              <h3 className="font-display font-bold text-sm text-emerald-strong">Special Delivery & Kitchen Instructions</h3>
            </div>
            <p className="text-xs text-muted-grey mb-3 leading-relaxed font-normal">
              Optional — delivery gate codes, entrance directions, or food allergy requests for the kitchen staff.
            </p>
            <div className="relative">
              <textarea
                placeholder="e.g. Gate code is #5512. Hall 4 entrance. Allergy: Absolutely no peanuts or trace seafood elements, thank you!"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full text-xs font-semibold text-ink-deep bg-neutral-50/50 hover:bg-neutral-50 border border-emerald-deep/12 rounded-2xl p-3.5 min-h-[90px] pr-20 focus:ring-2 focus:ring-emerald-deep focus:outline-none focus:bg-white transition-all placeholder:text-muted-grey/60 placeholder:font-normal resize-none"
                id="cart_special_instructions"
                maxLength={400}
              />
              <span className="absolute bottom-3.5 right-3 text-[9px] font-mono font-black text-muted-grey bg-neutral-100 px-1.5 py-0.5 rounded">
                {specialInstructions.length}/400 chars
              </span>
            </div>
          </GlassPanel>
        </div>

        {/* Right Segment (Quoting & Payment) */}
        <div className="space-y-6">
          <GlassPanel className="p-6 bg-emerald-strong text-white border-t-4 border-t-mango-warm">
            <h3 className="font-display text-base font-bold mb-4 text-white">Takeway Cost Summary</h3>

            {/* Spoon Meter limit badge */}
            <div className="mb-4 bg-emerald-deep/40 rounded-xl p-3 border border-white/8">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span>Plastic Spoons Count:</span>
                <span className={quote.spoonCount > 3 ? 'text-danger font-black font-mono animate-pulse' : 'text-mango-warm'}>
                  {quote.spoonCount} / 3 Max
                </span>
              </div>
              <div className="w-full bg-emerald-strong/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${quote.spoonCount > 3 ? 'bg-danger' : 'bg-mango-warm'}`}
                  style={{ width: `${Math.min(100, (quote.spoonCount / 3) * 100)}%` }}
                />
              </div>
              {quote.spoonCount > 3 && (
                <span className="text-[9px] text-red-200 mt-1.5 block">
                  🚨 Total requested spoons exceed the maximum allowable 3 spoons limit. Update countdown values.
                </span>
              )}
            </div>

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
                  <span>Service Fee:</span>
                  <Currency kobo={serverQuote.serviceFeeKobo} className="text-white font-bold" />
                </div>
              )}

              {serverQuote && serverQuote.discountKobo > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span className="text-mango-warm font-bold">- <Currency kobo={serverQuote.discountKobo} /></span>
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
                  <span>Confirm & Pay with Paystack</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-[9px] text-white/50 mt-3 text-center leading-relaxed flex items-center justify-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Final prices lock at payment. Secured by Paystack.
            </p>
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
              <span>Empty Current Takeaway Cart?</span>
            </div>

            <p className="text-xs text-muted-grey leading-relaxed">
              This action will securely empty all registered custom ingredients or packages currently configured in your basket. This cannot be undone.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 bg-neutral-50 hover:bg-neutral-100 text-muted-grey font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel Keep
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
