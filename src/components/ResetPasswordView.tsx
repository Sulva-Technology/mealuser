import React, { useState } from 'react';
import { useMealDirect } from '../store';
import { GlassPanel } from './CommonUI';
import { KeyRound, AlertCircle, CheckCircle2, LogIn, Eye, EyeOff } from 'lucide-react';

// Shown when the app is opened via a Supabase password-reset link (/auth/callback).
// Lets the user choose a new password (the recovery token is held in the store),
// or explains that the link is invalid/expired.
export const ResetPasswordView: React.FC = () => {
  const { passwordRecovery, updatePassword, exitPasswordRecovery } = useMealDirect();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Could not update your password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Expired / invalid link — no token to work with.
  if (passwordRecovery?.mode === 'error') {
    return (
      <div className="min-h-screen bg-canvas-ivory flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <GlassPanel className="p-6 md:p-8 text-center flex flex-col items-center gap-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-danger/10 text-danger">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl text-emerald-strong">Link expired</h2>
              <p className="text-muted-grey text-sm mt-2 leading-relaxed">
                {passwordRecovery.message} Request a fresh password reset link and try again.
              </p>
            </div>
            <button
              type="button"
              onClick={exitPasswordRecovery}
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

  // Password updated — send the user to sign in with the new password.
  if (done) {
    return (
      <div className="min-h-screen bg-canvas-ivory flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <GlassPanel className="p-6 md:p-8 text-center flex flex-col items-center gap-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-deep/10 text-emerald-deep">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl text-emerald-strong">Password updated</h2>
              <p className="text-muted-grey text-sm mt-2 leading-relaxed">
                Your password has been changed. Sign in with your new password to continue.
              </p>
            </div>
            <button
              type="button"
              onClick={exitPasswordRecovery}
              className="w-full flex items-center justify-center gap-2 bg-emerald-deep hover:bg-emerald-strong text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-deep/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              Go to Sign In
            </button>
          </GlassPanel>
        </div>
      </div>
    );
  }

  // Choose-a-new-password form.
  return (
    <div className="min-h-screen bg-canvas-ivory flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-deep mb-4 shadow-xl shadow-emerald-deep/20 text-white">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="font-display font-black text-3xl text-emerald-strong">New Password</h1>
          <p className="text-muted-grey text-sm mt-2">Choose a new password for your account</p>
        </div>

        <GlassPanel className="p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/20 text-xs text-danger font-semibold rounded-2xl flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-danger shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-grey mb-1.5 uppercase tracking-wide">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 bg-white border border-emerald-deep/15 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-deep focus:border-transparent outline-none transition-all text-ink-deep"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-grey hover:text-emerald-deep cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-grey mb-1.5 uppercase tracking-wide">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-emerald-deep/15 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-deep focus:border-transparent outline-none transition-all text-ink-deep"
                placeholder="Re-enter your new password"
                autoComplete="new-password"
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
                  Update Password
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs">
            <button
              type="button"
              onClick={exitPasswordRecovery}
              className="font-bold text-emerald-deep hover:underline focus-visible:outline-none cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
};
