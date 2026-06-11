import crypto from 'crypto';
import { config } from './config.js';

export function verifySquareSignature(rawBodyBuffer, signatureHeader) {
  if (!signatureHeader) return false;

  const rawBody = rawBodyBuffer.toString('utf8');
  const signedPayload = config.publicWebhookUrl + rawBody;
  const expected = crypto
    .createHmac('sha256', config.squareSignatureKey)
    .update(signedPayload, 'utf8')
    .digest('base64');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(signatureHeader, 'utf8');

  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
