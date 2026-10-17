import React, { useCallback, useEffect, useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel } from './CommonUI';
import { LoadingSkeleton } from './LoadingSkeleton';
import { PullToRefresh } from './PullToRefresh';
import { ArrowLeft, Copy, Check, Wallet as WalletIcon, Building2, ArrowDownLeft, ArrowUpRight, CreditCard } from 'lucide-react';
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
  const [notice, setNotice] = useState<string | null>(null);
  const [topupNaira, setTopupNaira] = useState('');
  const [waitingForTransfer, setWaitingForTransfer] = useState(false);
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
        setNotice('Bank account numbers are coming soon. Please check back shortly.');
      } else {
        setError(message);
        // Pick up the recorded failure so the panel shows the retry state, not stale data.
        const w = await getWallet();
        if (w) setWallet(w);
      }
    } finally {
      setProvisioning(false);
    }
  };

  // The webhook credits the wallet once the bank transfer lands, so poll a few
  // times until the balance moves rather than asking the user to refresh.
  const handleSentTransfer = async () => {
    if (!wallet) return;
    const previousBalance = wallet.balanceKobo;
    setWaitingForTransfer(true);
    setError(null);
    setNotice('Waiting for your transfer to land…');
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const w = await getWallet();
        if (w && w.balanceKobo > previousBalance) {
          setWallet(w);
          setLedger(await getWalletLedger());
          setTopupNaira('');
          setNotice(`Wallet topped up. New balance: ${formatNGN(w.balanceKobo)}.`);
          return;
        }
      }
      setNotice('Transfer not seen yet. Bank transfers can take a few minutes — pull down to refresh.');
    } finally {
      setWaitingForTransfer(false);
    }
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Only a live account is real: a failed attempt leaves placeholder details like
  // "pending:<walletId>" that must never be shown as something to transfer to.
  const rawDva = wallet?.dedicatedAccount ?? null;
  const dva =
    rawDva && rawDva.status === 'active' && !rawDva.accountNumber.startsWith('pending') ? rawDva : null;
  const dvaFailed =
    wallet?.dedicatedAccountStatus === 'failed' || (rawDva !== null && rawDva.status === 'failed');
  const frozen = wallet?.status === 'frozen';
  const dvaFeePercent = (wallet?.dedicatedAccountFeeBps ?? 0) / 100;
  const dvaFeeCapKobo = wallet?.dedicatedAccountFeeCapKobo ?? 0;
  const dvaFeeLabel =
    dvaFeePercent > 0 ? `${dvaFeePercent}%${dvaFeeCapKobo > 0 ? ` (max ${formatNGN(dvaFeeCapKobo)})` : ''}` : '';
  // Same rule as the backend: percentage, capped, nearest kobo.
  const dvaFeeFor = (kobo: number) => {
    const fee = Math.round((kobo * (wallet?.dedicatedAccountFeeBps ?? 0)) / 10_000);
    return dvaFeeCapKobo > 0 ? Math.min(fee, dvaFeeCapKobo) : fee;
  };
  const fundKobo = Math.round(Number(topupNaira) * 100);
  const fundValid = Number.isFinite(fundKobo) && fundKobo > 0;
  const fundBelowMin = fundValid && (wallet?.minTopupKobo ?? 0) > 0 && fundKobo < (wallet?.minTopupKobo ?? 0);

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

              {/* Add money: always by bank transfer to the customer's dedicated account */}
              <GlassPanel className="p-6">
                <h3 className="font-display font-bold text-sm text-emerald-strong mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-4.5 h-4.5 text-emerald-deep" /> Add money
                </h3>
                <p className="text-[11px] text-muted-grey mb-4 leading-relaxed">
                  Enter an amount, then transfer it from any bank app to your personal account number.
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
                <div className="flex items-center rounded-xl border border-emerald-deep/15 bg-white px-3">
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
                {fundBelowMin && (
                  <p className="mt-2 text-[11px] text-red-700">The minimum top-up is {formatNGN(wallet.minTopupKobo)}.</p>
                )}
                {fundValid && !fundBelowMin && !frozen && (
                  <div className="mt-3 rounded-xl border border-emerald-deep/12 bg-emerald-deep/5 p-4 text-[11px] text-emerald-strong space-y-3">
                    {dva ? (
                      <>
                        <p className="leading-relaxed">
                          Transfer <span className="font-bold">{formatNGN(fundKobo)}</span> to{' '}
                          <span className="font-bold">{dva.accountNumber}</span> ({dva.bankName}). Your wallet gets{' '}
                          <span className="font-bold">{formatNGN(fundKobo - dvaFeeFor(fundKobo))}</span>
                          {dvaFeePercent > 0 ? ` after the ${formatNGN(dvaFeeFor(fundKobo))} fee (${dvaFeeLabel}).` : '.'}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopy(dva.accountNumber)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-emerald-deep/20 font-bold cursor-pointer hover:bg-emerald-deep/5"
                          >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied' : 'Copy account number'}
                          </button>
                          <button
                            onClick={handleSentTransfer}
                            disabled={waitingForTransfer}
                            className="px-3 py-2 bg-emerald-deep hover:bg-emerald-strong disabled:opacity-60 text-white font-bold rounded-xl cursor-pointer transition active:scale-95"
                          >
                            {waitingForTransfer ? 'Checking…' : "I've sent it"}
                          </button>
                        </div>
                      </>
                    ) : dvaUnavailable ? (
                      <p className="leading-relaxed">Bank account numbers are coming soon. Please check back shortly.</p>
                    ) : (
                      <>
                        <p className="leading-relaxed">
                          Set up your personal account number first, then transfer {formatNGN(fundKobo)} to it.
                        </p>
                        <button
                          onClick={handleProvision}
                          disabled={provisioning}
                          className="px-3 py-2 bg-emerald-deep hover:bg-emerald-strong disabled:opacity-60 text-white font-bold rounded-xl cursor-pointer transition active:scale-95"
                        >
                          {provisioning ? 'Setting up…' : 'Get my account number'}
                        </button>
                      </>
                    )}
                  </div>
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
                        A {dvaFeeLabel} fee is deducted from each transfer — send {formatNGN(1_000_000)}, get{' '}
                        {formatNGN(1_000_000 - dvaFeeFor(1_000_000))} in your wallet.
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
                    A personal account number for transfers is coming soon. Please check back shortly.
                  </p>
                ) : dvaFailed ? (
                  <>
                    <p className="text-[11px] text-muted-grey mb-2 leading-relaxed">
                      We couldn't create your account number yet. Please try again.
                    </p>
                    {wallet.dedicatedAccountError && (
                      <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[10px] text-red-700">
                        {wallet.dedicatedAccountError}
                      </p>
                    )}
                    <button
                      onClick={handleProvision}
                      disabled={provisioning}
                      className="px-4 py-2.5 bg-emerald-deep hover:bg-emerald-strong disabled:opacity-60 text-white font-bold text-xs rounded-xl cursor-pointer transition active:scale-95"
                    >
                      {provisioning ? 'Trying again…' : 'Try again'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-muted-grey mb-4 leading-relaxed">
                      Get a personal account number so you can top up any time by bank transfer
                      {dvaFeePercent > 0 ? ` (${dvaFeeLabel} fee per transfer)` : ''}.
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
