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
  return data.ecom_uri || data.external_url || null;
}
