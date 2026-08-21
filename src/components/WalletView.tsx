import React, { useCallback, useEffect, useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel } from './CommonUI';
import { LoadingSkeleton } from './LoadingSkeleton';
import { PullToRefresh } from './PullToRefresh';
import { ArrowLeft, Copy, Check, Wallet as WalletIcon, Building2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatNGN } from '../utils/helpers';
import type { Wallet, WalletLedgerEntry } from '../types';

export const WalletView: React.FC = () => {
  const { getWallet, getWalletLedger, requestDedicatedAccount, navigateTo } = useMealDirect();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleProvision = async () => {
    setProvisioning(true);
    setError(null);
    try {
      const w = await requestDedicatedAccount();
      if (w) setWallet(w);
    } catch (e: any) {
      setError(e?.message || 'Could not set up your top-up account. Please try again.');
    } finally {
      setProvisioning(false);
    }
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dva = wallet?.dedicatedAccount ?? null;
  const frozen = wallet?.status === 'frozen';

  return (
    <AppShell activeTab="profile">
      <PullToRefresh onRefresh={load}>
        <div className="max-w-2xl mx-auto pb-8">
          <button
            onClick={() => navigateTo('/profile')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-strong mb-4 cursor-pointer hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to profile
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

              {/* Top up via dedicated account */}
              <GlassPanel className="p-6">
                <h3 className="font-display font-bold text-sm text-emerald-strong mb-1 flex items-center gap-1.5">
                  <Building2 className="w-4.5 h-4.5 text-emerald-deep" /> Top up your wallet
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
                    {wallet.minTopupKobo > 0 && (
                      <p className="mt-3 text-[10px] text-muted-grey">
                        Suggested minimum top-up: {formatNGN(wallet.minTopupKobo)}.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-muted-grey mb-4 leading-relaxed">
                      Set up a dedicated bank account to top up your wallet by transfer.
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
