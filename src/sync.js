import { config } from './config.js';
import {
  getChangedItemCandidates,
  getInventoryCountsForItem,
  resolveCategoryId,
  retrieveVariationAndParentItem
} from './square.js';
import { loadState, saveState, subtractSeconds } from './state.js';
import {
  applyInventoryCount,
  countsToInventoryMap,
  itemIsActive,
  itemIsInCategory,
  itemSnapshot,
  snapshotChanged,
  totalQuantityForVariation
} from './catalogLogic.js';
import { postDiscordInventoryNotice, postDiscordItemNotice } from './discord.js';

export async function syncChangedCatalogObjects(webhookUpdatedAt = null) {
  const state = await loadState();
  const categoryId = await resolveCategoryId();

  const beginTime = subtractSeconds(state.lastSyncAt, config.syncLookbackSeconds);
  const candidates = await getChangedItemCandidates(beginTime);

  let announced = 0;
  let checked = 0;

  for (const item of candidates) {
    checked++;

    if (config.onlyAnnounceActiveItems && !itemIsActive(item)) {
      state.items[item.id] = itemSnapshot(item, false, state.items[item.id]?.inventoryCounts || {});
      continue;
    }

    const inCategory = itemIsInCategory(item, categoryId);
    const previous = state.items[item.id] || null;
    const currentInventory = previous?.inventoryCounts || {};
    const next = itemSnapshot(item, inCategory, currentInventory);

    if (!inCategory) {
      state.items[item.id] = next;
      continue;
    }

    const wasInCategory = previous?.inWatchedCategory === true;
    const changed = snapshotChanged(previous, next);

    if (!wasInCategory) {
      const counts = await getInventoryCountsForItem(item).catch(error => {
        console.warn(`Could not retrieve inventory for new item ${item.id}: ${error.message}`);
        return [];
      });
      const inventoryCounts = countsToInventoryMap(counts);
      state.items[item.id] = itemSnapshot(item, true, inventoryCounts);

      if (config.announceAdds) {
        await postDiscordItemNotice(item, 'added');
        announced++;
      }
      continue;
    }

    // Existing catalog changes, like price edits, should normally be ignored.
    if (changed && config.announceUpdates) {
      await postDiscordItemNotice(item, 'updated');
      announced++;
    }

    state.items[item.id] = next;
  }

  state.lastSyncAt = webhookUpdatedAt || new Date().toISOString();
  await saveState(state);

  return { checked, announced, categoryId, lastSyncAt: state.lastSyncAt, type: 'catalog' };
}

export async function syncInventoryCountEvent(event) {
  const state = await loadState();
  const categoryId = await resolveCategoryId();
  const counts = event.data?.object?.inventory_counts || [];

  let checked = 0;
  let announced = 0;
  let skipped = 0;

  for (const count of counts) {
    checked++;

    if (count.catalog_object_type && count.catalog_object_type !== 'ITEM_VARIATION') {
      skipped++;
      continue;
    }

    if (count.state !== config.inventoryState) {
      skipped++;
      continue;
    }

    const variationId = count.catalog_object_id;
    if (!variationId) {
      skipped++;
      continue;
    }

    let item;
    let variation;
    try {
      ({ item, variation } = await retrieveVariationAndParentItem(variationId));
    } catch (error) {
      console.warn(`Could not retrieve item for variation ${variationId}: ${error.message}`);
      skipped++;
      continue;
    }

    if (config.onlyAnnounceActiveItems && !itemIsActive(item)) {
      skipped++;
      continue;
    }

    const inCategory = itemIsInCategory(item, categoryId);
    if (!inCategory) {
      skipped++;
      continue;
    }

    const previousSnapshot = state.items[item.id] || itemSnapshot(item, true, {});
    const previousInventory = previousSnapshot.inventoryCounts || {};
    const previousTotal = totalQuantityForVariation(previousInventory, variationId);
    const nextInventory = applyInventoryCount(previousInventory, count);
    const nextTotal = totalQuantityForVariation(nextInventory, variationId);

    state.items[item.id] = itemSnapshot(item, true, nextInventory);

    // First time seeing this variation/location after a fresh deploy or missing seed: record it, don't spam.
    if (previousTotal === null || previousTotal === undefined) {
      continue;
    }

    if (previousTotal === nextTotal) {
      continue;
    }

    const soldOut = previousTotal > 0 && nextTotal <= 0;
    const quantityChanged = previousTotal !== nextTotal;

    if (soldOut && config.announceSoldOut) {
      await postDiscordInventoryNotice(item, variation, previousTotal, nextTotal);
      announced++;
    } else if (!soldOut && quantityChanged && config.announceQuantityUpdates) {
      await postDiscordInventoryNotice(item, variation, previousTotal, nextTotal);
      announced++;
    }
  }

  state.lastInventoryEventAt = event.created_at || new Date().toISOString();
  await saveState(state);

  return { checked, skipped, announced, categoryId, type: 'inventory' };
}
