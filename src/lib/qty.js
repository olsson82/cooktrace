/**
 * qty.js — quantity string parsing + formatting for recipe scaling.
 *
 * Recipe ingredient quantities are stored as free-text strings ("1",
 * "1/2", "1 1/2", "0.5", "to taste") so the user can write whatever feels
 * natural. parseQty() extracts a number when it can; formatQty() turns a
 * number back into a friendly string snapped to common cooking fractions.
 *
 * If parseQty() returns null (e.g. "to taste"), the qty passes through
 * unchanged on scaling — never silently become "NaN" or "0".
 */

const COMMON_FRACTIONS = [
  [1/8, '1/8'], [1/4, '1/4'], [1/3, '1/3'], [3/8, '3/8'],
  [1/2, '1/2'], [5/8, '5/8'], [2/3, '2/3'], [3/4, '3/4'], [7/8, '7/8'],
];
const FRAC_TOL = 0.03;

export function parseQty(s) {
  if (s == null) return null;
  let str = String(s).trim();
  if (!str) return null;

  // Normalize "1 and 1/2" → "1 1/2" — recipe sites (and recipe-scrapers'
  // raw output) sometimes write mixed numbers conjunctively. Without
  // this, the qty regex below would only catch the leading integer and
  // the fraction would leak into the unit slot.
  str = str.replace(/^(\d+)\s+and\s+(\d+\s*\/\s*\d+)$/i, '$1 $2');

  // Mixed numbers: "1 1/2"
  const mixed = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const n = parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
    return Number.isFinite(n) ? n : null;
  }

  // Plain fraction: "1/2"
  const frac = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const n = parseInt(frac[1], 10) / parseInt(frac[2], 10);
    return Number.isFinite(n) && n !== Infinity ? n : null;
  }

  // Plain number: "1.5", "2"
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export function formatQty(n) {
  if (n == null || !Number.isFinite(n)) return '';
  if (n < 0) return n.toString();

  const wholes = Math.floor(n);
  const frac = n - wholes;

  if (frac < FRAC_TOL)       return String(wholes);
  if (1 - frac < FRAC_TOL)   return String(wholes + 1);

  for (const [val, str] of COMMON_FRACTIONS) {
    if (Math.abs(frac - val) < FRAC_TOL) {
      return wholes ? `${wholes} ${str}` : str;
    }
  }

  // Fall back to a decimal — trim trailing zeros, max 2 decimals.
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Scale a quantity string by a factor. Unparseable quantities ("to
 * taste") pass through unchanged.
 */
export function scaleQty(s, factor) {
  if (factor === 1 || factor == null) return s;
  const n = parseQty(s);
  if (n == null) return s;
  return formatQty(n * factor);
}

/**
 * Cooking units where decimals read awkwardly and fractions are the
 * vernacular: 0.25 cup → 1/4 cup, 0.5 tsp → 1/2 tsp, 1.5 tbsp → 1 1/2
 * tbsp. Weight units (g, oz, lb, kg, mg) and metric volume (ml, l)
 * stay as decimals because that's how the world weighs them.
 */
const FRACTION_UNITS = new Set([
  'tsp', 'tbsp', 'cup', 'pt', 'qt', 'gal', 'fl oz',
]);

/**
 * Display-time quantity formatter that respects the unit. Combines
 * scaling + fraction snapping in one shot:
 *
 *   - "0.25" + "cup" → "1/4"
 *   - "0.5"  + "tsp" → "1/2"
 *   - "1.5"  + "g"   → "1.5"
 *   - "100"  + "g"   → "100"
 *   - "to taste" + anything → "to taste" (passthrough)
 *
 * Intended for read-only contexts (RecipeView, PublicRecipe). The
 * editor still stores the user's typed string verbatim.
 */
export function displayQty(qty, unit, scale = 1) {
  if (qty == null || qty === '') return '';
  const n = parseQty(qty);
  // Unparseable ("to taste", "a pinch") — pass through, scaled or not.
  if (n == null) return String(qty);
  const scaled = n * (scale || 1);
  const u = (unit || '').toLowerCase().trim();
  if (FRACTION_UNITS.has(u)) {
    return formatQty(scaled);
  }
  // Weight / metric-volume / count: keep as decimal, trimmed.
  if (Number.isInteger(scaled)) return String(scaled);
  return scaled.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Same logic as displayQty but returns the result split into a whole
 * number part and a fraction part so callers can style them
 * separately (e.g. render the fraction at a smaller font size, like
 * "1 ½" in cookbook typography).
 *
 * Shape: { whole: string|'', fraction: string|'' }
 *  - "1 1/2" → { whole: '1', fraction: '1/2' }
 *  - "1/2"   → { whole: '',  fraction: '1/2' }
 *  - "2"     → { whole: '2', fraction: '' }
 *  - "0.5"   → { whole: '0.5', fraction: '' }    (decimal — no split)
 *  - ''      → { whole: '',  fraction: '' }
 */
export function displayQtyParts(qty, unit, scale = 1) {
  const s = displayQty(qty, unit, scale);
  if (!s) return { whole: '', fraction: '' };
  // Mixed number: "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+\/\d+)$/);
  if (mixed) return { whole: mixed[1], fraction: mixed[2] };
  // Pure fraction: "1/2"
  if (/^\d+\/\d+$/.test(s)) return { whole: '', fraction: s };
  // Anything else (integer, decimal, "to taste") — keep whole.
  return { whole: s, fraction: '' };
}
