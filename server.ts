import compression from 'compression';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type Express, type Request, type Response } from 'express';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const DEFAULT_BACKEND_URL = 'https://mealdirectbackend.onrender.com';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ACCESS_COOKIE = 'md_access_token';
const REFRESH_COOKIE = 'md_refresh_token';
const CSRF_COOKIE = 'md_csrf';

type FetchLike = typeof fetch;

interface CreateAppOptions {
  backendUrl?: string;
  isProd?: boolean;
  fetchImpl?: FetchLike;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) return acc;
    acc[rawName] = decodeURIComponent(rawValue.join('=') || '');
    return acc;
  }, {});
}

function makeCsrfToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function cookieOptions(isProd: boolean, httpOnly: boolean, maxAgeMs: number) {
  return {
    httpOnly,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeMs
  };
}

function setSessionCookies(res: Response, tokens: { accessToken?: string; refreshToken?: string }, isProd: boolean) {
  if (tokens.accessToken) {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, cookieOptions(isProd, true, 15 * 60 * 1000));
  }
  if (tokens.refreshToken) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(isProd, true, 30 * 24 * 60 * 60 * 1000));
  }
  res.cookie(CSRF_COOKIE, makeCsrfToken(), cookieOptions(isProd, false, 30 * 24 * 60 * 60 * 1000));
}

function clearSessionCookies(res: Response, isProd: boolean) {
  const base = { secure: isProd, sameSite: 'lax' as const, path: '/' };
  res.clearCookie(ACCESS_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(REFRESH_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}

function stripTokens(body: any) {
  if (!body || typeof body !== 'object') return body;
  const { accessToken, refreshToken, session, ...rest } = body;
  return rest;
}

function isMutating(req: Request) {
  return !SAFE_METHODS.has(req.method.toUpperCase());
}

function requireCsrf(req: Request, res: Response) {
  if (!isMutating(req)) return true;
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.header('x-mealdirect-csrf');
  if (cookieToken && headerToken && cookieToken === headerToken) return true;
  res.status(403).json({ error: { code: 'CSRF_MISMATCH', message: 'CSRF token missing or invalid.' } });
  return false;
}

async function readBackendJson(response: globalThis.Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildForwardHeaders(req: Request, accessToken?: string) {
  const headers: Record<string, string> = {
    Accept: req.header('accept') || 'application/json'
  };
  const contentType = req.header('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  const idempotencyKey = req.header('idempotency-key');
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const csrf = req.header('x-mealdirect-csrf');
  if (csrf) headers['X-MealDirect-CSRF'] = csrf;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function buildFetchInit(req: Request, accessToken?: string): RequestInit {
  const init: RequestInit = {
    method: req.method,
    headers: buildForwardHeaders(req, accessToken)
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : undefined;
  }
  return init;
}

async function refreshAccessToken(
  backendUrl: string,
  refreshToken: string,
  fetchImpl: FetchLike
): Promise<{ accessToken?: string; refreshToken?: string } | null> {
  const response = await fetchImpl(`${backendUrl}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  if (!response.ok) return null;
  const json: any = await readBackendJson(response);
  if (!json?.accessToken) return null;
  return {
    accessToken: json.accessToken,
    refreshToken: json.refreshToken || refreshToken
  };
}

async function sendBackendResponse(res: Response, backendResponse: globalThis.Response) {
  const contentType = backendResponse.headers.get('content-type');
  if (contentType) res.setHeader('content-type', contentType);
  res.status(backendResponse.status);
  if (backendResponse.status === 204) {
    res.end();
    return;
  }
  const body = await backendResponse.arrayBuffer();
  res.send(Buffer.from(body));
}

function applySecurity(app: Express, backendUrl: string, isProd: boolean) {
  app.use((_, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64url');
    next();
  });

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              'default-src': ["'self'"],
              'base-uri': ["'self'"],
              'connect-src': ["'self'", backendUrl, 'https://*.ingest.sentry.io', 'https://sentry.io'],
              'form-action': ["'self'", 'https://checkout.paystack.com'],
              'frame-src': ["'self'", 'https://checkout.paystack.com'],
              'img-src': ["'self'", 'data:', 'https:'],
              'script-src': ["'self'", (_req, res) => `'nonce-${(res as any).locals.cspNonce}'`],
              'style-src': ["'self'", "'unsafe-inline'"]
            }
          }
        : false
    })
  );
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const backendUrl = (options.backendUrl || process.env.BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/$/, '');
  const isProd = options.isProd ?? process.env.NODE_ENV === 'production';
  const fetchImpl = options.fetchImpl || fetch;

  app.set('trust proxy', 1);
  applySecurity(app, backendUrl, isProd);
  app.use(compression());
  app.use(morgan(isProd ? 'combined' : 'dev'));

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use(express.json({ limit: '100kb' }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api', apiLimiter);

  app.post('/api/auth/customer/login', async (req, res) => {
    try {
      const backendResponse = await fetchImpl(`${backendUrl}/v1/auth/customer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(req.body || {})
      });
      const json = await readBackendJson(backendResponse);
      if (backendResponse.ok && json && typeof json === 'object') {
        setSessionCookies(res, json as any, isProd);
        res.status(backendResponse.status).json(stripTokens(json));
        return;
      }
      res.status(backendResponse.status).json(json);
    } catch (error) {
      console.error('Login proxy failed:', error);
      res.status(502).json({ error: { code: 'AUTH_PROXY_FAILED', message: 'Authentication service unavailable.' } });
    }
  });

  app.post('/api/auth/customer/signup', async (req, res) => {
    try {
      const backendResponse = await fetchImpl(`${backendUrl}/v1/auth/customer/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(req.body || {})
      });
      const json = await readBackendJson(backendResponse);
      if (backendResponse.ok && json && typeof json === 'object') {
        setSessionCookies(res, json as any, isProd);
        res.status(backendResponse.status).json(stripTokens(json));
        return;
      }
      res.status(backendResponse.status).json(json);
    } catch (error) {
      console.error('Signup proxy failed:', error);
      res.status(502).json({ error: { code: 'AUTH_PROXY_FAILED', message: 'Authentication service unavailable.' } });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    try {
      if (cookies[ACCESS_COOKIE]) {
        await fetchImpl(`${backendUrl}/v1/auth/logout`, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${cookies[ACCESS_COOKIE]}` }
        }).catch(() => null);
      }
    } finally {
      clearSessionCookies(res, isProd);
      res.json({ ok: true });
    }
  });

  app.use('/api/v1', async (req, res) => {
    if (!requireCsrf(req, res)) return;

    const cookies = parseCookies(req.headers.cookie);
    const targetUrl = `${backendUrl}/v1${req.originalUrl.replace(/^\/api\/v1/, '')}`;

    try {
      let backendResponse = await fetchImpl(targetUrl, buildFetchInit(req, cookies[ACCESS_COOKIE]));
      if (backendResponse.status === 401 && cookies[REFRESH_COOKIE]) {
        const refreshed = await refreshAccessToken(backendUrl, cookies[REFRESH_COOKIE], fetchImpl);
        if (refreshed?.accessToken) {
          setSessionCookies(res, refreshed, isProd);
          backendResponse = await fetchImpl(targetUrl, buildFetchInit(req, refreshed.accessToken));
        } else {
          clearSessionCookies(res, isProd);
        }
      }
      await sendBackendResponse(res, backendResponse);
    } catch (error) {
      console.error(`BFF proxy failed [${req.method} ${req.originalUrl}]:`, error);
      res.status(502).json({ error: { code: 'BACKEND_UNAVAILABLE', message: 'Backend service unavailable.' } });
    }
  });

  // Deterministic local nutrition estimate (no external AI dependency)
  const nutritionCache = new Map<string, any>();
  app.post('/api/nutrition', (req, res) => {
    const { itemName, description } = req.body;
    if (!itemName) {
      return res.status(400).json({ error: 'itemName is required' });
    }
    const cacheKey = `${itemName.toLowerCase().trim()}_${(description || '').toLowerCase().trim()}`;
    if (nutritionCache.has(cacheKey)) return res.json(nutritionCache.get(cacheKey));
    const data = getSimulatedNutrition(itemName, description);
    nutritionCache.set(cacheKey, data);
    return res.json(data);
  });

  return app;
}

function getSimulatedNutrition(itemName: string, description?: string) {
  const lower = (itemName || '').toLowerCase() + ' ' + (description || '').toLowerCase();
  let calories = 330;
  let protein = '11g';
  let carbs = '38g';
  let fats = '7g';
  let allergens = ['None'];
  let healthTips = 'Pure natural organic recipe. Rich in essential energy nutrients to support active college lifestyles.';

  if (lower.includes('rice') || lower.includes('jollof')) {
    calories = 440;
    protein = '12g';
    carbs = '64g';
    fats = '8g';
    healthTips = 'Excellent carbohydrate complex providing sustainable physical energy during active study. Best served hot!';
  } else if (lower.includes('chicken') || lower.includes('meat') || lower.includes('beef') || lower.includes('shawarma') || lower.includes('grill') || lower.includes('protein') || lower.includes('ponmo') || lower.includes('egg') || lower.includes('fish')) {
    calories = 390;
    protein = '28g';
    carbs = '14g';
    fats = '13g';
    healthTips = 'Rich source of high-quality amino proteins supporting muscular regeneration and mental alertness.';
  } else if (lower.includes('soup') || lower.includes('egusi') || lower.includes('stew') || lower.includes('fufu') || lower.includes('semo')) {
    calories = 310;
    protein = '8g';
    carbs = '22g';
    fats = '18g';
    allergens = ['Soy', 'Nuts'];
    healthTips = 'Filled with natural minerals and vitamins. Packed with deep botanical textures and dietary fibers.';
  } else if (lower.includes('plantain') || lower.includes('dodo')) {
    calories = 230;
    protein = '2g';
    carbs = '46g';
    fats = '5g';
    healthTips = 'Loaded with potassium which regulates fluid flow and optimizes heart functions during study concentration.';
  } else if (lower.includes('egg') || lower.includes('salad') || lower.includes('cheese') || lower.includes('veg')) {
    calories = 190;
    protein = '13g';
    carbs = '7g';
    fats = '11g';
    allergens = ['Egg', 'Dairy'];
    healthTips = 'Antioxidant-dense meal high in vitamin metrics. Helps secure healthy cellular synthesis and physical focus.';
  }

  return { calories, protein, carbs, fats, allergens, healthTips, isSimulated: true };
}

export async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const IS_PROD = process.env.NODE_ENV === 'production';
  const app = createApp({ isProd: IS_PROD });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', async (_req, res) => {
      const html = await fs.promises.readFile(path.join(distPath, 'index.html'), 'utf8');
      res.type('html').send(html.replaceAll('%CSP_NONCE%', res.locals.cspNonce));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
    console.log(`Proxying /api/v1 -> ${process.env.BACKEND_URL || DEFAULT_BACKEND_URL}/v1`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
