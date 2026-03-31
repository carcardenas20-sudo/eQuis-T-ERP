import crypto from 'crypto';

let JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SESSION_SECRET is required in production. Set the environment variable and restart.');
    process.exit(1);
  }
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('⚠️  SESSION_SECRET not set — using a random secret for this session. Set SESSION_SECRET in env for persistence across restarts.');
}

export { JWT_SECRET };
export const JWT_EXPIRES = '30d';

// Entity types that require admin role for write operations (POST/PUT/DELETE)
export const ADMIN_ONLY_WRITE_ENTITIES = new Set([
  'User', 'Role', 'SystemSettings', 'Location'
]);
