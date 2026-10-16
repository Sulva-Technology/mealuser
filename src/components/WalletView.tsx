import React, { useCallback, useEffect, useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel } from './CommonUI';
import { LoadingSkeleton } from './LoadingSkeleton';
import { PullToRefresh } from './PullToRefresh';
import { ArrowLeft, Copy, Check, Wallet as WalletIcon, Building2, ArrowDownLeft, ArrowUpRight, CreditCard } from 'lucide-react';
import { formatNGN } from '../utils/helpers';
import { launchPaystackCheckout } from '../utils/paystackPopup';
import type { Wallet, WalletLedgerEntry } from '../types';

export const WalletView: React.FC = () => {
  const { getWallet, getWalletLedger, requestDedicatedAccount, startWalletTopup, quoteWalletTopup, navigateTo } =
    useMealDirect();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [topupNaira, setTopupNaira] = useState('');
  const [toppingUp, setToppingUp] = useState(false);
  const [topupQuote, setTopupQuote] = useState<{ amountKobo: number; feeKobo: number; chargeKobo: number } | null>(
    null
  );
  // Set once the backend says dedicated accounts are switched off, so we stop
  // offering a button that cannot succeed and point at card top-up instead.
  const [dvaUnavailable, setDvaUnavailable] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [w, l] = await Promise.all([getWallet(), getWalletLedger()]);
    setWallet(w);
    setLedger(l);
    setIsLoading(false);
  }, [getWallet, getWalletLedger]);

  useEffect(() => {
    load();
  }, [load]);

  // Show what the customer will actually pay (amount + Paystack fee) as they type.
  useEffect(() => {
    const amountKobo = Math.round(Number(topupNaira) * 100);
    if (!Number.isFinite(amountKobo) || amountKobo < 100) {
      setTopupQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      quoteWalletTopup(amountKobo).then(q => {
        if (!cancelled) setTopupQuote(q && q.amountKobo === amountKobo ? q : null);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topupNaira]);

  const handleProvision = async () => {
    setProvisioning(true);
    setError(null);
    try {
      const w = await requestDedicatedAccount();
      if (w) setWallet(w);
    } catch (e: any) {
      const message: string = e?.message || 'Could not set up your top-up account. Please try again.';
      if (/not available yet/i.test(message)) {
        setDvaUnavailable(true);
        setNotice('Bank account numbers are coming soon. Top up with card or bank transfer below.');
      } else {
        setError(message);
      }
    } finally {
      setProvisioning(false);
    }
  };

  // The webhook credits the wallet a moment after Paystack confirms, so poll a
  // few times until the balance moves rather than asking the user to refresh.
  const refreshUntilCredited = async (previousBalance: number) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      const w = await getWallet();
      if (w && w.balanceKobo > previousBalance) {
        setWallet(w);
        setLedger(await getWalletLedger());
        setNotice(`Wallet topped up. New balance: ${formatNGN(w.balanceKobo)}.`);
        return;
      }
    }
    setNotice('Payment received. Your balance will update shortly — pull down to refresh.');
  };

  const handleTopup = async () => {
    if (!wallet) return;
    const amountKobo = Math.round(Number(topupNaira) * 100);
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      setError('Enter how much you want to add.');
      return;
    }
    if (wallet.minTopupKobo > 0 && amountKobo < wallet.minTopupKobo) {
      setError(`The minimum top-up is ${formatNGN(wallet.minTopupKobo)}.`);
      return;
    }
    setToppingUp(true);
    setError(null);
    setNotice(null);
    const previousBalance = wallet.balanceKobo;
    try {
      const launch = await startWalletTopup(amountKobo);
      await launchPaystackCheckout(launch, {
        onSuccess: () => {
          setTopupNaira('');
          setNotice('Payment successful — crediting your wallet…');
          void refreshUntilCredited(previousBalance);
        },
        onCancel: () => setNotice('Top-up cancelled.'),
        onError: () => setError('Payment could not be completed. Please try again.')
      });
    } catch (e: any) {
      setError(e?.message || 'Could not start the top-up. Please try again.');
    } finally {
      setToppingUp(false);
    }
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dva = wallet?.dedicatedAccount ?? null;
  const frozen = wallet?.status === 'frozen';
  const dvaFeePercent = (wallet?.dedicatedAccountFeeBps ?? 0) / 100;

  return (
    <AppShell activeTab="wallet">
      <PullToRefresh onRefresh={load}>
        <div className="max-w-2xl mx-auto pb-8">
          <button
            onClick={() => navigateTo('/home')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-strong mb-4 cursor-pointer hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>

          {isLoading ? (
            <LoadingSkeleton.ListRow count={4} />
          ) : !wallet ? (
            <GlassPanel className="p-6 text-center">
              <p className="text-sm text-muted-grey">Your wallet is not available right now. Pull down to retry.</p>
            </GlassPanel>
          ) : (
            <div className="space-y-6">
              {/* Balance */}
              <GlassPanel className="p-6 bg-emerald-deep text-white">
                <div className="flex items-center gap-2 text-emerald-50/90">
                  <WalletIcon className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">Wallet balance</span>
                </div>
                <p className="mt-2 font-display font-bold text-3xl">{formatNGN(wallet.balanceKobo)}</p>
                {frozen && (
                  <p className="mt-2 inline-block rounded-lg bg-white/15 px-2 py-1 text-[10px] font-bold uppercase">
                    Frozen — contact support
                  </p>
                )}
              </GlassPanel>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">{error}</div>
              )}
              {notice && (
                <div className="rounded-xl bg-emerald-deep/5 border border-emerald-deep/15 p-3 text-xs text-emerald-strong">
                  {notice}
                </div>
              )}

              {/* Top up with card / bank transfer via Paystack checkout */}
              <GlassPanel className="p-6">
                <h3 className="font-display font-bold text-sm text-emerald-strong mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-4.5 h-4.5 text-emerald-deep" /> Add money
                </h3>
                <p className="text-[11px] text-muted-grey mb-4 leading-relaxed">
                  Pay with card, bank transfer or USSD. Your wallet is credited as soon as payment is confirmed.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[1000, 2000, 5000, 10000].map(naira => (
                    <button
                      key={naira}
                      type="button"
                      onClick={() => setTopupNaira(String(naira))}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition ${
                        topupNaira === String(naira)
                          ? 'bg-emerald-deep text-white border-emerald-deep'
                          : 'border-emerald-deep/20 text-emerald-strong hover:bg-emerald-deep/5'
                      }`}
                    >
                      {formatNGN(naira * 100)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center rounded-xl border border-emerald-deep/15 bg-white px-3">
                    <span className="text-xs font-bold text-muted-grey mr-1">₦</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="Amount"
                      value={topupNaira}
                      onChange={e => setTopupNaira(e.target.value)}
                      className="w-full py-2.5 text-sm font-bold text-emerald-strong bg-transparent outline-none"
                    />
                  </div>
                  <button
                    onClick={handleTopup}
                    disabled={toppingUp || frozen || !topupNaira}
                    className="px-4 py-2.5 bg-emerald-deep hover:bg-emerald-strong disabled:opacity-60 text-white font-bold text-xs rounded-xl cursor-pointer transition active:scale-95"
                  >
                    {toppingUp ? 'Starting…' : 'Top up'}
                  </button>
                </div>
                {topupQuote && topupQuote.feeKobo > 0 && (
                  <p className="mt-2 text-[11px] text-emerald-strong">
                    You pay <span className="font-bold">{formatNGN(topupQuote.chargeKobo)}</span> — includes{' '}
                    {formatNGN(topupQuote.feeKobo)} Paystack fee. Your wallet gets{' '}
                    <span className="font-bold">{formatNGN(topupQuote.amountKobo)}</span>.
                  </p>
                )}
                {wallet.minTopupKobo > 0 && (
                  <p className="mt-2 text-[10px] text-muted-grey">Minimum top-up: {formatNGN(wallet.minTopupKobo)}.</p>
                )}
              </GlassPanel>

              {/* Top up via dedicated account */}
              <GlassPanel className="p-6">
                <h3 className="font-display font-bold text-sm text-emerald-strong mb-1 flex items-center gap-1.5">
                  <Building2 className="w-4.5 h-4.5 text-emerald-deep" /> Your bank account number
                </h3>
                {dva ? (
                  <>
                    <p className="text-[11px] text-muted-grey mb-4 leading-relaxed">
                      Send a bank transfer to your personal account below. Your wallet is credited automatically once the
                      transfer lands.
                    </p>
                    <div className="rounded-xl border border-emerald-deep/12 bg-emerald-deep/5 p-4 space-y-3">
                      <Row label="Bank" value={dva.bankName} />
                      <Row
                        label="Account number"
                        value={dva.accountNumber}
                        action={
                          <button
                            onClick={() => handleCopy(dva.accountNumber)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-strong cursor-pointer hover:underline"
                          >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        }
                      />
                      <Row label="Account name" value={dva.accountName} />
                    </div>
                    {dvaFeePercent > 0 && (
                      <p className="mt-3 text-[11px] text-emerald-strong">
                        A {dvaFeePercent}% fee is deducted from each transfer — send{' '}
                        {formatNGN(1_000_000)}, get{' '}
                        {formatNGN(1_000_000 - Math.round((1_000_000 * (wallet.dedicatedAccountFeeBps ?? 0)) / 10_000))}{' '}
                        in your wallet.
                      </p>
                    )}
                    {wallet.minTopupKobo > 0 && (
                      <p className="mt-3 text-[10px] text-muted-grey">
                        Suggested minimum top-up: {formatNGN(wallet.minTopupKobo)}.
                      </p>
                    )}
                  </>
                ) : dvaUnavailable ? (
                  <p className="text-[11px] text-muted-grey leading-relaxed">
                    A personal account number for transfers is coming soon. Use “Add money” above in the meantime.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-muted-grey mb-4 leading-relaxed">
                      Get a personal account number so you can top up any time by bank transfer
                      {dvaFeePercent > 0 ? ` (${dvaFeePercent}% fee per transfer)` : ''}.
                    </p>
                    <button
                      onClick={handleProvision}
                      disabled={provisioning}
                      className="px-4 py-2.5 bg-emerald-deep hover:bg-emerald-strong disabled:opacity-60 text-white font-bold text-xs rounded-xl cursor-pointer transition active:scale-95"
                    >
                      {provisioning ? 'Setting up…' : 'Set up top-up account'}
                    </button>
                  </>
                )}
              </GlassPanel>

              {/* Ledger */}
              <GlassPanel className="p-6">
                <h3 className="font-display font-bold text-sm text-emerald-strong mb-4">Recent activity</h3>
                {ledger.length === 0 ? (
                  <p className="text-xs text-muted-grey">No wallet activity yet.</p>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {ledger.map((entry) => {
                      const credit = entry.amountKobo >= 0;
                      return (
                        <div key={entry.id} className="flex items-center gap-3 py-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              credit ? 'bg-emerald-deep/10 text-emerald-strong' : 'bg-neutral-100 text-neutral-500'
                            }`}
                          >
                            {credit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-emerald-strong capitalize truncate">
                              {ledgerLabel(entry)}
                            </p>
                            <p className="text-[10px] text-muted-grey">
                              {new Date(entry.createdAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-xs font-bold ${credit ? 'text-emerald-strong' : 'text-neutral-600'}`}>
                              {credit ? '+' : ''}
                              {formatNGN(entry.amountKobo)}
                            </p>
                            <p className="text-[9px] text-muted-grey">{formatNGN(entry.balanceAfterKobo)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassPanel>
            </div>
          )}
        </div>
      </PullToRefresh>
    </AppShell>
  );
};

const Row: React.FC<{ label: string; value: string; action?: React.ReactNode }> = ({ label, value, action }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[10px] uppercase tracking-wide text-muted-grey font-bold">{label}</span>
    <span className="flex items-center gap-2">
      <span className="text-sm font-bold text-emerald-strong">{value}</span>
      {action}
    </span>
  </div>
);

function ledgerLabel(entry: WalletLedgerEntry): string {
  if (entry.orderNumber) return `Order ${entry.orderNumber}`;
  if (entry.reason) return entry.reason;
  return entry.entryType.replace(/_/g, ' ');
}
