// Vercel serverless entry. Routes every /api/* request into the Express BFF.
// Express `app` is itself an (req, res) handler. Wrapped here so any boot or
// invocation error is surfaced in the response body instead of an opaque
// FUNCTION_INVOCATION_FAILED. app.listen is skipped because VERCEL is set.
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server';

let app: ReturnType<typeof createApp> | null = null;
let bootError: unknown = null;
try {
  app = createApp({ isProd: true });
} catch (e) {
  bootError = e;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (bootError || !app) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ stage: 'boot', error: String((bootError as any)?.stack || bootError) }));
    return;
  }
  try {
    return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ stage: 'handle', error: String((e as any)?.stack || e) }));
  }
}
