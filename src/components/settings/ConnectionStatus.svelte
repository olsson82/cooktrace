<script>
  /**
   * ConnectionStatus — top-of-card banner for any integration that
   * connects to an external API (NutriTrace federation, Trace AI,
   * future ones). Promotes the federation card's pattern to a single
   * reusable component so the look + the affordance stay consistent
   * everywhere.
   *
   * Status values:
   *   'ok'      — green banner, "Connected as <connectedAs>", Re-test button
   *   'fail'    — red banner, error string inline, Re-test button
   *   'testing' — neutral banner with spinner, Re-test disabled
   *   '' / null — render nothing (idle / not yet configured)
   *
   * The banner intentionally does NOT render its own divider; it sits
   * inside the card BEFORE the first .setting-row so the existing
   * .setting-divider chain still works for the rows below.
   */
  export let status = '';
  /** Label shown after "Connected as " on the ok branch. Falls back
   *  to a plain "Connected" if not provided. */
  export let connectedAs = '';
  /** Error string shown on the fail branch. */
  export let error = '';
  /** Callback for the Re-test button. */
  export let onRetest = null;
  /** Disable the Re-test button (use during in-flight saves). */
  export let retestDisabled = false;
</script>

{#if status === 'ok'}
  <div class="status-pill ok">
    <span class="material-symbols-rounded">check_circle</span>
    <span>Connected</span>
    {#if connectedAs}
      <span class="status-badge">{connectedAs}</span>
    {/if}
    {#if onRetest}
      <button class="status-retest" on:click={onRetest} disabled={retestDisabled}>
        {retestDisabled ? 'Testing…' : 'Re-test'}
      </button>
    {/if}
  </div>
{:else if status === 'fail'}
  <div class="status-pill fail">
    <span class="material-symbols-rounded">error</span>
    <span>Not connected{error ? `: ${error}` : ''}</span>
    {#if onRetest}
      <button class="status-retest" on:click={onRetest} disabled={retestDisabled}>
        {retestDisabled ? 'Testing…' : 'Re-test'}
      </button>
    {/if}
  </div>
{:else if status === 'testing'}
  <div class="status-pill testing">
    <span class="material-symbols-rounded spin">progress_activity</span>
    <span>Testing connection…</span>
  </div>
{/if}

<style>
  .status-pill {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
    color: var(--text-1);
  }
  .status-pill .material-symbols-rounded { font-size: 18px; }
  .status-pill.ok      { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .status-pill.ok      .material-symbols-rounded { color: var(--accent); }
  .status-pill.fail    { background: color-mix(in srgb, var(--danger) 10%, transparent); }
  .status-pill.fail    .material-symbols-rounded { color: var(--danger); }
  .status-pill.testing { background: var(--surface-2); color: var(--text-2); }
  .status-pill.testing .material-symbols-rounded { color: var(--text-3); }

  /* Provider badge — the integration's name (e.g. OpenAI, Claude) in
     the same PWA / platform-tag pill style: compact accent-tinted
     chip with bold 10px uppercase text. "Connected" stays as plain
     body text to its left. */
  .status-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    background: var(--accent-dim);
    color: var(--accent);
  }

  .status-retest {
    margin-left: auto;
    background: transparent; border: 1px solid var(--border);
    color: var(--text-2);
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .status-retest:hover:not(:disabled) { color: var(--text-1); border-color: var(--text-3); }
  .status-retest:disabled { opacity: 0.5; cursor: default; }

  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
