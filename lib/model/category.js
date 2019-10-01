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
  4: 'Garage Door Opener',
  5: 'Lighting',
  6: 'Lock',
  7: 'Outlet',
  8: 'Switch',
  9: 'Thermostat',
  10: 'Sensor',
  11: 'Security System',
  12: 'Door',
  13: 'Window',
  14: 'Window Covering',
  15: 'Programmable Switch',
  // 16: reserved
  17: 'IP Camera',
  18: 'Video Doorbell',
  19: 'Air Purifier',
  20: 'Heater',
  21: 'Air Conditioner',
  22: 'Humidifier',
  23: 'Dehumidifier',
  // 24-27: reserved
  28: 'Sprinkler',
  29: 'Faucet',
  30: 'Shower System',
  // 31: reserved
  32: 'Remote',
  // 33+: reserved
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
