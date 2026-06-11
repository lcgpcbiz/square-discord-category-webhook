import { config } from './config.js';
import { getAllCurrentItems, getInventoryCountsForItem, resolveCategoryId } from './square.js';
import { countsToInventoryMap, itemIsActive, itemIsInCategory, itemSnapshot } from './catalogLogic.js';
import { saveState } from './state.js';

export async function seedCurrentCatalogState() {
  const categoryId = await resolveCategoryId();
  const items = await getAllCurrentItems();
  const state = { lastSyncAt: new Date().toISOString(), lastInventoryEventAt: null, items: {} };
  let inCategoryCount = 0;
  let inventoryCountsSeeded = 0;

  for (const item of items) {
    if (config.onlyAnnounceActiveItems && !itemIsActive(item)) continue;
    const inCategory = itemIsInCategory(item, categoryId);
    let inventoryCounts = {};

    if (inCategory) {
      inCategoryCount++;
      const counts = await getInventoryCountsForItem(item).catch(error => {
        console.warn(`Could not retrieve inventory for item ${item.id}: ${error.message}`);
        return [];
      });
      inventoryCountsSeeded += counts.length;
      inventoryCounts = countsToInventoryMap(counts);
    }

    state.items[item.id] = itemSnapshot(item, inCategory, inventoryCounts);
  }

  await saveState(state);
  return {
    totalItemsSeeded: Object.keys(state.items).length,
    watchedCategoryItems: inCategoryCount,
    inventoryCountsSeeded,
    categoryName: config.categoryName,
    categoryId,
    lastSyncAt: state.lastSyncAt
  };
}
