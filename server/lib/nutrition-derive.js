/**
 * nutrition-derive.js — sodium ↔ salt auto-conversion.
 *
 * Used by the recipes + pantry routes whenever a nutrition object is
 * persisted. If the user filled one of {sodium, salt} but not the
 * other, the missing field is filled in via the EU regulatory factor
 * (sodium_mg = salt_g × 400). The derived field gets tagged in
 * `nutrition._derived` so the UI can show a small calculator icon
 * next to the auto-filled value.
 */
const SODIUM_MG_PER_SALT_G = 400;

function _isPresent(v) { return v != null && v !== '' && Number(v) > 0; }

export function deriveSodiumSalt(nutrition) {
  if (!nutrition || typeof nutrition !== 'object') return nutrition;
  const hasSodium = _isPresent(nutrition.sodium);
  const hasSalt   = _isPresent(nutrition.salt);
  if (hasSodium === hasSalt) return nutrition;
  if (!nutrition._derived || typeof nutrition._derived !== 'object') {
    nutrition._derived = {};
  } else {
    delete nutrition._derived.sodium;
    delete nutrition._derived.salt;
  }
  if (hasSodium && !hasSalt) {
    nutrition.salt = Math.round((Number(nutrition.sodium) / SODIUM_MG_PER_SALT_G) * 1000) / 1000;
    nutrition._derived.salt = true;
  } else if (hasSalt && !hasSodium) {
    nutrition.sodium = Math.round(Number(nutrition.salt) * SODIUM_MG_PER_SALT_G * 10) / 10;
    nutrition._derived.sodium = true;
  }
  return nutrition;
}
