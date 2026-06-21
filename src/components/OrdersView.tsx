import React, { useState, useMemo, useEffect } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency } from './CommonUI';
import { LoadingSkeleton } from './LoadingSkeleton';
import { PullToRefresh } from './PullToRefresh';
import { Calendar, Clock, MapPin, Receipt, Star, MessageSquarePlus, ShieldCheck, ChevronRight, Filter, HelpCircle, RotateCcw } from 'lucide-react';
import { OrderStatus } from '../types';
import emptyOrdersIllustration from '../assets/images/empty_orders_illustration_1781791218965.jpg';

export const OrdersView: React.FC = () => {
  const { orders, navigateTo, reorderOrder, reviews } = useMealDirect();
  
  // States
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'past'>('active');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [activeTab, statusFilter]);

  // Status lists
  const activeStatuses: OrderStatus[] = [
    'PENDING_PAYMENT',
    'PAID',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'ESCALATED'
  ];

  // Filtering orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Tab filter
      if (activeTab === 'active') {
        if (!activeStatuses.includes(o.status)) return false;
      } else if (activeTab === 'past') {
        if (activeStatuses.includes(o.status)) return false;
      }

      // Status query filter
      if (statusFilter && o.status !== statusFilter) return false;

      return true;
    });
  }, [orders, activeTab, statusFilter]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        setIsLoading(false);
        resolve();
      }, 700);
    });
  };

  return (
    <AppShell activeTab="orders">
      <PullToRefresh onRefresh={handleRefresh}>
      {/* Page Header */}
      <section className="mb-6" id="orders_page_header">
        <div>
          <span className="text-[10px] font-black tracking-widest text-emerald-deep uppercase bg-emerald-deep/5 px-2.5 py-1 rounded">DISPATCH ARCHIVE</span>
          <h2 className="font-display font-black text-2xl text-emerald-strong mt-1.5" id="orders_headline">Log of Campus Orders</h2>
          <p className="text-xs text-muted-grey">Keep tabs on prepared lunches, active courier routes, and finalized takeaway feedbacks.</p>
        </div>
      </section>

      {/* Segment tabs Selector */}
      <section className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4" id="orders_filter_stage">
        <div className="flex bg-neutral-100 p-1 rounded-xl border border-emerald-deep/6 self-start">
          {[
            { key: 'active', label: 'Active Dispatches' },
            { key: 'past', label: 'Past Archives' },
            { key: 'all', label: 'All Orders' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                setStatusFilter('');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold select-none cursor-pointer transition ${
                activeTab === tab.key
                  ? 'bg-emerald-deep text-white shadow-sm'
                  : 'text-muted-grey hover:bg-neutral-50 hover:text-emerald-deep'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Dropdowns Filter */}
        <div className="w-full md:w-52">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-neutral-100 rounded-xl text-xs font-semibold text-muted-grey cursor-pointer focus:outline-none"
            aria-label="Filter orders specifically by state"
          >
            <option value="">Filter by Specific Status</option>
            {activeTab !== 'past' && (
              <>
                <option value="PENDING_PAYMENT">Pending Paystack Payment</option>
                <option value="PAID">Paid / Submitted</option>
                <option value="PREPARING">In the Kitchen</option>
                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                <option value="DELIVERED">Arrived at Terminal Desk</option>
                <option value="ESCALATED">Support Escalation Active</option>
              </>
            )}
            {activeTab !== 'active' && (
              <>
                <option value="CONFIRMED">Delivery Confirmed</option>
                <option value="CANCELLED">Marked Cancelled</option>
                <option value="REFUNDED">Apologetic Refunded</option>
              </>
            )}
          </select>
        </div>
      </section>

      {/* Render list */}
      <section className="space-y-4" id="orders_timeline_stage">
        {isLoading ? (
          <LoadingSkeleton.ListRow count={3} />
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-emerald-deep/8 flex flex-col items-center justify-center p-6 max-w-lg mx-auto" id="orders_empty_card">
            <div className="w-48 h-32 mb-6 rounded-2xl overflow-hidden shadow-sm relative">
                <img src={emptyOrdersIllustration} alt="No Orders" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-black text-emerald-strong">No Registered Orders In This Filter</span>
            <p className="text-xs text-muted-grey mt-2 max-w-sm leading-relaxed">
              When student orders are authorized through checkout, they display here with real-time status updates.
            </p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const orderReview = reviews.find(r => r.orderId === order.id);
            
            return (
              <GlassPanel
                key={order.id}
                onClick={() => navigateTo(`/orders/${order.id}`)}
                className="hover:shadow flex flex-col justify-between"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-deep/8 pb-4 mb-4">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-strong bg-emerald-deep/5 px-2 py-0.5 rounded border border-emerald-deep/8 select-all">
                      {order.orderNumber}
                    </span>
                    <p className="text-[10px] text-muted-grey mt-1">Submitted: {new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>

                  {/* High contrast state chip */}
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black tracking-wider uppercase ${
                      ['DELIVERED', 'CONFIRMED'].includes(order.status)
                        ? 'bg-emerald-deep/15 text-emerald-strong'
                        : order.status === 'ESCALATED'
                        ? 'bg-red-50 text-danger border border-red-200'
                        : 'bg-mango-warm/15 text-orange-700'
                    }`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-grey shrink-0" />
                  </div>
                </div>

                {/* Sub-itemization display list */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                  <div className="space-y-1.5 max-w-md">
                    <p className="font-semibold text-emerald-strong truncate">
                      {order.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-grey">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-deep" />
                        Desk Terminal
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-deep" />
                        Drop: {order.deliveryDate}
                      </span>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="text-[9px] text-muted-grey block uppercase font-bold">TOTAL REMITTED</span>
                    <Currency kobo={order.totalKobo} className="text-sm font-black text-emerald-strong select-all" />
                  </div>
                </div>

                {/* Your feedback review output section */}
                {orderReview && (
                  <div className="mt-3 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl text-[11px] animate-fade-in flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-mango-warm font-bold">
                      <div className="flex">
                        {Array.from({ length: orderReview.rating }).map((_, sIdx) => (
                          <Star key={sIdx} className="w-3.5 h-3.5 fill-mango-warm text-mango-warm" />
                        ))}
                        {Array.from({ length: 5 - orderReview.rating }).map((_, sIdx) => (
                          <Star key={sIdx} className="w-3.5 h-3.5 text-neutral-300" />
                        ))}
                      </div>
                      <span className="text-[9px] text-[#A15C03] font-black uppercase tracking-wider ml-1">Dining Feedback Received</span>
                    </div>
                    {orderReview.comment && (
                      <p className="text-muted-grey italic">"{orderReview.comment}"</p>
                    )}
                  </div>
                )}

                {/* Actions Context summary */}
                <div className="mt-4 pt-3 border-t border-emerald-deep/8 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold">
                  <span className="text-muted-grey">Flat dispatch fee included.</span>
                  
                  <div className="flex gap-2 items-center">
                    {/* Instantly allow reordering past orders */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderOrder(order.id);
                      }}
                      className="px-2.5 py-1 bg-emerald-deep text-white hover:bg-[#0c6544] rounded-lg flex items-center gap-1 cursor-pointer transition transform active:scale-95 text-[10px]"
                      title="Instantly copy this past meal to current shopping cart"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Quick Reorder</span>
                    </button>

                    {['DELIVERED', 'CONFIRMED'].includes(order.status) && !order.hasReview && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateTo(`/orders/${order.id}/review`);
                        }}
                        className="px-2.5 py-1 bg-white border border-emerald-deep/15 text-emerald-deep hover:bg-emerald-deep/5 rounded-lg flex items-center gap-1 cursor-pointer text-[10px]"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        <span>Write Kitchen Review</span>
                      </button>
                    )}
                    {order.status === 'DELIVERED' && (
                      <span className="text-emerald-strong flex items-center gap-0.5 py-1 text-[10px]">
                        <ShieldCheck className="w-3.5 h-3.5 animate-pulse" /> Confirm delivery check!
                      </span>
                    )}
                  </div>
                </div>
              </GlassPanel>
            );
          })
        )}
      </section>
      </PullToRefresh>
    </AppShell>
  );
};
