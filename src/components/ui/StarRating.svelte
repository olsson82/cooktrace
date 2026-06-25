<script>
  import { createEventDispatcher } from 'svelte';

  /** Current rating, 0..5 (or null = unrated). */
  export let value = null;
  /** When true, hover/click are disabled — pure read-only display. */
  export let readOnly = false;
  /** Pixel size of each star. */
  export let size = 22;

  const dispatch = createEventDispatcher();
  let hover = null;
  // Index of the star to briefly animate on click. Cleared by the
  // animationend handler so back-to-back picks each re-trigger the pop.
  let popping = null;

  $: shown = hover ?? (value || 0);

  function pick(n) {
    if (readOnly) return;
    // Click the same star twice to clear back to unrated.
    const next = value === n ? 0 : n;
    value = next;
    popping = n;
    dispatch('change', next);
  }
</script>

<div
  class="rating"
  class:read-only={readOnly}
  on:mouseleave={() => (hover = null)}
  role={readOnly ? 'img' : 'radiogroup'}
  aria-label={readOnly ? `Rated ${value || 0} out of 5` : 'Rating'}
>
  {#each [1, 2, 3, 4, 5] as n}
    <button
      type="button"
      class="star"
      class:filled={n <= shown}
      class:popping={popping === n}
      style:--s={`${size}px`}
      on:click={() => pick(n)}
      on:mouseenter={() => { if (!readOnly) hover = n; }}
      on:animationend={() => { if (popping === n) popping = null; }}
      aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
      aria-pressed={value === n}
      tabindex={readOnly ? -1 : 0}
    >
      <span class="material-symbols-rounded">{n <= shown ? 'star' : 'star_border'}</span>
    </button>
  {/each}
</div>

<style>
  .rating {
    display: inline-flex;
    gap: 2px;
    align-items: center;
  }
  .star {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: var(--text-3);
    line-height: 0;
    transition: color var(--dur-fast), transform var(--dur-fast) var(--ease-spring);
    -webkit-tap-highlight-color: transparent;
  }
  .star .material-symbols-rounded {
    font-size: var(--s, 22px);
    font-variation-settings: 'FILL' 0;
  }
  .star.filled {
    color: var(--accent);
  }
  .star.filled .material-symbols-rounded {
    font-variation-settings: 'FILL' 1;
  }
  .rating:not(.read-only) .star:hover {
    transform: scale(1.18);
  }
  .read-only .star {
    cursor: default;
    pointer-events: none;
  }
  /* Pop animation on click — scale up briefly, then settle. Honours
     reduced-motion so users with vestibular sensitivity get the same
     instant state change they'd expect. */
  .star.popping {
    animation: star-pop 320ms var(--ease-spring) both;
  }
  @keyframes star-pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.45); }
    70%  { transform: scale(0.92); }
    100% { transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .star.popping { animation: none; }
  }
</style>
