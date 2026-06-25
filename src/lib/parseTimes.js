/**
 * parseTimes — find duration mentions in step text so we can render
 * inline ▶ buttons next to them.
 *
 * Patterns matched (case-insensitive, with word boundaries so we don't
 * grab "minute" inside other words):
 *   "30 min" / "30 minutes" / "30m"
 *   "2 hours" / "2 hr" / "2 h"
 *   "1 hour 30 min" (combined → 90 min)
 *   "30 to 45 min" / "30-45 min" → uses the lower bound (safer)
 *   "1.5 hours" / "1 1/2 hours"
 *
 * Returns an array of `{ start, end, durationSec, label }` matches in
 * text-order, non-overlapping. The caller can splice play buttons in
 * around each match.
 */

// One token: "<num> <unit>". Captures the number and the unit class.
// Numbers can be integer, decimal, or "1 1/2" mixed fractions, or just
// a fraction like "1/2".
const NUM = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)`;
const UNIT_HOUR = '(?:hours?|hrs?|h)\\b';
const UNIT_MIN  = '(?:minutes?|mins?|m)\\b';
const UNIT_SEC  = '(?:seconds?|secs?|s)\\b';

// Combined "X hours Y min". The Y portion is optional.
const HOUR_TOKEN = `${NUM}\\s*${UNIT_HOUR}`;
const MIN_TOKEN  = `${NUM}\\s*${UNIT_MIN}`;
const SEC_TOKEN  = `${NUM}\\s*${UNIT_SEC}`;

// Range: "30 to 45 minutes" / "30-45 min". Take the smaller value so
// the timer lands on the early end (cooks would rather check early).
const RANGE_MIN = `${NUM}\\s*(?:to|-|–)\\s*${NUM}\\s*${UNIT_MIN}`;
const RANGE_HOUR = `${NUM}\\s*(?:to|-|–)\\s*${NUM}\\s*${UNIT_HOUR}`;
const RANGE_SEC = `${NUM}\\s*(?:to|-|–)\\s*${NUM}\\s*${UNIT_SEC}`;

// Master regex: try the most specific first. Order matters: combined
// hour+min beats lone hour, range beats lone min.
const PATTERN = new RegExp(
  '(' +
    `${HOUR_TOKEN}\\s+${MIN_TOKEN}` + '|' +
    RANGE_MIN + '|' + RANGE_HOUR + '|' + RANGE_SEC + '|' +
    HOUR_TOKEN + '|' + MIN_TOKEN + '|' + SEC_TOKEN +
  ')',
  'gi'
);

function _parseNumeric(s) {
  if (!s) return NaN;
  const t = String(s).trim();
  // Mixed fraction "1 1/2"
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const w = +mixed[1], n = +mixed[2], d = +mixed[3];
    if (d > 0) return w + n / d;
  }
  // Plain fraction "1/2"
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const n = +frac[1], d = +frac[2];
    if (d > 0) return n / d;
  }
  const f = parseFloat(t);
  return Number.isFinite(f) ? f : NaN;
}

function _matchToSeconds(match) {
  const lower = match.toLowerCase();
  let totalSec = 0;
  // "X hours Y min" combined
  const combined = lower.match(new RegExp(`(${NUM})\\s*${UNIT_HOUR}\\s+(${NUM})\\s*${UNIT_MIN}`, 'i'));
  if (combined) {
    return Math.round((_parseNumeric(combined[1]) * 3600) + (_parseNumeric(combined[2]) * 60));
  }
  // Ranges — take the smaller value.
  const rmin = lower.match(new RegExp(`(${NUM})\\s*(?:to|-|–)\\s*(${NUM})\\s*${UNIT_MIN}`, 'i'));
  if (rmin) return Math.round(Math.min(_parseNumeric(rmin[1]), _parseNumeric(rmin[2])) * 60);
  const rhr = lower.match(new RegExp(`(${NUM})\\s*(?:to|-|–)\\s*(${NUM})\\s*${UNIT_HOUR}`, 'i'));
  if (rhr) return Math.round(Math.min(_parseNumeric(rhr[1]), _parseNumeric(rhr[2])) * 3600);
  const rsec = lower.match(new RegExp(`(${NUM})\\s*(?:to|-|–)\\s*(${NUM})\\s*${UNIT_SEC}`, 'i'));
  if (rsec) return Math.round(Math.min(_parseNumeric(rsec[1]), _parseNumeric(rsec[2])));

  const hr = lower.match(new RegExp(`(${NUM})\\s*${UNIT_HOUR}`, 'i'));
  if (hr) totalSec += _parseNumeric(hr[1]) * 3600;
  const mn = lower.match(new RegExp(`(${NUM})\\s*${UNIT_MIN}`, 'i'));
  if (mn) totalSec += _parseNumeric(mn[1]) * 60;
  const sc = lower.match(new RegExp(`(${NUM})\\s*${UNIT_SEC}`, 'i'));
  if (sc) totalSec += _parseNumeric(sc[1]);
  return Math.round(totalSec) || 0;
}

/**
 * Find every duration mention. Returns `[{ start, end, text, durationSec }, ...]`
 * in text order, suitable for splice-rendering.
 */
export function findTimes(text) {
  if (!text || typeof text !== 'string') return [];
  const out = [];
  PATTERN.lastIndex = 0;
  let m;
  while ((m = PATTERN.exec(text)) !== null) {
    const matched = m[0];
    const start = m.index;
    const end = start + matched.length;
    const sec = _matchToSeconds(matched);
    if (sec > 0 && sec <= 24 * 3600) {
      out.push({ start, end, text: matched, durationSec: sec });
    }
  }
  return out;
}

/**
 * Split text into a sequence of `{ type: 'text' | 'time', value }` parts
 * for templating. Helpful when the consumer wants to walk the text once
 * and render a play-button per time chunk.
 */
export function splitWithTimes(text) {
  if (!text || typeof text !== 'string') return [{ type: 'text', value: text || '' }];
  const matches = findTimes(text);
  if (matches.length === 0) return [{ type: 'text', value: text }];
  const parts = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) parts.push({ type: 'text', value: text.slice(cursor, m.start) });
    parts.push({ type: 'time', value: m.text, durationSec: m.durationSec });
    cursor = m.end;
  }
  if (cursor < text.length) parts.push({ type: 'text', value: text.slice(cursor) });
  return parts;
}
