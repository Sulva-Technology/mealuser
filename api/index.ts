// Vercel serverless entry. The vercel.json rewrite funnels every /api/* request
// here ("/api/(.*)" -> "/api") and Vercel preserves the original request URL, so
// the Express routes (/api/v1/..., /api/auth/..., /api/nutrition) match.
//
// A single index.ts is used instead of a [...slug].ts catch-all: with this
// project's custom buildCommand/outputDirectory there is no framework preset, so
// Vercel parsed [...slug] as a single dynamic segment and 404'd multi-segment
// paths. The rewrite routes all depths deterministically.
//
// The import MUST carry the .js extension: package.json is "type": "module", so
// this function ships as ESM and Node ESM rejects extensionless relative imports
// (ERR_MODULE_NOT_FOUND). app.listen is skipped because process.env.VERCEL is set.
import { createApp } from '../server.js';

const app = createApp({ isProd: true });

export default app;
