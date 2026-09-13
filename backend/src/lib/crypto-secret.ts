import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

function decodeMasterKey(raw: string): Buffer {
  const hex = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  const buf = Buffer.from(hex, 'base64');
  if (buf.length === KEY_BYTES) return buf;
  throw new Error('INTEGRATION_MASTER_KEY must be 32 bytes (64 hex chars or base64).');
}

export function loadMasterKey(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env.INTEGRATION_MASTER_KEY;
  if (!raw) {
    throw new Error('INTEGRATION_MASTER_KEY is not set.');
  }
  return decodeMasterKey(raw);
}

/**
 * AES-256-GCM. Unique IV per record. Plaintext exists only in the call frame.
 * Thrown errors never include the secret or the ciphertext.
 */
export function encryptSecret(plaintext: string, key: Buffer, keyVersion = 1): EncryptedSecret {
  if (key.length !== KEY_BYTES) {
    throw new Error('Master key must be 32 bytes.');
  }
  if (!plaintext) {
    throw new Error('Refusing to encrypt an empty secret.');
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion,
  };
}

export function decryptSecret(record: EncryptedSecret, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new Error('Master key must be 32 bytes.');
  }
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(record.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Failed to decrypt integration secret.');
  }
}

export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return '••••';
  return `••••${plaintext.slice(-4)}`;
}

/** Redact anything that looks like a secret from an error before it is logged or returned. */
export function redactSecret(message: string, secret?: string): string {
  let out = message;
  if (secret && secret.length > 0) {
    out = out.split(secret).join('[redacted]');
  }
  return out;
}
