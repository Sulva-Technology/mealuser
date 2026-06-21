import React from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency } from './CommonUI';
import { WifiOff, Key } from 'lucide-react';

export const OfflineView: React.FC = () => {
  const { orders } = useMealDirect();

  // Find cached paid orders for backup reference
  const offlineCachedOrders = orders.filter(o => o.status !== 'PENDING_PAYMENT');

  return (
    <AppShell activeTab="none">
      <div className="max-w-md mx-auto py-12" id="offline_recovery_page">
        <GlassPanel className="p-8 text-center border-t-4 border-t-amber-500 relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-warning flex items-center justify-center mx-auto mb-5 animate-pulse">
            <WifiOff className="w-8 h-8" />
          </div>

          <h2 className="font-display font-black text-xl text-emerald-strong" id="offline_headline">Network Connection Suspended</h2>
          <p className="text-xs text-muted-grey mt-2 leading-relaxed max-w-sm mx-auto">
            Meal Direct is operating in <strong>offline data cache mode</strong>. To prevent lost transactions, Paystack checkout submissions and active orders status tracking updates are paused until a stable connection is verified.
          </p>

          {/* Backup verification keys for offline campus desks */}
          <div className="mt-8 border-t border-emerald-deep/8 pt-6 text-left">
            <h3 className="text-xs font-bold text-emerald-strong mb-3 flex items-center gap-1.5 justify-center">
              <Key className="w-4 h-4 text-emerald-deep" />
              Academic Dispatch Recovery Reference
            </h3>

            {offlineCachedOrders.length === 0 ? (
              <p className="text-[10px] text-muted-grey leading-relaxed text-center italic">
                No active paid orders found in your terminal storage cache.
              </p>
            ) : (
              <div className="space-y-2.5">
                <p className="text-[10px] text-muted-grey leading-relaxed mb-1">
                  If you are already standing at the destination desk terminal, present these order keys and transaction identifiers directly to the dispatch courier:
                </p>

                {offlineCachedOrders.map(order => (
                  <div key={order.id} className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-emerald-strong bg-emerald-deep/5 px-2 py-0.5 rounded border border-emerald-deep/8 select-all">
                        {order.orderNumber}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-deep/10 text-emerald-strong">
                        {order.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10.5px]">
                      <span className="text-muted-grey truncate max-w-[180px]">{order.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}</span>
                      <span className="font-bold text-ink-deep"><Currency kobo={order.totalKobo} /></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </AppShell>
  );
};
