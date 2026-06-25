<script>
  /**
   * SettingsKitchens — manage household / roommate Kitchens.
   *
   * A Kitchen is a soft group of users; sharing a recipe with a
   * Kitchen fans out per-user shares to every member in one action.
   * MVP: create / delete kitchens, list + invite + remove members.
   * Sharing-by-kitchen is exposed in the Recipes share dialog (lives
   * elsewhere); this screen is the management surface.
   */
  import { onMount } from 'svelte';
  import { NtApi } from '../../lib/api.js';
  import { showSuccess, showError } from '../../stores/toast.js';
  import { confirmDialog } from '../../stores/confirmDialog.js';
  import { currentUser, userMgmtActive } from '../../stores/auth.js';
  import Spinner from '../ui/Spinner.svelte';

  let kitchens = [];
  let loading = false;
  let busy = false;
  let creating = false;
  let newName = '';

  // Per-kitchen expanded panel state
  let openId = null;
  let members = {};      // { kitchenId: [member, ...] }
  let inviteName = '';
  let inviteBusy = false;

  async function load() {
    loading = true;
    try { kitchens = await NtApi.getKitchens(); }
    catch (e) { showError(e.message || 'Could not load Kitchens'); kitchens = []; }
    finally { loading = false; }
  }
  onMount(load);

  async function createKitchen() {
    const name = newName.trim();
    if (!name) return;
    creating = true;
    try {
      const k = await NtApi.createKitchen(name);
      kitchens = [...kitchens, k];
      newName = '';
      showSuccess(`Created Kitchen "${k.name}"`);
    } catch (e) { showError(e.message || 'Could not create'); }
    finally { creating = false; }
  }

  async function loadMembers(id) {
    try { members[id] = await NtApi.getKitchenMembers(id); members = members; }
    catch (e) { showError(e.message || 'Could not load members'); }
  }
  async function toggleOpen(id) {
    if (openId === id) { openId = null; return; }
    openId = id;
    inviteName = '';
    if (!members[id]) await loadMembers(id);
  }

  async function invite(kitchenId) {
    const username = inviteName.trim();
    if (!username) return;
    inviteBusy = true;
    try {
      await NtApi.addKitchenMember(kitchenId, username);
      showSuccess(`Added ${username}`);
      inviteName = '';
      await loadMembers(kitchenId);
      // Update member_count cached on the row.
      kitchens = kitchens.map(k => k.id === kitchenId ? { ...k, member_count: (members[kitchenId] || []).length } : k);
    } catch (e) { showError(e.message || 'Could not add member'); }
    finally { inviteBusy = false; }
  }

  async function removeMember(kitchenId, member) {
    const isSelf = member.user_id === $currentUser?.id;
    const ok = await confirmDialog({
      title: isSelf ? 'Leave this Kitchen?' : `Remove ${member.username}?`,
      message: isSelf
        ? `You'll lose access to recipes that were shared via this Kitchen.`
        : `${member.username} will lose access to recipes shared via this Kitchen.`,
      confirmText: isSelf ? 'Leave' : 'Remove',
      dangerous: true,
    });
    if (!ok) return;
    try {
      await NtApi.removeKitchenMember(kitchenId, member.user_id);
      if (isSelf) {
        kitchens = kitchens.filter(k => k.id !== kitchenId);
        openId = null;
      } else {
        await loadMembers(kitchenId);
        kitchens = kitchens.map(k => k.id === kitchenId ? { ...k, member_count: (members[kitchenId] || []).length } : k);
      }
    } catch (e) { showError(e.message || 'Could not remove member'); }
  }

  async function deleteKitchen(k) {
    const ok = await confirmDialog({
      title: `Delete Kitchen "${k.name}"?`,
      message: `Members will lose access to anything shared through this Kitchen. Recipes themselves are not deleted.`,
      confirmText: 'Delete',
      dangerous: true,
    });
    if (!ok) return;
    try {
      await NtApi.deleteKitchen(k.id);
      kitchens = kitchens.filter(x => x.id !== k.id);
      openId = null;
      showSuccess('Kitchen deleted');
    } catch (e) { showError(e.message || 'Could not delete'); }
  }

  function isOwner(k) { return k.role === 'owner'; }
</script>

<div class="card settings-card">
  {#if !$userMgmtActive}
    <div class="setting-row">
      <div>
        <span class="setting-label">User Management Required</span>
        <span class="setting-desc">Kitchens are a multi-user feature. Enable User Management in Settings → Users to create one.</span>
      </div>
    </div>
  {:else}
    <!-- Create -->
    <div class="setting-row stack">
      <span class="setting-label">Create a New Kitchen</span>
      <span class="setting-desc">A Kitchen is a household or shared group of users. Sharing a recipe with the Kitchen sends it to every member at once.</span>
      <div class="create-row">
        <input class="input" type="text" placeholder="Smith Family Kitchen" bind:value={newName}
          on:keydown={(e) => { if (e.key === 'Enter') createKitchen(); }} />
        <button class="btn btn-primary" on:click={createKitchen} disabled={creating || !newName.trim()}>
          {creating ? 'Creating…' : 'Create'}
        </button>
      </div>
    </div>

    <!-- List -->
    {#if loading}
      <div class="setting-row"><Spinner label="Loading…" /></div>
    {:else if kitchens.length === 0}
      <div class="setting-divider"></div>
      <div class="setting-row">
        <span class="setting-desc">No Kitchens yet. Create one above to start sharing recipes with a group.</span>
      </div>
    {:else}
      {#each kitchens as k (k.id)}
        <div class="setting-divider"></div>
        <div class="kitchen-row">
          <button class="kitchen-head" on:click={() => toggleOpen(k.id)}>
            <span class="material-symbols-rounded kitchen-icon">cooking</span>
            <span class="kitchen-info">
              <span class="kitchen-name">{k.name}</span>
              <span class="kitchen-meta">
                {k.member_count} {k.member_count === 1 ? 'member' : 'members'}
                {#if isOwner(k)}<span class="badge">Owner</span>{/if}
              </span>
            </span>
            <span class="material-symbols-rounded chev" class:open={openId === k.id}>expand_more</span>
          </button>

          {#if openId === k.id}
            <div class="kitchen-body">
              <div class="member-list">
                {#each (members[k.id] || []) as m (m.user_id)}
                  <div class="member-row">
                    <span class="member-name">
                      {m.full_name || m.username}
                      {#if m.role === 'owner'}<span class="badge">Owner</span>{/if}
                      {#if m.user_id === $currentUser?.id}<span class="muted">(you)</span>{/if}
                    </span>
                    {#if isOwner(k) && m.user_id !== $currentUser?.id}
                      <button class="btn-link danger" on:click={() => removeMember(k.id, m)}>Remove</button>
                    {:else if m.user_id === $currentUser?.id && !isOwner(k)}
                      <button class="btn-link danger" on:click={() => removeMember(k.id, m)}>Leave</button>
                    {/if}
                  </div>
                {/each}
              </div>

              {#if isOwner(k)}
                <div class="invite-row">
                  <input class="input" type="text" placeholder="Username to invite" bind:value={inviteName}
                    on:keydown={(e) => { if (e.key === 'Enter') invite(k.id); }} />
                  <button class="btn btn-secondary" on:click={() => invite(k.id)}
                    disabled={inviteBusy || !inviteName.trim()}>
                    {inviteBusy ? 'Adding…' : 'Add'}
                  </button>
                </div>
                <div class="kitchen-actions">
                  <button class="btn-link danger" on:click={() => deleteKitchen(k)}>Delete Kitchen</button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  {/if}
</div>

<style>
  .card.settings-card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .setting-row {
    display: flex; justify-content: space-between; align-items: center;
    gap: 12px; padding: 14px 16px;
  }
  .setting-row.stack { flex-direction: column; align-items: stretch; gap: 8px; }
  .setting-label { font-size: 14px; font-weight: 600; color: var(--text-1); }
  .setting-desc { font-size: 12px; color: var(--text-3); line-height: 1.4; }
  .setting-divider { height: 1px; background: var(--border); margin: 0 16px; }

  .input {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius-sm); padding: 9px 12px;
    color: var(--text-1); font-size: 14px; box-sizing: border-box;
  }
  .input:focus { outline: 2px solid var(--accent-dim); border-color: var(--accent); }

  .create-row { display: flex; gap: 8px; }
  .create-row .input { flex: 1; }

  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 14px; font-size: 13px; cursor: pointer;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    white-space: nowrap;
  }
  .btn-primary { background: var(--accent); color: var(--accent-text, #0A0B0F); border-color: var(--accent); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--surface-2); color: var(--text-1); }
  .btn-secondary:hover { border-color: var(--accent); }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-link {
    background: none; border: none; padding: 0;
    color: var(--accent); font-weight: 600; font-size: 12px;
    cursor: pointer;
  }
  .btn-link:hover { text-decoration: underline; }
  .btn-link.danger { color: var(--error, #f87171); }

  /* Kitchen row */
  .kitchen-row { padding: 0 16px; }
  .kitchen-head {
    width: 100%;
    display: flex; align-items: center; gap: 12px;
    background: transparent; border: none; cursor: pointer;
    padding: 14px 0;
    text-align: left;
    color: var(--text-1);
  }
  .kitchen-icon {
    font-size: 22px; color: var(--accent);
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    padding: 6px;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }
  .kitchen-info { flex: 1; min-width: 0; }
  .kitchen-name { font-size: 14px; font-weight: 600; display: block; }
  .kitchen-meta { font-size: 12px; color: var(--text-3); display: inline-flex; align-items: center; gap: 6px; }
  .badge {
    background: var(--accent-dim);
    color: var(--accent);
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .muted { color: var(--text-3); }
  .chev { color: var(--text-3); transition: transform var(--dur-fast); flex-shrink: 0; }
  .chev.open { transform: rotate(180deg); }

  .kitchen-body { padding: 0 0 14px 46px; display: flex; flex-direction: column; gap: 10px; }
  .member-list { display: flex; flex-direction: column; gap: 4px; }
  .member-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
  }
  .member-name { display: inline-flex; align-items: center; gap: 6px; }
  .invite-row { display: flex; gap: 8px; margin-top: 4px; }
  .invite-row .input { flex: 1; }
  .kitchen-actions { display: flex; justify-content: flex-end; padding-top: 6px; }
</style>
