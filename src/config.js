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
  categoryName: process.env.CATEGORY_NAME?.trim() || 'TCG Singles',
  discordWebhookUrl: required('DISCORD_WEBHOOK_URL'),
  roleMentionId: process.env.ROLE_MENTION_ID?.trim() || '',

  // Catalog behavior.
  // New category items still post. Existing catalog edits like price/name/image changes are ignored by default.
  announceAdds: bool('ANNOUNCE_ADDS', true),
  announceCatalogUpdates: bool('ANNOUNCE_CATALOG_UPDATES', false),
  // Legacy env var support. If someone already uses ANNOUNCE_UPDATES, only honor it when the newer var is absent.
  announceUpdates: bool('ANNOUNCE_CATALOG_UPDATES', bool('ANNOUNCE_UPDATES', false)),

  // Inventory behavior. Requires subscribing to Square's inventory.count.updated webhook event.
  announceQuantityUpdates: bool('ANNOUNCE_QUANTITY_UPDATES', true),
  announceSoldOut: bool('ANNOUNCE_SOLD_OUT', true),
  inventoryState: process.env.INVENTORY_STATE?.trim() || 'IN_STOCK',

  onlyAnnounceActiveItems: bool('ONLY_ANNOUNCE_ACTIVE_ITEMS', true),
  syncLookbackSeconds: Number(process.env.SYNC_LOOKBACK_SECONDS || 5),
  stateDir: process.env.STATE_DIR?.trim() || 'data',
  adminToken: process.env.ADMIN_TOKEN?.trim() || '',

  // Discord item display options.
  showItemImage: bool('SHOW_ITEM_IMAGE', true),

  // Link behavior.
  // Square's item_data.ecom_uri is deprecated and often missing. By default, we only link when Square gives us a direct URL.
  // LINK_MODE options:
  //   direct_only = use Square direct item URL only, no fallback
  //   none        = never include item links
  //   fallback    = use STORE_FALLBACK_URL if no direct URL exists
  //   search      = use STORE_SEARCH_URL?q=item-name if no direct URL exists
  //   template    = use STORE_ITEM_URL_TEMPLATE if no direct URL exists
  linkMode: (process.env.LINK_MODE || 'direct_only').trim().toLowerCase(),
  storeSearchUrl: process.env.STORE_SEARCH_URL?.trim() || '',
  storeFallbackUrl: process.env.STORE_FALLBACK_URL?.trim() || '',
  storeItemUrlTemplate: process.env.STORE_ITEM_URL_TEMPLATE?.trim() || ''
};
