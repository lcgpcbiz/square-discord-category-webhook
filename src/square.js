import { config } from './config.js';
import { itemImageIds, legacyEcomImageUrls } from './catalogLogic.js';

const BASE_URL = config.squareEnvironment === 'sandbox'
  ? 'https://connect.squareupsandbox.com'
  : 'https://connect.squareup.com';

export async function squareFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${config.squareAccessToken}`,
      'Square-Version': config.squareApiVersion,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = json?.errors?.map(e => `${e.category || ''} ${e.code || ''}: ${e.detail || ''}`.trim()).join('; ') || text;
    throw new Error(`Square API ${response.status} ${response.statusText}: ${message}`);
  }
  return json;
}

export async function listCatalogObjects(types, extraBody = {}) {
  const objects = [];
  let cursor;
  do {
    const body = {
      object_types: types,
      include_deleted_objects: false,
      ...extraBody,
      ...(cursor ? { cursor } : {})
    };
    const result = await squareFetch('/v2/catalog/search', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    objects.push(...(result.objects || []));
    cursor = result.cursor;
  } while (cursor);
  return objects;
}

export async function retrieveCatalogObject(id, includeRelatedObjects = false) {
  const result = await squareFetch(`/v2/catalog/object/${encodeURIComponent(id)}?include_related_objects=${includeRelatedObjects ? 'true' : 'false'}`, {
    method: 'GET'
  });
  return result.object;
}

export async function resolveCategoryId() {
  if (config.categoryId) return config.categoryId;

  const categories = await listCatalogObjects(['CATEGORY']);
  const match = categories.find(c =>
    c.category_data?.name?.trim().toLowerCase() === config.categoryName.trim().toLowerCase()
  );

  if (!match) {
    const names = categories.map(c => c.category_data?.name).filter(Boolean).join(', ');
    throw new Error(`Could not find Square category named "${config.categoryName}". Found categories: ${names || '(none)'}`);
  }

  return match.id;
}

export async function getChangedItemCandidates(beginTime) {
  const body = {};
  if (beginTime) body.begin_time = beginTime;

  const changed = await listCatalogObjects(['ITEM', 'ITEM_VARIATION'], body);
  const itemMap = new Map();

  for (const object of changed) {
    if (object.type === 'ITEM') {
      itemMap.set(object.id, object);
      continue;
    }

    if (object.type === 'ITEM_VARIATION') {
      const parentId = object.item_variation_data?.item_id;
      if (!parentId || itemMap.has(parentId)) continue;
      try {
        const parent = await retrieveCatalogObject(parentId);
        if (parent?.type === 'ITEM') itemMap.set(parentId, parent);
      } catch (error) {
        console.warn(`Could not retrieve parent item ${parentId}: ${error.message}`);
      }
    }
  }

  return [...itemMap.values()];
}

export async function getAllCurrentItems() {
  return await listCatalogObjects(['ITEM']);
}

export async function getFirstItemImageUrl(item) {
  const imageIds = itemImageIds(item);

  for (const imageId of imageIds) {
    try {
      const image = await retrieveCatalogObject(imageId);
      const url = image?.image_data?.url;
      if (url) return url;
    } catch (error) {
      console.warn(`Could not retrieve Square image ${imageId}: ${error.message}`);
    }
  }

  // Older Square Online catalogs may expose these legacy image URLs.
  const legacyUrls = legacyEcomImageUrls(item);
  if (legacyUrls.length) return legacyUrls[0];

  return null;
}
