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

export function variationIds(item) {
  return (item.item_data?.variations || [])
    .map(v => v.id)
    .filter(Boolean);
}

export function itemSnapshot(item, inWatchedCategory, inventoryCounts = {}) {
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
    inventoryCounts,
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

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function subcategoryLinks() {
  if (config.subcategoryLinksJson) {
    try {
      const parsed = JSON.parse(config.subcategoryLinksJson);
      if (Array.isArray(parsed)) {
        return parsed
          .map(entry => ({
            id: String(entry.id || '').trim(),
            name: String(entry.name || '').trim(),
            url: String(entry.url || '').trim()
          }))
          .filter(entry => entry.id && entry.name);
      }
    } catch (error) {
      console.warn(`Invalid SUBCATEGORY_LINKS_JSON. Falling back to default subcategory links. ${error.message}`);
    }
  }

  return config.defaultSubcategoryLinks || [];
}

export function itemSubcategory(item) {
  const ids = itemCategoryIds(item);

  for (const link of subcategoryLinks()) {
    if (ids.has(link.id)) return link;
  }

  return null;
}

export function categoryUrl(categoryLink) {
  if (!categoryLink) return null;
  if (categoryLink.url) return categoryLink.url;

  const template = config.storeCategoryUrlTemplate || '';
  if (template) {
    return template
      .replaceAll('{category_id}', encodeURIComponent(categoryLink.id || ''))
      .replaceAll('{category_name}', encodeURIComponent(categoryLink.name || ''))
      .replaceAll('{category_slug}', encodeURIComponent(slugify(categoryLink.name || '')));
  }

  const base = (config.storeBaseUrl || config.storeFallbackUrl || '').replace(/\/$/, '');
  if (!base) return null;
  return `${base}/s/shop?category_ids=${encodeURIComponent(categoryLink.id)}`;
}

export function itemSubcategoryUrl(item) {
  return categoryUrl(itemSubcategory(item));
}

export function itemUrl(item, variation = null) {
  if (config.linkMode === 'none') return null;

  const data = item.item_data || {};
  const directUrl = data.ecom_uri || data.external_url || null;
  const subcategoryUrl = itemSubcategoryUrl(item);

  if (config.linkMode === 'category') {
    return subcategoryUrl || directUrl || null;
  }

  if (config.linkMode === 'direct_then_category') {
    return directUrl || subcategoryUrl || null;
  }

  if (config.linkMode === 'direct_only') {
    return directUrl || null;
  }

  const itemName = data.name || '';
  const variationName = variation?.item_variation_data?.name || '';

  if (config.linkMode === 'template' && config.storeItemUrlTemplate) {
    return config.storeItemUrlTemplate
      .replaceAll('{item_id}', encodeURIComponent(item.id || ''))
      .replaceAll('{variation_id}', encodeURIComponent(variation?.id || ''))
      .replaceAll('{name}', encodeURIComponent(itemName))
      .replaceAll('{slug}', encodeURIComponent(slugify(itemName)))
      .replaceAll('{variation_name}', encodeURIComponent(variationName))
      .replaceAll('{variation_slug}', encodeURIComponent(slugify(variationName)));
  }

  if (config.linkMode === 'search' && config.storeSearchUrl) {
    const separator = config.storeSearchUrl.includes('?') ? '&' : '?';
    return `${config.storeSearchUrl}${separator}q=${encodeURIComponent(itemName)}`;
  }

  if (config.linkMode === 'fallback' && config.storeFallbackUrl) {
    return config.storeFallbackUrl;
  }

  return directUrl || subcategoryUrl || null;
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

export function inventoryKey(count) {
  return [count.catalog_object_id, count.location_id || 'unknown', count.state || config.inventoryState].join('|');
}

export function parseQuantity(quantity) {
  const value = Number(quantity ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function countsToInventoryMap(counts = []) {
  const map = {};
  for (const count of counts) {
    if (!count?.catalog_object_id) continue;
    const key = inventoryKey(count);
    map[key] = {
      variationId: count.catalog_object_id,
      locationId: count.location_id || '',
      state: count.state || config.inventoryState,
      quantity: parseQuantity(count.quantity),
      calculatedAt: count.calculated_at || new Date().toISOString()
    };
  }
  return map;
}

export function applyInventoryCount(inventoryCounts = {}, count) {
  const next = { ...inventoryCounts };
  const key = inventoryKey(count);
  next[key] = {
    variationId: count.catalog_object_id,
    locationId: count.location_id || '',
    state: count.state || config.inventoryState,
    quantity: parseQuantity(count.quantity),
    calculatedAt: count.calculated_at || new Date().toISOString()
  };
  return next;
}

export function totalQuantityForVariation(inventoryCounts = {}, variationId) {
  let total = 0;
  let seen = false;
  for (const entry of Object.values(inventoryCounts || {})) {
    if (entry?.variationId === variationId && entry?.state === config.inventoryState) {
      total += parseQuantity(entry.quantity);
      seen = true;
    }
  }
  return seen ? total : null;
}

export function variationName(item, variationId) {
  const variation = (item.item_data?.variations || []).find(v => v.id === variationId);
  const name = variation?.item_variation_data?.name;
  return name && name !== 'Regular' ? name : '';
}
