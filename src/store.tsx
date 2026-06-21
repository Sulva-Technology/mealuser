import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  Cart,
  CartItem,
  Order,
  OrderStatus,
  OrderStatusHistory,
  Notification as AppNotification,
  Escalation,
  Review,
  RoutePath,
  OrderQuote,
  MenuItemReview,
  Campus,
  PresetLocation,
  DeliverySlot,
  Vendor,
  MenuItem,
  ServerQuote
} from './types';
import { triggerVibration, VIBE_PATTERNS } from './utils/vibe';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/v1';

// Single-flight refresh: many parallel 401s share one /auth/refresh call
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('md_refresh_token');
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (!res.ok) return null;
        const json = await res.json();
        const newAccess = json.accessToken;
        if (!newAccess) return null;
        localStorage.setItem('md_access_token', newAccess);
        localStorage.setItem('md_refresh_token', json.refreshToken || refreshToken);
        return newAccess as string;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

// Convert a base64url VAPID public key into the Uint8Array PushManager expects
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Idempotency-Key for mutating POSTs so retries/double-clicks don't duplicate
function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function unwrapEnvelope(json: any) {
  if (json && typeof json === 'object' && 'data' in json && !('accessToken' in json)) {
    return json.data;
  }
  return json;
}

export async function apiRequest(path: string, method = 'GET', body: any = null, token?: string | null, extraHeaders?: Record<string, string>, _isRetry = false): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {})
  };
  const activeToken = token || localStorage.getItem('md_access_token');
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
  } catch (error) {
    console.warn(`API network error [${method} ${path}]:`, error);
    throw error;
  }

  // Access token expired — attempt a one-time refresh, then retry once.
  // Skip auth endpoints (login/signup/refresh): their 401 is a real credential
  // error, not an expired session. Only engage if we actually hold a refresh token.
  const isAuthPath = path.startsWith('/auth/');
  const hasRefreshToken = !!localStorage.getItem('md_refresh_token');
  if (response.status === 401 && !_isRetry && !token && !isAuthPath && hasRefreshToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest(path, method, body, newToken, extraHeaders, true);
    }
    // Refresh failed → force a clean logout
    localStorage.removeItem('md_access_token');
    localStorage.removeItem('md_refresh_token');
    window.dispatchEvent(new CustomEvent('md:logout'));
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || errorData?.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) return null;
  const json = await response.json();
  return unwrapEnvelope(json);
}

interface RouterState {
  path: string;
  params: Record<string, string>;
}

interface MealDirectContextType {
  // Session / User Profile
  user: UserProfile | null;
  onboardingData: { phone: string; campusId: string; locationId: string } | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  completeOnboarding: (fullName: string, phone: string, campusId: string, locationId: string) => void;
  updateProfile: (fullName: string, phone: string, campusId: string, defaultLocationId: string) => void;
  signOut: () => void;

  // Catalog
  campuses: Campus[];
  locations: PresetLocation[];
  deliverySlots: DeliverySlot[];
  vendors: Vendor[];
  menuItems: MenuItem[];

  // Routing
  router: RouterState;
  navigateTo: (path: string) => void;
  goBack: () => void;

  // Cart
  cart: Cart | null;
  addToCart: (vendorId: string, item: CartItem) => void;
  updateCartItemQuantity: (menuItemId: string, quantity: number) => void;
  updateCartItemSpoons: (menuItemId: string, spoonsCount: number, quantity?: number) => void;
  removeFromCart: (menuItemId: string) => void;
  clearCart: () => void;
  setCartDateTimeLocation: (date: string, slotId: string, locationId: string) => void;
  getCartQuote: () => OrderQuote;
  fetchOrderQuote: (promotionCode?: string) => Promise<ServerQuote | null>;
  validatePromo: (code: string) => Promise<{ valid: boolean; discountKobo: number; message?: string }>;

  // Orders
  orders: Order[];
  createOrder: (specialInstructions?: string, promotionCode?: string) => Promise<Order>;
  registerDeviceToken: () => Promise<boolean>;
  payOrder: (orderId: string) => Promise<string>;
  refreshOrder: (orderId: string) => Promise<Order | null>;
  fetchPaymentStatus: (orderId: string) => Promise<{ orderStatus: OrderStatus; paid: boolean; terminalFail: boolean } | null>;
  confirmDelivery: (orderId: string) => void;
  progressOrderStatus: (orderId: string) => void; // Simulated status incrementer for demo!
  cancelOrder: (orderId: string) => void;
  reorderOrder: (orderId: string) => void;

  // Escalations
  escalations: Escalation[];
  createEscalation: (orderId: string, category: Escalation['category'], description: string) => void;

  // Reviews
  reviews: Review[];
  createReview: (orderId: string, rating: number, comment: string) => void;
  menuItemReviews: MenuItemReview[];
  createMenuItemReview: (menuItemId: string, rating: number, comment: string, userName?: string) => void;

  // Notifications
  notifications: AppNotification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Connection & Offline simulated states
  isOnline: boolean;
  setOnlineStatus: (status: boolean) => void;
  lastSyncTime: string;

  // Global Context Helpers
  currentDate: string;
  currentSlotId: string;
  currentLocationId: string;
  setCurrentDateTimeLocation: (date: string, slotId: string, locationId: string) => void;

  // Local live in-app alert notification
  activeInAppAlert: { id: string; orderId: string; orderNumber: string; title: string; message: string; timestamp: string } | null;
  dismissInAppAlert: () => void;

  // Saved Delivery Locations
  savedLocationIds: string[];
  toggleSaveLocation: (locationId: string) => void;

  // Saved Favorite Dishes
  favoriteItemIds: string[];
  toggleFavoriteItem: (itemId: string) => void;
}

const MealDirectContext = createContext<MealDirectContextType | undefined>(undefined);

// Helper to extract path & params (e.g. /vendors/ven_grill or /orders/ord_123/escalate)
function parseLocation(): RouterState {
  const hash = window.location.hash || '#/';
  const path = hash.replace('#', '').split('?')[0];

  const params: Record<string, string> = {};
  
  // Custom segment matchers
  if (path.startsWith('/vendors/')) {
    const parts = path.split('/');
    if (parts[2]) params.vendorId = parts[2];
  } else if (path.startsWith('/payment/status/')) {
    const parts = path.split('/');
    if (parts[3]) params.orderId = parts[3];
  } else if (path.startsWith('/orders/')) {
    const parts = path.split('/');
    if (parts[2]) params.orderId = parts[2];
    if (parts[3] === 'escalate') params.action = 'escalate';
    if (parts[3] === 'review') params.action = 'review';
  }

  return { path, params };
}

// localStorage key holding the route to return to after the user signs back in.
const RETURN_PATH_KEY = 'md_return_path';

// Whether a path is safe to restore for ANY account after re-login.
// Excludes auth/onboarding plus user-specific deep links (a specific order,
// payment status) — restoring those for a different account could 404 or
// surface another user's data, so those fall back to /home.
function isRestorablePath(path: string): boolean {
  if (!path || path === '/' || path === '/onboarding') return false;
  const STATIC_SAFE = ['/home', '/vendors', '/cart', '/checkout', '/orders', '/notifications', '/profile'];
  if (STATIC_SAFE.includes(path)) return true;
  // Vendor detail is shared catalog data → safe to restore for anyone.
  if (path.startsWith('/vendors/')) return true;
  // /orders/:id, /payment/status/:id, etc. are account-specific → not safe.
  return false;
}

// Capture the current route at logout so we can return here after the next
// successful sign-in. Called for both manual and forced (session-expiry) logout.
function saveReturnPath() {
  const { path } = parseLocation();
  if (isRestorablePath(path)) {
    localStorage.setItem(RETURN_PATH_KEY, path);
  } else {
    localStorage.removeItem(RETURN_PATH_KEY);
  }
}

// Backend returns lowercase status strings (e.g. "pending_payment"); client uses UPPERCASE
export function normalizeStatus(raw: string | undefined | null): OrderStatus {
  if (!raw) return 'PENDING_PAYMENT';
  return raw.toUpperCase() as OrderStatus;
}

// Human-readable titles for synthesized status-history entries
const STATUS_TITLES: Record<string, { title: string; description: string }> = {
  PENDING_PAYMENT: { title: 'Awaiting Payment', description: 'Order created. Awaiting payment confirmation.' },
  PAID: { title: 'Payment Confirmed 💳', description: 'Payment verified. Order submitted to the vendor.' },
  ACCEPTED: { title: 'Order Accepted 🧑‍🍳', description: 'The vendor confirmed receipt and is assembling your meal.' },
  PREPARING: { title: 'In the Kitchen 🔥', description: 'Your meal is being cooked.' },
  READY: { title: 'Takeaway Packaged 📦', description: 'Sealed and marked for courier dispatch.' },
  PICKED_UP: { title: 'Picked up by Courier 🚴', description: 'Rider departed the pickup hub.' },
  OUT_FOR_DELIVERY: { title: 'Out for Campus Dispatch 📍', description: 'Rider approaching your zone.' },
  DELIVERED: { title: 'Arrived at Location 🏁', description: 'Takeaway delivered. Confirm receipt on screen.' },
  CONFIRMED: { title: 'Order Confirmed by Customer 👍', description: 'You confirmed successful delivery. Thank you!' },
  CANCELLED: { title: 'Order Cancelled', description: 'This order has been cancelled.' },
  EXPIRED: { title: 'Order Expired', description: 'Payment window elapsed before confirmation.' },
  REFUNDED: { title: 'Order Refunded', description: 'A refund was processed for this order.' },
  ESCALATED: { title: 'Case Escalated to Helpdesk ⚠️', description: 'A support investigation is in progress.' },
  ADMINISTRATIVELY_COMPLETED: { title: 'Completed', description: 'Order closed by support.' }
};

function mapOrderItem(raw: any, existing?: any) {
  return {
    menuItemId: raw.menuItemId,
    name: raw.itemName || raw.name || existing?.name || 'Item',
    priceKobo: raw.unitPriceKobo ?? raw.priceKobo ?? existing?.priceKobo ?? 0,
    quantity: raw.quantity ?? existing?.quantity ?? 1,
    spoonsCount: raw.spoonsCount ?? existing?.spoonsCount ?? 0
  };
}

// Preserve existing local history; append a new entry when server status advances
function buildStatusHistory(status: OrderStatus, s: any, existing?: Order): OrderStatusHistory[] {
  const history = existing?.statusHistory ? [...existing.statusHistory] : [];
  const last = history[history.length - 1];
  if (!last || last.status !== status) {
    const meta = STATUS_TITLES[status] || { title: status, description: '' };
    history.push({
      status,
      timestamp: s.updatedAt || s.paidAt || s.deliveredAt || new Date().toISOString(),
      title: meta.title,
      description: meta.description
    });
  }
  return history;
}

// Map a backend order (list or detail shape) into the client Order shape.
// Merges with an existing local order to preserve client-only fields.
export function normalizeOrder(s: any, existing?: Order): Order {
  const status = normalizeStatus(s.orderStatus || s.status);
  const items = Array.isArray(s.items) && s.items.length
    ? s.items.map((it: any, i: number) => mapOrderItem(it, existing?.items?.[i]))
    : (existing?.items || []);
  return {
    id: s.id,
    orderNumber: s.orderNumber || existing?.orderNumber || '',
    userId: s.customerId || existing?.userId || '',
    vendorId: s.vendorId || existing?.vendorId || '',
    campusId: s.campusId || existing?.campusId || '',
    locationId: s.locationId || existing?.locationId || '',
    slotId: s.deliverySlotId || existing?.slotId || '',
    deliveryDate: s.serviceDate || existing?.deliveryDate || '',
    items,
    subtotalKobo: s.foodSubtotalKobo ?? existing?.subtotalKobo ?? 0,
    deliveryFeeKobo: s.deliveryFeeKobo ?? existing?.deliveryFeeKobo ?? 0,
    totalKobo: s.totalKobo ?? existing?.totalKobo ?? 0,
    status,
    statusHistory: buildStatusHistory(status, s, existing),
    paymentReference: s.latestPayment?.providerReference || existing?.paymentReference,
    requestId: existing?.requestId || s.id,
    createdAt: s.createdAt || existing?.createdAt || new Date().toISOString(),
    hasEscalation: existing?.hasEscalation || false,
    hasReview: existing?.hasReview || false,
    specialInstructions: s.specialInstructions ?? existing?.specialInstructions
  };
}

// Merge a server order list into local state: normalize + preserve local-only orders
export function mergeServerOrders(prev: Order[], serverList: any[]): Order[] {
  const byId = new Map(prev.map(o => [o.id, o]));
  const normalized = serverList.map(s => normalizeOrder(s, byId.get(s.id)));
  const serverIds = new Set(normalized.map(o => o.id));
  const localOnly = prev.filter(o => !serverIds.has(o.id));
  return [...normalized, ...localOnly];
}

// Normalize a backend CampusLocationRecordDto into the client PresetLocation shape
export function mapLocation(raw: any): PresetLocation {
  return {
    id: raw.id,
    campusId: raw.campusId,
    name: raw.name,
    zone: raw.zoneName || raw.zoneCode || 'Zone',
    type: String(raw.type).toLowerCase() === 'hostel' ? 'Hostel' : 'Department'
  };
}

// Normalize a backend DeliverySlotRecordDto into the client DeliverySlot shape
export function mapSlot(raw: any): DeliverySlot {
  const time = (raw.deliveryTime || raw.time || '').slice(0, 5); // "12:00:00" -> "12:00"
  return {
    id: raw.id,
    time,
    label: raw.name ? `${raw.name}${time ? ` (${time})` : ''}` : (raw.label || time)
  };
}

// Normalize a backend CatalogVendorDto into the client Vendor shape (with safe defaults
// for fields the catalog endpoint doesn't supply, e.g. rating/reviewCount).
export function mapVendor(raw: any): Vendor {
  return {
    id: raw.id,
    name: raw.displayName || raw.name || 'Vendor',
    description: raw.description || '',
    imageUrl: raw.logoUrl || raw.imageUrl || '',
    rating: typeof raw.rating === 'number' ? raw.rating : (raw.ratingAverage ?? 0),
    reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : (raw.ratingCount ?? 0),
    featuredTags: raw.featuredTags || (raw.kitchenLocation ? [raw.kitchenLocation] : []),
    preparationTimeMins: raw.preparationTimeMins ?? 0
  };
}

// Normalize a backend menu item (MenuItemDto) into the client MenuItem shape
export function mapMenuItem(raw: any): MenuItem {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description || '',
    priceKobo: raw.priceKobo,
    imageUrl: raw.imageUrl || '',
    category: raw.categoryName || raw.category || 'General',
    availableQuantity: raw.remainingQuantity ?? raw.availableQuantity ?? 0
  };
}

export const MealDirectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Offline State
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString());

  // Routing State
  const [router, setRouter] = useState<RouterState>(parseLocation());

  // Global Context state: Selection overrides
  const [currentDate, setCurrentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [currentSlotId, setCurrentSlotId] = useState<string>('slot_12'); // Defaults to Lunch
  const [currentLocationId, setCurrentLocationId] = useState<string>('');

  // Persisted Database State
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('md_access_token');
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('md_user');
    if (saved) return JSON.parse(saved);
    return null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('md_access_token', token);
      
      // Real auth protection: validate session on boot
      apiRequest('/me', 'GET', null, token).then((meProfile) => {
        if (meProfile) setUser(meProfile);
      }).catch((err) => {
        console.warn('Session invalid, logging out', err);
        setToken(null);
        setUser(null);
        localStorage.removeItem('md_access_token');
        localStorage.removeItem('md_user');
      });
      
    } else {
      localStorage.removeItem('md_access_token');
    }
  }, []); // Only run once on mount, or wait, if I run it on `token` change, it loops?
  
  // Safe token persistence
  useEffect(() => {
    if (token) {
      localStorage.setItem('md_access_token', token);
    } else {
      localStorage.removeItem('md_access_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('md_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('md_user');
    }
  }, [user]);

  const [onboardingData, setOnboardingData] = useState<{ phone: string; campusId: string; locationId: string } | null>(() => {
    const saved = localStorage.getItem('md_onboarding_temp');
    return saved ? JSON.parse(saved) : null;
  });

  const [cart, setCart] = useState<Cart | null>(() => {
    const saved = localStorage.getItem('md_cart');
    return saved ? JSON.parse(saved) : null;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('md_orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('md_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [escalations, setEscalations] = useState<Escalation[]>(() => {
    const saved = localStorage.getItem('md_escalations');
    return saved ? JSON.parse(saved) : [];
  });

  const [reviews, setReviews] = useState<Review[]>(() => {
    const saved = localStorage.getItem('md_reviews');
    return saved ? JSON.parse(saved) : [];
  });

  const [menuItemReviews, setMenuItemReviews] = useState<MenuItemReview[]>(() => {
    const saved = localStorage.getItem('md_menu_item_reviews');
    return saved ? JSON.parse(saved) : [];
  });

  const [savedLocationIds, setSavedLocationIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('md_saved_location_ids');
    return saved ? JSON.parse(saved) : [];
  });

  const [favoriteItemIds, setFavoriteItemIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('md_favorite_item_ids');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeInAppAlert, setActiveInAppAlert] = useState<{ id: string; orderId: string; orderNumber: string; title: string; message: string; timestamp: string } | null>(null);
  const dismissInAppAlert = () => setActiveInAppAlert(null);

  // Sync state with storage
  useEffect(() => {
    localStorage.setItem('md_user', user ? JSON.stringify(user) : '');
    localStorage.setItem('md_cart', cart ? JSON.stringify(cart) : '');
    localStorage.setItem('md_orders', JSON.stringify(orders));
    localStorage.setItem('md_notifications', JSON.stringify(notifications));
    localStorage.setItem('md_escalations', JSON.stringify(escalations));
    localStorage.setItem('md_reviews', JSON.stringify(reviews));
    localStorage.setItem('md_menu_item_reviews', JSON.stringify(menuItemReviews));
    localStorage.setItem('md_saved_location_ids', JSON.stringify(savedLocationIds));
    localStorage.setItem('md_favorite_item_ids', JSON.stringify(favoriteItemIds));
  }, [user, cart, orders, notifications, escalations, reviews, menuItemReviews, savedLocationIds, favoriteItemIds]);

  // Synchronize orders, profile, notifications with backend session
  useEffect(() => {
    if (!isOnline || !user?.id) return;

    const pullServerSync = async () => {
      try {
        const token = user.id;
        const profile = await apiRequest('/me', 'GET', null, token);
        if (profile) {
          setUser(prev => prev ? { ...prev, ...profile } : profile);
        }

        const serverOrders = await apiRequest('/orders', 'GET', null, token);
        if (serverOrders && Array.isArray(serverOrders)) {
          setOrders(prev => mergeServerOrders(prev, serverOrders));
        }

        const serverNotifs = await apiRequest('/notifications', 'GET', null, token);
        if (serverNotifs && Array.isArray(serverNotifs)) {
          setNotifications(serverNotifs);
        }
      } catch (e) {
        console.warn('Silent live-reconciliation pull warning:', e);
      }
    };

    pullServerSync();
  }, [isOnline, user?.id]);

  const toggleSaveLocation = (locationId: string) => {
    triggerVibration(VIBE_PATTERNS.MEDIUM);
    setSavedLocationIds(prev => {
      const isSaved = prev.includes(locationId);
      let next: string[];
      if (isSaved) {
        next = prev.filter(id => id !== locationId);
        addNotification('Location Unpinned 📍', 'The building has been unpinned from your rapid checkout shortcuts.', 'general');
      } else {
        next = [...prev, locationId];
        addNotification('Location Pinned! 📍', 'The building has been pinned for fast checkout shortcuts!', 'general');
      }
      return next;
    });
  };

  const toggleFavoriteItem = (itemId: string) => {
    triggerVibration(VIBE_PATTERNS.MEDIUM);
    setFavoriteItemIds(prev => {
      const isFav = prev.includes(itemId);
      let next: string[];
      if (isFav) {
        next = prev.filter(id => id !== itemId);
        addNotification('Removed from Favorites ❤️', 'The dish was removed from your favorites list.', 'general');
      } else {
        next = [...prev, itemId];
        addNotification('Added to Favorites ❤️', 'The dish was successfully saved to your favorites tab.', 'general');
      }
      return next;
    });
  };

  // Real connectivity tracking via the browser's network status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => {
      setIsOnline(true);
      setLastSyncTime(new Date().toLocaleTimeString());
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Sync Routing
  useEffect(() => {
    const handlePopState = () => {
      setRouter(parseLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (pathPattern: string) => {
    window.location.hash = pathPattern;
    setRouter(parseLocation());
  };

  const goBack = () => {
    window.history.back();
  };

  // Sync date updates
  const setCurrentDateTimeLocation = (date: string, slotId: string, locationId: string) => {
    setCurrentDate(date);
    setCurrentSlotId(slotId);
    setCurrentLocationId(locationId);
    if (cart) {
      setCart({
        ...cart,
        deliveryDate: date,
        deliverySlotId: slotId,
        deliveryLocationId: locationId
      });
    }
  };

  // Catalog Global State
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [locations, setLocations] = useState<PresetLocation[]>([]);
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlot[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // Function to load catalog
  const loadGlobalCatalog = async () => {
    try {
      if (!token) return;
      // Campuses the user actually belongs to (avoids 403 "you do not belong to this campus")
      const [campList, memberships] = await Promise.all([
        apiRequest('/campuses', 'GET', null, token).catch(() => []),
        apiRequest('/me/campuses', 'GET', null, token).catch(() => [])
      ]);
      setCampuses(campList || []);

      const membershipCampusId = Array.isArray(memberships) ? memberships[0]?.campusId : undefined;
      const cId = user?.campusId || membershipCampusId || campList?.[0]?.id;

      if (cId) {

        const [slotsList, locs] = await Promise.all([
          apiRequest(`/campuses/${cId}/delivery-slots`, 'GET', null, token).catch(() => []),
          apiRequest(`/campuses/${cId}/locations`, 'GET', null, token)
        ]);
        const mappedSlots = Array.isArray(slotsList) ? slotsList.map(mapSlot) : [];
        setDeliverySlots(mappedSlots);
        setLocations(Array.isArray(locs) ? locs.map(mapLocation) : []);

        // Replace the legacy non-UUID default slot with a real one
        if (mappedSlots.length) {
          setCurrentSlotId(prev => (mappedSlots.some(s => s.id === prev) ? prev : mappedSlots[0].id));
        }

        const vends = await apiRequest(`/catalog/vendors?campusId=${cId}`, 'GET', null, token);
        const vendorList: Vendor[] = Array.isArray(vends) ? vends.map(mapVendor) : [];
        setVendors(vendorList);

        // Aggregate menus across vendors so cart/checkout pricing + validation resolve
        const menusNested = await Promise.all(
          vendorList.map(v =>
            apiRequest(`/catalog/vendors/${v.id}/menu`, 'GET', null, token).catch(() => [])
          )
        );
        const allItems = menusNested.flat().filter(Boolean).map(mapMenuItem);
        const deduped = Array.from(new Map(allItems.map(it => [it.id, it])).values());
        setMenuItems(deduped);
      }
    } catch (err) {
      console.warn("Failed to load global catalog:", err);
    }
  };

  // Function to load user specific resources (orders, notifications)
  const loadUserResources = async () => {
    if (!token) return;
    try {
      const [remoteOrders, remoteNotifications] = await Promise.all([
        apiRequest('/orders', 'GET'),
        apiRequest('/notifications', 'GET')
      ]);
      if (Array.isArray(remoteOrders)) setOrders(prev => mergeServerOrders(prev, remoteOrders));
      if (remoteNotifications) setNotifications(remoteNotifications);
    } catch (err) {
      console.warn("Failed to load user resources remotely:", err);
    }
  };

  useEffect(() => {
    if (user && token) {
      loadGlobalCatalog();
      loadUserResources();
      
      const interval = setInterval(() => {
        loadUserResources();
      }, 15000); 

      return () => clearInterval(interval);
    }
  }, [user, token]);

  // Auth Functions
  const signIn = async (email: string, password: string) => {
    try {
      const data = await apiRequest('/auth/customer/login', 'POST', { email, password });
      if (data && (data.accessToken || (data.session && data.session.access_token))) {
        const tokenToUse = data.accessToken || data.session.access_token;
        const refreshToUse = data.refreshToken || data.session?.refresh_token;
        if (refreshToUse) localStorage.setItem('md_refresh_token', refreshToUse);
        setToken(tokenToUse);
        setUser(data.user);
        setLastSyncTime(new Date().toLocaleTimeString());
        
        const meProfile = await apiRequest('/me', 'GET', null, tokenToUse).catch(() => data.user);
        if (meProfile) {
          setUser(meProfile);
        }

        // Return to the page the user was on before logging out (if any & safe),
        // otherwise land on home.
        const returnPath = localStorage.getItem(RETURN_PATH_KEY);
        localStorage.removeItem(RETURN_PATH_KEY);
        navigateTo(returnPath && isRestorablePath(returnPath) ? returnPath : '/home');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'Error signing in');
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      // POST /auth/customer/signup
      await apiRequest('/auth/customer/signup', 'POST', { email, password });
      
      // Auto sign in when sign up completes
      await signIn(email, password);
      
      addNotification('Registration Successful 🎉', 'Welcome to Meal Direct! Please complete your delivery profile.', 'general');
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'Error creating account');
    }
  };

  const completeOnboarding = (fullName: string, phone: string, campusId: string, locationId: string) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      fullName,
      phone,
      campusId,
      defaultLocationId: locationId,
      isOnboarded: true
    };
    setUser(updatedUser);
    setCurrentLocationId(locationId);
    navigateTo('/home');

    // POST /v1/me/complete-onboarding to persist campus/location/phone
    apiRequest('/me/complete-onboarding', 'POST', {
      defaultCampusId: campusId,
      defaultLocationId: locationId,
      phoneNumber: phone
    }).then(record => {
      // Merge server record but keep the display name we just set
      if (record) setUser(prev => ({ ...(record as any), fullName: fullName || (record as any).fullName || prev?.fullName }));
    }).catch(console.error);

    // Name is set via PATCH /me (complete-onboarding has no name field)
    if (fullName) {
      apiRequest('/me', 'PATCH', { displayName: fullName }).catch(console.error);
    }

    // Notification
    addNotification(
      'Onboarding Completed 🎓',
      `Welcome onboard${user.fullName ? ', ' + user.fullName.split(' ')[0] : ''}. Your default delivery location has been validated for campus dispatch.`,
      'general'
    );
  };

  const updateProfile = (fullName: string, phone: string, campusId: string, defaultLocationId: string) => {
    if (!user) return;
    const updated = {
      ...user,
      fullName,
      phone,
      campusId,
      defaultLocationId,
      isOnboarded: true
    };
    setUser(updated);
    setCurrentLocationId(defaultLocationId);

    // PATCH /v1/me to persist properties
    apiRequest('/me', 'PATCH', {
      displayName: fullName,
      phoneNumber: phone
    }).then(record => {
      if (record) {
        setUser(record);
      }
    }).catch(console.error);

    // Put default location
    apiRequest('/me/default-location', 'PUT', {
      campusId,
      locationId: defaultLocationId
    }).catch(console.error);

    addNotification('Profile Saved Successfully', 'Your contact phone number and preset dispatch terminal were updated.', 'general');
  };

  const signOut = () => {
    // Remember the current page so re-login returns the user here.
    saveReturnPath();

    if (user?.id) {
    apiRequest('/auth/logout', 'POST').catch(console.error);
    }

    localStorage.removeItem('md_orders');
    localStorage.removeItem('md_cart');
    localStorage.removeItem('md_notifications');
    localStorage.removeItem('md_escalations');
    localStorage.removeItem('md_reviews');
    localStorage.removeItem('md_onboarding_temp');
    localStorage.removeItem('md_user');
    localStorage.removeItem('md_access_token');
    localStorage.removeItem('md_refresh_token');

    setUser(null);
    setToken(null);
    setCart(null);
    setOrders([]);
    setNotifications([]);
    setOnboardingData(null);
    navigateTo('/');
  };

  // Forced logout when token refresh fails (dispatched from apiRequest).
  // Clears local state only — no backend call, to avoid a 401 → logout loop.
  useEffect(() => {
    const onForcedLogout = () => {
      // Remember the current page so re-login returns the user here.
      saveReturnPath();
      localStorage.removeItem('md_user');
      localStorage.removeItem('md_access_token');
      localStorage.removeItem('md_refresh_token');
      setUser(null);
      setToken(null);
      setCart(null);
      setOrders([]);
      setNotifications([]);
      setOnboardingData(null);
      navigateTo('/');
    };
    window.addEventListener('md:logout', onForcedLogout);
    return () => window.removeEventListener('md:logout', onForcedLogout);
  }, []);

  // Cart operations
  const addToCart = (vendorId: string, newItem: CartItem) => {
    triggerVibration(VIBE_PATTERNS.TICK);
    // Validate Single-Vendor cart rule
    if (cart && cart.vendorId !== vendorId) {
      // Prompt modal confirmation is required, but we enforce this check on the menu Page as well
      // For hard reset, override cart:
      setCart({
        vendorId,
        items: [newItem],
        deliverySlotId: currentSlotId,
        deliveryDate: currentDate,
        deliveryLocationId: currentLocationId || user?.defaultLocationId || ''
      });
      return;
    }

    const currentItems = cart ? [...cart.items] : [];
    const existingIndex = currentItems.findIndex(it => it.menuItemId === newItem.menuItemId);

    if (existingIndex >= 0) {
      currentItems[existingIndex].quantity += newItem.quantity;
      // Enforce the 3 spoon restriction
      currentItems[existingIndex].spoonsCount = Math.min(3, newItem.spoonsCount);
    } else {
      currentItems.push({
        ...newItem,
        spoonsCount: Math.min(3, newItem.spoonsCount)
      });
    }

    setCart({
      vendorId,
      items: currentItems,
      deliverySlotId: currentSlotId,
      deliveryDate: currentDate,
      deliveryLocationId: currentLocationId || user?.defaultLocationId || ''
    });

    addNotification(
      'Takeaway Added 🛍️',
      `A custom takeaway package was added to your cart.`,
      'general'
    );
  };

  const updateCartItemQuantity = (menuItemId: string, quantity: number) => {
    if (!cart) return;
    triggerVibration(VIBE_PATTERNS.TICK);
    let currentItems = [...cart.items];
    if (quantity <= 0) {
      currentItems = currentItems.filter(it => it.menuItemId !== menuItemId);
    } else {
      const idx = currentItems.findIndex(it => it.menuItemId === menuItemId);
      if (idx >= 0) {
        currentItems[idx].quantity = quantity;
      }
    }

    if (currentItems.length === 0) {
      setCart(null);
    } else {
      setCart({ ...cart, items: currentItems });
    }
  };

  const updateCartItemSpoons = (menuItemId: string, spoonsCount: number, quantity?: number) => {
    if (!cart) return;
    triggerVibration(VIBE_PATTERNS.TICK);
    const currentItems = [...cart.items];
    const idx = currentItems.findIndex(it => it.menuItemId === menuItemId);
    if (idx >= 0) {
      currentItems[idx].spoonsCount = Math.min(3, Math.max(0, spoonsCount)); // business rule cap of 3
      if (quantity !== undefined) currentItems[idx].quantity = quantity;
      setCart({ ...cart, items: currentItems });
    }
  };

  const removeFromCart = (menuItemId: string) => {
    if (!cart) return;
    triggerVibration(VIBE_PATTERNS.TICK);
    const currentItems = cart.items.filter(it => it.menuItemId !== menuItemId);
    if (currentItems.length === 0) {
      setCart(null);
    } else {
      setCart({ ...cart, items: currentItems });
    }
  };

  const clearCart = () => {
    triggerVibration(VIBE_PATTERNS.TICK);
    setCart(null);
  };

  const setCartDateTimeLocation = (date: string, slotId: string, locationId: string) => {
    if (!cart) return;
    setCart({
      ...cart,
      deliveryDate: date,
      deliverySlotId: slotId,
      deliveryLocationId: locationId
    });
  };

  const getCartQuote = (): OrderQuote => {
    if (!cart) {
      return { subtotalKobo: 0, deliveryFeeKobo: 15000, totalKobo: 15000, itemCount: 0, spoonCount: 0, isValid: false, errors: ['Cart is empty'] };
    }

    let subtotalKobo = 0;
    let spoonCount = 0;
    let itemCount = 0;
    const errors: string[] = [];

    cart.items.forEach(cItem => {
      const dbItem = menuItems.find(it => it.id === cItem.menuItemId);
      if (dbItem) {
        subtotalKobo += dbItem.priceKobo * cItem.quantity;
        spoonCount += cItem.spoonsCount;
        itemCount += cItem.quantity;
        if (cItem.spoonsCount > 3) {
          errors.push(`Takeaway item '${dbItem.name}' exceeds the maximum allowed 3 spoons limit.`);
        }
      } else {
        errors.push(`Item code '${cItem.menuItemId}' could not be validated.`);
      }
    });

    const deliveryFeeKobo = 15000; // Flat ₦150
    const totalKobo = subtotalKobo + deliveryFeeKobo;

    return {
      subtotalKobo,
      deliveryFeeKobo,
      totalKobo,
      spoonCount,
      itemCount,
      isValid: errors.length === 0,
      errors
    };
  };

  // Shared payload builder for quote + order create (single source of truth).
  // Backend uses strict whitelist validation: only menuItemId/quantity per item,
  // a real slot UUID, and no specialInstructions/spoonsCount. Keep this minimal.
  const buildOrderPayload = (_specialInstructions?: string, promotionCode?: string) => {
    if (!cart || !user) throw new Error('Cannot build order: cart or user missing.');

    // Resolve a valid delivery-slot UUID (the legacy default "slot_12" is not a UUID)
    const requestedSlot = cart.deliverySlotId || currentSlotId;
    const slotId = deliverySlots.some(s => s.id === requestedSlot)
      ? requestedSlot
      : (deliverySlots[0]?.id || requestedSlot);

    const payload: any = {
      campusId: user.campusId || campuses[0]?.id || '',
      vendorId: cart.vendorId,
      serviceDate: cart.deliveryDate || currentDate,
      deliverySlotId: slotId,
      locationId: cart.deliveryLocationId || user.defaultLocationId || '',
      items: cart.items.map(it => ({
        menuItemId: it.menuItemId,
        quantity: it.quantity
      }))
    };
    if (promotionCode) payload.promotionCode = promotionCode.trim();
    return payload;
  };

  // Authoritative server-side quote (does NOT mutate cart/orders).
  // Pass a promotionCode so the backend applies + returns discountKobo.
  const fetchOrderQuote = async (promotionCode?: string): Promise<ServerQuote | null> => {
    if (!cart || !user) return null;
    try {
      const q = await apiRequest('/orders/quote', 'POST', buildOrderPayload(undefined, promotionCode));
      return q as ServerQuote;
    } catch (e) {
      console.warn('Server quote unavailable, using local estimate:', e);
      return null;
    }
  };

  // Instant promo-code feedback. Authoritative discount is applied via the quote/order
  // (which carries promotionCode); this is a UX preview only and is non-fatal on error.
  const validatePromo = async (
    code: string
  ): Promise<{ valid: boolean; discountKobo: number; message?: string }> => {
    if (!cart || !user) return { valid: false, discountKobo: 0, message: 'Add items to your cart first.' };
    try {
      const res = await apiRequest('/promotions/validate', 'POST', {
        code: code.trim(),
        campusId: user.campusId || campuses[0]?.id || '',
        vendorId: cart.vendorId,
        foodSubtotalKobo: getCartQuote().subtotalKobo
      });
      const discountKobo = res?.discountKobo ?? res?.amountKobo ?? res?.discount ?? 0;
      const valid = res?.valid !== false; // treat presence/no-error as valid
      return { valid, discountKobo, message: res?.message };
    } catch (e: any) {
      return { valid: false, discountKobo: 0, message: e?.message || 'Invalid or expired promo code.' };
    }
  };

  // Orders Actions
  const createOrder = async (specialInstructions?: string, promotionCode?: string): Promise<Order> => {
    if (!cart || !user) throw new Error('Cannot create order: Pre-requisites not met.');

    const newOrder = await apiRequest('/orders', 'POST', buildOrderPayload(specialInstructions, promotionCode), null, {
      'Idempotency-Key': newIdempotencyKey()
    });

    const normalized = normalizeOrder(newOrder);
    setOrders(prev => [normalized, ...prev]);
    setCart(null); // Clear active cart on check out
    triggerVibration(VIBE_PATTERNS.MEDIUM);
    return normalized;
  };

  // Initialize Paystack. Returns the hosted authorization URL to redirect to.
  // Does NOT mark the order paid — payment truth comes from the backend webhook,
  // surfaced via fetchPaymentStatus / refreshOrder after the user returns.
  const payOrder = async (orderId: string): Promise<string> => {
    triggerVibration(VIBE_PATTERNS.SUCCESS);

    const initRes = await apiRequest(`/orders/${orderId}/payments/paystack/initialize`, 'POST', null, null, {
      'Idempotency-Key': newIdempotencyKey()
    });
    const url = initRes?.authorizationUrl || initRes?.authorization_url;
    if (!url) {
      throw new Error('Payment gateway did not return an authorization URL.');
    }

    // Record the payment reference only (still PENDING_PAYMENT until confirmed)
    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, paymentReference: initRes.reference } : o))
    );

    return url;
  };

  // Re-fetch a single order from the backend and merge into local state
  const refreshOrder = async (orderId: string): Promise<Order | null> => {
    try {
      const s = await apiRequest(`/orders/${orderId}`, 'GET');
      if (!s) return null;
      let updated: Order | null = null;
      setOrders(prev => {
        const existing = prev.find(o => o.id === orderId);
        const norm = normalizeOrder(s, existing);
        updated = norm;
        return prev.some(o => o.id === orderId)
          ? prev.map(o => (o.id === orderId ? norm : o))
          : [norm, ...prev];
      });
      return updated;
    } catch (e) {
      console.warn('refreshOrder failed:', e);
      return null;
    }
  };

  // Poll-friendly payment status check against the authoritative backend
  const fetchPaymentStatus = async (
    orderId: string
  ): Promise<{ orderStatus: OrderStatus; paid: boolean; terminalFail: boolean } | null> => {
    try {
      const data = await apiRequest(`/orders/${orderId}/payment-status`, 'GET');
      if (!data) return null;
      const orderStatus = normalizeStatus(data.orderStatus);
      const payStatus = (data.payment?.status || '').toLowerCase();
      const paid =
        (orderStatus !== 'PENDING_PAYMENT' && orderStatus !== 'CANCELLED' && orderStatus !== 'EXPIRED') ||
        payStatus === 'success' ||
        payStatus === 'successful' ||
        !!data.payment?.paidAt;
      const terminalFail = orderStatus === 'CANCELLED' || orderStatus === 'EXPIRED' || payStatus === 'failed';
      return { orderStatus, paid, terminalFail };
    } catch (e) {
      console.warn('fetchPaymentStatus failed:', e);
      return null;
    }
  };

  const confirmDelivery = (orderId: string) => {
    triggerVibration(VIBE_PATTERNS.SUCCESS);
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          const timestamp = new Date().toISOString();
          return {
            ...o,
            status: 'CONFIRMED',
            statusHistory: [
              ...o.statusHistory,
              {
                status: 'CONFIRMED',
                timestamp,
                title: 'Order Confirmed by Customer 👍',
                description: 'You indicated successful checkout delivery. Thank you for dining with Meal Direct!'
              }
            ]
          };
        }
        return o;
      })
    );

    apiRequest(`/orders/${orderId}/confirm-delivery`, 'POST')
      .then(() => refreshOrder(orderId))
      .catch(console.error);

    addNotification(
      'Order Confirmed 👍',
      'You have confirmed clean delivery. Write a vendor review to share feedback!',
      'order_status',
      orderId
    );
  };

  const cancelOrder = (orderId: string) => {
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          const timestamp = new Date().toISOString();
          return {
            ...o,
            status: 'CANCELLED',
            statusHistory: [
              ...o.statusHistory,
              {
                status: 'CANCELLED',
                timestamp,
                title: 'Order Cancelled',
                description: 'Your order has been cancelled.'
              }
            ]
          };
        }
        return o;
      })
    );

    addNotification('Order Cancelled 🚫', 'The order has been marked as cancelled.', 'order_status', orderId);
  };

  const reorderOrder = (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const newItems: CartItem[] = targetOrder.items.map(it => ({
      menuItemId: it.menuItemId,
      quantity: it.quantity,
      spoonsCount: it.spoonsCount
    }));

    setCart({
      vendorId: targetOrder.vendorId,
      items: newItems,
      deliverySlotId: currentSlotId,
      deliveryDate: currentDate,
      deliveryLocationId: currentLocationId || user?.defaultLocationId || ''
    });

    addNotification(
      'Order Reordered 🛍️',
      `Items from order ${targetOrder.orderNumber} have been placed in your cart.`,
      'general'
    );

    navigateTo('/cart');
  };

  // Pull the latest authoritative status from the backend.
  // (Replaces the former client-side status simulator — status now advances
  //  server-side via vendor/rider/admin actions and Paystack webhooks.)
  const progressOrderStatus = (orderId: string) => {
    refreshOrder(orderId);
  };

  // Escalation actions
  const createEscalation = (
    orderId: string,
    category: Escalation['category'],
    description: string
  ) => {
    const escId = 'esc_' + Math.floor(Math.random() * 1000000);
    const newEsc: Escalation = {
      id: escId,
      orderId,
      category,
      description,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    setEscalations(prev => [newEsc, ...prev]);

    // Update order status indicator
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          const timestamp = new Date().toISOString();
          return {
            ...o,
            status: 'ESCALATED',
            hasEscalation: true,
            statusHistory: [
              ...o.statusHistory,
              {
                status: 'ESCALATED',
                timestamp,
                title: 'Case Escalated to Helpdesk ⚠️',
                description: `Customer submitted investigation query regarding: ${category.replace(/_/g, ' ')}. Description: ${description}`
              }
            ]
          };
        }
        return o;
      })
    );

    // REST call to create escalation on backend, then reconcile order state
    apiRequest(`/orders/${orderId}/escalations`, 'POST', {
      category,
      description
    })
      .then(() => refreshOrder(orderId))
      .catch(console.error);

    addNotification(
      'Issue Reported ⚠️',
      'The support ticket has been logged with the helpdesk. We will investigate and respond shortly.',
      'support_update',
      orderId
    );
  };

  // Review actions
  const createReview = (orderId: string, rating: number, comment: string) => {
    const newRev: Review = {
      orderId,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };
    setReviews(prev => [newRev, ...prev]);

    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          return { ...o, hasReview: true };
        }
        return o;
      })
    );

    // REST call to submit review
    apiRequest(`/orders/${orderId}/review`, 'POST', {
      vendorRating: rating,
      comment
    }).catch(console.error);

    addNotification('Review Logged ⭐', 'Thank you for grading the meal! Your feedback shapes launch vendor scorecards.', 'general', orderId);
  };

  const createMenuItemReview = (menuItemId: string, rating: number, comment: string, userName?: string) => {
    const newRev: MenuItemReview = {
      id: 'mr_' + Date.now(),
      menuItemId,
      rating,
      comment,
      userName: userName || user?.fullName || 'Anonymous Student',
      createdAt: new Date().toISOString()
    };
    setMenuItemReviews(prev => [newRev, ...prev]);
    addNotification('Meal Feedback Logged ⭐', 'Thank you for sharing your feedback on this single meal helper item!', 'general');
  };

  // Register this browser for web push (POST /v1/me/device-tokens).
  // Requires a VAPID public key (VITE_VAPID_PUBLIC_KEY) + a service worker.
  // Non-fatal: returns false if unsupported/denied/unconfigured — polling stays the fallback.
  const registerDeviceToken = async (): Promise<boolean> => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return false;
      }
      const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
      if (!vapid) {
        console.warn('VITE_VAPID_PUBLIC_KEY not set — web push disabled, using polling.');
        return false;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid)
      });

      await apiRequest('/me/device-tokens', 'POST', {
        token: JSON.stringify(sub),
        platform: 'web'
      });
      addNotification('Notifications Enabled 🔔', 'You will now get push alerts for order updates.', 'general');
      return true;
    } catch (e) {
      console.warn('Device token registration failed:', e);
      return false;
    }
  };

  // Notification actions
  const addNotification = (title: string, message: string, type: AppNotification['type'], orderId?: string) => {
    const noti: AppNotification = {
      id: 'noti_' + Date.now() + Math.floor(Math.random() * 100),
      title,
      message,
      createdAt: new Date().toISOString(),
      read: false,
      type,
      orderId
    };
    setNotifications(prev => [noti, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    // REST call to read single notification
    apiRequest(`/notifications/${id}/read`, 'POST').catch(console.error);
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    // REST call to read all notifications
    apiRequest('/notifications/read-all', 'POST').catch(console.error);
  };

  // Toggle offline connection simulation
  const setOnlineStatus = (status: boolean) => {
    setIsOnline(status);
    setLastSyncTime(new Date().toLocaleTimeString());
    if (status) {
      addNotification('Connection Re-established 🤝', 'Application synchronized back with live Venite dispatch catalog.', 'general');
    } else {
      addNotification('Offline Mode Triggered 🔌', 'Operating in cached safe mode. Financial transactions and order submission are disabled.', 'general');
    }
  };

  return (
    <MealDirectContext.Provider
      value={{
        user,
        onboardingData,
        signIn,
        signUp,
        completeOnboarding,
        updateProfile,
        signOut,

        campuses,
        locations,
        deliverySlots,
        vendors,
        menuItems,

        router,
        navigateTo,
        goBack,

        cart,
        addToCart,
        updateCartItemQuantity,
        updateCartItemSpoons,
        removeFromCart,
        clearCart,
        setCartDateTimeLocation,
        getCartQuote,
        fetchOrderQuote,
        validatePromo,

        orders,
        createOrder,
        registerDeviceToken,
        payOrder,
        refreshOrder,
        fetchPaymentStatus,
        confirmDelivery,
        progressOrderStatus,
        cancelOrder,
        reorderOrder,

        escalations,
        createEscalation,

        reviews,
        createReview,
        menuItemReviews,
        createMenuItemReview,

        notifications,
        markNotificationRead,
        markAllNotificationsRead,

        isOnline,
        setOnlineStatus,
        lastSyncTime,

        currentDate,
        currentSlotId,
        currentLocationId,
        setCurrentDateTimeLocation,

        activeInAppAlert,
        dismissInAppAlert,

        savedLocationIds,
        toggleSaveLocation,

        favoriteItemIds,
        toggleFavoriteItem
      }}
    >
      {children}
    </MealDirectContext.Provider>
  );
};

export const useMealDirect = () => {
  const context = useContext(MealDirectContext);
  if (!context) throw new Error('useMealDirect must be used within a MealDirectProvider');
  return context;
};
