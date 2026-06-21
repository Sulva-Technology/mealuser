import React, { useState } from 'react';
import { useMealDirect } from '../store';
import { AppShell, GlassPanel, Currency } from './CommonUI';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { signIn, signUp } = useMealDirect();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

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
              <label className="block text-xs font-bold text-muted-grey mb-1.5 uppercase tracking-wide">Password</label>
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
