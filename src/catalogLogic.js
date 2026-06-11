import { config } from './config.js';

export function itemCategoryIds(item) {
  const data = item.item_data || {};
  const ids = new Set();

  // Current Square category model.
  for (const category of data.categories || []) {
    if (category?.id) ids.add(category.id);
  }

  // Backward compatibility for older catalog data.
  if (data.category_id) ids.add(data.category_id);

  return ids;
}

export function itemIsInCategory(item, categoryId) {
  return itemCategoryIds(item).has(categoryId);
}

export function itemIsActive(item) {
  if (item.is_deleted) return false;
  const data = item.item_data || {};
  if (data.is_archived) return false;
  return true;
}

export function itemSnapshot(item, inWatchedCategory) {
  const variations = item.item_data?.variations || [];
  const variationVersions = {};
  for (const variation of variations) {
    variationVersions[variation.id] = variation.version || null;
  }

  return {
    id: item.id,
    name: item.item_data?.name || '(Unnamed Square item)',
    version: item.version || null,
    inWatchedCategory,
    variationVersions,
    updatedAt: item.updated_at || new Date().toISOString()
  };
}

export function snapshotChanged(previous, next) {
  if (!previous) return true;
  if (previous.version !== next.version) return true;
  const prevVar = previous.variationVersions || {};
  const nextVar = next.variationVersions || {};
  const allIds = new Set([...Object.keys(prevVar), ...Object.keys(nextVar)]);
  for (const id of allIds) {
    if (prevVar[id] !== nextVar[id]) return true;
  }
  return false;
}

export function cheapestPriceText(item) {
  const variations = item.item_data?.variations || [];
  const amounts = variations
    .map(v => v.item_variation_data?.price_money)
    .filter(Boolean)
    .filter(m => typeof m.amount === 'number');

  if (!amounts.length) return 'Price not listed';
  amounts.sort((a, b) => a.amount - b.amount);
  const min = amounts[0];
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: min.currency || 'USD'
  }).format(min.amount / 100);
}

export function skuText(item) {
  const variations = item.item_data?.variations || [];
  const skus = variations
    .map(v => v.item_variation_data?.sku)
    .filter(Boolean);
  if (!skus.length) return 'No SKU listed';
  return skus.slice(0, 4).join(', ') + (skus.length > 4 ? `, +${skus.length - 4} more` : '');
}

export function itemUrl(item) {
  const data = item.item_data || {};

  // Square has historically returned ecom_uri for published Square Online products,
  // but Square marks it as deprecated. Use it when present, then fall back below.
  if (data.ecom_uri) return data.ecom_uri;
  if (data.external_url) return data.external_url;

  // If you provide a search page URL, link to a search for the item name.
  // Example: STORE_SEARCH_URL=https://lctcg.com/s/search
  if (config.storeSearchUrl) {
    const separator = config.storeSearchUrl.includes('?') ? '&' : '?';
    const name = data.name || '';
    return `${config.storeSearchUrl}${separator}q=${encodeURIComponent(name)}`;
  }

  // Last resort: link to your store/category page.
  if (config.storeFallbackUrl) return config.storeFallbackUrl;

  return null;
}

export function itemImageIds(item) {
  const ids = [];
  const seen = new Set();

  function add(id) {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  }

  for (const id of item.item_data?.image_ids || []) add(id);

  for (const variation of item.item_data?.variations || []) {
    for (const id of variation.item_variation_data?.image_ids || []) add(id);
  }

  return ids;
}

export function legacyEcomImageUrls(item) {
  const raw = item.item_data?.ecom_image_uris;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}
