import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Generate a new API key with format: sk_prod_<32chars> or sk_test_<32chars>
 */
export function generateApiKey(): string {
  const env = process.env.NODE_ENV === 'production' ? 'prod' : 'test';
  const random = crypto.randomBytes(24).toString('base64url');
  return `sk_${env}_${random}`;
}

/**
 * Hash an API key for secure storage using bcrypt
 */
export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, 10);
}

/**
 * Verify a plain API key against a hashed key
 */
export async function verifyApiKey(plainKey: string, hashedKey: string): Promise<boolean> {
  return bcrypt.compare(plainKey, hashedKey);
}

/**
 * Get the display prefix for an API key (first 12 chars)
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 12) + '...';
}
