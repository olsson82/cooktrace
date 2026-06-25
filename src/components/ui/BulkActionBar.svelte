<script>
  /**
   * BulkActionBar — single shared component for multi-select toolbars
   * across the app (Recipes, Pantry, future bulk-select sections).
   *
   * Two layouts in one component, swapped via CSS:
   *
   *   • Desktop / tablet (≥ 768px): inline toolbar at the top of the
   *     content. Pushes layout, integrates with page chrome. Better
   *     when there's lots of horizontal space and the user is using
   *     a mouse or trackpad — same pattern as Gmail / Drive / GitHub.
   *
   *   • Mobile (< 768px): floating pill at the bottom, fixed-positioned
   *     so it stays in reach as the user scrolls and ticks items.
   *     Same pattern as iOS Photos / Mail / Files.
   *
   * Both render the same actions: Select All, Clear, Delete.
   *
   * Caller wires three callbacks via on:* events. Pass `count` (number
   * selected) and `total` (number visible) so Select All can disable
   * itself when everything is already selected. The optional `noun`
   * pluralizes the count label ("3 recipes selected" vs "3 items
   * selected"); use the singular form.
   */
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { portal } from '../../lib/portal.js';

  export let count = 0;
  export let total = 0;
  export let noun = 'item';
  // Opt-in extra action: "Add to Cookbook". Specific to recipes today
  // but cheap to keep here so we don't need a parallel component. The
  // caller hooks on:cookbook to open whatever picker it wants.
  export let showCookbook = false;

  const dispatch = createEventDispatcher();
  const onSelectAll = () => dispatch('selectAll');
  const onClear     = () => dispatch('clear');
  const onDelete    = () => dispatch('delete');
  const onCookbook  = () => dispatch('cookbook');

  $: label = `${count} ${count === 1 ? noun : noun + 's'} selected`;
</script>

<!-- Desktop: inline toolbar. Lives where the caller put the component
     so it integrates with the surrounding layout. -->
<div class="bulk-toolbar inline" transition:fade={{ duration: 140 }}>
  <span class="bulk-count">{label}</span>
  <div class="bulk-actions">
    <button class="btn btn-secondary" on:click={onSelectAll} disabled={total === 0 || count === total}>
      Select All
    </button>
    <button class="btn btn-secondary" on:click={onClear} disabled={count === 0}>
      Clear
    </button>
    {#if showCookbook}
      <button class="btn btn-secondary" on:click={onCookbook} disabled={count === 0}>
        <span class="material-symbols-rounded">auto_stories</span>
        Add to Cookbook
      </button>
    {/if}
    <button class="btn btn-danger" on:click={onDelete} disabled={count === 0}>
      <span class="material-symbols-rounded">delete</span>
      Delete
    </button>
  </div>
</div>

<!-- Mobile: floating pill, portaled to body so it stays put regardless
     of the caller's scroll container. -->
<div use:portal class="bulk-toolbar floating" transition:fade={{ duration: 140 }}>
  <span class="bulk-count">{label}</span>
  <button class="btn-link" on:click={onSelectAll} disabled={total === 0 || count === total}>
    Select All
  </button>
  <button class="btn-link" on:click={onClear} disabled={count === 0}>
    Clear
  </button>
  {#if showCookbook}
    <button class="btn-link" on:click={onCookbook} disabled={count === 0} title="Add to Cookbook">
      <span class="material-symbols-rounded">auto_stories</span>
    </button>
  {/if}
  <button class="btn btn-danger bulk-delete" on:click={onDelete} disabled={count === 0}>
    <span class="material-symbols-rounded">delete</span>
    Delete
  </button>
</div>

<style>
  /* ── Desktop / tablet inline toolbar ──────────────────────────────── */
  .bulk-toolbar.inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    margin: 0 0 8px;
    background: var(--surface-1);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: var(--radius-md);
    flex-wrap: wrap;
  }
  .bulk-toolbar.inline .bulk-count {
    font-weight: 600;
    color: var(--text-1);
    font-size: 14px;
  }
  .bulk-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .bulk-actions .btn { height: 32px; font-size: 13px; padding: 0 10px; }
  .bulk-actions .btn-danger {
    background: var(--danger, var(--error, #ef4444));
    color: #fff;
    border: 1px solid var(--danger, var(--error, #ef4444));
  }
  .bulk-actions .btn-danger:disabled { opacity: 0.45; }
  .bulk-actions .btn-danger .material-symbols-rounded { font-size: 16px; }

  /* ── Mobile floating pill ─────────────────────────────────────────── */
  .bulk-toolbar.floating {
    position: fixed;
    left: 50%;
    bottom: calc(var(--safe-bottom, 0px) + 76px);
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-full, 999px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.35);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 80;
  }
  .bulk-toolbar.floating .bulk-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }
  .btn-link {
    background: none; border: none; padding: 0;
    color: var(--accent);
    font-size: 13px; font-weight: 600;
    cursor: pointer;
  }
  .btn-link:disabled { color: var(--text-3); cursor: not-allowed; }
  .btn-link .material-symbols-rounded { font-size: 18px; vertical-align: middle; }
  .bulk-delete {
    background: var(--danger, var(--error, #ef4444));
    color: #fff;
    border: none;
    border-radius: var(--radius-full, 999px);
    padding: 8px 16px;
    font-size: 13px; font-weight: 700;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .bulk-delete:disabled { opacity: 0.5; cursor: not-allowed; }
  .bulk-delete .material-symbols-rounded { font-size: 16px; }

  /* ── Layout swap at 768px ─────────────────────────────────────────── */
  /* Mobile (< 768): inline hidden, floating shown. */
  @media (max-width: 767px) {
    .bulk-toolbar.inline    { display: none; }
  }
  /* Desktop (≥ 768): floating hidden, inline shown. */
  @media (min-width: 768px) {
    .bulk-toolbar.floating { display: none; }
  }
</style>
