import * as Joi from 'joi';

/**
 * Fails fast at boot on missing/malformed env vars instead of silently falling
 * back to insecure defaults (e.g. a hardcoded JWT secret) in production.
 * `.unknown(true)` because this validates the *entire* process.env, which
 * includes unrelated system vars (PATH, HOME, ...) we don't want to reject.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),

  PUBLIC_BASE_URL: Joi.string().uri().required(),
  DASHBOARD_ORIGIN: Joi.string().uri().required(),
  AT_WEBHOOK_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'AT_WEBHOOK_SECRET must be at least 16 characters — generate one with `openssl rand -hex 16`',
  }),
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters — generate one with `openssl rand -hex 32`',
  }),

  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().port().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),

  AT_USERNAME: Joi.string().required(),
  AT_API_KEY: Joi.string().required(),
  AT_SHORTCODE: Joi.string().allow('').optional(),
  AT_VOICE_NUMBER: Joi.string().allow('').optional(),
}).unknown(true);
