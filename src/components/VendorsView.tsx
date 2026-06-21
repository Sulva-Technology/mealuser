import React, { useState, useMemo, useEffect } from 'react';
import { useMealDirect } from '../store';
import { isSlotAvailable, formatNGN } from '../utils/helpers';
import { AppShell, GlassPanel, Skeleton } from './CommonUI';
import { Search, Store, Star, Filter, Heart, ChevronRight, XCircle, Sparkles } from 'lucide-react';
import { motion, Variants } from 'motion/react';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 18,
      stiffness: 110
    }
  }
};

export const VendorsView: React.FC = () => {
  const { currentDate, currentSlotId, navigateTo, vendors: VENDORS, menuItems: MENU_ITEMS } = useMealDirect();
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [specialFilter, setSpecialFilter] = useState<'all' | 'spicy' | 'traditional' | 'bakery'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Debouncing effect for search input (250ms delay)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 750);
    return () => clearTimeout(timer);
  }, []);

  // Compute matched predictive suggestions (both vendors & dishes)
  const suggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 2) return { vendors: [], dishes: [] };

    // Find matching vendors
    const matchedVendors = VENDORS.filter(v =>
      v.name.toLowerCase().includes(query) ||
      v.description.toLowerCase().includes(query) ||
      v.featuredTags.some(t => t.toLowerCase().includes(query))
    );

    // Find matching dishes (popular menu items)
    const matchedDishes = MENU_ITEMS.filter(it =>
      it.name.toLowerCase().includes(query) ||
      it.description.toLowerCase().includes(query) ||
      it.category.toLowerCase().includes(query)
    );

    return {
      vendors: matchedVendors.slice(0, 3), // suggest up to 3 kitchens
      dishes: matchedDishes.slice(0, 5)     // suggest up to 5 popular dishes
    };
  }, [searchQuery]);

  // Check if current global slot allows ordering
  const activeSlotEntity = useMemo(() => {
    // Basic availability mapping
    return isSlotAvailable('12:00', currentDate); // placeholder time check
  }, [currentDate]);

  // Combined filters using standard debounced filter on the local vendor list
  const filteredVendors = useMemo(() => {
    return VENDORS.filter(v => {
      const matchSearch = v.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                          v.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                          v.featuredTags.some(t => t.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) ||
                          // Also match if any of its dishes matches the debounced string
                          MENU_ITEMS.some(item => {
                            const isThisVendor = item.id.startsWith(
                              v.id === 'ven_grill' ? 'item_grill' : v.id === 'ven_bistro' ? 'item_bistro' : v.id === 'ven_bake' ? 'item_bake' : 'item_akara'
                            );
                            return isThisVendor && item.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
                          });
      
      const matchRating = ratingFilter ? v.rating >= ratingFilter : true;
      
      let matchSpecial = true;
      if (specialFilter === 'spicy') matchSpecial = v.featuredTags.includes('Spicy');
      if (specialFilter === 'traditional') matchSpecial = v.featuredTags.includes('Traditional');
      if (specialFilter === 'bakery') matchSpecial = v.featuredTags.includes('Bakery');

      return matchSearch && matchRating && matchSpecial;
    });
  }, [debouncedSearchQuery, ratingFilter, specialFilter]);

  return (
    <AppShell activeTab="vendors">
      {/* 1. Header context */}
      <section className="mb-6" id="vendors_page_header">
        <div>
          <span className="text-[10px] font-black tracking-widest text-emerald-deep uppercase bg-emerald-deep/5 px-2.5 py-1 rounded">Venite Catalog</span>
          <h2 className="font-display font-black text-2xl text-emerald-strong mt-1.5" id="vendors_headline">Available Launch Vendors</h2>
          <p className="text-xs text-muted-grey">Browse authorized kitchen partners certified to batch-dispatch for your selected slot.</p>
        </div>
      </section>

      {/* 2. Interactive Filter & Search Controls */}
      <section className="mb-8" id="vendor_filters_stage">
        <GlassPanel className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Text query input */}
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-0 pl-3.5 w-4.5 h-full text-muted-grey flex items-center pointer-events-none" />
            <input
              type="text"
              placeholder="Search vendors or dishes (e.g. cafeteria, savory, traditional amala, beef, wrap)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 250)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50/50 hover:bg-neutral-50 border border-emerald-deep/12 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-deep focus:outline-none font-semibold text-ink-deep"
              id="vendor_search_box"
              autoComplete="off"
            />

            {/* Dropdown Suggestions Card */}
            {isFocused && searchQuery.trim().length >= 2 && (suggestions.vendors.length > 0 || suggestions.dishes.length > 0) && (
              <div 
                className="absolute left-0 right-0 top-full mt-2 bg-white backdrop-blur-md border border-neutral-200/90 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-neutral-100 max-h-96 overflow-y-auto animate-fade-in" 
                id="search_suggestions_dropdown"
              >
                {suggestions.vendors.length > 0 && (
                  <div className="p-3">
                    <span className="text-[10px] font-black tracking-widest text-emerald-deep bg-emerald-deep/5 px-2 py-0.5 rounded uppercase block mb-1.5">Matched Kitchens</span>
                    <div className="space-y-1">
                      {suggestions.vendors.map(v => (
                        <div
                          key={v.id}
                          className="group flex items-center justify-between p-2 rounded-xl hover:bg-neutral-50 transition cursor-pointer"
                          onClick={() => navigateTo(`/vendors/${v.id}`)}
                          id={`suggest_vendor_${v.id}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-neutral-100">
                              <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-[11.5px] font-bold text-ink-deep flex items-center gap-1.5">
                                {v.name}
                                <span className="text-[9px] text-mango-warm font-bold">★ {(v.rating ?? 0).toFixed(1)}</span>
                              </h5>
                              <p className="text-[10px] text-muted-grey truncate">{v.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(v.name);
                              }}
                              className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-ink-deep font-bold rounded-lg text-[9px] cursor-pointer"
                              title="Filter by this vendor"
                            >
                              Filter
                            </button>
                            <div className="p-1 text-emerald-deep">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.dishes.length > 0 && (
                  <div className="p-3">
                    <span className="text-[10px] font-black tracking-widest text-[#D38B00] bg-mango-warm/10 px-2 py-0.5 rounded uppercase block mb-1.5">Suggested Dishes</span>
                    <div className="space-y-1">
                      {suggestions.dishes.map(d => {
                        const vendorId = d.id.startsWith('item_grill') 
                          ? 'ven_grill' 
                          : d.id.startsWith('item_bistro') 
                            ? 'ven_bistro' 
                            : d.id.startsWith('item_bake')
                              ? 'ven_bake'
                              : 'ven_akara';
                        const vendorObj = VENDORS.find(v => v.id === vendorId);
                        
                        return (
                          <div
                            key={d.id}
                            className="group flex items-center justify-between p-2 rounded-xl hover:bg-neutral-50 transition cursor-pointer"
                            onClick={() => navigateTo(`/vendors/${vendorId}`)}
                            id={`suggest_dish_${d.id}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-neutral-100 relative">
                                <img src={d.imageUrl} alt={d.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <div className="min-w-0">
                                <h5 className="text-[11.5px] font-bold text-ink-deep truncate flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-500 fill-current shrink-0" />
                                  <span>{d.name}</span>
                                </h5>
                                <p className="text-[10px] text-emerald-deep font-semibold">
                                  {formatNGN(d.priceKobo)} <span className="text-muted-grey font-normal">at {vendorObj?.name || 'Kitchen'}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSearchQuery(d.name);
                                }}
                                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-ink-deep font-bold rounded-lg text-[9px] cursor-pointer"
                                title="Filter list by dish"
                              >
                                Filter
                              </button>
                              <div className="p-1 text-emerald-deep">
                                <ChevronRight className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tag classification toggle buttons */}
            {[
              { key: 'all', label: 'All Specialties' },
              { key: 'spicy', label: 'Spicy' },
              { key: 'traditional', label: 'Traditional' },
              { key: 'bakery', label: 'Bakery' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSpecialFilter(tab.key as any)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold select-none cursor-pointer transition ${
                  specialFilter === tab.key
                    ? 'bg-emerald-deep text-white shadow-sm'
                    : 'bg-white border border-neutral-100 hover:border-emerald-deep/20 text-muted-grey'
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* Rating Filter drop */}
            <select
              value={ratingFilter || ''}
              onChange={(e) => setRatingFilter(e.target.value ? parseFloat(e.target.value) : null)}
              className="px-3 py-2 bg-white border border-neutral-100 rounded-xl text-xs font-semibold text-muted-grey cursor-pointer focus:outline-none"
              aria-label="Filter by rating quality"
            >
              <option value="">All Ratings</option>
              <option value="4.7">★ 4.7+ Rating</option>
              <option value="4.8">★ 4.8+ Top Rated</option>
            </select>
          </div>
        </GlassPanel>
      </section>

      {/* 3. Render Catalog Cards */}
      <section id="vendors_render_stage">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={`vendor-skel-${idx}`}
                className="bg-white rounded-[24px] border border-neutral-100 overflow-hidden shadow-sm flex flex-col md:flex-row h-full"
              >
                <div className="h-44 md:h-auto md:w-44 shrink-0 relative bg-neutral-50">
                  <Skeleton className="w-full h-full rounded-none" />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <Skeleton className="h-4 w-1/3 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                  <Skeleton className="h-5 w-3/4 rounded mb-2" />
                  <div className="space-y-1.5 mb-4">
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-5/6 rounded" />
                  </div>
                  <div className="mt-auto space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-14 rounded-full" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-emerald-deep/8 flex flex-col items-center justify-center p-6" id="vendors_empty_state">
            <XCircle className="w-12 h-12 text-muted-grey opacity-40 mb-3" />
            <h4 className="font-display font-bold text-sm text-emerald-strong">No Vendors Found Matching Filters</h4>
            <p className="text-xs text-muted-grey mt-1 max-w-sm">
              Adjust your search keywords or clear rating selections to browse the active Venite Launch partners.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setRatingFilter(null);
                setSpecialFilter('all');
              }}
              className="mt-4 px-4 py-2 bg-emerald-deep text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {filteredVendors.map(v => (
              <motion.div
                key={v.id}
                variants={cardVariants}
                className="w-full h-full"
              >
                <GlassPanel
                  onClick={() => navigateTo(`/vendors/${v.id}`)}
                  className="overflow-hidden p-0 h-full flex flex-col justify-between rounded-[24px] border border-ink-deep/5 shadow-md group hover:shadow-lg hover:scale-[1.01] transition-all duration-300"
                >
                  <div className="flex flex-col sm:flex-row h-full">
                    <div className="h-44 sm:h-auto sm:w-44 shrink-0 relative overflow-hidden">
                      <img
                        src={v.imageUrl}
                        alt={v.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition duration-300 hover:scale-105"
                      />
                      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-bold text-mango-warm flex items-center gap-1 shadow-xs border border-ink-deep/5">
                        ★ <span className="numeric-tabular text-ink-deep font-bold">{(v.rating ?? 0).toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-success/10 text-success text-[9px] font-bold rounded-md">CERTIFIED</span>
                        </div>
                        <h4 className="font-display font-bold text-sm text-ink-deep leading-normal">{v.name}</h4>
                        <p className="text-[11px] text-muted-grey mt-1 leading-relaxed line-clamp-3">
                          {v.description}
                        </p>
                      </div>

                      <div className="mt-4">
                        <div className="flex flex-wrap gap-1 mb-3">
                          {v.featuredTags.map((tag, tIdx) => (
                            <span key={tIdx} className="text-[9px] font-bold tracking-wider text-[#617069] bg-ink-deep/5 border border-ink-deep/8 rounded-md px-1.5 py-0.5 uppercase">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-grey">
                          <span className="font-bold text-ink-deep">Prepare: ~{v.preparationTimeMins} mins</span>
                          <span className="hover:underline flex items-center gap-1 text-emerald-deep cursor-pointer font-bold uppercase tracking-wider text-[10px]">
                            VIEW MENU
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </AppShell>
  );
};
