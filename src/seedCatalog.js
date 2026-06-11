import { config } from './config.js';
import { getAllCurrentItems, resolveCategoryId } from './square.js';
import { itemIsActive, itemIsInCategory, itemSnapshot } from './catalogLogic.js';
import { saveState } from './state.js';

export async function seedCurrentCatalogState() {
  const categoryId = await resolveCategoryId();
  const items = await getAllCurrentItems();
  const state = { lastSyncAt: new Date().toISOString(), items: {} };
  let inCategoryCount = 0;

  for (const item of items) {
    if (config.onlyAnnounceActiveItems && !itemIsActive(item)) continue;
    const inCategory = itemIsInCategory(item, categoryId);
    if (inCategory) inCategoryCount++;
    state.items[item.id] = itemSnapshot(item, inCategory);
  }

  await saveState(state);
  return {
    totalItemsSeeded: Object.keys(state.items).length,
    watchedCategoryItems: inCategoryCount,
    categoryName: config.categoryName,
    categoryId,
    lastSyncAt: state.lastSyncAt
  };
}
