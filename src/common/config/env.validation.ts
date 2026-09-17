import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  ENV: Joi.string().valid('dev', 'staging', 'production', 'test').default('dev'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required. Example: postgresql://user:password@localhost:5432/lodgify?schema=public',
  }),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  REDIS_DB: Joi.number().default(0),

  JWT_SECRET: Joi.string().required().messages({
    'any.required': 'JWT_SECRET is required for authentication to function.',
  }),
  JWT_REFRESH_SECRET: Joi.string().required().messages({
    'any.required': 'JWT_REFRESH_SECRET is required for token refresh to function.',
  }),

  GOOGLE_CLIENT_ID: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),

  ALLOWED_ORIGINS: Joi.string().optional().allow('').default('http://localhost:4200'),
  FRONTEND_URL: Joi.string().uri().optional().default('http://localhost:4200'),
}).options({ allowUnknown: true });
