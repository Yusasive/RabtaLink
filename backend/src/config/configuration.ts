// By the time this factory runs, `env-validation.schema.ts` has already
// validated process.env at boot (Nest validates before invoking `load`
// factories) — so every `required()` field here is guaranteed present.
// This helper just satisfies TypeScript's `string | undefined` typing for
// `process.env` without reintroducing a silent, potentially-insecure fallback.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name} (should have been caught by Joi validation)`);
  return value;
}

export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  // Must be a publicly reachable https URL (ngrok or deployed host) for AT's Voice
  // GetDigits callbackUrl — AT's servers call this, not localhost.
  publicBaseUrl: requireEnv('PUBLIC_BASE_URL'),
  // Dashboard's own origin, for CORS — the AT webhooks above have no origin to
  // restrict since they're server-to-server, but the browser-based dashboard does.
  dashboardOrigin: requireEnv('DASHBOARD_ORIGIN'),
  // Shared secret appended as a query param to AT callback URLs (?token=...),
  // checked by AtWebhookGuard — AT itself has no request-signing mechanism, so
  // this is the standard workaround to stop arbitrary internet POSTs to these routes.
  atWebhookSecret: requireEnv('AT_WEBHOOK_SECRET'),
  jwt: {
    secret: requireEnv('JWT_SECRET'),
  },
  database: {
    host: requireEnv('POSTGRES_HOST'),
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: requireEnv('POSTGRES_USER'),
    password: requireEnv('POSTGRES_PASSWORD'),
    database: requireEnv('POSTGRES_DB'),
  },
  redis: {
    host: requireEnv('REDIS_HOST'),
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  africastalking: {
    username: requireEnv('AT_USERNAME'),
    apiKey: requireEnv('AT_API_KEY'),
    shortcode: process.env.AT_SHORTCODE ?? '',
    voiceNumber: process.env.AT_VOICE_NUMBER ?? '',
  },
});
