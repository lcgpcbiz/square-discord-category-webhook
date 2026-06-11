import { seedCurrentCatalogState } from './seedCatalog.js';

const result = await seedCurrentCatalogState();
console.log(`Seeded ${result.totalItemsSeeded} items. ${result.watchedCategoryItems} are currently in ${result.categoryName}.`);
console.log('No Discord notifications were sent. Future category additions/updates will be announced.');
