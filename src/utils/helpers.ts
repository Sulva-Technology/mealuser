import type { Order, MenuItem, OrderStatus } from '../types';

export interface WeeklySpend {
  weekLabel: string;
  spendAmount: number; // naira
  mostOrderedCategory: string;
  healthyIndex: number; // 0-100 derived rating
  tip: string;
}

// Orders that never represent money actually spent by the customer.
const NON_SPEND_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'PENDING_PAYMENT',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED'
]);

const HEALTHY_HINTS = ['salad', 'grain', 'wrap', 'veg', 'fruit', 'smoothie', 'soup', 'bowl', 'protein', 'fish', 'poultry', 'chicken', 'plantain'];
const INDULGENT_HINTS = ['fried', 'swallow', 'pastry', 'soda', 'burger', 'pizza', 'chips', 'cake', 'ice cream', 'shawarma', 'pie'];

// Monday-anchored start-of-week timestamp (local time) for an ISO date string.
function startOfWeek(dateStr: string): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return NaN;
  const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day, 0, 0, 0, 0);
  return monday.getTime();
}

// ISO week number, for a compact "Wk NN" label.
function isoWeekNumber(ts: number): number {
  const d = new Date(ts);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

function scoreHealth(label: string): number {
  const l = label.toLowerCase();
  if (HEALTHY_HINTS.some((h) => l.includes(h))) return 1;
  if (INDULGENT_HINTS.some((h) => l.includes(h))) return -1;
  return 0;
}

function buildTip(index: number, category: string): string {
  if (index >= 85) return `Excellent balance. ${category} led your week and aligns well with clean-fuel targets — keep it up.`;
  if (index >= 65) return `Solid choices. ${category} topped your orders; add a fresh side to push your balance higher.`;
  if (index >= 45) return `Decent week. ${category} dominated — alternate with lighter, vegetable-forward picks for better balance.`;
  return `${category} drove most of your spend. Mix in salads, grains, or protein bowls to lift your dietary balance.`;
}

// Derive the weekly spending/nutrition tracker from the customer's real orders.
// Returns up to `maxWeeks` most recent weeks (oldest -> newest) that contain spend.
// No data -> empty array (caller renders an empty state).
export function computeSpendHistory(
  orders: Order[],
  menuItems: MenuItem[],
  maxWeeks = 6
): WeeklySpend[] {
  const categoryById = new Map(menuItems.map((m) => [m.id, m.category]));

  interface Bucket {
    weekStart: number;
    totalKobo: number;
    categoryQty: Map<string, number>;
    healthySum: number;
    healthyTotal: number;
  }
  const buckets = new Map<number, Bucket>();

  for (const order of orders) {
    if (NON_SPEND_STATUSES.has(order.status)) continue;
    const weekStart = startOfWeek(order.createdAt);
    if (Number.isNaN(weekStart)) continue;

    let bucket = buckets.get(weekStart);
    if (!bucket) {
      bucket = { weekStart, totalKobo: 0, categoryQty: new Map(), healthySum: 0, healthyTotal: 0 };
      buckets.set(weekStart, bucket);
    }
    bucket.totalKobo += order.totalKobo;

    for (const item of order.items) {
      const category = categoryById.get(item.menuItemId) || item.name;
      bucket.categoryQty.set(category, (bucket.categoryQty.get(category) || 0) + item.quantity);
      bucket.healthySum += scoreHealth(category) * item.quantity;
      bucket.healthyTotal += item.quantity;
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.weekStart - b.weekStart)
    .slice(-maxWeeks)
    .map((b) => {
      let topCategory = '—';
      let topQty = -1;
      for (const [cat, qty] of b.categoryQty) {
        if (qty > topQty) {
          topQty = qty;
          topCategory = cat;
        }
      }
      const ratio = b.healthyTotal > 0 ? b.healthySum / b.healthyTotal : 0;
      const healthyIndex = Math.max(0, Math.min(100, Math.round(50 + ratio * 50)));
      return {
        weekLabel: `Wk ${isoWeekNumber(b.weekStart)}`,
        spendAmount: Math.round(b.totalKobo / 100),
        mostOrderedCategory: topCategory,
        healthyIndex,
        tip: buildTip(healthyIndex, topCategory)
      };
    });
}

export const formatNGN = (kobo: number): string => {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(naira);
};

export const isSlotAvailable = (slotTime: string, targetDateStr: string, mockCurrentTimeInMins?: number): boolean => {
  const dateSplit = targetDateStr.split('-');
  const year = parseInt(dateSplit[0]);
  const month = parseInt(dateSplit[1]) - 1;
  const day = parseInt(dateSplit[2]);

  const targetDate = new Date(year, month, day);
  const now = new Date();
  
  const targetMidnight = new Date(year, month, day, 0, 0, 0, 0).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();

  if (targetMidnight > todayMidnight) {
    return true; 
  }
  if (targetMidnight < todayMidnight) {
    return false; 
  }

  const slotSplit = slotTime.split(':');
  const slotHour = parseInt(slotSplit[0]);
  const slotMin = parseInt(slotSplit[1]);

  let currentHour = now.getHours();
  let currentMin = now.getMinutes();

  if (mockCurrentTimeInMins !== undefined) {
    currentHour = Math.floor(mockCurrentTimeInMins / 60);
    currentMin = mockCurrentTimeInMins % 60;
  }

  const slotMinutes = slotHour * 60 + slotMin;
  const currentMinutes = currentHour * 60 + currentMin;

  return (slotMinutes - currentMinutes) >= 60;
};
