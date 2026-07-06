import { useEffect, useState } from 'react';

/**
 * Transient toast popups for foreground pushes. Decoupled via a `md:toast`
 * window event so any layer (the store's FCM onMessage handler) can raise one
 * without prop-drilling. Mirrors the in-app toasts the admin/rider apps show
 * while the tab is focused. Auto-dismisses; tap to close.
 */
type Toast = { id: string; title: string; body: string };

export type PushToastDetail = { title: string; body?: string };

export function PushToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<PushToastDetail>).detail;
      if (!detail?.title) return;
      const id = 'toast_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, title: detail.title, body: detail.body ?? '' }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    };
    window.addEventListener('md:toast', onToast);
    return () => window.removeEventListener('md:toast', onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] w-80">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          className="text-left rounded-xl border border-gray-200 bg-white shadow-lg px-4 py-3 animate-in slide-in-from-top-2"
        >
          <p className="text-sm font-semibold text-gray-900">{t.title}</p>
          {t.body && <p className="mt-0.5 text-sm text-gray-600 line-clamp-2">{t.body}</p>}
        </button>
      ))}
    </div>
  );
}
