// Signup funnel tracking. Steps are sent to the backend (POST /v1/analytics/events via
// the BFF at /api/analytics/events) and read by admins at GET /v1/admin/analytics/funnel.
// Onboarding completion and first order are derived server-side, so only the steps the
// backend can't see are reported here. Tracking must never break the app: every
// failure is swallowed.

export type FunnelEvent =
  | 'campus_link_opened'
  | 'signup_started'
  | 'signup_completed'
  | 'campus_selected'
  | 'location_selected';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
// Same split as PUBLIC_CATALOG_BASE in store.tsx: the BFF serves the event route outside
// /api/v1 (which demands CSRF before sign-in); a direct backend base already exposes it.
const ANALYTICS_URL = API_BASE === '/api/v1' ? '/api/analytics/events' : `${API_BASE}/analytics/events`;

const ANON_ID_KEY = 'md_anon_id';
const CAMPUS_LINK_KEY = 'md_campus_link';
const CSRF_COOKIE = 'md_csrf';
const CAMPUS_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Steps already sent during this page load, so re-renders and repeated taps on the
// same campus/location don't flood the endpoint. The backend counts distinct people
// anyway; this only trims noise.
const sent = new Set<string>();

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / storage disabled — tracking still works for this page load */
  }
}

function randomUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let memoryAnonId: string | null = null;

/** Random per-device id, kept across visits so pre-signup steps count as one person. */
export function getAnonymousId(): string {
  const stored = storageGet(ANON_ID_KEY);
  if (stored && UUID_PATTERN.test(stored)) return stored;
  memoryAnonId = memoryAnonId || randomUuid();
  storageSet(ANON_ID_KEY, memoryAnonId);
  return memoryAnonId;
}

export function normalizeCampusSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slug = raw.trim().toLowerCase();
  return slug.length <= 80 && CAMPUS_SLUG_PATTERN.test(slug) ? slug : null;
}

/** Campus slug from a `?campus=<slug>` link (e.g. https://app/?campus=unilag). */
export function readCampusLinkFromUrl(search?: string): string | null {
  try {
    const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
    return normalizeCampusSlug(new URLSearchParams(query).get('campus'));
  } catch {
    return null;
  }
}

/** The campus link this device arrived on, persisted so it survives signup + email confirmation. */
export function getCampusLink(): string | null {
  return normalizeCampusSlug(storageGet(CAMPUS_LINK_KEY));
}

/**
 * Call once on app load: remembers a `?campus=` link and records that it was opened.
 * Returns the slug in effect (from the URL, else from an earlier visit).
 */
export function captureCampusLink(): string | null {
  const fromUrl = readCampusLinkFromUrl();
  if (fromUrl) {
    storageSet(CAMPUS_LINK_KEY, fromUrl);
    trackFunnel('campus_link_opened');
    return fromUrl;
  }
  return getCampusLink();
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

/**
 * Report one funnel step. With a campusId the step is tied to that campus; without one
 * it is tied to the campus link the visitor arrived on, if any.
 */
export function trackFunnel(event: FunnelEvent, options: { campusId?: string } = {}) {
  try {
    const campusId = options.campusId && UUID_PATTERN.test(options.campusId) ? options.campusId : undefined;
    const campusSlug = campusId ? undefined : getCampusLink() || undefined;
    const dedupeKey = `${event}:${campusId || campusSlug || ''}`;
    if (sent.has(dedupeKey)) return;
    sent.add(dedupeKey);

    const csrf = readCookie(CSRF_COOKIE);
    void fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-MealDirect-CSRF': csrf } : {})
      },
      credentials: 'same-origin',
      // Survives the page navigating away (e.g. right after signup).
      keepalive: true,
      body: JSON.stringify({
        event,
        anonymousId: getAnonymousId(),
        ...(campusId ? { campusId } : {}),
        ...(campusSlug ? { campusSlug } : {})
      })
    }).catch(() => {
      /* analytics must never surface errors */
    });
  } catch {
    /* analytics must never surface errors */
  }
}
