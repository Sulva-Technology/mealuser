import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../server';
import {
  MAX_AVATAR_UPLOAD_BYTES,
  derivePaymentPollingState,
  mapMeSession,
  mapNotification,
  mapPaymentStatus,
  stripEphemeralUserProfileFields,
  uploadProfileAvatar,
  validateAvatarFile
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
        onboardingCompleted: true,
        avatarUrl: 'https://cdn.test/signed-avatar.jpg'
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
      isOnboarded: true,
      avatarUrl: 'https://cdn.test/signed-avatar.jpg'
    });
  });

  it('maps avatarUrl from the latest /me profile only', () => {
    const user = mapMeSession({
      profile: {
        id: 'profile-1',
        avatarUrl: 'https://cdn.test/latest-signed-avatar.webp'
      },
      actor: { email: 'student@example.com' }
    });

    expect(user.avatarUrl).toBe('https://cdn.test/latest-signed-avatar.webp');
  });

  it('strips short-lived avatarUrl before local profile persistence', () => {
    const persistable = stripEphemeralUserProfileFields({
      id: 'profile-1',
      email: 'student@example.com',
      fullName: 'Ada Student',
      isOnboarded: true,
      avatarUrl: 'https://cdn.test/short-lived.jpg'
    });

    expect(persistable).toEqual({
      id: 'profile-1',
      email: 'student@example.com',
      fullName: 'Ada Student',
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

describe('profile avatar upload flow', () => {
  it('accepts only jpeg, png, and webp files up to 2 MB', () => {
    expect(validateAvatarFile(new File(['x'], 'avatar.jpg', { type: 'image/jpeg' }))).toBeNull();
    expect(validateAvatarFile(new File(['x'], 'avatar.png', { type: 'image/png' }))).toBeNull();
    expect(validateAvatarFile(new File(['x'], 'avatar.webp', { type: 'image/webp' }))).toBeNull();

    expect(validateAvatarFile(new File(['x'], 'avatar.gif', { type: 'image/gif' }))).toContain('JPEG, PNG, or WebP');
    expect(
      validateAvatarFile(
        new File([new Uint8Array(MAX_AVATAR_UPLOAD_BYTES + 1)], 'avatar.jpg', { type: 'image/jpeg' })
      )
    ).toContain('2 MB');
  });

  it('requests a signed upload URL, uploads binary bytes, then confirms key', async () => {
    const calls: Array<{ kind: string; path?: string; method?: string; body?: any; input?: string; contentType?: string }> = [];
    const file = new File(['avatar-bytes'], 'avatar.jpg', { type: 'image/jpeg' });

    const updated = await uploadProfileAvatar(file, {
      apiRequestImpl: async (path, method, body) => {
        calls.push({ kind: 'api', path, method, body });
        if (path === '/me/avatar/upload-url') {
          return {
            uploadUrl: 'https://storage.test/upload',
            token: 'signed-token',
            key: 'avatars/profile-1/avatar.jpg'
          };
        }
        if (path === '/me/avatar/confirm') {
          return {
            profile: {
              id: 'profile-1',
              avatarUrl: 'https://cdn.test/new-signed-avatar.jpg',
              onboardingCompleted: true
            }
          };
        }
        throw new Error(`unexpected path ${path}`);
      },
      fetchImpl: async (input, init) => {
        calls.push({
          kind: 'upload',
          input: String(input),
          method: init?.method,
          contentType: new Headers(init?.headers).get('content-type') || undefined,
          body: init?.body
        });
        return new Response(null, { status: 200 });
      }
    });

    expect(updated.avatarUrl).toBe('https://cdn.test/new-signed-avatar.jpg');
    expect(calls).toMatchObject([
      {
        kind: 'api',
        path: '/me/avatar/upload-url',
        method: 'POST',
        body: { contentType: 'image/jpeg', sizeBytes: file.size }
      },
      {
        kind: 'upload',
        input: 'https://storage.test/upload',
        method: 'PUT',
        contentType: 'image/jpeg'
      },
      {
        kind: 'api',
        path: '/me/avatar/confirm',
        method: 'POST',
        body: { key: 'avatars/profile-1/avatar.jpg' }
      }
    ]);
  });
});

describe('CSP allows Firebase Cloud Messaging', () => {
	// The FCM background SW importScripts() the compat SDK from gstatic, and
	// getToken() in the page calls the Installations + FCM registration APIs.
	// Both the Express prod CSP and the Vercel static-host CSP must allow them,
	// or web push dies with "ServiceWorker script evaluation failed".
	const FCM_CONNECT = [
		'https://fcmregistrations.googleapis.com',
		'https://firebaseinstallations.googleapis.com'
	];

	it('Express prod CSP permits gstatic scripts and FCM endpoints', async () => {
		const app = createApp({
			backendUrl: 'https://backend.test',
			isProd: true,
			fetchImpl: async () => jsonResponse({})
		});
		const res = await request(app).get('/healthz').expect(200);
		const csp = String(res.headers['content-security-policy']);
		const directive = (name: string) =>
			csp.split(';').map(d => d.trim()).find(d => d.startsWith(name)) || '';
		expect(directive('script-src')).toContain('https://www.gstatic.com');
		for (const origin of FCM_CONNECT) {
			expect(directive('connect-src')).toContain(origin);
		}
	});

	it('vercel.json CSP permits gstatic scripts and FCM endpoints', async () => {
		const { readFile } = await import('node:fs/promises');
		const vercel = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
		const cspHeader = vercel.headers
			.flatMap((h: { headers: Array<{ key: string; value: string }> }) => h.headers)
			.find((h: { key: string }) => h.key === 'Content-Security-Policy');
		const csp = String(cspHeader?.value || '');
		const directive = (name: string) =>
			csp.split(';').map(d => d.trim()).find(d => d.startsWith(name)) || '';
		expect(directive('script-src')).toContain('https://www.gstatic.com');
		for (const origin of FCM_CONNECT) {
			expect(directive('connect-src')).toContain(origin);
		}
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
