import React, { useState } from 'react';
import { useMealDirect, isEmailUnconfirmedError } from '../store';
import { AppShell, GlassPanel, Currency } from './CommonUI';
import { LogIn, UserPlus, AlertCircle, MailCheck, KeyRound, ArrowLeft } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { signIn, signUp, requestPasswordReset } = useMealDirect();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // When set, the account exists but the email hasn't been confirmed yet — show a
  // "check your email app" prompt instead of the sign-in form.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // Forgot-password flow: `isReset` swaps the form for the "enter your email" panel;
  // `resetSentEmail` (once set) swaps that for the "check your inbox" confirmation.
  const [isReset, setIsReset] = useState(false);
  const [resetSentEmail, setResetSentEmail] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await requestPasswordReset(email);
      setResetSentEmail(email);
    } catch (err: any) {
      setError(err.message || 'Could not send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const backToSignIn = () => {
    setIsReset(false);
    setResetSentEmail(null);
    setIsLogin(true);
    setPassword('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setPendingEmail(email);
        }
      }
    } catch (err: any) {
      // A sign-in against an unconfirmed account also lands here — route it to the
      // confirmation prompt rather than showing the raw "Email not confirmed" error.
      if (isEmailUnconfirmedError(err?.message)) {
        setPendingEmail(email);
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingEmail) {
    return (
      <div className="min-h-screen bg-canvas-ivory flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <GlassPanel className="p-6 md:p-8 text-center flex flex-col items-center gap-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-deep/10 text-emerald-deep">
              <MailCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl text-emerald-strong">Confirm your email</h2>
              <p className="text-muted-grey text-sm mt-2 leading-relaxed">
                We sent a confirmation link to <strong className="text-ink-deep break-all">{pendingEmail}</strong>.
                Open your email app and tap the link to activate your account, then come back and sign in.
              </p>
            </div>
            <div className="text-[11px] text-muted-grey bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2.5 leading-relaxed">
              Can’t find it? Check your <strong>Spam / Promotions</strong> folder. The link can take a minute to arrive.
            </div>
            <button
              type="button"
              onClick={() => {
                setPendingEmail(null);
                setIsLogin(true);
                setPassword('');
                setError(null);
              }}
              className="w-full flex items-center justify-center gap-2 bg-emerald-deep hover:bg-emerald-strong text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-deep/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              Back to Sign In
            </button>
          </GlassPanel>
        </div>
      </div>
    );
  }

  // Password reset — link sent. The actual new-password entry happens on the page
  // the emailed Supabase link opens; we can't complete it in-app (no client SDK).
  if (resetSentEmail) {
    return (
      <div className="min-h-screen bg-canvas-ivory flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <GlassPanel className="p-6 md:p-8 text-center flex flex-col items-center gap-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-deep/10 text-emerald-deep">
              <MailCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl text-emerald-strong">Check your email</h2>
              <p className="text-muted-grey text-sm mt-2 leading-relaxed">
                If an account exists for <strong className="text-ink-deep break-all">{resetSentEmail}</strong>,
                we’ve sent a password reset link. Open it to choose a new password, then come back and sign in.
              </p>
            </div>
            <div className="text-[11px] text-muted-grey bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2.5 leading-relaxed">
              Can’t find it? Check your <strong>Spam / Promotions</strong> folder. The link can take a minute to arrive.
            </div>
            <button
              type="button"
              onClick={backToSignIn}
              className="w-full flex items-center justify-center gap-2 bg-emerald-deep hover:bg-emerald-strong text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-deep/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              Back to Sign In
            </button>
          </GlassPanel>
        </div>
      </div>
    );
  }

  // Password reset — request form (enter email).
  if (isReset) {
    return (
      <div className="min-h-screen bg-canvas-ivory flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-deep mb-4 shadow-xl shadow-emerald-deep/20 text-white">
              <KeyRound className="w-8 h-8" />
            </div>
            <h1 className="font-display font-black text-3xl text-emerald-strong">Reset Password</h1>
            <p className="text-muted-grey text-sm mt-2">We’ll email you a secure reset link</p>
          </div>

          <GlassPanel className="p-6 md:p-8">
            {error && (
              <div className="mb-6 p-4 bg-danger/10 border border-danger/20 text-xs text-danger font-semibold rounded-2xl flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-danger shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-grey mb-1.5 uppercase tracking-wide">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-deep focus:border-transparent outline-none transition-all text-ink-deep"
                  placeholder="student@venite.edu.ng"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-deep hover:bg-emerald-strong text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-deep/25 transition-all active:scale-[0.98] mt-2 disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    Send Reset Link
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-xs">
              <button
                type="button"
                onClick={backToSignIn}
                className="inline-flex items-center gap-1.5 font-bold text-emerald-deep hover:underline focus-visible:outline-none cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>
            </div>
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas-ivory flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-deep mb-4 shadow-xl shadow-emerald-deep/20 overflow-hidden">
            <img src="/logo.png" alt="Meal Direct" className="w-full h-full object-contain p-2" />
          </div>
          <h1 className="font-display font-black text-3xl text-emerald-strong">Meal Direct</h1>
          <p className="text-muted-grey text-sm mt-2">Premium Campus Dining Delivery</p>
        </div>

        <GlassPanel className="p-6 md:p-8">
          <h2 className="font-display font-bold text-xl mb-6 text-ink-deep">
            {isLogin ? 'Sign In to your account' : 'Create an account'}
          </h2>

          {error && (
             <div className="mb-6 p-4 bg-danger/10 border border-danger/20 text-xs text-danger font-semibold rounded-2xl flex items-start gap-2.5 animate-fade-in">
             <AlertCircle className="w-5 h-5 text-danger shrink-0" />
             <span>{error}</span>
           </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-grey mb-1.5 uppercase tracking-wide">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-deep focus:border-transparent outline-none transition-all text-ink-deep"
                placeholder="student@venite.edu.ng"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-muted-grey uppercase tracking-wide">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsReset(true);
                      setError(null);
                    }}
                    className="text-xs font-bold text-emerald-deep hover:underline focus-visible:outline-none cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-deep focus:border-transparent outline-none transition-all text-ink-deep"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-deep hover:bg-emerald-strong text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-deep/25 transition-all active:scale-[0.98] mt-2 disabled:opacity-70"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Sign Up
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs">
            <span className="text-muted-grey">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="ml-1.5 font-bold text-emerald-deep hover:underline focus-visible:outline-none cursor-pointer"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
};
