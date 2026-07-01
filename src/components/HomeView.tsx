import React, { useState, useEffect } from 'react';
import { useMealDirect } from '../store';
import { isSlotAvailable } from '../utils/helpers';
import { resolveImage, handleImageError } from '../utils/images';
// First import Skeleton
import { AppShell, GlassPanel, Currency, Skeleton } from './CommonUI';
// ... remove LoadingSkeleton import if possible or just ignore it.
import { PullToRefresh } from './PullToRefresh';
import {
  Calendar,
  MapPin,
  Store,
  ChevronRight,
  AlertCircle,
  Bookmark,
  Heart,
  Plus,
  Star,
  Flame
} from 'lucide-react';

export const HomeView: React.FC = () => {
  const {
    user,
    orders,
    navigateTo,
    currentDate,
    currentSlotId,
    currentLocationId,
    setCurrentDateTimeLocation,
    savedLocationIds,
    favoriteItemIds,
    toggleFavoriteItem,
    addToCart,
    cart,
    campuses: CAMPUSES,
    locations: PRESET_LOCATIONS,
    deliverySlots: DELIVERY_SLOTS,
    vendors: VENDORS,
    menuItems: MENU_ITEMS
  } = useMealDirect();

  // Tab state: 'vendors' or 'favorites'
  const [activeCatalogTab, setActiveCatalogTab] = useState<'vendors' | 'favorites'>('vendors');
  const [cartConflictError, setCartConflictError] = useState<string | null>(null);

  // Selected date state
  const [tempDate, setTempDate] = useState(currentDate);

  // Simulated API loading state
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 850);
    return () => clearTimeout(timer);
  }, []);

  // Fallback for user location
  const activeLocId = currentLocationId || user?.defaultLocationId || '';
  const activeLocation = PRESET_LOCATIONS.find(l => l.id === activeLocId);
  const activeCampus = CAMPUSES.find(c => c.id === user?.campusId);

  // Active / Tracking orders check
  const activeOrders = orders.filter(o =>
    o.status !== 'CONFIRMED' && o.status !== 'CANCELLED' && o.status !== 'REFUNDED'
  );

  // Top 3 kitchens by rating — the first thing a hungry student wants to see.
  const topVendors = [...VENDORS].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3);

  // Most-ordered dishes across every vendor, aggregated from this student's order
  // history (order items already carry name + price, so this needs no menu lookup).
  const dishTally = new Map<string, { menuItemId: string; name: string; priceKobo: number; vendorId: string; qty: number }>();
  orders.forEach(o =>
    o.items.forEach(it => {
      const existing = dishTally.get(it.menuItemId);
      if (existing) existing.qty += it.quantity;
      else dishTally.set(it.menuItemId, { menuItemId: it.menuItemId, name: it.name, priceKobo: it.priceKobo, vendorId: o.vendorId, qty: it.quantity });
    })
  );
  const topDishes = Array.from(dishTally.values()).sort((a, b) => b.qty - a.qty).slice(0, 4);

  // Favorited dishes that actually resolve in the loaded catalog. Driving the tab
  // count off this list keeps the badge and the rendered cards in agreement.
  const favoriteItems = MENU_ITEMS.filter(it => favoriteItemIds?.includes(it.id));

  const handleSlotSelect = (slotId: string) => {
    setCurrentDateTimeLocation(currentDate, slotId, activeLocId);
  };

  const handleDateChange = (dateStr: string) => {
    setTempDate(dateStr);
    setCurrentDateTimeLocation(dateStr, currentSlotId, activeLocId);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        setIsLoading(false);
        resolve();
      }, 850);
    });
  };

  return (
    <AppShell activeTab="home">
      <PullToRefresh onRefresh={handleRefresh}>
      {/* 1. Header Greeting HUD & Preset Location indicator */}
      <section className="mb-8" id="home_hud_header">
        <GlassPanel className="p-6 border-l-4 border-l-emerald-deep relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-emerald-deep/5 rounded-full" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            <div>
              <p className="text-[10px] font-bold text-muted-grey uppercase tracking-wider">Welcome Back 👋</p>
              <h2 className="font-display text-2xl font-black text-emerald-strong mt-0.5" id="home_greeting_name">
                {user?.fullName || 'Welcome'}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 md:gap-3 text-xs text-muted-grey mt-2">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-deep" />
                  <strong>Preset Desk:</strong> {activeLocation ? `${activeLocation.name} (${activeLocation.zone})` : 'None registered'}
                </span>
                <span className="text-neutral-200 hidden md:inline">|</span>
                <span className="text-[11px] font-mono text-emerald-deep bg-emerald-deep/5 border border-emerald-deep/12 rounded px-2 py-0.2">
                  Launch Flat Fee: ₦150
                </span>
              </div>

              {savedLocationIds.length > 0 && (
                <div className="flex items-center gap-2 mt-4 flex-wrap border-t border-emerald-deep/8 pt-3">
                  <span className="text-[10px] font-bold text-emerald-strong uppercase tracking-wider flex items-center gap-1">
                    <Bookmark className="w-3 h-3 fill-current text-amber-500 shrink-0" />
                    <span>Quick-Select Saved Locations:</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {savedLocationIds.map(locId => {
                      const loc = PRESET_LOCATIONS.find(l => l.id === locId);
                      if (!loc) return null;
                      const isSelected = activeLocId === locId;
                      return (
                        <button
                          key={locId}
                          onClick={() => {
                            setCurrentDateTimeLocation(currentDate, currentSlotId, locId);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border transition text-[10px] font-bold cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-emerald-deep text-white border-emerald-deep shadow-xs'
                              : 'bg-white border-neutral-100 text-[#47544F] hover:border-emerald-deep/40 hover:bg-neutral-50/50'
                          }`}
                          title={`Instantly set to ${loc.name}`}
                        >
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          <span>{loc.name.split(' (')[0].replace('Terminal', '').trim()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => navigateTo('/profile')}
              aria-label="Change defaults profile settings"
              className="text-xs font-bold text-emerald-deep hover:text-emerald-strong hover:underline border border-emerald-deep/15 hover:border-emerald-deep/30 px-3 py-1.5 rounded-xl transition bg-white/50 cursor-pointer"
            >
              Change Preset
            </button>
          </div>
        </GlassPanel>
      </section>

      {/* 2. Active Orders Progressing bar */}
      {activeOrders.length > 0 && (
        <section className="mb-8" id="active_order_tracker">
          <div className="bg-mango-warm/15 border border-mango-warm/30 rounded-[24px] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-2.5">
                <span className="p-1 px-2 text-[10px] font-black uppercase text-emerald-strong bg-mango-warm rounded-lg mt-0.5">ACTIVE DISPATCH</span>
                <div>
                  <h3 className="font-display font-bold text-sm text-emerald-strong">
                    Tracking Order {activeOrders[0].orderNumber}
                  </h3>
                  <p className="text-[10px] text-muted-grey mt-0.5">
                    Stage: <span className="font-bold text-emerald-strong">{activeOrders[0].status.replace(/_/g, ' ')}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigateTo(`/orders/${activeOrders[0].id}`)}
                className="text-xs font-bold text-emerald-deep hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Track Full History</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Micro-progress timeline dots */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-mango-warm/20 text-center">
              {[
                { label: 'Kitchen', passed: ['PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(activeOrders[0].status) },
                { label: 'Prepared', passed: ['READY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(activeOrders[0].status) },
                { label: 'Courier Desk', passed: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(activeOrders[0].status) },
                { label: 'At Doorway', passed: activeOrders[0].status === 'DELIVERED' }
              ].map((step, sIdx) => (
                <div key={sIdx} className="flex flex-col items-center">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    step.passed ? 'bg-emerald-deep text-white' : 'bg-neutral-200 text-neutral-400'
                  }`}>
                    {step.passed && '✓'}
                  </div>
                  <span className={`text-[9px] font-semibold mt-1 truncate w-full ${step.passed ? 'text-emerald-strong font-bold' : 'text-neutral-400'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Discovery: top-rated kitchens + most-ordered dishes */}
      <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6" id="home_highlights">
        {/* Top Rated Kitchens */}
        <GlassPanel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm text-emerald-strong flex items-center gap-1.5">
              <Star className="w-4.5 h-4.5 text-mango-warm fill-mango-warm/30" />
              <span>Top Rated Kitchens</span>
            </h3>
            <button
              onClick={() => navigateTo('/vendors')}
              className="text-[10px] font-black tracking-widest text-emerald-deep uppercase hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
          ) : topVendors.length === 0 ? (
            <p className="text-xs text-muted-grey py-6 text-center">No kitchens available yet.</p>
          ) : (
            <div className="space-y-3">
              {topVendors.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => navigateTo(`/vendors/${v.id}`)}
                  className="w-full flex items-center gap-3 p-2.5 bg-white border border-ink-deep/5 rounded-2xl hover:border-emerald-deep/40 hover:shadow-sm transition text-left cursor-pointer active:scale-[0.99]"
                >
                  <span className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black ${
                    idx === 0 ? 'bg-mango-warm text-emerald-strong' : 'bg-emerald-deep/10 text-emerald-deep'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-neutral-50">
                    <img
                      src={resolveImage(v.imageUrl, v.name)}
                      onError={handleImageError(v.name)}
                      alt={v.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-bold text-xs text-ink-deep truncate">{v.name}</h4>
                    <p className="text-[10px] text-muted-grey truncate">{v.description}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-ink-deep">
                    <Star className="w-3.5 h-3.5 text-mango-warm fill-mango-warm" />
                    <span className="numeric-tabular">{(v.rating ?? 0).toFixed(1)}</span>
                    <span className="text-muted-grey font-semibold">({v.reviewCount})</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </GlassPanel>

        {/* Most Ordered Dishes (across all vendors) */}
        <GlassPanel className="p-6">
          <h3 className="font-display font-bold text-sm text-emerald-strong flex items-center gap-1.5 mb-4">
            <Flame className="w-4.5 h-4.5 text-mango-warm" />
            <span>Most Ordered Dishes</span>
          </h3>

          {topDishes.length === 0 ? (
            <div className="text-center py-6 flex flex-col items-center gap-2">
              <Flame className="w-8 h-8 text-neutral-200" />
              <p className="text-xs text-muted-grey max-w-xs">
                Your most-ordered meals will appear here once you start placing orders.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topDishes.map((dish, idx) => {
                const vendorObj = VENDORS.find(v => v.id === dish.vendorId);
                return (
                  <button
                    key={dish.menuItemId}
                    onClick={() => dish.vendorId && navigateTo(`/vendors/${dish.vendorId}`)}
                    className="w-full flex items-center gap-3 p-2.5 bg-white border border-ink-deep/5 rounded-2xl hover:border-emerald-deep/40 hover:shadow-sm transition text-left cursor-pointer active:scale-[0.99]"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black bg-emerald-deep/10 text-emerald-deep">
                      {idx + 1}
                    </span>
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-neutral-50">
                      <img
                        src={resolveImage('', dish.name)}
                        onError={handleImageError(dish.name)}
                        alt={dish.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-bold text-xs text-ink-deep truncate">{dish.name}</h4>
                      <p className="text-[10px] text-emerald-deep font-bold truncate">at {vendorObj?.name || 'Kitchen partner'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Currency kobo={dish.priceKobo} className="text-xs font-extrabold text-ink-deep block" />
                      <span className="text-[9px] font-bold text-muted-grey">Ordered ×{dish.qty}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </GlassPanel>
      </section>

      {/* 3. Horizontal Delivery Slots Configuration */}
      <section className="mb-8 bg-white rounded-[24px] p-6 border border-emerald-deep/8" id="slot_selector_widget">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display font-medium text-sm text-emerald-strong flex items-center gap-1.5" id="delivery_slot_title">
              <Calendar className="w-4 h-4 text-emerald-deep" />
              Choose Delivery Target Context
            </h3>
            <p className="text-[10px] text-muted-grey mt-0.5">We dispatch batch boxes only. Orders locked 60 mins before delivery.</p>
          </div>
          
          {/* Quick Date override input */}
          <div className="relative w-full md:w-auto">
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={tempDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full md:w-auto px-4 py-1.5 bg-neutral-50/50 hover:bg-neutral-50 border border-emerald-deep/12 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-deep cursor-pointer"
              aria-label="Delivery target date selection"
            />
          </div>
        </div>

        {/* Scrollable Slot selection cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {DELIVERY_SLOTS.map(slot => {
            const isAvail = isSlotAvailable(slot.time, currentDate);
            const isSelected = currentSlotId === slot.id;

            return (
              <button
                key={slot.id}
                onClick={() => isAvail && handleSlotSelect(slot.id)}
                disabled={!isAvail}
                className={`px-5 py-4.5 rounded-[20px] transition duration-200 flex flex-col items-center justify-center gap-1 select-none text-center border ${
                  !isAvail
                    ? 'bg-white border-ink-deep/5 shadow-xs opacity-50 cursor-not-allowed'
                    : isSelected
                    ? 'bg-emerald-deep text-white shadow-xl shadow-emerald-deep/20 border-emerald-deep scale-[1.02]'
                    : 'bg-white border-ink-deep/5 shadow-sm hover:border-emerald-deep/40 cursor-pointer hover:shadow-md'
                }`}
              >
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  !isAvail ? 'text-muted-grey/60' : isSelected ? 'text-white' : 'text-ink-deep'
                }`}>
                  {slot.time}
                </span>

                <span className={`text-[10px] font-bold ${
                  !isAvail ? 'text-red-500' : isSelected ? 'text-white/90' : 'text-emerald-deep'
                }`}>
                  {!isAvail ? 'CLOSED' : isSelected ? 'ACTIVE' : 'OPEN'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Active Catalog Launch Vendors Grid with Saved Favorites Tab */}
      <section id="vendors_grid_section">
        {/* Tab Selection */}
        <div className="flex border-b border-neutral-100 mb-6 gap-6">
          <button
            onClick={() => setActiveCatalogTab('vendors')}
            className={`pb-3 text-xs font-extrabold uppercase tracking-widest transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeCatalogTab === 'vendors' 
                ? 'border-emerald-deep text-emerald-strong' 
                : 'border-transparent text-muted-grey hover:text-emerald-deep'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Kitchen Partners</span>
          </button>
          <button
            onClick={() => setActiveCatalogTab('favorites')}
            className={`pb-3 text-xs font-extrabold uppercase tracking-widest transition flex items-center gap-2 border-b-2 cursor-pointer ${
              activeCatalogTab === 'favorites' 
                ? 'border-rose-500 text-rose-500' 
                : 'border-transparent text-muted-grey hover:text-rose-500'
            }`}
            id="favorite_dishes_tab_btn"
          >
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500 animate-pulse" />
            <span>Saved Favorites ({favoriteItems.length})</span>
          </button>
        </div>

        {/* Global Cart Conflict Warning Banner */}
        {cartConflictError && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-100 text-danger rounded-xl text-xs font-bold flex items-start gap-2 animate-pulse">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span>{cartConflictError}</span>
          </div>
        )}

        {/* Dynamic Inner Catalog Display */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div
                key={`home-skel-${idx}`}
                className="bg-white rounded-[24px] border border-neutral-100 overflow-hidden shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="h-44 w-full relative overflow-hidden bg-neutral-50">
                    <Skeleton className="w-full h-full rounded-none" />
                  </div>
                  <div className="p-5">
                    <Skeleton className="w-16 h-4 rounded mt-1 mb-3" />
                    <Skeleton className="h-5 w-3/4 rounded mb-3" />
                    <div className="space-y-2 mt-2">
                      <Skeleton className="h-3 w-full rounded" />
                      <Skeleton className="h-3 w-5/6 rounded" />
                    </div>
                  </div>
                </div>
                <div className="p-5 pt-0">
                  <div className="flex gap-2 mb-4">
                    <Skeleton className="h-5 w-12 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : activeCatalogTab === 'vendors' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-medium text-xs tracking-widest text-emerald-strong bg-emerald-deep/5 px-2.5 py-1 rounded inline-block uppercase block">
                  Certified Academic Launch Vendors
                </h3>
                <p className="text-[10px] text-muted-grey mt-1">vetted campus partners cooking with premium hygiene standards for Venite.</p>
              </div>
              <button
                onClick={() => navigateTo('/vendors')}
                className="text-[10px] font-black tracking-widest text-emerald-deep uppercase hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>See Grid View</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {VENDORS.map(v => {
                return (
                  <div
                    key={v.id}
                    onClick={() => navigateTo(`/vendors/${v.id}`)}
                    className="bg-white rounded-[24px] border border-ink-deep/5 overflow-hidden shadow-md hover:shadow-lg hover:scale-[1.01] transition-all duration-300 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-44 w-full relative overflow-hidden">
                        <img
                          src={resolveImage(v.imageUrl, v.name)}
                          onError={handleImageError(v.name)}
                          alt={v.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition duration-300 hover:scale-105"
                        />
                        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-bold text-mango-warm flex items-center gap-1 shadow-sm border border-ink-deep/5">
                          ★ <span className="numeric-tabular text-ink-deep font-bold">{(v.rating ?? 0).toFixed(1)}</span>
                          <span className="text-muted-grey">({v.reviewCount})</span>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 bg-success/10 text-success text-[9px] font-bold rounded-md">CERTIFIED</span>
                        </div>
                        <h4 className="font-display font-bold text-base text-ink-deep leading-normal">{v.name}</h4>
                        <p className="text-[11px] text-muted-grey line-clamp-2 mt-1 leading-relaxed">
                          {v.description}
                        </p>
                      </div>
                    </div>

                    <div className="p-5 pt-0">
                      <div className="flex flex-wrap gap-1 mb-4">
                        {v.featuredTags.map((tag, tIdx) => (
                          <span key={tIdx} className="text-[9px] font-bold tracking-wider text-[#617069] bg-ink-deep/5 border border-ink-deep/8 rounded-md px-1.5 py-0.5 uppercase">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <button className="w-full py-2.5 bg-[#10231C] text-white hover:bg-[#0B6B4F] transition font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-sm">
                        <span>VIEW MENU</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Favorites Tab renderer */
          <div>
            {favoriteItems.length === 0 && MENU_ITEMS.length === 0 && (favoriteItemIds?.length || 0) > 0 ? (
              /* Catalog still loading — don't flash "empty" while saved favorites resolve */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-[20px]" />)}
              </div>
            ) : favoriteItems.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-rose-200/60 p-6 flex flex-col items-center justify-center">
                <Heart className="w-12 h-12 text-rose-300 stroke-[1.5] mb-3 animate-pulse" />
                <h4 className="font-display font-bold text-sm text-ink-deep mb-1">Your Favorites Tab is Empty</h4>
                <p className="text-xs text-muted-grey max-w-sm">Tap the heart toggle next to any dish inside our interactive vendor menus to save meals for rapid access.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {favoriteItems.map(item => {
                  const itemVendorId = item.vendorId;
                  const vendorObj = VENDORS.find(v => v.id === itemVendorId);
                  const activeInCart = cart && cart.vendorId === itemVendorId 
                    ? cart.items.find(it => it.menuItemId === item.id) 
                    : null;

                  const handleQuickAdd = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setCartConflictError(null);
                    
                    if (cart && cart.vendorId !== itemVendorId) {
                      const currentVendorName = VENDORS.find(v => v.id === cart.vendorId)?.name || 'another kitchen';
                      setCartConflictError(`Your cart contains options from "${currentVendorName}". Please checkout or clear your cart first.`);
                      setTimeout(() => setCartConflictError(null), 4500);
                      return;
                    }
                    
                    addToCart(itemVendorId, { menuItemId: item.id, quantity: 1, spoonsCount: 1 });
                  };

                  return (
                    <div
                      key={item.id}
                      onClick={() => navigateTo(`/vendors/${itemVendorId}`)}
                      className="bg-white rounded-[20px] border border-neutral-100 p-4 flex gap-4 shadow-sm hover:shadow-md transition cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-deep focus-visible:ring-offset-2"
                      id={`fav_dish_card_${item.id}`}
                      tabIndex={0}
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-neutral-50 relative">
                        <img src={resolveImage(item.imageUrl, item.name)} onError={handleImageError(item.name)} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="font-display font-extrabold text-xs text-ink-deep leading-normal">{item.name}</h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoriteItem(item.id);
                              }}
                              className="text-rose-500 hover:text-rose-600 p-1 rounded transition shrink-0 cursor-pointer"
                              title="Remove from favorites"
                            >
                              <Heart className="w-3.5 h-3.5 fill-current" />
                            </button>
                          </div>
                          <p className="text-[10px] text-emerald-deep font-bold mt-0.5">
                            at {vendorObj?.name || 'Kitchen partner'}
                          </p>
                          <p className="text-[10px] text-muted-grey mt-1 line-clamp-1">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2.5">
                          <Currency kobo={item.priceKobo} className="text-xs font-extrabold text-ink-deep" />
                          
                          {activeInCart ? (
                            <span className="text-[10px] font-black text-emerald-strong bg-emerald-deep/8 px-2 py-0.5 rounded-md">
                              {activeInCart.quantity} in Cart
                            </span>
                          ) : (
                            <button
                              onClick={handleQuickAdd}
                              className="bg-emerald-deep hover:bg-emerald-strong text-white rounded-lg p-1 px-3 text-[10px] font-bold cursor-pointer transition flex items-center gap-1 shadow-xs"
                              id={`fav_quick_add_${item.id}`}
                            >
                              <Plus className="w-3 h-3" /> Quick Add
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
      </PullToRefresh>
    </AppShell>
  );
};
