import React, { useState, useEffect } from 'react';
import { useMealDirect } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home,
  Store,
  ShoppingBag,
  Clock,
  User,
  Bell,
  Wifi,
  WifiOff,
  LogOut,
  MapPin,
  HelpCircle,
  Menu,
  ChevronRight,
  ChevronLeft,
  Bike,
  Eye
} from 'lucide-react';
import { formatNGN } from '../utils/helpers';

// Premium Currency formatting
export const Currency: React.FC<{ kobo: number; className?: string }> = ({ kobo, className = '' }) => {
  return (
    <span className={`numeric-tabular font-medium text-inherit ${className}`} aria-label={`${kobo / 100} Naira`}>
      {formatNGN(kobo)}
    </span>
  );
};

// Skeleton loaders
export const Skeleton: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  return <div className={`skeleton-pulse ${className}`} />;
};

export const LoadingSkeleton: React.FC<{ r?: string; h?: string; w?: string; className?: string }> = ({
  r = 'rounded-xl',
  h = 'h-6',
  w = 'w-full',
  className = ''
}) => {
  return <div className={`skeleton-pulse ${r} ${h} ${w} ${className}`} />;
};

// Custom Liquid Glass Card Wrapper
export const GlassPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
  id?: string;
  onClick?: () => void;
}> = ({ children, className = '', id, onClick }) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`glass-panel rounded-[24px] p-6 transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-deep focus-visible:ring-offset-2' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

// Offline Status banner — driven by the real browser connection (navigator.onLine)
export const OfflineBanner: React.FC = () => {
  const { isOnline, lastSyncTime } = useMealDirect();

  return (
    <div className="w-full transition-all duration-300">
      {!isOnline ? (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 px-4 py-2.5 text-xs font-medium flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-400 animate-pulse" />
            <span>
              <strong>Offline:</strong> No internet connection. Order placement is paused until you reconnect.
            </span>
          </div>
          <span className="text-[10px] text-red-300">Last sync: {lastSyncTime}</span>
        </div>
      ) : (
        <div className="bg-[#10231C] text-white px-4 py-1 text-[11px] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16845B] animate-ping" />
          <span>Connected to Meal Direct.</span>
        </div>
      )}
    </div>
  );
};

interface AppShellProps {
  children: React.ReactNode;
  activeTab: 'home' | 'vendors' | 'cart' | 'orders' | 'profile' | 'none';
}

export const AppShell: React.FC<AppShellProps> = ({ children, activeTab }) => {
  const { user, navigateTo, signOut, notifications, cart, activeInAppAlert, dismissInAppAlert } = useMealDirect();
  // Real PWA install handling. `beforeinstallprompt` only fires on Chromium
  // (Android/desktop) once the app meets installability criteria and isn't
  // already installed. iOS Safari never fires it — there we show manual
  // "Add to Home Screen" instructions instead.
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari exposes this non-standard flag when launched from home screen
      (window.navigator as any).standalone === true);
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window.navigator as any).standalone;

  const [pwaInstalled, setPwaInstalled] = useState(isStandalone);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showPwaPrompt, setShowPwaPrompt] = useState(() => {
    if (isStandalone) return false;
    return !localStorage.getItem('md_pwa_prompt_dismissed');
  });

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Stop Chrome's mini-infobar so we can trigger the prompt from our button
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setPwaInstalled(true);
      setShowPwaPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const cartItemCount = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

  const navItems = [
    { key: 'home', label: 'Home', icon: Home, path: '/home' },
    { key: 'vendors', label: 'Vendors', icon: Store, path: '/vendors' },
    { key: 'cart', label: 'Cart', icon: ShoppingBag, path: '/cart', badge: cartItemCount },
    { key: 'orders', label: 'Orders', icon: Clock, path: '/orders' },
    { key: 'profile', label: 'Profile', icon: User, path: '/profile' }
  ];

  const handleDismissPwa = () => {
    localStorage.setItem('md_pwa_prompt_dismissed', 'true');
    setShowPwaPrompt(false);
  };

  const handleInstallPwa = async () => {
    // iOS: no programmatic install — surface the manual Share-sheet steps.
    if (isIOS) {
      setShowIosHelp(true);
      return;
    }
    if (!deferredPrompt) {
      // Installable criteria not met yet (or already installed / unsupported
      // browser). Nothing to prompt — leave the banner for the user to dismiss.
      return;
    }
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setShowPwaPrompt(false);
      }
    } catch {
      /* user dismissed */
    } finally {
      // A deferred prompt can only be used once
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas-ivory text-ink-deep font-sans">
      {/* Network offline checker */}
      <OfflineBanner />

      {/* Local Live In-App Alert Overlay */}
      <AnimatePresence>
        {activeInAppAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-emerald-strong text-white p-5 rounded-2xl shadow-2xl z-50 border border-emerald-deep/20 overflow-hidden"
            id="inapp_alert_banner"
          >
            {/* Ambient Background Glow Effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-mango-warm/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start gap-3.5 relative z-10">
              <div className="p-2 bg-mango-warm text-emerald-strong rounded-xl animate-pulse shrink-0">
                <Bike className="w-5 h-5 stroke-[2.5]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-widest text-[#FFF2CC] uppercase">REAL-TIME DISPATCH</span>
                  <span className="text-[9px] font-mono text-white/50">{new Date(activeInAppAlert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <h3 className="font-display font-black text-sm text-white mt-1 leading-tight">{activeInAppAlert.title}</h3>
                <p className="text-[11px] text-zinc-100/90 leading-relaxed mt-1.5">{activeInAppAlert.message}</p>
                
                <div className="flex gap-2.5 mt-4">
                  <button
                    onClick={() => {
                      navigateTo(`/orders/${activeInAppAlert.orderId}`);
                      dismissInAppAlert();
                    }}
                    className="flex-1 py-1.5 bg-mango-warm text-emerald-strong hover:bg-amber-400 rounded-lg text-[10.5px] font-black cursor-pointer shadow-sm text-center transition active:scale-95 flex items-center justify-center gap-1"
                    id="alert_track_btn"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Track Takeaway</span>
                  </button>
                  <button
                    onClick={dismissInAppAlert}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10.5px] font-bold cursor-pointer transition active:scale-95"
                    id="alert_dismiss_btn"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global PWA Install Prompter — only when the browser can actually
          install (deferred prompt captured) or on iOS (manual instructions). */}
      {showPwaPrompt && !pwaInstalled && (deferredPrompt || isIOS) && (
        <div className="bg-emerald-strong text-white px-4 py-3 text-xs md:text-sm flex items-center justify-between shadow-lg sticky top-0 z-50 animate-fade-in border-b border-emerald-deep">
          <div className="flex items-center gap-3">
            <span className="p-1 px-2.5 rounded-full bg-mango-warm text-emerald-strong font-bold text-xs uppercase tracking-wider shadow-sm animate-pulse">PWA</span>
            <span>
              <strong>Install Meal Direct:</strong> Add to Home Screen for clean standalone operation and offline catalog browsing.
            </span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
            <button
              onClick={handleInstallPwa}
              className="bg-white hover:bg-neutral-100 text-emerald-strong px-3 py-1.5 rounded-lg font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm"
            >
              {isIOS ? 'How to install' : 'Install App'}
            </button>
            <button
              onClick={handleDismissPwa}
              className="text-white/80 hover:text-white px-2 py-1 text-xs font-semibold cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* iOS manual "Add to Home Screen" instructions */}
      {showIosHelp && (
        <div
          className="fixed inset-0 z-[60] bg-ink-deep/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-lg text-emerald-strong">Install on iPhone / iPad</h3>
            <ol className="mt-3 space-y-2.5 text-sm text-ink-deep list-decimal list-inside">
              <li>Tap the <strong>Share</strong> icon in Safari’s toolbar.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top-right corner.</li>
            </ol>
            <p className="text-[11px] text-muted-grey mt-3">
              Install must be done from Safari — Chrome and in-app browsers on iOS can’t add to the Home Screen.
            </p>
            <button
              onClick={() => setShowIosHelp(false)}
              className="mt-5 w-full bg-emerald-deep hover:bg-emerald-strong text-white py-2.5 rounded-xl font-bold text-sm transition active:scale-95 cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Main Top Header Navigation */}
      <header className="bg-white/40 backdrop-blur-xl border-b border-ink-deep/5 sticky top-0 z-40 h-20 px-4 md:px-8 flex items-center justify-between pt-[env(safe-area-inset-top)]" id="global_header">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigateTo(user ? '/home' : '/')}
            className="flex items-center gap-2.5 cursor-pointer select-none animate-fade-in"
          >
            <div className="w-10 h-10 bg-emerald-deep rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-deep/20 transition duration-300 hover:scale-105 overflow-hidden">
              <img src="/logo.png" alt="Meal Direct" className="w-full h-full object-contain p-1" />
            </div>
            <div>
              <h1 className="font-display font-black text-base leading-tight tracking-tight text-ink-deep flex items-center gap-1.5">
                Meal Direct
                <span className="text-[9px] bg-mango-warm/20 text-[#B96A05] border border-mango-warm/30 rounded-md px-1.5 py-0.5 font-mono font-medium scale-90">
                  Customer
                </span>
              </h1>
              <p className="text-[10px] text-muted-grey font-medium leading-none tracking-wide">Venite University Dispatch</p>
            </div>
          </div>
        </div>

        {/* Action Widgets */}
        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Notifications Trigger */}
          {user && (
            <button
              onClick={() => navigateTo('/notifications')}
              className="relative p-2 rounded-xl text-muted-grey hover:bg-emerald-deep/5 hover:text-emerald-strong transition-all duration-200 cursor-pointer"
              id="notification_bell"
              aria-label="Open notifications page"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-danger text-[9px] font-black text-white rounded-full flex items-center justify-center shadow animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Log Out Widget */}
          {user && (
            <div className="flex items-center gap-2 border-l border-emerald-deep/12 pl-3">
              <span className="hidden md:inline text-xs font-semibold text-emerald-strong bg-emerald-deep/5 px-2.5 py-1.5 rounded-lg border border-emerald-deep/10">
                {user.fullName}
              </span>
              <button
                onClick={signOut}
                className="p-2 rounded-xl text-muted-grey hover:bg-red-50 hover:text-danger hover:border-red-100 transition-all cursor-pointer border border-transparent"
                title="Log out of application"
                id="logout_action"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Dynamic Screen Layout Framework */}
      <div className="flex flex-1 relative">
        {/* Tablet Navigation Rail Segment (Hidden on mobile/desktop) */}
        {user && (
          <aside className="hidden md:flex lg:hidden flex-col items-center gap-8 py-8 w-20 border-r border-ink-deep/5 bg-white/60 backdrop-blur-xl shrink-0 z-20">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => navigateTo(item.path)}
                  className={`relative p-3 rounded-2xl transition-all duration-200 group cursor-pointer min-h-[48px] min-w-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-deep focus-visible:ring-offset-2 flex justify-center items-center ${
                    isActive
                      ? 'bg-emerald-deep text-white shadow-xl shadow-emerald-deep/25 scale-105'
                      : 'text-muted-grey hover:bg-ink-deep/5 hover:text-ink-deep'
                  }`}
                  aria-label={item.label}
                >
                  <Icon className="w-5 h-5" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-mango-warm text-emerald-strong text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                      {item.badge}
                    </span>
                  )}
                  {/* Tooltip feedback */}
                  <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-ink-deep text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all scale-90 origin-left group-hover:scale-100 shadow-lg z-50">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </aside>
        )}

        {/* Desktop Sidebar Sidebar Segment (Hidden on mobile/tablet) */}
        {user && (
          <aside className="hidden lg:flex flex-col justify-between py-8 px-4 w-60 border-r border-ink-deep/5 bg-white/60 backdrop-blur-xl shrink-0 z-20">
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-bold tracking-wider text-muted-grey uppercase px-3 mb-3">Main Navigation</p>
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigateTo(item.path)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl min-h-[48px] transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-deep focus-visible:ring-offset-2 ${
                      isActive
                        ? 'bg-emerald-deep text-white font-bold shadow-xl shadow-emerald-deep/20 scale-[1.01]'
                        : 'text-muted-grey hover:bg-ink-deep/5 hover:text-ink-deep hover:translate-x-1'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4.5 h-4.5" />
                      <span className="text-xs">{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border ${
                        isActive ? 'bg-mango-warm text-emerald-strong border-emerald-deep' : 'bg-emerald-deep text-white border-white'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Support section card */}
            <div className="p-4 bg-[#F7F8F4] rounded-2xl border border-ink-deep/5 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-deep" />
                <h4 className="text-xs font-bold text-ink-deep leading-none">Need Support?</h4>
              </div>
              <p className="text-[10px] text-muted-grey leading-relaxed mb-3 font-medium">
                Have orders delayed? Lodge structure escalations directly on the tracking screen.
              </p>
              <a
                href="https://mealdirect.com/support"
                target="_blank"
                rel="referrer"
                className="text-[10px] font-black text-emerald-deep hover:underline flex items-center gap-1 cursor-pointer"
              >
                Help Center
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </aside>
        )}

        {/* Dynamic page viewport frame */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 focus:outline-none" tabIndex={-1} id="main_content_stage">
          <div className="max-w-4xl mx-auto pb-20 md:pb-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar (Hidden on tablet/desktop) */}
      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-emerald-deep/8 px-2 py-2 flex justify-around items-center z-40 shadow-xl pb-[calc(0.5rem+env(safe-area-inset-bottom))]" id="mobile_bottom_nav">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
                <button
                  key={item.key}
                  onClick={() => navigateTo(item.path)}
                  className={`relative flex flex-col items-center justify-center p-2 rounded-2xl min-w-[56px] min-h-[48px] cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-deep focus-visible:ring-offset-2 ${
                    isActive ? 'text-emerald-deep font-bold scale-105' : 'text-muted-grey hover:text-ink-deep active:scale-95'
                  }`}
                  aria-label={item.label}
                >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                <span className="text-[10px] tracking-tight mt-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute top-1 right-2 bg-mango-warm text-emerald-strong text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Minimal high contrast legal footer for unregistered visitors */}
      {!user && (
        <footer className="py-6 px-4 border-t border-emerald-deep/8 text-center text-[11px] text-muted-grey bg-white/50 backdrop-blur" id="auth_footer">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© {new Date().getFullYear()} Meal Direct Inc. Venite campus dispatch dispatch. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="https://mealdirect.com/terms" target="_blank" rel="noopener noreferrer" className="hover:underline">Terms of Service</a>
              <a href="https://mealdirect.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline">Privacy Policy</a>
              <a href="https://mealdirect.com/support" target="_blank" rel="noopener noreferrer" className="hover:underline">Contact Support</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};
