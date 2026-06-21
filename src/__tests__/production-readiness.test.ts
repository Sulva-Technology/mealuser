import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../server';
import {
  derivePaymentPollingState,
  mapMeSession,
  mapNotification,
  mapPaymentStatus
} from '../store';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function setCookieHeader(res: request.Response) {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw.join('\n') : String(raw || '');
}

describe('backend contract mappers', () => {
  it('maps the /me session envelope into the client user profile shape', () => {
    const user = mapMeSession({
      actor: { id: 'actor-1', email: 'student@example.com' },
      profile: {
        id: 'profile-1',
        email: null,
        displayName: 'Ada Student',
        phoneNumber: '+2348012345678',
        defaultCampusId: 'campus-1',
        defaultLocationId: 'location-1',
        onboardingCompleted: true
      },
      roles: ['customer'],
      campuses: [{ campusId: 'campus-2', active: true }]
    });

    expect(user).toEqual({
      id: 'profile-1',
      email: 'student@example.com',
      fullName: 'Ada Student',
      phone: '+2348012345678',
      campusId: 'campus-1',
      defaultLocationId: 'location-1',
      isOnboarded: true
    });
  });

  it('maps backend notifications into the local notification model', () => {
    expect(
      mapNotification({
        id: 'notif-1',
        title: 'Order ready',
        body: 'Pick it up soon',
        aggregateType: 'order',
        aggregateId: 'order-1',
        readAt: '2026-06-21T10:00:00.000Z',
        createdAt: '2026-06-21T09:00:00.000Z'
      })
    ).toEqual({
      id: 'notif-1',
      title: 'Order ready',
      message: 'Pick it up soon',
      createdAt: '2026-06-21T09:00:00.000Z',
      read: true,
      type: 'order_status',
      orderId: 'order-1'
    });
  });

  it('classifies payment status without treating pending webhook delay as failure', () => {
    expect(mapPaymentStatus({ orderStatus: 'pending_payment', payment: null })).toEqual({
      orderStatus: 'PENDING_PAYMENT',
      paid: false,
      terminalFail: false
    });

    expect(
      derivePaymentPollingState({
        paymentStatus: null,
        hasKnownOrder: true,
        attemptsExhausted: true,
        explicitCancel: false
      })
    ).toBe('pending_verification');
  });
});

describe('BFF auth and CSRF behavior', () => {
  it('sets HttpOnly auth cookies and a readable CSRF cookie on customer login', async () => {
    const app = createApp({
      backendUrl: 'https://backend.test',
      isProd: true,
      fetchImpl: async () =>
        jsonResponse({
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          user: { id: 'user-1', email: 'student@example.com', role: 'customer' }
        })
    });

    const res = await request(app)
      .post('/api/auth/customer/login')
      .send({ email: 'student@example.com', password: 'Password123!' })
      .expect(200);

    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    const cookies = setCookieHeader(res);
    expect(cookies).toContain('md_access_token=access-1;');
    expect(cookies).toContain('md_refresh_token=refresh-1;');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('md_csrf=');
  });

  it('forwards session cookies as bearer auth and requires CSRF for mutating requests', async () => {
    const seen: Array<{ url: string; auth?: string; csrf?: string }> = [];
    const app = createApp({
      backendUrl: 'https://backend.test',
      isProd: false,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        seen.push({
          url: String(input),
          auth: headers.get('authorization') || undefined,
          csrf: headers.get('x-mealdirect-csrf') || undefined
        });
        return jsonResponse({ data: [] });
      }
    });

    await request(app)
      .get('/api/v1/orders')
      .set('Cookie', ['md_access_token=access-1'])
      .expect(200);

    await request(app)
      .post('/api/v1/orders')
      .set('Cookie', ['md_access_token=access-1', 'md_csrf=csrf-1'])
      .send({})
      .expect(403);

    await request(app)
      .post('/api/v1/orders')
      .set('Cookie', ['md_access_token=access-1', 'md_csrf=csrf-1'])
      .set('X-MealDirect-CSRF', 'csrf-1')
      .send({})
      .expect(200);

    expect(seen[0]).toMatchObject({
      url: 'https://backend.test/v1/orders',
      auth: 'Bearer access-1'
    });
    expect(seen[1]).toMatchObject({
      url: 'https://backend.test/v1/orders',
      auth: 'Bearer access-1',
      csrf: 'csrf-1'
    });
  });

  it('refreshes an expired access cookie once and retries the proxied request', async () => {
    let meAttempts = 0;
    const app = createApp({
      backendUrl: 'https://backend.test',
      isProd: true,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith('/v1/auth/refresh')) {
          return jsonResponse({ accessToken: 'access-2', refreshToken: 'refresh-2' });
        }
        if (url.endsWith('/v1/me')) {
          meAttempts += 1;
          if (meAttempts === 1) return jsonResponse({ error: { message: 'expired' } }, 401);
          return jsonResponse({ data: { ok: true } });
        }
        return jsonResponse({ data: null }, 404);
      }
    });

    const res = await request(app)
      .get('/api/v1/me')
      .set('Cookie', ['md_access_token=expired', 'md_refresh_token=refresh-1'])
      .expect(200);

    expect(res.body).toEqual({ data: { ok: true } });
    expect(meAttempts).toBe(2);
    const cookies = setCookieHeader(res);
    expect(cookies).toContain('md_access_token=access-2;');
    expect(cookies).toContain('md_refresh_token=refresh-2;');
  });
});
