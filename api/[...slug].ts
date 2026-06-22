// Vercel serverless entry. Routes every /api/* request into the Express BFF.
// Imports are done dynamically INSIDE the handler so that any module-load,
// boot, or invocation error is surfaced in the response body instead of an
// opaque FUNCTION_INVOCATION_FAILED. app.listen is skipped because VERCEL is set.
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { createApp } = await import('../server');
    const app = createApp({ isProd: true }) as unknown as (req: IncomingMessage, res: ServerResponse) => void;
    return app(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ stage: 'load', error: String((e as any)?.stack || e) }));
  }
}
