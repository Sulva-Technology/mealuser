import React, { useEffect } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel } from './CommonUI';
import { Loader2 } from 'lucide-react';

// Checkout review + payment now live in the cart (single consolidated flow:
// Cart → Confirm → Pay → Payment status). This route is kept only so any old
// /checkout deep link redirects into the cart instead of 404-ing or exposing a
// second, duplicate payment-initiation path.
export const CheckoutView: React.FC = () => {
  const { navigateTo } = useMealDirect();

  useEffect(() => {
    navigateTo('/cart');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell activeTab="cart">
      <div className="max-w-md mx-auto py-16">
        <GlassPanel className="p-8 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-deep animate-spin" />
          <p className="text-xs text-muted-grey">Taking you to your cart…</p>
        </GlassPanel>
      </div>
    </AppShell>
  );
};
