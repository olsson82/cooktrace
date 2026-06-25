<script>
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { unitGroupsMerged } from '../../lib/units.js';
  import { measurementSystem } from '../../stores/settings.js';
  import { unitsOverlay, refreshUnitsOverlay } from '../../stores/unitsOverlay.js';
  import { portal } from '../../lib/portal.js';

  /** Stored abbreviation (e.g. "tsp"). Free text is also allowed. */
  export let value = '';
  export let placeholder = 'unit';

  const dispatch = createEventDispatcher();

  let inputEl;
  let popoverEl;
  let open = false;
  let highlight = -1;
  let _wrap;
  // Popover is portaled to document.body so it escapes any ancestor
  // overflow:hidden (the global .card class clips otherwise). We
  // position it manually below (or above when there's no room) the
  // input each time it opens or the viewport resizes.
  let popStyle = '';
  // Distinguishes "browse" mode (just clicked open — show ALL options) from
  // "search" mode (user has typed since opening — filter to matches). The
  // saved value isn't a search query, just the current selection.
  let typedSinceOpen = false;

  // Server-backed catalog. The overlay store caches { disabled, custom }
  // and exposes refresh() so Manage edits propagate without a reload.
  // Built-in 37 + custom additions, minus user-disabled built-ins.
  $: orderedGroups = (() => {
    const merged = unitGroupsMerged($unitsOverlay);
    if ($measurementSystem !== 'metric') return merged;
    // Move metric ahead of US; keep Custom group at the top if present.
    const head = merged[0]?.label === 'Custom' ? [merged[0]] : [];
    const rest = (head.length ? merged.slice(1) : merged).slice();
    rest.sort((a, b) => {
      const am = a.label.includes('Metric'), bm = b.label.includes('Metric');
      if (am && !bm) return -1;
      if (!am && bm) return 1;
      return 0;
    });
    return [...head, ...rest];
  })();

  // Filter ONLY when the user has typed since opening — clicking the field
  // (browse mode) shows every unit regardless of the saved value.
  $: q = typedSinceOpen ? (value || '').trim().toLowerCase() : '';
  $: filteredGroups = q
    ? orderedGroups
        .map(g => ({
          ...g,
          units: g.units.filter(u =>
            u.abbr.toLowerCase().includes(q) ||
            u.full.toLowerCase().includes(q)
          ),
        }))
        .filter(g => g.units.length > 0)
    : orderedGroups;

  // Flatten for keyboard navigation.
  $: flatList = filteredGroups.flatMap(g => g.units.map(u => ({ ...u, groupLabel: g.label })));
  $: if (highlight >= flatList.length) highlight = flatList.length - 1;

  function pick(u) {
    value = u.abbr;
    open = false;
    highlight = -1;
    typedSinceOpen = false;
    dispatch('change', value);
    if (inputEl) setTimeout(() => inputEl.blur(), 0);
  }

  function onKey(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        open = true;
        highlight = 0;
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') { highlight = Math.min(flatList.length - 1, highlight + 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { highlight = Math.max(0, highlight - 1); e.preventDefault(); }
    else if (e.key === 'Enter') {
      if (highlight >= 0 && flatList[highlight]) { pick(flatList[highlight]); e.preventDefault(); }
      else { open = false; }
    }
    else if (e.key === 'Escape') { open = false; highlight = -1; }
    else if (e.key === 'Tab') { open = false; }
  }

  function onInput(e) {
    value = e.target.value;
    typedSinceOpen = true;
    open = true;
    highlight = 0;
  }

  function onFocus() {
    open = true;
    highlight = -1;
    typedSinceOpen = false;        // Clicking opens for browse, not search.
    tick().then(_repositionPopover);
  }

  function _repositionPopover() {
    if (!inputEl) return;
    const r = inputEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const POP_MAX_H = 320;
    const GAP = 4;
    // Prefer below; flip above when there's no room (and the input is
    // far enough down the viewport that the flipped popover fits).
    const spaceBelow = vh - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const placeAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
    const top = placeAbove
      ? Math.max(8, r.top - GAP - Math.min(POP_MAX_H, spaceAbove))
      : r.bottom + GAP;
    const maxH = placeAbove ? Math.min(POP_MAX_H, spaceAbove) : Math.min(POP_MAX_H, spaceBelow);
    popStyle = `top:${top}px;left:${r.left}px;width:${r.width}px;max-height:${maxH}px;`;
  }
  function _onScrollOrResize() { if (open) _repositionPopover(); }
  onMount(() => {
    window.addEventListener('resize', _onScrollOrResize);
    window.addEventListener('scroll', _onScrollOrResize, true);
  });
  onDestroy(() => {
    window.removeEventListener('resize', _onScrollOrResize);
    window.removeEventListener('scroll', _onScrollOrResize, true);
  });
  function onBlur() {
    // Defer so a click on a popover item registers before we close.
    // Check both the wrap AND the portaled popover, since the popover
    // lives on document.body now and isn't a child of the wrap.
    setTimeout(() => {
      const a = document.activeElement;
      if (_wrap?.contains(a) || popoverEl?.contains(a)) return;
      open = false;
      typedSinceOpen = false;
    }, 120);
  }
</script>

<div class="unit-picker" bind:this={_wrap}>
  <input
    bind:this={inputEl}
    class="input unit-input"
    type="text"
    {placeholder}
    value={value || ''}
    on:input={onInput}
    on:focus={onFocus}
    on:blur={onBlur}
    on:keydown={onKey}
    autocomplete="off"
    spellcheck="false"
    aria-haspopup="listbox"
    aria-expanded={open}
  />
  <span class="caret material-symbols-rounded">expand_more</span>

</div>

{#if open}
  <div use:portal class="popover" bind:this={popoverEl} role="listbox"
    style={popStyle} transition:fade={{ duration: 80 }}>
    {#if filteredGroups.length === 0}
      <p class="empty-line">No matches — your text will be saved as-is</p>
    {:else}
      {#each filteredGroups as group}
        <p class="group-label">{group.label}</p>
        {#each group.units as u}
          {@const idx = flatList.findIndex(f => f.abbr === u.abbr && f.groupLabel === group.label)}
          <button
            type="button"
            class="opt"
            class:active={highlight === idx}
            role="option"
            aria-selected={value === u.abbr}
            on:mousedown|preventDefault={() => pick(u)}
            on:mouseenter={() => highlight = idx}
          >
            <span class="opt-full">{u.full}</span>
            <span class="opt-abbr">{u.abbr}</span>
          </button>
        {/each}
      {/each}
    {/if}
  </div>
{/if}

<style>
  .unit-picker { position: relative; }

  .unit-input { padding-right: 28px; box-sizing: border-box; width: 100%; }
  .caret {
    position: absolute;
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    color: var(--text-3);
    font-size: 18px;
    pointer-events: none;
  }

  /* Portaled to document.body so the dropdown can extend past any
     ancestor with overflow:hidden (the global .card class). Position
     is set via inline `style` from the script: top + left + width +
     max-height all driven by the input's getBoundingClientRect(). */
  .popover {
    position: fixed;
    min-width: 220px;
    overflow-y: auto;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    z-index: 200;
    padding: 6px 0;
  }
  .group-label {
    margin: 6px 12px 4px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
    font-weight: 700;
  }
  .opt {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    background: transparent;
    border: none;
    padding: 7px 12px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-1);
    text-align: left;
  }
  .opt:hover, .opt.active { background: var(--accent-dim); color: var(--accent); }
  .opt-full { flex: 1; }
  .opt-abbr {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--text-3);
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
  }
  .opt.active .opt-abbr { color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, transparent); }

  .empty-line {
    padding: 12px;
    margin: 0;
    color: var(--text-3);
    font-size: 12px;
    font-style: italic;
    text-align: center;
  }
</style>
