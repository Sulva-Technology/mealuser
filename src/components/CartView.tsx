import React, { useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency } from './CommonUI';
import {
  Trash2,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Award,
  AlertTriangle,
  ArrowRight,
  Info
} from 'lucide-react';

import emptyCartIllustration from '../assets/images/empty_cart_illustration_1781791204037.jpg';

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
    isOnline,
    savedLocationIds,
    setCurrentDateTimeLocation,
    campuses: CAMPUSES,
    locations: PRESET_LOCATIONS,
    deliverySlots: DELIVERY_SLOTS,
    menuItems: MENU_ITEMS
  } = useMealDirect();

  // Dialog configurations
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [acknowledgedQuote, setAcknowledgedQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

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

  // Trigger quote submit mapping to checkout page
  const handleProceedToCheckout = () => {
    if (!isOnline) {
      setQuoteError('Cannot proceed in offline cache mode. Internet connection is required for absolute inventory verification.');
      return;
    }
    if (!quote.isValid) {
      setQuoteError(quote.errors[0] || 'Takeaway validation checks failed.');
      return;
    }
    if (!acknowledgedQuote) {
      setQuoteError('Please acknowledge the price quote terms before proceeding to Paystack submission.');
      return;
    }

    navigateTo('/checkout');
  };

  const handleClearCart = () => {
    clearCart();
    setShowClearConfirm(false);
  };

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

                return (
                  <div key={cartItem.menuItemId} className="py-4.5 first:pt-0 last:pb-0 flex gap-4">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-neutral-100">
                      <img src={dbItem.imageUrl} alt={dbItem.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-emerald-strong truncate">{dbItem.name}</h4>
                        <Currency kobo={itemTotalKobo} className="text-xs text-ink-deep font-bold" />
                      </div>

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

              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-neutral-50/50 border border-neutral-100">
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
                  className="w-full text-[11px] font-bold text-ink-deep bg-white border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-deep cursor-pointer mt-1"
                  id="cart_slot_picker"
                >
                  {DELIVERY_SLOTS.map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label}
                    </option>
                  ))}
                </select>
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
        </div>

        {/* Right Segment (Quoting & Terms verification) */}
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
                <Currency kobo={quote.subtotalKobo} className="text-white font-bold" />
              </div>
              
              <div className="flex justify-between">
                <span>Flat Delivery fee:</span>
                <Currency kobo={15000} className="text-white font-bold" />
              </div>
            </div>

            <div className="flex justify-between items-baseline py-4 mb-4">
              <span className="text-xs font-bold text-white">Estimated Quote Total:</span>
              <span className="text-xl font-black text-mango-warm select-all"><Currency kobo={quote.totalKobo} /></span>
            </div>

            {/* Acknowledgment checkbox */}
            <label className="flex items-start gap-2.5 bg-white/5 rounded-xl p-3 border border-white/8 cursor-pointer select-none mb-6">
              <input
                type="checkbox"
                checked={acknowledgedQuote}
                onChange={(e) => setAcknowledgedQuote(e.target.checked)}
                className="w-4.5 h-4.5 rounded accent-mango-warm cursor-pointer mt-0.5"
                id="ack_quote_checkbox"
              />
              <span className="text-[10px] leading-relaxed text-white/80">
                I understand this is an estimated quote. Final item availability and checkout prices will be autoritatively locked at payment initiation.
              </span>
            </label>

            <button
              onClick={handleProceedToCheckout}
              disabled={quote.spoonCount > 3}
              className={`w-full py-4 rounded-2xl font-bold text-xs transition duration-200 text-center flex items-center justify-center gap-2 ${
                quote.spoonCount > 3
                  ? 'bg-emerald-deep/20 text-neutral-400 cursor-not-allowed'
                  : 'bg-mango-warm text-emerald-strong hover:bg-amber-400 cursor-pointer shadow-lg active:scale-95'
              }`}
              id="proceed_to_checkout_btn"
            >
              <span>Proceed to Paystack checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </GlassPanel>
        </div>
      </div>

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
