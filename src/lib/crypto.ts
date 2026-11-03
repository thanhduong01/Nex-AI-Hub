import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
function masterKey() {
  const key = Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('Invalid credential encryption configuration');
  return key;
}
export function encryptSecret(plaintext: string, connectionId: string) {
  const nonce = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', masterKey(), nonce);
  cipher.setAAD(Buffer.from(connectionId));
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    'v1',
    nonce.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join('.');
}
export function decryptSecret(encoded: string, connectionId: string) {
  const [version, nonce, tag, data] = encoded.split('.');
  if (version !== 'v1' || !nonce || !tag || !data) throw new Error('Invalid credential envelope');
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(nonce, 'base64'));
  decipher.setAAD(Buffer.from(connectionId));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}
