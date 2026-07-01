import React, { useState } from 'react';
import { useMealDirect } from '../store';
import { formatNGN, MAX_ORDER_TOTAL_KOBO } from '../utils/helpers';
import { AppShell, GlassPanel, Currency, MessageModal } from './CommonUI';
import { ShieldCheck, ArrowRight, Loader2, Landmark, HelpCircle, MapPin, Clock, CreditCard, Lock, ClipboardList } from 'lucide-react';

export const CheckoutView: React.FC = () => {
  const {
    user,
    cart,
    navigateTo,
    getCartQuote,
    fetchOrderQuote,
    validatePromo,
    createOrder,
    payOrder,
    isOnline,
    setCurrentDateTimeLocation,
    locations: PRESET_LOCATIONS,
    deliverySlots: DELIVERY_SLOTS,
    vendors: VENDORS
  } = useMealDirect();

  // Local estimate (instant) + authoritative server quote (loaded async)
  const quote = getCartQuote();
  const [serverQuote, setServerQuote] = useState<import('../types').ServerQuote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  // Promo code
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  React.useEffect(() => {
    if (!cart || !isOnline) return;
    let cancelled = false;
    setIsQuoteLoading(true);
    fetchOrderQuote(appliedPromo || undefined)
      .then(q => { if (!cancelled) setServerQuote(q); })
      .finally(() => { if (!cancelled) setIsQuoteLoading(false); });
    return () => { cancelled = true; };
  }, [cart?.vendorId, cart?.deliveryLocationId, cart?.deliverySlotId, cart?.deliveryDate, JSON.stringify(cart?.items), isOnline, appliedPromo]);

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoMsg(null);
    const res = await validatePromo(code);
    setPromoLoading(false);
    if (res.valid) {
      setAppliedPromo(code); // triggers re-quote with the code -> authoritative discount
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

  // Authoritative figures when server quote present, else local estimate
  const displaySubtotalKobo = serverQuote ? serverQuote.foodSubtotalKobo : quote.subtotalKobo;
  const displayDeliveryKobo = serverQuote ? serverQuote.deliveryFeeKobo : quote.deliveryFeeKobo;
  const displayTotalKobo = serverQuote ? serverQuote.totalKobo : quote.totalKobo;

  // Per-slot inventory: quote reports remainingQuantity for the chosen date + slot
  const unavailableItems = serverQuote
    ? serverQuote.items.filter(it => (it.remainingQuantity ?? Infinity) < it.quantity)
    : [];
  const hasUnavailable = unavailableItems.length > 0;

  // Order cap: final total (post-discount) must not exceed ₦2490. Block here so the
  // server's VALIDATION_FAILED on POST /orders is never hit in the happy path.
  const exceedsCap = displayTotalKobo > MAX_ORDER_TOTAL_KOBO;

  // States
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const activeLocation = PRESET_LOCATIONS.find(l => l.id === (cart?.deliveryLocationId || user?.defaultLocationId));
  const activeSlot = DELIVERY_SLOTS.find(s => s.id === (cart?.deliverySlotId));
  const activeVendor = VENDORS.find(v => v.id === cart?.vendorId);

  const handleLaunchPayment = () => {
    if (!isOnline) {
      setErrorMessage('Offline cache. Payout requires internet connectivity.');
      return;
    }
    if (exceedsCap) {
      setErrorMessage(`Order total exceeds the ${formatNGN(MAX_ORDER_TOTAL_KOBO)} maximum. Reduce your cart to continue.`);
      return;
    }
    setErrorMessage(null);
    setIsCreatingOrder(true);

    createOrder(specialInstructions, appliedPromo || undefined).then(async orderResult => {
        try {
          const authUrl = await payOrder(orderResult.id);
          // Redirect the user out to Paystack
          window.location.href = authUrl;
        } catch (paymentErr: any) {
          setIsCreatingOrder(false);
          setErrorMessage(paymentErr.message || 'Payment initialization failed.');
        }
    }).catch(err => {
        setIsCreatingOrder(false);
        const msg: string = err?.message || '';
        if (/maximum allowed amount/i.test(msg)) {
          setErrorMessage(`Order total exceeds the ${formatNGN(MAX_ORDER_TOTAL_KOBO)} maximum. Reduce your cart to continue.`);
        } else {
          setErrorMessage(msg || 'Failed to lock checkout inventory quotas. Try cooking options.');
        }
    });
  };

  // If cart is empty, push back home
  if (!cart) {
    return (
      <AppShell activeTab="cart">
        <div className="text-center py-12 bg-white rounded-3xl border border-red-100">
          <ShieldCheck className="w-12 h-12 text-danger mx-auto mb-3" />
          <p className="text-sm font-bold text-emerald-strong">Your cart is empty. Checkout requires active packaging.</p>
          <button onClick={() => navigateTo('/home')} className="mt-4 px-4 py-2 bg-emerald-deep text-white rounded-xl text-xs font-bold cursor-pointer">
            Return Home
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="cart">
      <section className="mb-6" id="checkout_page_header">
        <div>
          <span className="text-[10px] font-black tracking-widest text-emerald-deep uppercase bg-emerald-deep/5 px-2.5 py-1 rounded">Safe Gateway</span>
          <h2 className="font-display font-black text-2xl text-emerald-strong mt-1.5" id="checkout_headline">Checkout Payment Slate</h2>
          <p className="text-xs text-muted-grey">Authorize your order securely. We partner with Paystack for campus remittance.</p>
        </div>
      </section>

      <MessageModal
        open={!!errorMessage}
        message={errorMessage || ''}
        variant="error"
        title="Checkout couldn't continue"
        confirmLabel="Close"
        onClose={() => setErrorMessage(null)}
      />

      {isCreatingOrder ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-emerald-deep/8 flex flex-col items-center justify-center p-6" id="order_creating_state">
          <Loader2 className="w-10 h-10 text-emerald-deep animate-spin mb-4" />
          <h3 className="font-display font-bold text-sm text-emerald-strong">Securing Ingredient Inventory...</h3>
          <p className="text-xs text-muted-grey mt-1 max-w-sm">
            Communicating with <strong>{activeVendor?.name}</strong>. Reserving delivery slots under the flat ₦150 dispatch window.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="checkout_main_grid">
          {/* Left Summary columns */}
          <div className="lg:col-span-2 space-y-6">
            <GlassPanel className="p-6">
              <h3 className="font-display font-bold text-sm text-emerald-strong mb-4">Takeway Booking Breakdown</h3>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 p-4 bg-emerald-deep/5 rounded-2xl border border-emerald-deep/10">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-white rounded-xl text-emerald-deep border border-neutral-100/80 shadow-xs">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-emerald-strong uppercase tracking-wider">Configure Delivery Destination</h4>
                      <p className="text-[10px] text-muted-grey mt-0.5">Choose your delivery drop-off terminal/location for this order:</p>
                      
                      <div className="mt-2.5 relative">
                        <select
                          value={cart?.deliveryLocationId || user?.defaultLocationId}
                          onChange={(e) => {
                            if (cart) {
                              setCurrentDateTimeLocation(cart.deliveryDate, cart.deliverySlotId, e.target.value);
                            }
                          }}
                          className="w-full text-xs font-bold text-ink-deep bg-white border border-neutral-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-deep focus:border-emerald-deep cursor-pointer"
                          id="checkout_location_picker"
                        >
                          {PRESET_LOCATIONS.map(loc => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name} ({loc.zone})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-neutral-50 rounded-xl text-emerald-deep border border-neutral-100">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-strong">Delivery Slot Time Window</h4>
                    <p className="text-[11px] text-muted-grey mt-0.5">{activeSlot ? activeSlot.label : 'None configured'}</p>
                    <span className="inline-block mt-1 text-[9px] bg-mango-warm/15 px-2 py-0.5 text-orange-700 font-semibold rounded-md border border-mango-warm/20">
                      Standard batch delivery
                    </span>
                  </div>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-4.5 h-4.5 text-emerald-deep" />
                <h3 className="font-display font-bold text-sm text-emerald-strong">Special Delivery & Kitchen Instructions</h3>
              </div>
              <p className="text-xs text-muted-grey mb-3 leading-relaxed font-normal">
                Specify optional details such as delivery gate codes, specific outer entrance directions, or food allergy requests for the kitchen staff.
              </p>
              <div className="relative">
                <textarea
                  placeholder="e.g. Gate code is #5512. Hall 4 entrance. Allergy: Absolutely no peanuts or trace seafood elements, thank you!"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full text-xs font-semibold text-ink-deep bg-neutral-50/50 hover:bg-neutral-50 border border-emerald-deep/12 rounded-2xl p-3.5 min-h-[90px] pr-20 focus:ring-2 focus:ring-emerald-deep focus:outline-none focus:bg-white transition-all placeholder:text-muted-grey/60 placeholder:font-normal resize-none"
                  id="checkout_special_instructions"
                  maxLength={400}
                />
                <span className="absolute bottom-3.5 right-3 text-[9px] font-mono font-black text-muted-grey bg-neutral-100 px-1.5 py-0.5 rounded">
                  {specialInstructions.length}/400 chars
                </span>
              </div>
            </GlassPanel>

            <GlassPanel className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4.5 h-4.5 text-emerald-deep" />
                <h3 className="font-display font-bold text-sm text-emerald-strong">Remittance Protocol</h3>
              </div>
              <p className="text-xs text-muted-grey leading-relaxed">
                Meal Direct complies with global card encryption laws. We do not store credit card inputs on local terminal databases. Paystack processes transaction validations independently with campus bank structures.
              </p>
            </GlassPanel>
          </div>

          {/* Right Summation Cards */}
          <div>
            <GlassPanel className="p-6 bg-emerald-strong text-white border-t-4 border-t-mango-warm">
              <h3 className="font-display text-base font-bold mb-4">Remittance Quote</h3>

              <div className="space-y-3 pb-4 border-b border-white/8 text-xs text-white/80">
                <div className="flex justify-between">
                  <span>Takeaways Basket:</span>
                  <Currency kobo={displaySubtotalKobo} className="text-white font-bold" />
                </div>
                <div className="flex justify-between">
                  <span>Spoons customization:</span>
                  <span className="text-mango-warm font-semibold font-mono">{quote.spoonCount} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Dispatch Courier Fee:</span>
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

              {/* Promo code */}
              <div className="py-4 border-b border-white/8">
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

              <div className="flex justify-between items-baseline py-4 mb-6">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  Remittance Total:
                  {isQuoteLoading && <Loader2 className="w-3 h-3 animate-spin text-white/60" />}
                  {!isQuoteLoading && !serverQuote && <span className="text-[8px] font-bold text-white/50 uppercase">(est)</span>}
                </span>
                <span className="text-xl font-black text-mango-warm select-all"><Currency kobo={displayTotalKobo} /></span>
              </div>

              {exceedsCap && (
                <div className="mb-3 p-3 bg-red-500/15 border border-red-300/30 rounded-xl text-[10px] text-red-100 font-semibold">
                  Total {formatNGN(displayTotalKobo)} is over the {formatNGN(MAX_ORDER_TOTAL_KOBO)} per-order maximum.{' '}
                  <button onClick={() => navigateTo('/cart')} className="underline font-bold cursor-pointer">Reduce your cart</button> to continue.
                </div>
              )}

              {hasUnavailable && (
                <div className="mb-3 p-3 bg-red-500/15 border border-red-300/30 rounded-xl text-[10px] text-red-100 font-semibold">
                  Out of stock for this date/slot: {unavailableItems.map(it => it.name).join(', ')}. Change the delivery date or slot in your cart.
                </div>
              )}

              <button
                onClick={handleLaunchPayment}
                disabled={hasUnavailable || isQuoteLoading || exceedsCap}
                className={`w-full py-4 font-bold text-xs rounded-2xl transition shadow-lg shadow-emerald-deep/15 flex items-center justify-center gap-2 ${
                  hasUnavailable || isQuoteLoading || exceedsCap
                    ? 'bg-mango-warm/40 text-emerald-strong/50 cursor-not-allowed'
                    : 'bg-mango-warm hover:bg-amber-400 text-emerald-strong active:scale-95 cursor-pointer'
                }`}
                id="launch_paystack_simulation"
              >
                <CreditCard className="w-4 h-4" />
                <span>Initialize Paystack Portal</span>
              </button>
            </GlassPanel>
          </div>
        </div>
      )}

    </AppShell>
  );
};
