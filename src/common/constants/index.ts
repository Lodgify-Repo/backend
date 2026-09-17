export const LOG_DIR = 'logs';
export const { 
  ENV, 
  DATABASE_URL, 
  PORT, 
  REDIS_DB, 
  REDIS_HOST, 
  REDIS_PASSWORD, 
  REDIS_PORT,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  ALLOWED_ORIGINS,
  FRONTEND_URL,
} = process.env;

const DEFAULT_ORIGINS = ['http://localhost:4200'];


export const allowedOrigins: string[] = ALLOWED_ORIGINS
  ? ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;
