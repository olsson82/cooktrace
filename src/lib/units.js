/**
 * units.js — canonical cooking unit catalog.
 *
 * Stored value is the short abbreviation (the field saves "tsp", not
 * "teaspoon"). Display in pickers shows the full name plus the abbr.
 *
 * Free-text is still allowed everywhere — anything not in this list
 * (e.g. "splash", "drizzle", "to taste") stays as the user typed it.
 */

export const UNIT_GROUPS = [
  {
    label: 'Volume — US',
    units: [
      { abbr: 'tsp',   full: 'teaspoon' },
      { abbr: 'tbsp',  full: 'tablespoon' },
      { abbr: 'fl oz', full: 'fluid ounce' },
      { abbr: 'cup',   full: 'cup' },
      { abbr: 'pt',    full: 'pint' },
      { abbr: 'qt',    full: 'quart' },
      { abbr: 'gal',   full: 'gallon' },
    ],
  },
  {
    label: 'Volume — Metric',
    units: [
      { abbr: 'ml', full: 'milliliter' },
      { abbr: 'cl', full: 'centiliter' },
      { abbr: 'dl', full: 'deciliter' },
      { abbr: 'l',  full: 'liter' },
    ],
  },
  {
    label: 'Weight — US',
    units: [
      { abbr: 'oz', full: 'ounce' },
      { abbr: 'lb', full: 'pound' },
    ],
  },
  {
    label: 'Weight — Metric',
    units: [
      { abbr: 'mg', full: 'milligram' },
      { abbr: 'g',  full: 'gram' },
      { abbr: 'kg', full: 'kilogram' },
    ],
  },
  {
    label: 'Count / descriptive',
    units: [
      { abbr: 'pc',       full: 'piece' },
      { abbr: 'whole',    full: 'whole' },
      { abbr: 'clove',    full: 'clove' },
      { abbr: 'sprig',    full: 'sprig' },
      { abbr: 'slice',    full: 'slice' },
      { abbr: 'stick',    full: 'stick' },
      { abbr: 'pinch',    full: 'pinch' },
      { abbr: 'dash',     full: 'dash' },
      { abbr: 'drop',     full: 'drop' },
      { abbr: 'splash',   full: 'splash' },
      { abbr: 'handful',  full: 'handful' },
      { abbr: 'bunch',    full: 'bunch' },
      { abbr: 'head',     full: 'head' },
      { abbr: 'stalk',    full: 'stalk' },
      { abbr: 'can',      full: 'can' },
      { abbr: 'jar',      full: 'jar' },
      { abbr: 'bottle',   full: 'bottle' },
      { abbr: 'pkg',      full: 'package' },
      { abbr: 'box',      full: 'box' },
      { abbr: 'bag',      full: 'bag' },
      { abbr: 'to taste', full: 'to taste' },
    ],
  },
];

/**
 * Merge the server-side units overlay into the built-in catalog.
 *
 * Args:
 *   overlay = { disabled: string[] of abbrs, custom: [{abbr, full_name, category}] }
 *
 * Built-ins matching `disabled` are filtered out (groups with zero
 * remaining units are dropped). Customs are grouped by their stored
 * `category`: ones whose category exactly matches a built-in group
 * label are merged into that group; everything else lands in a single
 * "Custom" group at the top.
 */
export function unitGroupsMerged(overlay) {
  const disabled = new Set((overlay?.disabled || []).map(s => String(s)));
  const customs  = Array.isArray(overlay?.custom) ? overlay.custom : [];

  // Bucket customs by their declared category.
  const customByCategory = new Map();
  const looseCustoms = [];
  for (const c of customs) {
    const u = { abbr: c.abbr, full: c.full_name || c.abbr };
    const cat = String(c.category || '').trim();
    if (!cat || cat === 'Custom') { looseCustoms.push(u); continue; }
    const arr = customByCategory.get(cat);
    if (arr) arr.push(u);
    else customByCategory.set(cat, [u]);
  }

  // Walk built-in groups, filter disabled, and append matching customs.
  const groups = [];
  for (const g of UNIT_GROUPS) {
    const remaining = g.units.filter(u => !disabled.has(u.abbr));
    const extras = customByCategory.get(g.label) || [];
    const merged = [...remaining, ...extras];
    if (merged.length > 0) groups.push({ label: g.label, units: merged });
    customByCategory.delete(g.label);
  }
  // Anything still in customByCategory is for an unknown category name —
  // treat as Custom-bucket entries.
  for (const arr of customByCategory.values()) looseCustoms.push(...arr);

  if (looseCustoms.length > 0) {
    groups.unshift({ label: 'Custom', units: looseCustoms });
  }
  return groups;
}
