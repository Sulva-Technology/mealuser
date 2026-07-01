import React, { useState, useEffect } from 'react';
import { useMealDirect, apiRequest, mapMenuItem } from '../store';
import { AppShell, GlassPanel, Currency } from './CommonUI';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ArrowLeft, Clock, Star, Plus, Minus, ShoppingCart, Info, ShieldAlert, Trash2, Flame, Sparkles, Heart, Check } from 'lucide-react';
import { CartItem, MenuItem } from '../types';
import { resolveImage, handleImageError } from '../utils/images';

interface VendorDetailViewProps {
  vendorId: string;
}

interface NutritionData {
  calories: number;
  protein: string;
  carbs: string;
  fats: string;
  allergens: string[];
  healthTips: string;
  isSimulated?: boolean;
}

export const VendorDetailView: React.FC<VendorDetailViewProps> = ({ vendorId }) => {
  const {
    cart,
    addToCart,
    addItemsToCart,
    updateCartItemSpoons,
    clearCart,
    navigateTo,
    favoriteItemIds,
    toggleFavoriteItem,
    menuItemReviews,
    createMenuItemReview,
    vendors
  } = useMealDirect();

  // Multi-select "order form" state: menuItemId -> chosen quantity. Items here are
  // staged and committed to the cart together via the single Add-all button.
  const [selection, setSelection] = useState<Record<string, number>>({});
  const selectedCount = Object.keys(selection).length;

  const toggleSelect = (id: string) => {
    setSelection(prev => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const setSelectionQty = (id: string, qty: number) => {
    setSelection(prev => ({ ...prev, [id]: Math.max(1, Math.min(99, qty)) }));
  };

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Review form state
  const [ratingTemp, setRatingTemp] = useState<number>(5);
  const [commentTemp, setCommentTemp] = useState<string>('');

  // Real per-item rating stats (no hardcoded seed values)
  const getItemRatingStats = (itemId: string) => {
    const itemRevs = (menuItemReviews || []).filter(r => r.menuItemId === itemId);
    if (itemRevs.length === 0) return { avg: 0, count: 0, reviews: itemRevs };
    const sum = itemRevs.reduce((acc, r) => acc + r.rating, 0);
    return { avg: Number((sum / itemRevs.length).toFixed(1)), count: itemRevs.length, reviews: itemRevs };
  };

  useEffect(() => {
    setIsLoading(true);
    apiRequest(`/catalog/vendors/${vendorId}/menu`, 'GET', null)
      .then(items => {
        setMenuItems(Array.isArray(items) ? items.map((it: any) => mapMenuItem(it, vendorId)) : []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [vendorId]);

  const vendor = vendors.find(v => v.id === vendorId);

  // Item detail modal state
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [spoonCountTemp, setSpoonCountTemp] = useState<number>(1);
  const [showReplaceCartModal, setShowReplaceCartModal] = useState(false);
  const [pendingCartItem, setPendingCartItem] = useState<{ vId: string; item: CartItem } | null>(null);
  // Set when a multi-select batch is pending a cart-replace confirmation.
  const [pendingBatch, setPendingBatch] = useState<CartItem[] | null>(null);

  // Nutrition (local estimate via /api/nutrition)
  const [nutrition, setNutrition] = useState<NutritionData | null>(null);
  const [isNutritionLoading, setIsNutritionLoading] = useState(false);

  useEffect(() => {
    if (!selectedItem) {
      setNutrition(null);
      return;
    }
    setIsNutritionLoading(true);
    setNutrition(null);
    fetch('/api/nutrition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemName: selectedItem.name,
        description: selectedItem.description,
        vendorName: vendor?.name || 'Meal Direct Kitchen',
        category: selectedItem.category
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(data => setNutrition(data))
      .catch(() => setNutrition(null))
      .finally(() => setIsNutritionLoading(false));
  }, [selectedItem, vendor]);

  const cartItemsMap = React.useMemo(() => {
    const map: Record<string, CartItem> = {};
    if (cart && cart.vendorId === vendorId) {
      cart.items.forEach(it => { map[it.menuItemId] = it; });
    }
    return map;
  }, [cart, vendorId]);

  const activeItemsCostKobo = React.useMemo(() => {
    if (!cart || cart.vendorId !== vendorId) return 0;
    return cart.items.reduce((sum, item) => {
      const menuIt = menuItems.find(mi => mi.id === item.menuItemId);
      return sum + ((menuIt?.priceKobo || 0) * item.quantity);
    }, 0);
  }, [cart, vendorId, menuItems]);

  if (!vendor) {
    return (
      <AppShell activeTab="vendors">
        <div className="text-center py-12 bg-white rounded-2xl border border-red-200">
          <ShieldAlert className="w-12 h-12 text-danger mx-auto mb-3" />
          <p className="text-sm font-bold text-emerald-strong">Vendor ID '{vendorId}' is not registered on this campus catalog.</p>
          <button onClick={() => navigateTo('/vendors')} className="mt-4 px-4 py-2 bg-emerald-deep text-white rounded-xl text-xs font-bold cursor-pointer">
            Back to Vendors
          </button>
        </div>
      </AppShell>
    );
  }

  const categories = Array.from(new Set(menuItems.map(item => item.category)));

  // Commit the staged multi-select form to the cart. If a cart from another vendor
  // exists, defer to the replace-cart confirmation first.
  const handleAddSelected = () => {
    const items: CartItem[] = Object.entries(selection).map(([menuItemId, quantity]) => ({
      menuItemId,
      quantity,
      spoonsCount: cartItemsMap[menuItemId]?.spoonsCount ?? 1
    }));
    if (!items.length) return;

    if (cart && cart.vendorId !== vendorId) {
      setPendingBatch(items);
      setShowReplaceCartModal(true);
      return;
    }

    addItemsToCart(vendorId, items);
    setSelection({});
  };

  const handleConfirmReplaceCart = () => {
    if (pendingBatch) {
      clearCart();
      setTimeout(() => {
        addItemsToCart(vendorId, pendingBatch);
        setShowReplaceCartModal(false);
        setPendingBatch(null);
        setSelection({});
      }, 50);
      return;
    }
    if (pendingCartItem) {
      clearCart();
      setTimeout(() => {
        addToCart(pendingCartItem.vId, pendingCartItem.item);
        setShowReplaceCartModal(false);
        setPendingCartItem(null);
      }, 50);
    }
  };

  const handleOpenItemDetail = (item: MenuItem) => {
    const existing = cartItemsMap[item.id];
    setSpoonCountTemp(existing ? existing.spoonsCount : 1);
    setSelectedItem(item);
  };

  const handleSaveItemDetails = () => {
    if (!selectedItem) return;
    const existing = cartItemsMap[selectedItem.id];
    const payload: CartItem = {
      menuItemId: selectedItem.id,
      quantity: existing ? existing.quantity : 1,
      spoonsCount: spoonCountTemp
    };

    if (cart && cart.vendorId !== vendorId) {
      setPendingCartItem({ vId: vendorId, item: payload });
      setSelectedItem(null);
      setShowReplaceCartModal(true);
      return;
    }

    if (existing) updateCartItemSpoons(selectedItem.id, spoonCountTemp);
    else addToCart(vendorId, payload);
    setSelectedItem(null);
  };

  return (
    <AppShell activeTab="vendors">
      <button
        onClick={() => navigateTo('/home')}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-deep hover:underline cursor-pointer"
        id="back_to_vendors_btn"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home Catalog</span>
      </button>

      {isLoading ? (
        <LoadingSkeleton.Detail />
      ) : (
        <>
          {/* Vendor banner */}
          <section className="mb-6" id="vendor_detail_banner">
            <div className="bg-white rounded-3xl border border-emerald-deep/8 overflow-hidden shadow-xs">
              <div className="h-48 md:h-60 w-full relative">
                <img src={resolveImage(vendor.imageUrl, vendor.name)} onError={handleImageError(vendor.name)} alt={vendor.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <h2 className="font-display text-2xl md:text-3xl font-black tracking-tight" id="active_vendor_name">{vendor.name}</h2>
                  <p className="text-xs text-neutral-200 mt-1" id="active_vendor_desc">{vendor.description}</p>
                </div>
              </div>

              <div className="p-4 px-6 bg-neutral-50/50 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-muted-grey">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-mango-warm stroke-mango-warm text-mango-warm" />
                  <span className="text-ink-deep font-bold">{(vendor.rating ?? 0).toFixed(1)}</span>
                  <span>({vendor.reviewCount ?? 0} total campus ratings)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-deep" />
                  <span>Cooking + delivery ready in <strong>~{vendor.preparationTimeMins ?? 30} mins</strong></span>
                </div>
              </div>
            </div>
          </section>

          {/* Menu items grouped by category — multi-select order form */}
          {menuItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-emerald-deep/8">
              <p className="text-sm font-bold text-emerald-strong">No menu items available for this vendor yet.</p>
            </div>
          ) : (
            <form
              className="space-y-8"
              id="menu_items_stage"
              onSubmit={(e) => { e.preventDefault(); handleAddSelected(); }}
            >
              <div className="flex items-center gap-2 text-[11px] text-muted-grey bg-emerald-deep/5 border border-emerald-deep/10 rounded-xl px-3.5 py-2.5">
                <Check className="w-4 h-4 text-emerald-deep shrink-0" />
                <span>Tick every dish you want, set its quantity, then add them all to your cart in one go.</span>
              </div>

              {categories.map(category => {
                const items = menuItems.filter(mi => mi.category === category);
                return (
                  <fieldset key={category}>
                    <legend className="font-display font-medium text-xs tracking-widest text-emerald-strong bg-emerald-deep/5 px-2.5 py-1 rounded uppercase mb-4">
                      {category}
                    </legend>

                    <div className="space-y-2.5">
                      {items.map(item => {
                        const activeInCart = cartItemsMap[item.id];
                        const isFav = favoriteItemIds?.includes(item.id);
                        const { avg, count } = getItemRatingStats(item.id);
                        const isSelected = item.id in selection;
                        const selQty = selection[item.id] ?? 1;

                        return (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            onClick={() => toggleSelect(item.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelect(item.id); } }}
                            className={`rounded-2xl border p-3.5 flex gap-3.5 shadow-xs transition relative animate-fade-in cursor-pointer ${isSelected ? 'border-emerald-deep ring-1 ring-emerald-deep/30 bg-emerald-deep/[0.03]' : 'bg-white border-emerald-deep/6 hover:border-emerald-deep/15'}`}
                            id={`menu_item_row_${item.id}`}
                          >
                            {/* Selection checkbox */}
                            <div className={`mt-0.5 w-5 h-5 rounded-md border shrink-0 flex items-center justify-center transition ${isSelected ? 'bg-emerald-deep border-emerald-deep text-white' : 'bg-white border-emerald-deep/25'}`}>
                              {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                            </div>

                            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-neutral-100 relative">
                              <img src={resolveImage(item.imageUrl, item.name)} onError={handleImageError(item.name)} alt={item.name} className="w-full h-full object-cover" />
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-display font-bold text-xs text-emerald-strong leading-normal">{item.name}</h4>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); toggleFavoriteItem(item.id); }}
                                      className={`p-1 rounded-md transition cursor-pointer ${isFav ? 'text-rose-500 hover:text-rose-600' : 'text-neutral-400 hover:text-rose-500'}`}
                                      title={isFav ? 'Remove from Favorites' : 'Save to Favorites'}
                                      id={`fav_toggle_${item.id}`}
                                    >
                                      <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500' : ''}`} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleOpenItemDetail(item); }}
                                      className="text-muted-grey hover:text-emerald-deep p-1 rounded-md transition cursor-pointer"
                                      title="More details, nutrition & spoons"
                                    >
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-grey line-clamp-1 mt-0.5 leading-relaxed">{item.description}</p>

                                {count > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Star className="w-3 h-3 text-mango-warm fill-mango-warm" />
                                    <span className="text-[10px] font-bold text-ink-deep leading-none">{avg}</span>
                                    <span className="text-[9px] text-muted-grey font-medium leading-none">({count})</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Currency kobo={item.priceKobo} className="text-xs text-ink-deep" />
                                  {activeInCart && (
                                    <span className="text-[8.5px] font-black uppercase tracking-wide text-emerald-strong bg-emerald-deep/10 px-1.5 py-0.5 rounded shrink-0">In cart · {activeInCart.quantity}</span>
                                  )}
                                </div>

                                {isSelected && (
                                  <div className="flex items-center gap-1.5 bg-emerald-deep/5 border border-emerald-deep/12 rounded-lg p-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" onClick={() => setSelectionQty(item.id, selQty - 1)} className="w-6 h-6 rounded-md hover:bg-emerald-deep/10 text-emerald-strong flex items-center justify-center cursor-pointer transition" id={`sel_sub_${item.id}`} aria-label="Decrease quantity">
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs font-bold font-mono text-emerald-strong px-1 min-w-5 text-center">{selQty}</span>
                                    <button type="button" onClick={() => setSelectionQty(item.id, selQty + 1)} className="w-6 h-6 rounded-md hover:bg-emerald-deep/10 text-emerald-strong flex items-center justify-center cursor-pointer transition" id={`sel_add_${item.id}`} aria-label="Increase quantity">
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}

              {/* Single add-all submit for the whole selection */}
              <button
                type="submit"
                disabled={selectedCount === 0}
                className="w-full py-3.5 bg-emerald-deep hover:bg-emerald-strong disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-deep/20 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                id="add_selected_to_cart_btn"
              >
                <ShoppingCart className="w-4 h-4" />
                {selectedCount === 0
                  ? 'Select dishes to add'
                  : `Add ${selectedCount} ${selectedCount === 1 ? 'dish' : 'dishes'} to cart`}
              </button>

              {/* Spacer so the fixed cart panel / bottom nav never hides the submit */}
              <div className="h-28" />
            </form>
          )}
        </>
      )}

      {/* Sticky cart summation panel */}
      {cart && cart.vendorId === vendorId && (
        <div className="fixed bottom-14 md:bottom-5 left-4 right-4 md:left-auto md:right-5 md:w-80 bg-emerald-strong text-white rounded-2xl p-4 shadow-xl border border-white/5 animate-slide-up z-30">
          <div className="flex items-center justify-between mb-3 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-mango-warm" />
              <span>Takeaway Review:</span>
            </div>
            <span className="bg-white/15 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{cart.items.length} items</span>
          </div>

          <div className="flex items-baseline justify-between mb-4">
            <span className="text-[10px] text-neutral-300">Takeaway Pack price:</span>
            <span className="text-sm font-black text-mango-warm"><Currency kobo={activeItemsCostKobo} /></span>
          </div>

          <button onClick={() => navigateTo('/cart')} className="w-full py-3 bg-mango-warm text-emerald-strong hover:bg-amber-400 font-bold text-xs rounded-xl transition cursor-pointer text-center shadow-lg active:scale-95 flex items-center justify-center gap-2" id="proceed-to-cart-sum">
            <span>Proceed to Cart Quote</span>
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Item detail modal: nutrition + spoons + reviews */}
      {selectedItem && (
        <dialog open className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="item_detail_dialog">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[88vh] overflow-y-auto border border-emerald-deep/12 shadow-2xl flex flex-col gap-5">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-3 bg-neutral-100">
                <img src={resolveImage(selectedItem.imageUrl, selectedItem.name)} onError={handleImageError(selectedItem.name)} alt={selectedItem.name} className="w-full h-full object-cover" />
              </div>
              <h3 className="font-display font-black text-sm text-emerald-strong">{selectedItem.name}</h3>
              <p className="text-[10px] text-muted-grey mt-1">{selectedItem.description}</p>
            </div>

            {/* Nutrition (local estimate) */}
            <div className="bg-emerald-deep/5 p-4 rounded-2xl border border-emerald-deep/8 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-emerald-deep/10 pb-2">
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-strong">
                  <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                  <span>Estimated Nutrition</span>
                </span>
                {nutrition && (
                  <span className="text-[8px] font-bold text-muted-grey bg-white px-2 py-0.5 rounded border border-neutral-100 uppercase tracking-widest">Est</span>
                )}
              </div>

              {isNutritionLoading ? (
                <div className="space-y-2 animate-pulse min-h-[70px]">
                  <div className="h-4 bg-emerald-deep/10 rounded w-2/3" />
                  <div className="grid grid-cols-4 gap-2">
                    <div className="h-10 bg-emerald-deep/10 rounded" />
                    <div className="h-10 bg-emerald-deep/10 rounded" />
                    <div className="h-10 bg-emerald-deep/10 rounded" />
                    <div className="h-10 bg-emerald-deep/10 rounded" />
                  </div>
                </div>
              ) : nutrition ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-white p-2 rounded-xl border border-emerald-deep/6">
                      <span className="text-[8px] font-black uppercase text-muted-grey block">Energy</span>
                      <span className="text-xs font-black text-emerald-strong">{nutrition.calories} <span className="text-[9px] font-normal">kcal</span></span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-deep/6">
                      <span className="text-[8px] font-black uppercase text-muted-grey block">Protein</span>
                      <span className="text-xs font-bold text-emerald-strong">{nutrition.protein}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-deep/6">
                      <span className="text-[8px] font-black uppercase text-muted-grey block">Carbs</span>
                      <span className="text-xs font-bold text-emerald-strong">{nutrition.carbs}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-deep/6">
                      <span className="text-[8px] font-black uppercase text-muted-grey block">Fats</span>
                      <span className="text-xs font-bold text-emerald-strong">{nutrition.fats}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-bold text-muted-grey">Allergens:</span>
                    {nutrition.allergens.length === 0 || (nutrition.allergens.length === 1 && nutrition.allergens[0].toLowerCase() === 'none') ? (
                      <span className="bg-emerald-deep/10 text-emerald-strong font-black text-[9px] px-2 py-0.5 rounded-full uppercase border border-emerald-deep/12">✓ Allergen Safe</span>
                    ) : (
                      nutrition.allergens.map((alg, aIdx) => (
                        <span key={aIdx} className="bg-red-50 text-danger font-black text-[9px] px-2 py-0.5 rounded-full uppercase border border-red-100 flex items-center gap-0.5">⚠️ {alg}</span>
                      ))
                    )}
                  </div>

                  <p className="text-[10px] text-muted-grey leading-relaxed italic bg-white/40 p-2.5 rounded-xl border border-neutral-100 flex gap-1 items-start">
                    <Sparkles className="w-3.5 h-3.5 text-[#F3B33D] shrink-0 mt-0.5" />
                    <span>{nutrition.healthTips}</span>
                  </p>
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-muted-grey font-medium">Nutrition estimate unavailable.</div>
              )}
            </div>

            {/* Spoons */}
            <div className="bg-neutral-50 p-4 rounded-2xl border border-emerald-deep/8">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-emerald-strong justify-center">
                <Info className="w-4 h-4 text-emerald-deep" />
                <span>Plastic Spoons (Max 3)</span>
              </div>
              <p className="text-[9px] text-muted-grey text-center mb-3">Request only what you need to reduce plastic waste.</p>
              <div className="flex items-center justify-center gap-3">
                <button type="button" onClick={() => setSpoonCountTemp(prev => Math.max(0, prev - 1))} className="w-8 h-8 rounded-full bg-emerald-deep/5 hover:bg-emerald-deep/10 text-emerald-strong flex items-center justify-center font-bold cursor-pointer transition text-xs">-</button>
                <div className="text-center min-w-16">
                  <span className="text-sm font-black font-mono text-emerald-strong">{spoonCountTemp}</span>
                  <span className="text-[9px] text-muted-grey block mt-0.5">{spoonCountTemp === 1 ? 'Plastic Spoon' : 'Plastic Spoons'}</span>
                </div>
                <button type="button" onClick={() => setSpoonCountTemp(prev => Math.min(3, prev + 1))} className="w-8 h-8 rounded-full bg-emerald-deep/5 hover:bg-emerald-deep/10 text-emerald-strong flex items-center justify-center font-bold cursor-pointer transition text-xs">+</button>
              </div>
            </div>

            {/* Reviews */}
            <div className="border-t border-neutral-100 pt-4 mt-2 space-y-3.5">
              <h4 className="font-display font-bold text-xs text-emerald-strong flex items-center justify-between">
                <span>Meal Feedback & Student Reviews</span>
                {getItemRatingStats(selectedItem.id).count > 0 && (
                  <span className="text-[10px] font-bold text-mango-warm flex items-center gap-0.5">
                    ⭐ {getItemRatingStats(selectedItem.id).avg} ({getItemRatingStats(selectedItem.id).count})
                  </span>
                )}
              </h4>

              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/60 flex flex-col gap-2">
                <span className="text-[9.5px] font-bold text-emerald-strong uppercase tracking-wide">Write a Review</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-muted-grey">Your Score:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <button key={starVal} type="button" onClick={() => setRatingTemp(starVal)} className="hover:scale-110 transition duration-150 cursor-pointer p-0.5" title={`Rate ${starVal} Star`}>
                        <Star className={`w-4 h-4 ${starVal <= ratingTemp ? 'text-mango-warm fill-mango-warm' : 'text-neutral-300'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <input type="text" value={commentTemp} onChange={(e) => setCommentTemp(e.target.value)} placeholder="Share your thoughts on this dish" className="flex-1 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs placeholder:text-neutral-400 text-ink-deep font-medium focus:outline-none focus:ring-1 focus:ring-emerald-deep" id="standard_item_comment_input" />
                  <button
                    type="button"
                    onClick={() => {
                      if (!commentTemp.trim()) return;
                      createMenuItemReview(selectedItem.id, ratingTemp, commentTemp);
                      setCommentTemp('');
                      setRatingTemp(5);
                    }}
                    className="px-3 py-1.5 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-[10px] rounded-lg cursor-pointer"
                  >
                    Post
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {getItemRatingStats(selectedItem.id).reviews.length > 0 ? (
                  getItemRatingStats(selectedItem.id).reviews.map((rev) => (
                    <div key={rev.id} className="p-2 rounded-lg bg-neutral-50/50 border border-neutral-100 text-[10px] leading-relaxed">
                      <div className="flex items-center justify-between font-bold mb-0.5">
                        <span className="text-emerald-strong">{rev.userName}</span>
                        <span className="text-mango-warm">{'★'.repeat(rev.rating)}</span>
                      </div>
                      <p className="text-muted-grey text-[9px] italic">"{rev.comment}"</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-3 bg-neutral-50/50 rounded-lg border border-dashed border-neutral-200">
                    <p className="text-[9.5px] text-muted-grey italic">No student reviews yet. Be the first to leave one! ⭐</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setSelectedItem(null)} className="flex-1 py-3 bg-neutral-50 hover:bg-neutral-100 text-muted-grey font-bold text-xs rounded-xl transition cursor-pointer">Close</button>
              <button type="button" onClick={handleSaveItemDetails} className="flex-1 py-3 bg-emerald-deep hover:bg-emerald-strong text-white font-bold text-xs rounded-xl transition cursor-pointer text-center">Save Choice</button>
            </div>
          </div>
        </dialog>
      )}

      {/* Replace cart dialog */}
      {showReplaceCartModal && (
        <dialog open className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="replace_cart_dialog">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-red-100 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2.5 text-danger font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-danger" />
              <span>Replace Takeaway Cart?</span>
            </div>
            <p className="text-xs text-muted-grey leading-relaxed">
              You already have items from another kitchen. A Meal Direct takeaway can only process <strong>one vendor per order</strong>.
            </p>
            <span className="text-[10px] text-muted-grey bg-red-50/50 p-2.5 rounded-xl border border-red-200">
              Continuing will discard your old selection and start empty.
            </span>
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setShowReplaceCartModal(false); setPendingCartItem(null); setPendingBatch(null); }} className="flex-1 py-2.5 bg-neutral-50 hover:bg-neutral-100 text-muted-grey font-semibold text-xs rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleConfirmReplaceCart} className="flex-1 py-2.5 bg-danger hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-red-200" id="confirm_replace_cart">
                <Trash2 className="w-3.5 h-3.5" /> Discard & Add
              </button>
            </div>
          </div>
        </dialog>
      )}
    </AppShell>
  );
};
