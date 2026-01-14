// js/data.js
const cache = new Map();

export async function loadCsvOnce(key, path) {
  if (cache.has(key)) return cache.get(key);
  const rows = await d3.csv(path);
  cache.set(key, rows);
  return rows;
}
