import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENC_KEY;
  if (!hex) throw new Error('TOKEN_ENC_KEY env var is not set');
  if (hex.length !== 64) {
    throw new Error('TOKEN_ENC_KEY must be 64 hex chars (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptToken(plaintext: string): { enc: string; iv: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const enc = Buffer.concat([ciphertext, authTag]).toString('base64');
  return { enc, iv: iv.toString('hex') };
}

export function decryptToken(encBase64: string, ivHex: string): string {
  const data = Buffer.from(encBase64, 'base64');
  const ciphertext = data.subarray(0, data.length - AUTH_TAG_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
