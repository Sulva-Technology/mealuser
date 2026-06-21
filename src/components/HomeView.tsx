import React, { useState, useEffect } from 'react';
import { useMealDirect } from '../store';
import { isSlotAvailable } from '../utils/helpers';
// First import Skeleton
import { AppShell, GlassPanel, Currency, Skeleton } from './CommonUI';
// ... remove LoadingSkeleton import if possible or just ignore it.
import { PullToRefresh } from './PullToRefresh';
import {
  Calendar,
  Clock,
  MapPin,
  Store,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Timer,
  Bike,
  Sliders,
  Bookmark,
  Heart,
  Plus
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

  // Delivery Estimation sliders (real-time calculations)
  const [orderVolume, setOrderVolume] = useState(24);
  const [driverProximity, setDriverProximity] = useState(1.4);

  // Setup delivery trend states
  const [prevMinutes, setPrevMinutes] = useState(33);
  const [trend, setTrend] = useState<'improving' | 'worsening' | 'stable'>('stable');

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

  // Estimation Arithmetic:
  // Base kitchen prep is 15 minutes
  // Each order volume adds 0.5 minutes queue delay
  // Driver proximity adds 4 minutes per kilometer
  const basePrep = 15;
  const queueTime = Math.round(orderVolume * 0.5);
  const transitTime = Math.round(driverProximity * 4);
  const totalMinutes = basePrep + queueTime + transitTime;

  useEffect(() => {
    if (totalMinutes < prevMinutes) {
      setTrend('improving');
    } else if (totalMinutes > prevMinutes) {
      setTrend('worsening');
    } else {
      setTrend('stable');
    }
    setPrevMinutes(totalMinutes);
  }, [totalMinutes]);

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

      {/* Real-time Delivery & Dispatch Estimator Dashboard */}
      <section className="mb-8" id="delivery_estimator_widget">
        <GlassPanel className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left sliders control */}
            <div className="flex-1 space-y-5">
              <div>
                <h3 className="font-display font-medium text-sm text-ink-deep font-bold flex items-center gap-1.5">
                  <Sliders className="w-4.5 h-4.5 text-emerald-deep" />
                  <span>Live Dispatch Health & Arrival Estimator</span>
                </h3>
                <p className="text-[10px] text-muted-grey mt-0.5">
                  Calculates exact meal transit times based on active campus volume and rider distance. Try adjusting the sliders below!
                </p>
              </div>

              {/* Slider 1: Order Volume */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-strong">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-deep" />
                    <span>Active Campus Orders (Dispatch Load)</span>
                  </span>
                  <span className="font-mono bg-white border border-emerald-deep/12 rounded px-1.5 py-0.2">
                    {orderVolume} orders active
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={orderVolume}
                  onChange={(e) => setOrderVolume(Number(e.target.value))}
                  className="w-full accent-emerald-deep h-1.5 bg-neutral-100 rounded-lg appearance-auto cursor-pointer"
                />
                <div className="text-[9px] text-muted-grey font-semibold">
                  {orderVolume < 20 ? (
                    <span className="text-emerald-deep">📗 Highly Fluid • Quick kitchen turnaround</span>
                  ) : orderVolume <= 40 ? (
                    <span className="text-mango-warm">📙 Steady Volume • Moderate queuing delay</span>
                  ) : (
                    <span className="text-red-500 animate-pulse">⚠️ Peak Rush Congestion • Standard queuing rules apply</span>
                  )}
                </div>
              </div>

              {/* Slider 2: Driver Proximity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-strong">
                  <span className="flex items-center gap-1">
                    <Bike className="w-3.5 h-3.5 text-emerald-deep" />
                    <span>Nearest Courier Proximity</span>
                  </span>
                  <span className="font-mono bg-white border border-emerald-deep/12 rounded px-1.5 py-0.2">
                    {driverProximity} km away
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="5.0"
                  step="0.1"
                  value={driverProximity}
                  onChange={(e) => setDriverProximity(Number(e.target.value))}
                  className="w-full accent-emerald-deep h-1.5 bg-neutral-100 rounded-lg appearance-auto cursor-pointer"
                />
                <div className="text-[9px] text-muted-grey font-semibold">
                  {driverProximity < 1.5 ? (
                    <span className="text-emerald-strong">📍 Immediate Hall Gateway (~{transitTime} mins travel)</span>
                  ) : driverProximity <= 3.5 ? (
                    <span className="text-emerald-strong">📍 In-Transit (Inter-campus roads, ~{transitTime} mins travel)</span>
                  ) : (
                    <span className="text-emerald-strong">📍 Far Campus Gateways (~{transitTime} mins travel)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right calculated outcomes circle & vector map trail */}
            <div className="w-full lg:w-72 bg-[#10231C]/5 border border-emerald-deep/8 p-5 rounded-[24px] flex flex-col justify-between gap-4">
              <div className="text-center">
                <span className="text-[9px] font-bold text-muted-grey block uppercase tracking-widest">Estimated Campus Wait</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Clock className="w-5 h-5 text-mango-warm fill-mango-warm/10 animate-pulse shrink-0" />
                  <span className="text-2xl font-black text-emerald-strong select-all">
                    ~{totalMinutes}<span className="text-sm font-bold">m</span>
                  </span>

                  {/* Real-time slider trend arrow indicator */}
                  {trend === 'improving' && (
                    <span className="inline-flex items-center gap-0.5 glass-pill text-success border border-success/30 text-[10px] font-bold px-1.5 py-0.5 rounded-md animate-bounce" title="Delivery parameters are currently improving">
                      <ArrowUp className="w-3 h-3 stroke-[3]" />
                      <span>Faster</span>
                    </span>
                  )}
                  {trend === 'worsening' && (
                    <span className="inline-flex items-center gap-0.5 bg-danger/10 text-danger border border-danger/20 text-[10px] font-bold px-1.5 py-0.5 rounded-md animate-pulse" title="Delivery parameters are currently worsening">
                      <ArrowDown className="w-3 h-3 stroke-[3]" />
                      <span>Slower</span>
                    </span>
                  )}
                  {trend === 'stable' && (
                    <span className="inline-flex items-center gap-0.5 bg-neutral-100 text-muted-grey border border-neutral-200 text-[9px] font-bold px-1.5 py-0.5 rounded-md" title="Steady delivery state">
                      <span>Stable</span>
                    </span>
                  )}
                </div>
                <p className="text-[9.5px] text-muted-grey mt-1">Estimated delivery countdown window</p>
              </div>

              {/* Visual Roadway track */}
              <div className="bg-white p-3 rounded-xl border border-emerald-deep/6 relative overflow-hidden">
                <div className="flex items-center justify-between text-[8px] font-bold text-muted-grey mb-1 uppercase tracking-wider">
                  <span>Kitchen Hub</span>
                  <span>Your Desk</span>
                </div>
                {/* Horizontal road track */}
                <div className="h-1.5 bg-neutral-100 rounded-full relative w-full my-2.5">
                  {/* Active Rider Position Dot */}
                  <div
                    style={{ left: `${Math.max(0, Math.min(92, 100 - (driverProximity / 5.0) * 100))}%` }}
                    className="absolute -top-1.5 w-4.5 h-4.5 rounded-full bg-emerald-deep text-white flex items-center justify-center shadow shadow-emerald-deep/30 transition-all duration-300"
                  >
                    <Bike className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between text-[8.5px] font-semibold text-muted-grey mt-1">
                  <span>Kitchen: {basePrep}m + Queue: {queueTime}m</span>
                  <span>Rider travel: {transitTime}m</span>
                </div>
              </div>
            </div>
          </div>
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
            <span>Saved Favorites ({favoriteItemIds?.length || 0})</span>
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
                          src={v.imageUrl}
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
            {MENU_ITEMS.filter(it => favoriteItemIds?.includes(it.id)).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-rose-200/60 p-6 flex flex-col items-center justify-center">
                <Heart className="w-12 h-12 text-rose-300 stroke-[1.5] mb-3 animate-pulse" />
                <h4 className="font-display font-bold text-sm text-ink-deep mb-1">Your Favorites Tab is Empty</h4>
                <p className="text-xs text-muted-grey max-w-sm">Tap the heart toggle next to any dish inside our interactive vendor menus to save meals for rapid access.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MENU_ITEMS.filter(it => favoriteItemIds?.includes(it.id)).map(item => {
                  const itemVendorId = item.id.startsWith('item_grill') 
                    ? 'ven_grill' 
                    : item.id.startsWith('item_bistro') 
                      ? 'ven_bistro' 
                      : item.id.startsWith('item_bake')
                        ? 'ven_bake'
                        : 'ven_akara';
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
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
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
