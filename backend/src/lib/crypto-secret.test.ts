import { describe, it, expect } from 'vitest';
import { decryptSecret, encryptSecret, loadMasterKey, maskSecret, redactSecret } from './crypto-secret';

const KEY = Buffer.from('a'.repeat(64), 'hex');
const SECRET = 'sk-live-do-not-leak-this-value';

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a tenant key', () => {
    const sealed = encryptSecret(SECRET, KEY);
    expect(decryptSecret(sealed, KEY)).toBe(SECRET);
    expect(sealed.ciphertext).not.toContain(SECRET);
    expect(sealed.iv).not.toBe(encryptSecret(SECRET, KEY).iv);
  });

  it('never puts the plaintext in a thrown error', () => {
    const sealed = encryptSecret(SECRET, KEY);
    try {
      decryptSecret({ ...sealed, authTag: Buffer.alloc(16).toString('base64') }, KEY);
      expect.unreachable();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain(sealed.ciphertext);
    }
  });

  it('masks for the Settings card and redacts leaks from messages', () => {
    expect(maskSecret(SECRET)).toBe('••••alue');
    expect(redactSecret(`failed for ${SECRET}`, SECRET)).toBe('failed for [redacted]');
  });

  it('loads a 32-byte hex master key', () => {
    const key = loadMasterKey({ INTEGRATION_MASTER_KEY: 'b'.repeat(64) });
    expect(key.length).toBe(32);
  });
});
