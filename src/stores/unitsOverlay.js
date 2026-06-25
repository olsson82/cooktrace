/**
 * unitsOverlay — server-backed cache of `{ disabled, custom }` for
 * cooking units. Read by every UnitPicker on the page, refreshed by
 * the Manage Units editor when the user toggles or creates entries.
 *
 * Load is lazy: stays empty (no disable, no custom) until first read,
 * then fetches once and shares the result across all subscribers.
 */
import { writable, get } from 'svelte/store';
import { NtApi } from '../lib/api.js';

const EMPTY = { disabled: [], custom: [] };
let _loaded = false;
let _inflight = null;

export const unitsOverlay = writable(EMPTY);

async function _fetch() {
  try {
    const res = await NtApi.getUnits();
    unitsOverlay.set({ disabled: res?.disabled || [], custom: res?.custom || [] });
  } catch {
    unitsOverlay.set(EMPTY);
  }
}

/** Trigger a fetch. Returns a Promise so callers (e.g. Manage edits)
 *  can await consistency before the next render. */
export function refreshUnitsOverlay() {
  _inflight = _fetch().finally(() => { _loaded = true; _inflight = null; });
  return _inflight;
}

// Auto-load on first store subscription. Idempotent.
unitsOverlay.subscribe(() => {
  if (!_loaded && !_inflight) refreshUnitsOverlay();
});
