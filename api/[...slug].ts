// Vercel serverless entry. Routes every /api/* request into the Express BFF.
// Express `app` is itself an (req, res) handler, so Vercel's Node runtime can
// use it directly. app.listen is skipped because process.env.VERCEL is set.
import { createApp } from '../server';

const app = createApp({ isProd: true });

export default app;
