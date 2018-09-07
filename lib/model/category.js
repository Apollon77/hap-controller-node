/**
 * Accessory categories.
 *
 * See Chapter 12.2
 */
'use strict';

const CategoryMapById = {
  1: 'Other',
  2: 'Bridge',
  3: 'Fan',
  4: 'Garage',
  5: 'Lightbulb',
  6: 'Door Lock',
  7: 'Outlet',
  8: 'Switch',
  9: 'Thermostat',
  10: 'Sensor',
  11: 'Security System',
  12: 'Door',
  13: 'Window',
  14: 'Window Covering',
  15: 'Programmable Switch',
  16: 'Range Extender',
  17: 'IP Camera',
  18: 'Video Door Bell',
  19: 'Air Purifier',
};

const CategoryMapByCategory = Object.assign(
  {},
  ...Object.entries(CategoryMapById).map(([a, b]) => ({[b]: a}))
);

/**
 * Get a category name from its Accessory Category Identifier.
 *
 * @param {number} id - Accessory Category Identifier
 * @returns {string} Category name
 */
function categoryFromId(id) {
  return CategoryMapById[id] || 'Unknown';
}

/**
 * Get an Accessory Category Identifier from its name.
 *
 * @param {string} category - Category name
 * @returns {number} Accessory Category Identifier
 */
function idFromCategory(category) {
  return CategoryMapByCategory[category] || 1;
}

module.exports = {
  categoryFromId,
  idFromCategory,
};
