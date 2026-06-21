import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'https://mealdirectbackend.onrender.com';
const IS_PROD = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1); // behind Render/Cloud Run load balancer

// Security headers. CSP disabled here because the SPA relies on inline styles
// (Tailwind) and redirects to external Paystack; enforce CSP at the CDN/edge if needed.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(compression());
app.use(morgan(IS_PROD ? 'combined' : 'dev'));

// Local health probe (the backend exposes its own at /v1/health/*)
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Proxy /v1 to the hosted backend (must run before the JSON body parser)
app.use(
  createProxyMiddleware({
    pathFilter: '/v1',
    target: BACKEND_URL,
    changeOrigin: true
  })
);

app.use(express.json({ limit: '100kb' }));

// Throttle the local API surface to curb abuse
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// Deterministic local nutrition estimate (no external AI dependency)
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
    allergens = ['None'];
    healthTips = 'Excellent carbohydrate complex providing sustainable physical energy during active study. Best served hot!';
  } else if (lower.includes('chicken') || lower.includes('meat') || lower.includes('beef') || lower.includes('shawarma') || lower.includes('grill') || lower.includes('protein') || lower.includes('ponmo') || lower.includes('egg') || lower.includes('fish')) {
    calories = 390;
    protein = '28g';
    carbs = '14g';
    fats = '13g';
    allergens = ['None'];
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
    allergens = ['None'];
    healthTips = 'Loaded with potassium which regulates fluid flow and optimizes heart functions during study concentration.';
  } else if (lower.includes('egg') || lower.includes('salad') || lower.includes('cheese') || lower.includes('veg')) {
    calories = 190;
    protein = '13g';
    carbs = '7g';
    fats = '11g';
    allergens = ['Egg', 'Dairy'];
    healthTips = 'Antioxidant-dense meal high in vitamin metrics. Helps secure healthy cellular synthesis and physical focus.';
  }

  return {
    calories,
    protein,
    carbs,
    fats,
    allergens,
    healthTips,
    isSimulated: true
  };
}

// In-memory caching for resolved nutrition data to eliminate redundant work
const nutritionCache = new Map<string, any>();

// REST route for local nutritional estimates
app.post('/api/nutrition', (req, res) => {
  const { itemName, description } = req.body;

  if (!itemName) {
    return res.status(400).json({ error: 'itemName is required' });
  }

  const cacheKey = `${itemName.toLowerCase().trim()}_${(description || '').toLowerCase().trim()}`;

  if (nutritionCache.has(cacheKey)) {
    return res.json(nutritionCache.get(cacheKey));
  }

  const data = getSimulatedNutrition(itemName, description);
  nutritionCache.set(cacheKey, data);
  return res.json(data);
});

// Vite server setup in development or static distribution file server in production
async function startServer() {
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
    console.log(`Proxying /v1 -> ${BACKEND_URL}`);
  });
}

startServer();
