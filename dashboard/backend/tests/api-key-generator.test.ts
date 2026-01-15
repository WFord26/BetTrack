import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  getKeyPrefix
} from '../src/utils/api-key-generator';

describe('API Key Generator', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('generateApiKey', () => {
    it('should generate API key with prod prefix in production', () => {
      process.env.NODE_ENV = 'production';
      const key = generateApiKey();

      expect(key).toMatch(/^sk_prod_[A-Za-z0-9_-]{32}$/);
      expect(key).toHaveLength(40); // sk_prod_ (8) + 32 chars
    });

    it('should generate API key with test prefix in non-production', () => {
      process.env.NODE_ENV = 'development';
      const key = generateApiKey();

      expect(key).toMatch(/^sk_test_[A-Za-z0-9_-]{32}$/);
      expect(key).toHaveLength(40); // sk_test_ (8) + 32 chars
    });

    it('should generate API key with test prefix when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      const key = generateApiKey();

      expect(key).toMatch(/^sk_test_[A-Za-z0-9_-]{32}$/);
    });

    it('should generate API key with test prefix when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      const key = generateApiKey();

      expect(key).toMatch(/^sk_test_[A-Za-z0-9_-]{32}$/);
    });

    it('should generate unique keys on each call', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      const key3 = generateApiKey();

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it('should use base64url encoding (URL-safe)', () => {
      const keys = Array.from({ length: 10 }, () => generateApiKey());

      keys.forEach(key => {
        // Base64url should not contain +, /, or =
        const randomPart = key.substring(8);
        expect(randomPart).not.toContain('+');
        expect(randomPart).not.toContain('/');
        expect(randomPart).not.toContain('=');
      });
    });

    it('should generate keys with consistent length', () => {
      const keys = Array.from({ length: 20 }, () => generateApiKey());

      keys.forEach(key => {
        expect(key).toHaveLength(40);
      });
    });

    it('should handle rapid generation', () => {
      const keys = Array.from({ length: 100 }, () => generateApiKey());
      const uniqueKeys = new Set(keys);

      expect(uniqueKeys.size).toBe(100); // All keys should be unique
    });
  });

  describe('hashApiKey', () => {
    it('should hash an API key', async () => {
      const key = 'sk_test_abcdef123456';
      const hashed = await hashApiKey(key);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(key);
      expect(hashed.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('should generate different hashes for same key (due to salt)', async () => {
      const key = 'sk_test_abcdef123456';
      const hash1 = await hashApiKey(key);
      const hash2 = await hashApiKey(key);

      expect(hash1).not.toBe(hash2); // Different salts
    });

    it('should generate bcrypt format hash', async () => {
      const key = 'sk_test_abcdef123456';
      const hashed = await hashApiKey(key);

      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(hashed).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    it('should handle empty string', async () => {
      const hashed = await hashApiKey('');

      expect(hashed).toBeDefined();
      expect(hashed).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    it('should handle long keys', async () => {
      const longKey = 'sk_prod_' + 'a'.repeat(1000);
      const hashed = await hashApiKey(longKey);

      expect(hashed).toBeDefined();
      expect(hashed).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    it('should handle special characters', async () => {
      const specialKey = 'sk_test_!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hashed = await hashApiKey(specialKey);

      expect(hashed).toBeDefined();
    });
  });

  describe('verifyApiKey', () => {
    it('should verify correct API key', async () => {
      const plainKey = 'sk_test_abcdef123456';
      const hashedKey = await hashApiKey(plainKey);

      const isValid = await verifyApiKey(plainKey, hashedKey);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect API key', async () => {
      const plainKey = 'sk_test_abcdef123456';
      const wrongKey = 'sk_test_wrongkey9999';
      const hashedKey = await hashApiKey(plainKey);

      const isValid = await verifyApiKey(wrongKey, hashedKey);

      expect(isValid).toBe(false);
    });

    it('should reject key with minor differences', async () => {
      const plainKey = 'sk_test_abcdef123456';
      const similarKey = 'sk_test_abcdef123457'; // Changed last char
      const hashedKey = await hashApiKey(plainKey);

      const isValid = await verifyApiKey(similarKey, hashedKey);

      expect(isValid).toBe(false);
    });

    it('should reject key with different case', async () => {
      const plainKey = 'sk_test_abcdef123456';
      const upperKey = 'SK_TEST_ABCDEF123456';
      const hashedKey = await hashApiKey(plainKey);

      const isValid = await verifyApiKey(upperKey, hashedKey);

      expect(isValid).toBe(false);
    });

    it('should handle empty string verification', async () => {
      const hashedKey = await hashApiKey('');
      
      const isValidEmpty = await verifyApiKey('', hashedKey);
      const isValidNonEmpty = await verifyApiKey('sk_test_abc', hashedKey);

      expect(isValidEmpty).toBe(true);
      expect(isValidNonEmpty).toBe(false);
    });

    it('should verify generated keys', async () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      const hashed1 = await hashApiKey(key1);

      const isValid1 = await verifyApiKey(key1, hashed1);
      const isValid2 = await verifyApiKey(key2, hashed1);

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(false);
    });

    it('should handle multiple verifications of same key', async () => {
      const plainKey = 'sk_test_consistent';
      const hashedKey = await hashApiKey(plainKey);

      const result1 = await verifyApiKey(plainKey, hashedKey);
      const result2 = await verifyApiKey(plainKey, hashedKey);
      const result3 = await verifyApiKey(plainKey, hashedKey);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });
  });

  describe('getKeyPrefix', () => {
    it('should return first 12 characters with ellipsis', () => {
      const key = 'sk_test_abcdefghijklmnopqrstuvwxyz123456';
      const prefix = getKeyPrefix(key);

      expect(prefix).toBe('sk_test_abcd...');
      expect(prefix).toHaveLength(15); // 12 chars + "..."
    });

    it('should handle prod keys', () => {
      const key = 'sk_prod_xyz789012345678901234567890123';
      const prefix = getKeyPrefix(key);

      expect(prefix).toBe('sk_prod_xyz7...');
    });

    it('should handle short keys', () => {
      const shortKey = 'sk_test';
      const prefix = getKeyPrefix(shortKey);

      expect(prefix).toBe('sk_test...');
    });

    it('should handle empty string', () => {
      const prefix = getKeyPrefix('');

      expect(prefix).toBe('...');
    });

    it('should handle keys shorter than 12 characters', () => {
      const key = 'short';
      const prefix = getKeyPrefix(key);

      expect(prefix).toBe('short...');
    });

    it('should handle keys exactly 12 characters', () => {
      const key = '123456789012';
      const prefix = getKeyPrefix(key);

      expect(prefix).toBe('123456789012...');
    });

    it('should preserve special characters in prefix', () => {
      const key = 'sk_test-abc!@#$%^&*()_+1234567890';
      const prefix = getKeyPrefix(key);

      expect(prefix).toBe('sk_test-abc!...');
    });

    it('should handle generated keys consistently', () => {
      const keys = Array.from({ length: 10 }, () => generateApiKey());
      const prefixes = keys.map(key => getKeyPrefix(key));

      prefixes.forEach(prefix => {
        expect(prefix).toHaveLength(15);
        expect(prefix).toMatch(/^sk_(test|prod)_.../);
        expect(prefix.endsWith('...')).toBe(true);
      });
    });
  });

  describe('Integration tests', () => {
    it('should generate, hash, and verify a key end-to-end', async () => {
      const key = generateApiKey();
      const hashed = await hashApiKey(key);
      const isValid = await verifyApiKey(key, hashed);
      const prefix = getKeyPrefix(key);

      expect(key).toMatch(/^sk_(test|prod)_/);
      expect(hashed).toMatch(/^\$2[aby]\$/);
      expect(isValid).toBe(true);
      expect(prefix).toHaveLength(15);
    });

    it('should handle multiple keys independently', async () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      const hash1 = await hashApiKey(key1);
      const hash2 = await hashApiKey(key2);

      expect(await verifyApiKey(key1, hash1)).toBe(true);
      expect(await verifyApiKey(key2, hash2)).toBe(true);
      expect(await verifyApiKey(key1, hash2)).toBe(false);
      expect(await verifyApiKey(key2, hash1)).toBe(false);
    });

    it('should display keys safely with prefix', async () => {
      const keys = Array.from({ length: 5 }, () => generateApiKey());
      const prefixes = keys.map(key => getKeyPrefix(key));

      // All prefixes should be different
      const uniquePrefixes = new Set(prefixes);
      expect(uniquePrefixes.size).toBeGreaterThan(1);

      // No prefix should reveal full key
      keys.forEach((key, i) => {
        expect(key).not.toBe(prefixes[i]);
        expect(key.startsWith(prefixes[i].substring(0, 12))).toBe(true);
      });
    });

    it('should maintain security through hash-verify cycle', async () => {
      const correctKey = generateApiKey();
      const wrongKeys = Array.from({ length: 10 }, () => generateApiKey());
      const hashedKey = await hashApiKey(correctKey);

      // Correct key should verify
      expect(await verifyApiKey(correctKey, hashedKey)).toBe(true);

      // All wrong keys should fail
      for (const wrongKey of wrongKeys) {
        expect(await verifyApiKey(wrongKey, hashedKey)).toBe(false);
      }
    });
  });
});
