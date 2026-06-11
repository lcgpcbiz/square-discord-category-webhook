import dotenv from 'dotenv';
dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing required env var: ${name}`);
  return value.trim();
}

function bool(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'y', 'on'].includes(raw.toLowerCase());
}

export const config = {
  port: Number(process.env.PORT || 3000),
  publicWebhookUrl: required('PUBLIC_WEBHOOK_URL'),
  squareEnvironment: (process.env.SQUARE_ENVIRONMENT || 'production').toLowerCase(),
  squareAccessToken: required('SQUARE_ACCESS_TOKEN'),
  squareSignatureKey: required('SQUARE_SIGNATURE_KEY'),
  squareApiVersion: process.env.SQUARE_API_VERSION || '2026-05-20',
  categoryId: process.env.CATEGORY_ID?.trim() || '',
  categoryName: process.env.CATEGORY_NAME?.trim() || 'Singles',
  discordWebhookUrl: required('DISCORD_WEBHOOK_URL'),
  roleMentionId: process.env.ROLE_MENTION_ID?.trim() || '',
  announceAdds: bool('ANNOUNCE_ADDS', true),
  announceUpdates: bool('ANNOUNCE_UPDATES', true),
  onlyAnnounceActiveItems: bool('ONLY_ANNOUNCE_ACTIVE_ITEMS', true),
  syncLookbackSeconds: Number(process.env.SYNC_LOOKBACK_SECONDS || 5),
  stateDir: process.env.STATE_DIR?.trim() || 'data',
  adminToken: process.env.ADMIN_TOKEN?.trim() || '',

  // Discord item display options.
  showItemImage: bool('SHOW_ITEM_IMAGE', true),

  // Square may return item_data.ecom_uri for some Online items, but that field is deprecated.
  // If no item-level URL is available, use one of these optional fallbacks.
  // STORE_SEARCH_URL example: https://lctcg.com/s/search
  // STORE_FALLBACK_URL example: https://lctcg.com/s/shop
  storeSearchUrl: process.env.STORE_SEARCH_URL?.trim() || '',
  storeFallbackUrl: process.env.STORE_FALLBACK_URL?.trim() || ''
};
