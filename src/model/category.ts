/**
 * Accessory categories.
 *
 * See Chapter 12.2
 */

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
  16: 'Range Extender',
  17: 'IP Camera',
  18: 'Video Doorbell',
  19: 'Air Purifier',
  20: 'Heater',
  21: 'Air Conditioner',
  22: 'Humidifier',
  23: 'Dehumidifier',
  24: 'Apple TV',
  25: 'HomePod',
  26: 'Speaker',
  27: 'AirPort',
  28: 'Sprinkler',
  29: 'Faucet',
  30: 'Shower System',
  31: 'Television',
  32: 'Remote',
  33: 'Router',
};

const CategoryMapByCategory = Object.assign(
  {},
  ...Object.entries(CategoryMapById).map(([a, b]) => ({ [b]: a }))
);

/**
 * Get a category name from its Accessory Category Identifier.
 *
 * @param {number} id - Accessory Category Identifier
 * @returns {string} Category name
 */
export function categoryFromId(id: number): string {
  return CategoryMapById[<keyof typeof CategoryMapById>id] || 'Unknown';
}

/**
 * Get an Accessory Category Identifier from its name.
 *
 * @param {string} category - Category name
 * @returns {number} Accessory Category Identifier
 */
export function idFromCategory(category: string): number {
  return CategoryMapByCategory[category] || 1;
}
