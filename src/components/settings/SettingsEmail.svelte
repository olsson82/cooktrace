<script>
  /**
   * SettingsEmail — SMTP form ported line-for-line from NutriTrace's
   * Settings.svelte Email (SMTP) block. Same field order, same Toggle
   * component, same env-lock banner, same Save / Test flow.
   *
   * Used for password resets, user invites, recipe-share notifications,
   * and the weekly summary email. Server endpoints already exist at
   * /api/app-config (key/value writes) + /api/app-config/test-email.
   */
  import { onMount } from 'svelte';
  import { showSuccess, showError } from '../../stores/toast.js';
  import Toggle from './Toggle.svelte';

  export let envLocks = { smtp: false };

  let smtpHost   = '';
  let smtpPort   = '587';
  let smtpSecure = false;
  let smtpUser   = '';
  let smtpPass   = '';
  let smtpFrom   = '';
  let smtpShowPass = false;
  let smtpSaving = false;
  let smtpSaved = false;
  let smtpTestStatus = '';   // '' | 'testing' | 'ok' | 'fail'

  onMount(load);

  async function load() {
    try {
      const res = await fetch('/api/app-config', { credentials: 'include' });
      if (!res.ok) return;
      const cfg = await res.json();
      smtpHost   = cfg.smtp_host   || '';
      smtpPort   = cfg.smtp_port   || '587';
      smtpSecure = cfg.smtp_secure === 'true';
      smtpUser   = cfg.smtp_user   || '';
      smtpPass   = cfg.smtp_pass   || '';
      smtpFrom   = cfg.smtp_from   || '';
    } catch {}
  }

  async function _saveField(key, value) {
    const csrf = typeof localStorage !== 'undefined' ? localStorage.getItem('ct:csrf') : null;
    const res = await fetch('/api/app-config', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || `Save failed (${res.status})`);
    }
  }

  async function saveSmtp() {
    smtpSaving = true;
    smtpSaved = false;
    try {
      const ops = [
        _saveField('smtp_host',   smtpHost),
        _saveField('smtp_port',   smtpPort),
        _saveField('smtp_secure', String(smtpSecure)),
        _saveField('smtp_user',   smtpUser),
        _saveField('smtp_from',   smtpFrom),
      ];
      // Don't ship the redacted placeholder back as the new value.
      if (smtpPass && smtpPass !== '••••••••') {
        ops.push(_saveField('smtp_pass', smtpPass));
      }
      await Promise.all(ops);
      smtpSaved = true;
      setTimeout(() => smtpSaved = false, 2000);
    } catch (e) {
      showError(e.message || 'Could not save SMTP settings');
    } finally {
      smtpSaving = false;
    }
  }

  async function testSmtp() {
    smtpTestStatus = 'testing';
    try {
      const csrf = typeof localStorage !== 'undefined' ? localStorage.getItem('ct:csrf') : null;
      const res = await fetch('/api/app-config/test-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      });
      smtpTestStatus = res.ok ? 'ok' : 'fail';
      if (res.ok) showSuccess('SMTP connection verified');
    } catch { smtpTestStatus = 'fail'; }
  }
</script>

<p class="sub-label" style="padding-bottom:4px">Used for password resets and user invites</p>
{#if envLocks.smtp}
  <div class="env-lock-banner">
    <span class="material-symbols-rounded">lock</span>
    Configured via environment variables &mdash; changes are disabled.
  </div>
{/if}
<div class="card settings-card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
  <div class="form-group">
    <label class="form-label">SMTP Host</label>
    <input class="input" type="text" placeholder="e.g. smtp.example.com"
      bind:value={smtpHost} disabled={envLocks.smtp} />
  </div>
  <div style="display:flex;gap:10px">
    <div class="form-group" style="flex:1">
      <label class="form-label">Port</label>
      <input class="input" type="number" placeholder="587"
        bind:value={smtpPort} disabled={envLocks.smtp} />
    </div>
    <div class="form-group" style="display:flex;flex-direction:column;gap:6px;justify-content:flex-end;padding-bottom:2px">
      <label class="form-label">TLS</label>
      <Toggle checked={smtpSecure} on:change={e => smtpSecure = e.detail} disabled={envLocks.smtp} />
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">Username</label>
    <input class="input" type="text" autocomplete="off" placeholder="SMTP username or email"
      bind:value={smtpUser} disabled={envLocks.smtp} />
  </div>
  <div class="form-group">
    <label class="form-label">Password</label>
    <div style="display:flex;gap:8px;align-items:center">
      {#if smtpShowPass}
        <input class="input" style="flex:1" type="text" autocomplete="new-password" placeholder="SMTP password or app password"
          bind:value={smtpPass} disabled={envLocks.smtp} />
      {:else}
        <input class="input" style="flex:1" type="password" autocomplete="new-password" placeholder="SMTP password or app password"
          bind:value={smtpPass} disabled={envLocks.smtp} />
      {/if}
      <button class="btn-icon" on:click={() => smtpShowPass = !smtpShowPass} title={smtpShowPass ? 'Hide' : 'Show'}>
        <span class="material-symbols-rounded">{smtpShowPass ? 'visibility_off' : 'visibility'}</span>
      </button>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">From Address</label>
    <input class="input" type="email" placeholder='CookTrace <noreply@example.com>'
      bind:value={smtpFrom} disabled={envLocks.smtp} />
  </div>
  <div style="display:flex;align-items:center;gap:10px">
    <button class="btn btn-primary" style="height:36px;font-size:13px"
      on:click={saveSmtp} disabled={smtpSaving || envLocks.smtp}>
      {#if smtpSaved}
        <span class="material-symbols-rounded" style="font-size:16px">check</span> Saved
      {:else}
        {smtpSaving ? 'Saving…' : 'Save'}
      {/if}
    </button>
    <button class="btn btn-secondary" style="height:36px;font-size:13px"
      on:click={testSmtp} disabled={!smtpHost || smtpTestStatus === 'testing'}>
      {smtpTestStatus === 'testing' ? 'Testing…' : 'Test'}
    </button>
    {#if smtpTestStatus === 'ok'}
      <span style="color:var(--success, #4ade80);font-size:13px;display:flex;align-items:center;gap:4px">
        <span class="material-symbols-rounded" style="font-size:16px">check_circle</span>Connected
      </span>
    {:else if smtpTestStatus === 'fail'}
      <span style="color:var(--error, #f87171);font-size:13px;display:flex;align-items:center;gap:4px">
        <span class="material-symbols-rounded" style="font-size:16px">error</span>Failed
      </span>
    {/if}
  </div>
</div>

<style>
  /* These mirror NT's Settings.svelte definitions so the layout reads
     identically. CookTrace's Settings.svelte doesn't define them
     globally; pulling them in here keeps the component self-contained. */
  .form-group :global(.form-label) {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .env-lock-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: var(--radius-md);
    font-size: 12px;
    color: var(--text-2);
    margin-bottom: 4px;
  }
  .env-lock-banner .material-symbols-rounded { font-size: 16px; color: var(--accent); flex-shrink: 0; }

  .btn-icon {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    width: 36px; height: 36px;
    cursor: pointer;
    color: var(--text-3);
    display: flex; align-items: center; justify-content: center;
  }
  .btn-icon:hover { color: var(--text-1); background: var(--surface-2); }
  .btn-icon .material-symbols-rounded { font-size: 18px; }
</style>
