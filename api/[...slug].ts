// Vercel serverless entry. Routes every /api/* request into the Express BFF.
// Express `app` is itself an (req, res) handler. The import MUST carry the .js
// extension: the project is `"type": "module"`, so Vercel ships this function
// as ESM, and Node ESM rejects extensionless relative imports at runtime
// (ERR_MODULE_NOT_FOUND). app.listen is skipped because process.env.VERCEL is set.
import { createApp } from '../server.js';

const app = createApp({ isProd: true });

export default app;
