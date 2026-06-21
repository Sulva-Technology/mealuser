import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initMonitoring() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_RELEASE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0)
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) return;
  Sentry.captureException(error, { extra: context });
}

export function setMonitoringUser(user: { id?: string; email?: string } | null) {
  if (!dsn) return;
  Sentry.setUser(user ? { id: user.id, email: user.email } : null);
}
