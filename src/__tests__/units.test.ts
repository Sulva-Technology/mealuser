import { describe, it, expect } from 'vitest';
import { formatNGN, isSlotAvailable, computeSpendHistory, MAX_ORDER_TOTAL_KOBO } from '../utils/helpers';
import {
  normalizeStatus,
  mapMenuItem,
  mapLocation,
  mapSlot,
  mapVendor,
  mergeServerOrders
} from '../store';
import type { Order, MenuItem } from '../types';

describe('formatNGN', () => {
  it('formats kobo into naira currency', () => {
    expect(formatNGN(150000)).toContain('1,500.00');
    expect(formatNGN(0)).toContain('0.00');
  });
});

describe('order cap (MAX_ORDER_TOTAL_KOBO)', () => {
  const exceedsCap = (totalKobo: number) => totalKobo > MAX_ORDER_TOTAL_KOBO;

  it('is ₦2490', () => {
    expect(MAX_ORDER_TOTAL_KOBO).toBe(249000);
  });

  it('allows totals at or below the cap', () => {
    expect(exceedsCap(249000)).toBe(false);
    expect(exceedsCap(100000)).toBe(false);
  });

  it('blocks totals above the cap', () => {
    expect(exceedsCap(249001)).toBe(true);
    expect(exceedsCap(500000)).toBe(true);
  });
});

describe('isSlotAvailable', () => {
  it('allows future-dated slots', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    expect(isSlotAvailable('08:00', tomorrow)).toBe(true);
  });

  it('rejects past-dated slots', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    expect(isSlotAvailable('20:00', yesterday)).toBe(false);
  });

  it('requires at least 60 minutes lead time today', () => {
    const today = new Date().toISOString().split('T')[0];
    // Slot 10:00 with mocked current time 09:30 -> 30 min lead -> unavailable
    expect(isSlotAvailable('10:00', today, 9 * 60 + 30)).toBe(false);
    // Slot 10:00 with mocked current time 08:30 -> 90 min lead -> available
    expect(isSlotAvailable('10:00', today, 8 * 60 + 30)).toBe(true);
  });
});

describe('normalizeStatus', () => {
  it('uppercases backend lowercase status', () => {
    expect(normalizeStatus('pending_payment')).toBe('PENDING_PAYMENT');
    expect(normalizeStatus('out_for_delivery')).toBe('OUT_FOR_DELIVERY');
    expect(normalizeStatus('paid')).toBe('PAID');
  });

  it('defaults to PENDING_PAYMENT for empty input', () => {
    expect(normalizeStatus(undefined)).toBe('PENDING_PAYMENT');
    expect(normalizeStatus(null)).toBe('PENDING_PAYMENT');
  });
});

describe('mapMenuItem', () => {
  it('maps backend MenuItemDto fields to client shape', () => {
    const mapped = mapMenuItem({
      id: 'item_1',
      name: 'Jollof Rice',
      priceKobo: 40000,
      categoryName: 'Rice',
      remainingQuantity: 12,
      imageUrl: 'http://x/y.jpg'
    });
    expect(mapped).toMatchObject({
      id: 'item_1',
      name: 'Jollof Rice',
      priceKobo: 40000,
      category: 'Rice',
      availableQuantity: 12
    });
  });

  it('falls back gracefully on missing optional fields', () => {
    const mapped = mapMenuItem({ id: 'x', name: 'Plain', priceKobo: 1000 });
    expect(mapped.category).toBe('General');
    expect(mapped.availableQuantity).toBe(0);
    expect(mapped.description).toBe('');
  });
});

describe('mapLocation', () => {
  it('maps backend zone/type fields to client shape', () => {
    const loc = mapLocation({
      id: 'loc_1',
      campusId: 'camp_1',
      name: 'Daniel Hall',
      zoneName: 'Zone A',
      zoneCode: 'A',
      type: 'hostel'
    });
    expect(loc).toEqual({
      id: 'loc_1',
      campusId: 'camp_1',
      name: 'Daniel Hall',
      zone: 'Zone A',
      type: 'Hostel'
    });
  });

  it('maps department type and falls back to zoneCode', () => {
    const loc = mapLocation({ id: 'l', campusId: 'c', name: 'CS Dept', zoneCode: 'B', type: 'department' });
    expect(loc.zone).toBe('B');
    expect(loc.type).toBe('Department');
  });
});

describe('mapVendor', () => {
  it('maps CatalogVendorDto with safe numeric defaults', () => {
    const v = mapVendor({
      id: 'ven_1',
      displayName: 'Matade Kitchen',
      logoUrl: 'http://x/logo.png',
      kitchenLocation: 'Block C'
    });
    expect(v.name).toBe('Matade Kitchen');
    expect(v.imageUrl).toBe('http://x/logo.png');
    expect(v.rating).toBe(0); // never undefined -> .toFixed() is safe
    expect(v.reviewCount).toBe(0);
    expect(v.featuredTags).toContain('Block C');
    expect(() => v.rating.toFixed(1)).not.toThrow();
  });
});

describe('mapSlot', () => {
  it('maps deliveryTime + name to client slot', () => {
    const slot = mapSlot({ id: 's1', name: 'Lunch', deliveryTime: '12:00:00' });
    expect(slot.id).toBe('s1');
    expect(slot.time).toBe('12:00');
    expect(slot.label).toBe('Lunch (12:00)');
  });
});

describe('computeSpendHistory', () => {
  const menuItems = [
    { id: 'm1', name: 'Garden Salad', category: 'Salad Bowls' },
    { id: 'm2', name: 'Eba', category: 'Fried Swallow' }
  ] as unknown as MenuItem[];

  const order = (over: Partial<Order>): Order =>
    ({
      status: 'DELIVERED',
      createdAt: '2026-06-22',
      totalKobo: 0,
      items: [],
      ...over
    } as unknown as Order);

  it('returns empty for no orders', () => {
    expect(computeSpendHistory([], menuItems)).toEqual([]);
  });

  it('sums real spend, picks top category, bounds the health index', () => {
    const orders: Order[] = [
      order({
        createdAt: '2026-06-22',
        totalKobo: 80000,
        items: [{ menuItemId: 'm1', name: 'Garden Salad', priceKobo: 40000, quantity: 2, spoonsCount: 0 }]
      }),
      order({
        status: 'CONFIRMED',
        createdAt: '2026-06-23',
        totalKobo: 20000,
        items: [{ menuItemId: 'm2', name: 'Eba', priceKobo: 20000, quantity: 1, spoonsCount: 0 }]
      })
    ];
    const result = computeSpendHistory(orders, menuItems);
    expect(result).toHaveLength(1);
    expect(result[0].spendAmount).toBe(1000); // (80000 + 20000) kobo -> naira
    expect(result[0].mostOrderedCategory).toBe('Salad Bowls'); // qty 2 > qty 1
    expect(result[0].healthyIndex).toBeGreaterThanOrEqual(0);
    expect(result[0].healthyIndex).toBeLessThanOrEqual(100);
  });

  it('excludes non-spend statuses (pending/cancelled/refunded/expired)', () => {
    const orders: Order[] = [
      order({ status: 'PENDING_PAYMENT', totalKobo: 99900 }),
      order({ status: 'CANCELLED', totalKobo: 99900 }),
      order({ status: 'REFUNDED', totalKobo: 99900 }),
      order({ status: 'EXPIRED', totalKobo: 99900 })
    ];
    expect(computeSpendHistory(orders, menuItems)).toEqual([]);
  });
});

describe('mergeServerOrders', () => {
  it('normalizes server orders and preserves local-only ones', () => {
    const local: Order[] = [
      { id: 'local_1', orderNumber: 'L1', status: 'PENDING_PAYMENT', statusHistory: [] } as unknown as Order
    ];
    const server = [{ id: 'srv_1', orderNumber: 'S1', orderStatus: 'paid' }];
    const merged = mergeServerOrders(local, server);
    expect(merged).toHaveLength(2);
    const srv = merged.find(o => o.id === 'srv_1');
    expect(srv?.status).toBe('PAID');
    expect(merged.some(o => o.id === 'local_1')).toBe(true);
  });
});
