export interface Campus {
  id: string;
  name: string;
  code: string;
}

export interface PresetLocation {
  id: string;
  campusId: string;
  name: string;
  zone: string; // backend zoneName, e.g. "Zone A"
  type: 'Hostel' | 'Department';
}

export interface DeliverySlot {
  id: string;
  time: string; // e.g. "08:00", "10:00", "12:00", "14:00", "17:00", "19:00"
  label: string; // e.g. "Breakfast (8:00 AM)", "Late Breakfast (10:00 AM)", "Lunch (12:00 PM)", etc.
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  priceKobo: number; // in integer kobo as requested
  imageUrl: string;
  category: string;
  availableQuantity: number;
  vendorId: string;
}

export interface Vendor {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  featuredTags: string[];
  preparationTimeMins: number;
}

export interface CartItem {
  menuItemId: string;
  quantity: number;
  spoonsCount: number; // up to 3 units as per business rules (plastic spoons)
}

export interface Cart {
  vendorId: string;
  items: CartItem[];
  deliverySlotId: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryLocationId: string;
}

export interface OrderQuote {
  subtotalKobo: number;
  deliveryFeeKobo: number; // Flat ₦150 (15000 kobo)
  totalKobo: number;
  itemCount: number;
  spoonCount: number;
  isValid: boolean;
  errors: string[];
}

// Authoritative server-computed quote (POST /v1/orders/quote)
export interface ServerQuoteItem {
  menuItemId: string;
  name: string;
  quantity: number;
  remainingQuantity: number;
  unitPriceKobo: number;
  lineTotalKobo: number;
}

export interface ServerQuote {
  currency: string;
  foodSubtotalKobo: number;
  deliveryFeeKobo: number;
  serviceFeeKobo: number;
  discountKobo: number;
  totalKobo: number;
  items: ServerQuoteItem[];
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CONFIRMED'
  | 'ESCALATED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'EXPIRED'
  | 'ADMINISTRATIVELY_COMPLETED';

export interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: string;
  title: string;
  description: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  vendorId: string;
  campusId: string;
  locationId: string;
  slotId: string;
  deliveryDate: string;
  items: {
    menuItemId: string;
    name: string;
    priceKobo: number;
    quantity: number;
    spoonsCount: number;
  }[];
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  status: OrderStatus;
  statusHistory: OrderStatusHistory[];
  paymentReference?: string;
  requestId: string;
  createdAt: string;
  hasEscalation: boolean;
  hasReview: boolean;
  specialInstructions?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: 'order_status' | 'general' | 'support_update';
  orderId?: string;
}

export interface Escalation {
  id: string;
  orderId: string;
  category: 'NON_DELIVERY' | 'INCOMPLETE_OR_WRONG_FOOD' | 'QUALITY' | 'PACKAGING' | 'DELAY' | 'OTHER';
  description: string;
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
  replyMessage?: string;
}

export interface Review {
  orderId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  campusId?: string;
  defaultLocationId?: string;
  isOnboarded: boolean;
}

export type RoutePath =
  | '/'
  | '/auth/sign-in'
  | '/auth/callback'
  | '/onboarding'
  | '/home'
  | '/vendors'
  | '/cart'
  | '/checkout'
  | '/orders'
  | '/notifications'
  | '/profile'
  | '/offline'; // We use simple state-routing which handles dynamic IDs easily in active props.

export interface MenuItemReview {
  id: string;
  menuItemId: string;
  rating: number;
  comment: string;
  userName: string;
  createdAt: string;
}
