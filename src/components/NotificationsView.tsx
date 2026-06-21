import React, { useState, useEffect } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel } from './CommonUI';
import { LoadingSkeleton } from './LoadingSkeleton';
import { PullToRefresh } from './PullToRefresh';
import { Bell, Check, MapPin, ChevronRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead, navigateTo } = useMealDirect();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleClearAll = () => {
    markAllNotificationsRead();
  };

  const handleClickItem = (n: any) => {
    markNotificationRead(n.id);
    if (n.orderId) {
      navigateTo(`/orders/${n.orderId}`);
    } else {
      navigateTo('/home');
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        setIsLoading(false);
        resolve();
      }, 600);
    });
  };

  return (
    <AppShell activeTab="none">
      <PullToRefresh onRefresh={handleRefresh}>
      <section className="mb-6" id="notifications_page_header">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black tracking-widest text-emerald-deep uppercase bg-emerald-deep/5 px-2.5 py-1 rounded">STUDENT DISPATCH HUB</span>
            <h2 className="font-display font-black text-2xl text-emerald-strong mt-1.5" id="notifications_headline">Your Notifications Alerts</h2>
            <p className="text-xs text-muted-grey">Check real-time alerts regarding kitchen cooking loops and courier dispatches.</p>
          </div>

          {notifications.some(n => !n.read) && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 bg-emerald-deep/5 border border-emerald-deep/12 rounded-xl text-xs font-bold text-emerald-deep hover:bg-emerald-deep hover:text-white transition cursor-pointer flex items-center gap-1 shrink-0"
              id="notifications_readall_btn"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3" id="notifications_list_stage">
        {isLoading ? (
          <LoadingSkeleton.ListRow count={3} />
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-emerald-deep/8 p-6" id="notifications_empty_card">
            <Bell className="w-10 h-10 text-muted-grey opacity-40 mx-auto mb-3" />
            <span className="text-xs font-bold text-emerald-strong">Your Inbox is Fully Clear</span>
            <p className="text-[10px] text-muted-grey mt-0.5">When status change alerts fire, they display on this viewport.</p>
          </div>
        ) : (
          notifications.map(n => {
            return (
              <div
                key={n.id}
                onClick={() => handleClickItem(n)}
                className={`py-4 px-5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-4 hover:shadow hover:scale-[1.002] ${
                  n.read
                    ? 'bg-white border-neutral-100 opacity-75 grayscale-[30%]'
                    : 'bg-emerald-deep/5 border-emerald-deep/15 ring-1 ring-emerald-deep/5'
                }`}
                style={{ contentVisibility: 'auto' }}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  n.type === 'order_status'
                    ? 'bg-emerald-deep/10 text-emerald-strong'
                    : n.type === 'support_update'
                    ? 'bg-red-50 text-danger'
                    : 'bg-mango-warm/15 text-orange-700'
                }`}>
                  {n.type === 'order_status' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : n.type === 'support_update' ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xs font-bold text-emerald-strong truncate">{n.title}</h4>
                    <span className="text-[9px] text-muted-grey font-mono whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-muted-grey mt-1 leading-relaxed">
                    {n.message}
                  </p>
                  
                  {n.orderId && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-deep hover:underline mt-2.5">
                      <span>Track Order details</span>
                      <ChevronRight className="w-3" />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
      </PullToRefresh>
    </AppShell>
  );
};
