<script>
  /**
   * PantryItemSheet — slide-up bottom sheet for a single pantry item.
   *
   * The single editing surface for pantry items in v1.0. Three modes:
   *   - View      (itemId set, editing=false): two-column grid (photo +
   *               identity left, stats + nutrition right). Stock pill
   *               derives from quantity. Qty +/- quick actions. Edit
   *               + Delete in footer.
   *   - Edit      (itemId set, editing=true): SAME two-column grid;
   *               every read-mode field flips to its editable input
   *               in place, no surface change. Linked-scaling toggle
   *               next to the Edit All Nutrients link, Smart OFF
   *               buttons + Verify row under Barcode, and the
   *               "Edit All Nutrients" sub-sheet for the full catalog.
   *   - Create    (itemId === null): same as Edit mode but builds a
   *               blank item with optional `prefill` (used by the
   *               barcode-scan flow for an unrecognized code).
   *
   * In Stock is DERIVED display: `quantity === 0` reads as Out of Stock;
   * `null` or `> 0` reads as In Stock. The explicit in_stock column
   * lives on in the schema so server reads still work, but every save
   * path computes it from quantity so the two never drift.
   *
   * Caller usage:
   *   <PantryItemSheet bind:open itemId={...}
   *     startInEdit={false} prefill={null}
   *     on:changed={e => ...} on:deleted={e => ...} on:created={e => ...} />
   */
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import Sheet from '../ui/Sheet.svelte';
  import ImagePicker from '../ui/ImagePicker.svelte';
  import UnitPicker from '../ui/UnitPicker.svelte';
  import BarcodeScanner from '../ui/BarcodeScanner.svelte';
  import Combobox from '../ui/Combobox.svelte';
  import { NtApi } from '../../lib/api.js';
  import { resolveAssetUrl, isNative } from '../../lib/platform.js';
  import { showError, showSuccess } from '../../stores/toast.js';
  import { confirmDialog } from '../../stores/confirmDialog.js';
  import NutritionFactsBox from '../recipe/NutritionFactsBox.svelte';
  import { categoryLabel, categoryIcon } from '../../lib/pantry-categories.js';
  import { NUTRIMENTS, DEFAULT_VISIBLE_NUTRIMENT_IDS, isDerived, deriveSodiumSalt } from '../../lib/nutriments.js';
  import { lookupBarcode, contributeToOFF } from '../../lib/off.js';
  import { visibleNutriments, offEnabled, offUsername, offPassword, offUploadCountry } from '../../stores/settings.js';

  export let open = false;
  export let itemId = null;
  export let startInEdit = false;
  export let prefill = null;

  const dispatch = createEventDispatcher();

  let item = null;
  let draft = null;
  let loading = false;
  let loadError = null;
  let editing = false;
  let saving = false;
  let imgUploading = false;

  // Edit-only state
  let linked = false;
  let _lastServingSize = null;
  let allNutrientsOpen = false;
  let editorScannerOpen = false;
  let pantryCategories = [];
  let categoryName = '';
  let comboCategoryRef;
  let categoryNewOpen = false;
  let categoryNewName = '';
  let categoryNewIcon = 'kitchen';

  // OFF state
  let downloading = false;
  let downloadSuccess = false;
  let contributing = false;
  let offSuccess = false;
  let offVerified = null;
  let offProductExists = null;
  let _lastCheckedBarcode = null;

  function _blank() {
    return {
      name: '', brand: '', barcode: '',
      in_stock: 1, quantity: '', unit: '',
      serving_size: '', serving_unit: 'g',
      notes: '', img_url: '',
      category: '', category_id: null,
      nutrition: {},
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  $: if (open && itemId == null) _enterCreateMode();
  $: if (open && itemId != null) _enterViewOrEditMode(itemId, startInEdit);
  $: if (!open) _reset();

  async function _enterViewOrEditMode(id, asEdit) {
    if (item && item.id === id) {
      if (asEdit && !editing) _startEdit();
      return;
    }
    loading = true; loadError = null; item = null;
    try {
      const row = await NtApi.getPantryItem(id);
      item = row;
      if (asEdit) _startEdit();
    } catch (e) { loadError = e.message || 'Could not load item'; }
    finally { loading = false; }
    _loadPantryCategories();
  }

  function _enterCreateMode() {
    item = { ..._blank(), ...(prefill || {}),
      nutrition: prefill?.nutrition && typeof prefill.nutrition === 'object'
        ? { ...prefill.nutrition } : {},
    };
    draft = { ...item };
    _lastServingSize = Number(draft.serving_size) || null;
    editing = true;
    loading = false;
    loadError = null;
    _loadPantryCategories();
  }

  function _startEdit() {
    if (!item) return;
    draft = {
      ..._blank(), ...item,
      brand: item.brand ?? '',
      barcode: item.barcode ?? '',
      quantity: item.quantity ?? '',
      img_url: item.img_url ?? '',
      category: item.category ?? '',
      category_id: item.category_id ?? null,
      serving_size: item.serving_size ?? '',
      serving_unit: item.serving_unit ?? 'g',
      nutrition: item.nutrition && typeof item.nutrition === 'object' ? { ...item.nutrition } : {},
    };
    _lastServingSize = Number(draft.serving_size) || null;
    editing = true;
  }

  function _reset() {
    item = null;
    draft = null;
    loadError = null;
    editing = false;
    saving = false;
    linked = false;
    _lastServingSize = null;
    allNutrientsOpen = false;
    downloading = false;
    downloadSuccess = false;
    contributing = false;
    offSuccess = false;
    offVerified = null;
    offProductExists = null;
    _lastCheckedBarcode = null;
  }

  // ── Visible nutriments — for the inline edit grid ──────────────────
  $: visibleIds = $visibleNutriments && $visibleNutriments.length
    ? $visibleNutriments
    : DEFAULT_VISIBLE_NUTRIMENT_IDS;
  $: visibleInlineNutriments = visibleIds
    .map(id => NUTRIMENTS.find(n => n.id === id))
    .filter(Boolean);

  // ── Categories ─────────────────────────────────────────────────────
  async function _loadPantryCategories() {
    if (pantryCategories.length) return;
    try { pantryCategories = await NtApi.getPantryCategories(); }
    catch { pantryCategories = []; }
  }
  $: {
    const src = editing ? draft : item;
    if (src?.category_id != null) {
      const c = pantryCategories.find(x => x.id === src.category_id);
      categoryName = c?.name || '';
    } else if (src?.category) {
      const c = pantryCategories.find(x => x.slug === src.category);
      categoryName = c?.name || categoryLabel(src.category);
    } else {
      categoryName = '';
    }
  }
  function onPantryCategorySelect(e) {
    const opt = e.detail;
    const match = pantryCategories.find(c => c.name.toLowerCase() === (opt?.name || '').toLowerCase());
    if (match) {
      draft.category_id = match.id;
      draft.category = match.slug;
      draft = { ...draft };
    }
  }
  function openNewPantryCategoryDialog(e) {
    categoryNewName = (e?.detail || '').trim();
    categoryNewIcon = 'kitchen';
    categoryNewOpen = true;
  }
  async function confirmNewPantryCategory() {
    const name = categoryNewName.trim();
    if (!name) return;
    try {
      const c = await NtApi.createPantryCategory({ name, icon: categoryNewIcon });
      pantryCategories = [...pantryCategories, c];
      draft.category_id = c.id;
      draft.category = c.slug;
      draft = { ...draft };
      comboCategoryRef?.acceptCreated(c.name);
      categoryNewOpen = false;
    } catch (err) { showError(err.message || 'Could not create category'); }
  }

  // ── Barcode + OFF ──────────────────────────────────────────────────
  function onScan(e) {
    const code = e?.detail?.code || e?.detail || '';
    const trimmed = String(code).trim();
    if (!trimmed) return;
    draft.barcode = trimmed;
    draft = { ...draft };
    editorScannerOpen = false;
    if ($offEnabled) downloadFromOFF();
  }

  async function downloadFromOFF() {
    if (!draft.barcode) { showError('Enter a barcode first'); return; }
    downloading = true; downloadSuccess = false;
    try {
      const result = await lookupBarcode(draft.barcode);
      if (!result) { showError('Not found on Open Food Facts'); return; }
      if (!draft.name) draft.name = result.name || '';
      if (!draft.brand) draft.brand = result.brand || '';
      draft.serving_size = result.serving_size ?? draft.serving_size;
      draft.serving_unit = result.serving_unit || draft.serving_unit;
      draft.nutrition = deriveSodiumSalt({ ...(draft.nutrition || {}), ...(result.nutrition || {}) });
      if (result.img_url && !draft.img_url) draft.img_url = result.img_url;
      _lastServingSize = draft.serving_size;
      draft = { ...draft };
      downloadSuccess = true;
      setTimeout(() => downloadSuccess = false, 2000);
    } catch (e) { showError(e.message || 'OFF lookup failed'); }
    finally { downloading = false; }
  }

  async function _refreshOffPresence() {
    if (!draft?.barcode) { offProductExists = null; return; }
    if (_lastCheckedBarcode === draft.barcode) return;
    _lastCheckedBarcode = draft.barcode;
    try {
      const existing = await lookupBarcode(draft.barcode);
      offProductExists = !!existing;
    } catch { offProductExists = false; }
  }
  $: if (editing && draft?.barcode && draft.barcode !== _lastCheckedBarcode) _refreshOffPresence();

  async function _openOffPage() {
    const url = 'https://world.openfoodfacts.org/product/' + encodeURIComponent(draft.barcode);
    try {
      if (isNative) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url });
      } else {
        window.open(url, '_blank', 'noopener');
      }
    } catch { window.open(url, '_blank', 'noopener'); }
  }

  async function shareOrViewOnOFF() {
    if (!draft.barcode) { showError('Add a barcode first'); return; }
    if (offProductExists) { await _openOffPage(); return; }
    if (!draft.name) { showError('Add a name first'); return; }
    contributing = true; offSuccess = false; offVerified = null;
    try {
      const existing = await lookupBarcode(draft.barcode);
      if (existing) {
        offProductExists = true;
        contributing = false;
        await _openOffPage();
        return;
      }
      await contributeToOFF(draft, {
        offUsername: $offUsername, offPassword: $offPassword,
        offUploadCountry: $offUploadCountry,
      });
      offSuccess = true;
      offProductExists = true;
      setTimeout(() => offSuccess = false, 3000);
      setTimeout(async () => {
        try {
          const found = await lookupBarcode(draft.barcode);
          offVerified = !!found;
        } catch { offVerified = false; }
      }, 3000);
    } catch (e) { showError(e.message || 'Share to OFF failed'); }
    finally { contributing = false; }
  }

// ── Linked nutrient scaling ────────────────────────────────────────
  function onServingSizeInput() {
    if (!linked || _lastServingSize == null) {
      _lastServingSize = Number(draft.serving_size) || null;
      return;
    }
    const next = Number(draft.serving_size);
    if (!Number.isFinite(next) || next <= 0 || _lastServingSize <= 0) {
      _lastServingSize = next || _lastServingSize;
      return;
    }
    const ratio = next / _lastServingSize;
    if (!Number.isFinite(ratio) || ratio === 1) { _lastServingSize = next; return; }
    const prev = draft.nutrition || {};
    const scaled = { ...prev, _derived: { ...(prev._derived || {}) } };
    for (const [k, v] of Object.entries(scaled)) {
      if (k === '_derived') continue;
      if (typeof v === 'number' && Number.isFinite(v)) {
        scaled[k] = Math.round(v * ratio * 100) / 100;
      }
    }
    if (Number(scaled.sodium) > 0 && !scaled._derived.sodium) {
      delete scaled.salt; delete scaled._derived.salt;
    } else if (Number(scaled.salt) > 0 && !scaled._derived.salt) {
      delete scaled.sodium; delete scaled._derived.sodium;
    }
    draft = { ...draft, nutrition: deriveSodiumSalt(scaled) };
    _lastServingSize = next;
  }

  // ── Nutrient helpers ───────────────────────────────────────────────
  function _setNutrient(key, raw) {
    const value = (raw === '' || raw == null) ? undefined : Number(raw);
    const prev = draft.nutrition || {};
    const next = { ...prev, _derived: { ...(prev._derived || {}) } };
    if (value == null || !Number.isFinite(value)) delete next[key];
    else next[key] = value;
    if (key === 'sodium' || key === 'salt') {
      const other = key === 'sodium' ? 'salt' : 'sodium';
      delete next._derived[key];
      delete next[other];
      delete next._derived[other];
    }
    draft = { ...draft, nutrition: deriveSodiumSalt(next) };
  }
  function _getNutrient(id) {
    const v = draft?.nutrition?.[id];
    return Number.isFinite(v) ? v : '';
  }

  // ── Save / Cancel / Delete ─────────────────────────────────────────
  async function saveEdit() {
    if (!draft.name?.trim()) { showError('Name is required'); return; }
    saving = true;
    try {
      const qtyNum = draft.quantity === '' || draft.quantity == null ? null : Number(draft.quantity);
      const payload = {
        name: draft.name.trim(),
        brand: draft.brand?.trim() || null,
        barcode: draft.barcode?.toString().trim() || null,
        in_stock: qtyNum === 0 ? 0 : 1,
        quantity: qtyNum,
        notes: draft.notes?.trim() || null,
        img_url: draft.img_url || null,
        category: draft.category || null,
        category_id: draft.category_id ?? null,
        serving_size: draft.serving_size === '' || draft.serving_size == null ? null : Number(draft.serving_size),
        serving_unit: draft.serving_unit || null,
        nutrition: draft.nutrition && Object.keys(draft.nutrition).length ? draft.nutrition : null,
      };
      if (itemId == null) {
        const row = await NtApi.createPantryItem(payload);
        showSuccess('Added to pantry');
        const finalRow = row && row.id ? row : { ...payload, id: row?.id };
        dispatch('created', finalRow);
        open = false;
      } else {
        await NtApi.updatePantryItem(itemId, payload);
        showSuccess('Saved');
        item = { ...item, ...payload, id: itemId };
        dispatch('changed', { ...item });
        editing = false;
        draft = null;
      }
    } catch (e) { showError(e.message || 'Save failed'); }
    finally { saving = false; }
  }

  function cancelEdit() {
    if (itemId == null) { open = false; return; }
    editing = false;
    draft = null;
  }

  async function deleteItem() {
    if (!item || itemId == null) return;
    const ok = await confirmDialog({
      title: 'Remove from pantry?',
      message: `"${item.name}" will be removed. Recipes referencing it stay; this just drops it from your library.`,
      confirmText: 'Remove', dangerous: true,
    });
    if (!ok) return;
    try {
      await NtApi.deletePantryItem(itemId);
      showSuccess('Removed');
      const id = itemId;
      open = false;
      dispatch('deleted', { id });
    } catch (e) { showError(e.message || 'Delete failed'); }
  }

  // Inline quick qty +/- removed in v1.0 — quantity is changed in the
  // sheet's edit mode. The qty-row CSS rules were stripped alongside.

  // ── Derived display ────────────────────────────────────────────────
  $: isInStock = item ? !(Number(item.quantity) === 0) : true;
  $: servingDescription = (item && item.serving_size && item.serving_unit)
    ? `${item.serving_size} ${item.serving_unit}`
    : '';
  $: hasNutrition = !!(item && item.nutrition && Object.keys(item.nutrition).filter(k => k !== '_derived').length > 0);

  $: sheetTitle = !item
    ? 'Pantry Item'
    : (itemId == null ? 'Add Pantry Item' : (editing ? 'Edit Pantry Item' : (item.name || 'Pantry Item')));
</script>

<Sheet bind:open title={sheetTitle} height="auto">
  <!-- Header action icons sit next to the Sheet's close (X) button —
       mirrors the recipe-view header chrome so detail surfaces feel
       uniform. View mode: Edit (pencil) + Delete (trash). Edit mode:
       Cancel (revert) + Save (checkmark). Order matches RecipeView. -->
  <svelte:fragment slot="headerActions">
    {#if item && !loading && !loadError}
      {#if editing}
        <button class="btn-icon danger" on:click={cancelEdit} disabled={saving}
          aria-label="Cancel" title="Cancel">
          <span class="material-symbols-rounded">undo</span>
        </button>
        <button class="btn-icon success" on:click={saveEdit} disabled={saving || imgUploading}
          aria-label={saving ? 'Saving' : 'Save'} title={saving ? 'Saving…' : 'Save'}>
          <span class="material-symbols-rounded">{saving ? 'progress_activity' : 'check'}</span>
        </button>
      {:else}
        <button class="btn-icon" on:click={_startEdit} aria-label="Edit" title="Edit">
          <span class="material-symbols-rounded">edit</span>
        </button>
        <button class="btn-icon danger" on:click={deleteItem} aria-label="Delete" title="Delete">
          <span class="material-symbols-rounded">delete</span>
        </button>
      {/if}
    {/if}
  </svelte:fragment>

  {#if loading}
    <div class="state" in:fade={{ duration: 120 }}>
      <span class="material-symbols-rounded spin">progress_activity</span>
    </div>
  {:else if loadError}
    <div class="state error">
      <span class="material-symbols-rounded">error</span>
      <p>{loadError}</p>
      {#if itemId != null}
        <button class="btn btn-secondary" on:click={() => _enterViewOrEditMode(itemId, false)}>Retry</button>
      {/if}
    </div>
  {:else if item}
    <div class="sheet-content">
      <!-- Two-column layout on desktop: identity (large photo + brand
           + meta pills) on the left, stats + nutrition on the right.
           Mobile collapses to a single column. SAME structure in view
           AND edit mode — fields just flip to inputs in place. -->
      <div class="grid">
        <!-- LEFT — identity column -->
        <div class="col-identity">
          {#if editing}
            <ImagePicker bind:value={draft.img_url} bind:uploading={imgUploading}
              aspect="1 / 1" expand placeholder="Add a Photo" />
          {:else}
            {#if item.img_url}
              <!-- Wrapper clips the image to rounded corners via
                   overflow:hidden, mirroring ImagePicker.preview-wrap.
                   Without the wrapper the image's own white background
                   leaks past the inner border-radius and the photo
                   looks square. -->
              <div class="hero-wrap">
                <img class="hero-photo" src={resolveAssetUrl(item.img_url)} alt="" />
              </div>
            {:else}
              <div class="hero-wrap">
                <div class="hero-stub">
                  <span class="material-symbols-rounded">{categoryIcon(item.category)}</span>
                </div>
              </div>
            {/if}
          {/if}
          <div class="identity-info">
            {#if editing}
              <label class="field">
                <span class="field-label">Name</span>
                <input class="input" type="text" bind:value={draft.name} placeholder="Iodized Salt" />
              </label>
              <label class="field">
                <span class="field-label">Brand</span>
                <input class="input" type="text" bind:value={draft.brand} placeholder="Morton" />
              </label>
              <label class="field">
                <span class="field-label">Category</span>
                <Combobox
                  bind:this={comboCategoryRef}
                  mode="single"
                  value={categoryName}
                  options={pantryCategories.map(c => ({ name: c.name, icon: c.icon, color: c.color }))}
                  placeholder="Pick or create…"
                  creatable={true}
                  createLabel="Create category"
                  on:select={onPantryCategorySelect}
                  on:create={openNewPantryCategoryDialog}
                  on:change={(e) => {
                    if (!e.detail) { draft.category_id = null; draft.category = ''; draft = { ...draft }; }
                  }}
                />
              </label>
              <label class="field">
                <span class="field-label">Barcode</span>
                <div class="barcode-wrap">
                  <input class="input barcode-input" type="text" inputmode="numeric"
                    bind:value={draft.barcode} placeholder="optional" />
                  <button type="button" class="barcode-scan-inline" aria-label="Scan barcode" title="Scan barcode"
                    on:click={() => editorScannerOpen = true}>
                    <span class="material-symbols-rounded">barcode_scanner</span>
                  </button>
                </div>
              </label>
              {#if $offEnabled && draft.barcode}
                <div class="off-actions">
                  <button type="button" class="btn btn-secondary off-btn"
                    on:click={shareOrViewOnOFF} disabled={contributing}
                    title={offProductExists ? 'Open this product on Open Food Facts' : !draft.name ? 'Name required' : 'Submit this item to OFF (requires OFF account in Settings)'}>
                    <span class="material-symbols-rounded off-btn-ico">
                      {offProductExists ? 'open_in_new' : 'upload'}
                    </span>
                    {contributing ? 'Uploading…' : offSuccess ? 'Submitted!' : offProductExists ? 'View on OFF' : 'Share to OFF'}
                  </button>
                  <button type="button" class="btn btn-secondary off-btn"
                    on:click={downloadFromOFF} disabled={downloading}
                    title="Pull data from Open Food Facts">
                    <span class="material-symbols-rounded off-btn-ico">download</span>
                    {downloading ? 'Loading…' : downloadSuccess ? 'Updated!' : 'Refresh from OFF'}
                  </button>
                </div>
                {#if offSuccess}
                  <div class="off-verify-row">
                    {#if offVerified === null}
                      <span class="off-verify-checking">
                        <span class="material-symbols-rounded off-verify-ico">hourglass_top</span>
                        Verifying on Open Food Facts…
                      </span>
                    {:else if offVerified}
                      <span class="off-verify-ok">
                        <span class="material-symbols-rounded off-verify-ico">check_circle</span>
                        Confirmed live on Open Food Facts
                      </span>
                    {:else}
                      <span class="off-verify-pending">
                        <span class="material-symbols-rounded off-verify-ico">schedule</span>
                        Submitted, may take a few minutes to appear
                      </span>
                    {/if}
                  </div>
                {/if}
              {/if}
            {:else}
              {#if item.brand}<div class="brand">{item.brand}</div>{/if}
              <div class="meta-pills">
                {#if item.category}
                  <span class="pill">
                    <span class="material-symbols-rounded">{categoryIcon(item.category)}</span>
                    {categoryLabel(item.category)}
                  </span>
                {/if}
                {#if item.barcode}
                  <span class="pill subtle">
                    <span class="material-symbols-rounded">barcode_scanner</span>
                    {item.barcode}
                  </span>
                {/if}
                <span class="pill" class:in={isInStock} class:out={!isInStock}>
                  <span class="material-symbols-rounded">{isInStock ? 'check_circle' : 'remove_shopping_cart'}</span>
                  {isInStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
            {/if}
          </div>
        </div>

        <!-- RIGHT — data column (stats + nutrition) -->
        <div class="col-data">
          <!-- Stats stack as full-width horizontal strips. Inputs inside
               each strip flow left-to-right and wrap to a second line
               naturally when the row runs out of width — they don't all
               have to fit on a single line. -->
          <!-- Single combined strip: On Hand on the left (qty +/- in
               view; plain number input in edit) + Serving Size on the
               right (size + unit picker). Quantity is just a number;
               the qty-unit field was removed in v1.0 (most users left
               it blank and nothing downstream consumed it). -->
          <!-- On Hand + Serving Size as two separate bordered stat cards
               sitting side-by-side in a flex row. Each keeps its own
               surface so the visual rhythm matches a paired-card layout
               rather than a single combined strip. -->
          <div class="stats">
            <div class="stat">
              <div class="stat-label">On Hand</div>
              {#if editing}
                <input class="input num" type="number" min="0" step="0.01"
                  bind:value={draft.quantity} placeholder="0" />
              {:else}
                <!-- View mode: pure display. The In Stock pill already
                     communicates stock state; the stat shows an em-dash
                     when quantity is untracked (null) instead of "Not
                     set" so the card reads cleanly. -->
                <div class="stat-value">
                  {#if item.quantity == null}
                    <span class="muted">—</span>
                  {:else}
                    {item.quantity}
                  {/if}
                </div>
              {/if}
            </div>
            <div class="stat">
              <div class="stat-label">Serving Size</div>
              {#if editing}
                <div class="stat-edit">
                  <input class="input num" type="number" min="0" step="any"
                    bind:value={draft.serving_size} on:input={onServingSizeInput} placeholder="100" />
                  <UnitPicker bind:value={draft.serving_unit} placeholder="g" />
                </div>
              {:else}
                <div class="stat-value">
                  {#if item.serving_size}
                    {item.serving_size} {item.serving_unit || 'g'}
                  {:else}
                    <span class="muted">Not set</span>
                  {/if}
                </div>
              {/if}
            </div>
          </div>

          {#if hasNutrition && !editing}
            <div class="nutrition-wrap">
              <NutritionFactsBox nutrition={item.nutrition} servingDescription={servingDescription} />
            </div>
          {/if}
          {#if editing}
            <div class="nutrient-edit">
              <div class="nutrient-edit-head">
                <span class="field-label">Nutrition <span class="muted">per serving</span></span>
                <div class="nutrient-edit-actions">
                  <button type="button" class="link-toggle small" class:linked
                    title={linked
                      ? 'Linked: nutrient values scale proportionally when serving size changes'
                      : 'Unlinked: nutrient values stay put when serving size changes'}
                    aria-label="Toggle proportional scaling"
                    on:click={() => linked = !linked}>
                    <span class="material-symbols-rounded">{linked ? 'link' : 'link_off'}</span>
                  </button>
                  <button class="btn-link" on:click={() => allNutrientsOpen = true}>
                    Edit All Nutrients
                  </button>
                </div>
              </div>
              <div class="nutrient-grid">
                {#each visibleInlineNutriments as n}
                  {@const derived = (n.id === 'sodium' || n.id === 'salt') && isDerived(draft.nutrition, n.id)}
                  <label class="nutrient-row">
                    <span class="nutrient-name">
                      {n.label}
                      {#if derived}
                        <span class="material-symbols-rounded derived-badge"
                          title={n.id === 'sodium' ? 'Auto-calculated from salt' : 'Auto-calculated from sodium'}>calculate</span>
                      {/if}
                    </span>
                    <span class="nutrient-input">
                      <input class="input" type="number" min="0" step="any"
                        value={_getNutrient(n.id)}
                        on:input={(e) => _setNutrient(n.id, e.target.value)}
                        placeholder="0" />
                      <span class="nutrient-unit">{n.unit}</span>
                    </span>
                  </label>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>

      {#if editing}
        <label class="field full">
          <span class="field-label">Notes</span>
          <textarea class="input" rows="3" bind:value={draft.notes}
            placeholder="Where you bought it, what works well, etc."></textarea>
        </label>
      {:else if item.notes}
        <div class="notes">
          <div class="notes-label">Notes</div>
          <p class="notes-body">{item.notes}</p>
        </div>
      {/if}

      <!-- Footer actions moved to the sheet header (icon buttons next
           to the X close, mirroring RecipeView) for uniform detail-
           surface chrome. -->
    </div>
  {/if}
</Sheet>

<!-- Full-nutrient sub-sheet (stacked on top of the main sheet). -->
{#if editing && draft}
  <Sheet bind:open={allNutrientsOpen} title="All Nutrients" height="full">
    <p class="all-nutrients-hint">
      Enter values for any nutrient. Your global "visible nutriments" setting (in Settings → Nutrition) is unchanged, these are stored just for this pantry item. Leave a field blank to skip it.
    </p>
    <div class="all-nutrients-grid">
      {#each NUTRIMENTS as n}
        <label class="nutrient-row">
          <span class="nutrient-name">
            {n.label}
            {#if n.subOf}<span class="nutrient-sub">({n.category})</span>{/if}
          </span>
          <span class="nutrient-input">
            <input class="input" type="number" min="0" step="any"
              value={_getNutrient(n.id)}
              on:input={(e) => _setNutrient(n.id, e.target.value)}
              placeholder="0" />
            <span class="nutrient-unit">{n.unit}</span>
          </span>
        </label>
      {/each}
    </div>
    <div class="all-nutrients-footer">
      <button class="btn btn-primary" on:click={() => allNutrientsOpen = false}>Done</button>
    </div>
  </Sheet>
{/if}

<!-- New-category dialog (stacked over the sheet). -->
<Sheet bind:open={categoryNewOpen} title="New Pantry Category" height="auto">
  <div class="newcat-body">
    <label class="field-label">Name</label>
    <input class="input" type="text" bind:value={categoryNewName} placeholder="Baking" />
    <label class="field-label" style="margin-top:10px">Icon (Material Symbols name)</label>
    <input class="input" type="text" bind:value={categoryNewIcon} placeholder="kitchen" />
    <p class="field-hint">Browse names at <a href="https://fonts.google.com/icons" target="_blank" rel="noopener">Material Symbols</a>. The picker page (Manage → Pantry Categories) has an icon search.</p>
    <div class="newcat-actions">
      <button class="btn btn-secondary" on:click={() => categoryNewOpen = false}>Cancel</button>
      <button class="btn btn-primary" on:click={confirmNewPantryCategory}>Create</button>
    </div>
  </div>
</Sheet>

<!-- Inline barcode scanner. -->
<BarcodeScanner bind:open={editorScannerOpen} on:scan={onScan} on:close={() => editorScannerOpen = false} />

<style>
  .state { padding: 40px 0; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-3); }
  .state.error { color: var(--danger); }
  .spin { animation: spin 1.2s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .sheet-content { display: flex; flex-direction: column; gap: 14px; padding: 4px 4px 12px; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
  .col-identity {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  /* Hero photo + stub sit inside a rounded wrapper with overflow
     hidden, so any white-background photo gets cleanly clipped at the
     rounded corners — mirroring ImagePicker's preview-wrap in edit
     mode so view and edit feel identical. */
  .hero-wrap {
    width: calc(100% - 16px);
    aspect-ratio: 1 / 1;
    margin: 8px;
    background: var(--surface-2);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .hero-photo {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .hero-stub {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
  }
  .hero-stub .material-symbols-rounded { font-size: 64px; color: var(--text-3); }
  .identity-info { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .col-data { display: flex; flex-direction: column; gap: 12px; }
  .brand { color: var(--text-3); font-size: 13px; font-weight: 500; }
  .meta-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .pill {
    display: inline-flex; align-items: center; gap: 4px;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: var(--radius-full, 99px);
    padding: 3px 9px; font-size: 11px; font-weight: 600;
  }
  .pill.subtle { background: var(--surface-2); color: var(--text-3); border-color: var(--border); }
  .pill .material-symbols-rounded { font-size: 14px; }
  .pill.in {
    background: color-mix(in srgb, var(--success, #4caf50) 14%, transparent);
    color: var(--success, #4caf50);
    border-color: color-mix(in srgb, var(--success, #4caf50) 35%, transparent);
  }
  .pill.out {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 35%, transparent);
  }

  /* Stats — two bordered stat cards side-by-side. On Hand stays
     narrow (just a qty number); Serving Size takes the remaining
     width so its [num][unit picker] row fits comfortably. */
  .stats { display: flex; flex-direction: row; gap: 8px; align-items: stretch; }
  .stat {
    min-width: 0;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    display: flex; flex-direction: column; gap: 6px;
  }
  /* On Hand: fixed-narrow. Serving Size: fills the rest. */
  .stat:first-child  { flex: 0 0 110px; padding: 12px 10px; }
  .stat:last-child   { flex: 1 1 0; }
  /* On Hand's number input fills its (narrow) card. */
  .stat > .input.num { width: 100%; max-width: 100%; }
  .stat-label .muted { color: var(--text-3); font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 4px; }
  .stat-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); }
  .stat-value { font-size: 16px; font-weight: 700; color: var(--text-1); }
  .stat-value .muted { color: var(--text-3); font-weight: 400; font-size: 14px; }
  .stat-sub { font-size: 12px; color: var(--text-3); }


  .nutrition-wrap { display: flex; justify-content: center; }

  .notes {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 14px;
  }
  .notes-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); margin-bottom: 4px; }
  .notes-body { margin: 0; color: var(--text-2); font-size: 14px; line-height: 1.5; white-space: pre-wrap; }

  .actions {
    display: flex; gap: 8px; justify-content: space-between;
    padding-top: 4px;
  }
  .actions .btn {
    flex: 1; height: 44px; font-size: 14px;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  }
  .actions .btn .material-symbols-rounded { font-size: 18px; }
  .danger-btn {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
  }
  .danger-btn:hover {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
  }

  /* ── Edit-mode form bits ───────────────────────────────────────── */
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field.full { grid-column: 1 / -1; }
  .field.tight { margin-top: 6px; }
  .field-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--text-3);
  }
  .field-hint { font-size: 11px; color: var(--text-3); line-height: 1.4; margin: 4px 0 0; }
  .input {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    color: var(--text-1); font-size: 14px;
    box-sizing: border-box; width: 100%;
  }
  .input:focus { outline: 2px solid var(--accent-dim); border-color: var(--accent); }
  .input.num { font-variant-numeric: tabular-nums; }
  textarea.input { resize: vertical; min-height: 60px; font-family: inherit; }

  /* Barcode input + inline scan icon. */
  .barcode-wrap { position: relative; display: flex; }
  .barcode-input { padding-right: 44px; }
  .barcode-scan-inline {
    position: absolute; right: 4px; top: 50%;
    transform: translateY(-50%);
    width: 36px; height: 36px;
    border: none; background: transparent;
    color: var(--text-3); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .barcode-scan-inline:hover { color: var(--accent); }

  /* OFF action buttons. Wrap to a second row when the column is too
     narrow for both to sit side-by-side comfortably (mobile view). */
  .off-actions { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
  .off-btn {
    flex: 1 1 calc(50% - 3px); min-width: 0;
    font-size: 12px; padding: 8px 10px; height: 36px;
    display: inline-flex; align-items: center; justify-content: center;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .off-btn-ico { font-size: 14px; vertical-align: middle; margin-right: 3px; flex-shrink: 0; }
  .off-verify-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; font-size: 12px; padding: 6px 2px 0;
  }
  .off-verify-ico { font-size: 14px; vertical-align: middle; margin-right: 4px; }
  .off-verify-checking { color: var(--text-3); }
  .off-verify-ok { color: var(--success, #4caf50); }
  .off-verify-pending { color: var(--text-3); }

  /* Stat-cell edit row: horizontal flow with wrap. Number stays
     compact (~90px), the unit picker takes ~130px so "cup ▾" fits,
     and any trailing free-text input (`.input.grow`) eats the
     remaining space. Wraps to a second line when the row can't hold
     it all. The :global(.unit-picker) rule is required because the
     global forms.css `.input { width: 100% }` would otherwise make
     the UnitPicker claim full width and wrap below the number. */
  .stat-edit { display: flex; gap: 6px; align-items: stretch; flex-wrap: nowrap; }
  .stat-edit .input.num { flex: 0 0 90px; width: 90px; min-width: 0; }
  .stat-edit .input.grow { flex: 1 1 140px; min-width: 0; }
  /* Unit picker grows into remaining cell width and shrinks freely
     so [num][unit] always stays on the same row inside the Serving
     Size card. */
  .stat-edit :global(.unit-picker) { flex: 1 1 0; min-width: 60px; }
  .stat-edit :global(.unit-picker .input) { width: 100%; }
  .stat-edit > :global(*) { min-width: 0; }
  /* Link-scaling toggle now lives in the nutrient header, not the
     serving-size row. Compact size to match the inline-link Edit All
     Nutrients button next to it. */
  .link-toggle {
    width: 30px; height: 30px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-3); cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .link-toggle.linked { color: var(--accent); border-color: var(--accent); }
  .link-toggle .material-symbols-rounded { font-size: 16px; }
  .nutrient-edit-actions { display: inline-flex; align-items: center; gap: 8px; }

  /* Inline nutrient inputs grid. */
  .nutrient-edit {
    display: flex; flex-direction: column; gap: 8px;
    padding: 12px 14px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .nutrient-edit-head {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .nutrient-edit-head .muted { color: var(--text-3); font-weight: 400; text-transform: none; letter-spacing: 0; }
  .btn-link {
    background: transparent; border: none; padding: 0;
    color: var(--accent); font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: inherit;
  }
  .btn-link:hover { text-decoration: underline; }
  .nutrient-grid { display: flex; flex-direction: column; gap: 4px; }
  .nutrient-row {
    display: grid; grid-template-columns: 1fr auto;
    align-items: center; gap: 8px; font-size: 13px;
  }
  .nutrient-name { color: var(--text-2); display: inline-flex; align-items: center; gap: 4px; }
  .nutrient-sub { color: var(--text-3); font-size: 11px; margin-left: 4px; }
  .nutrient-input { display: inline-flex; align-items: center; gap: 4px; }
  .nutrient-input .input {
    width: 80px; height: 32px;
    padding: 4px 8px; font-size: 13px; text-align: right;
  }
  .nutrient-unit { color: var(--text-3); font-size: 12px; min-width: 24px; }
  .derived-badge { font-size: 14px; color: var(--accent); cursor: help; }

  /* All-nutrient sub-sheet body. */
  .all-nutrients-hint { margin: 0 0 12px; color: var(--text-3); font-size: 13px; line-height: 1.5; }
  .all-nutrients-grid {
    display: grid; grid-template-columns: 1fr;
    gap: 4px; padding-bottom: 16px;
  }
  @media (min-width: 600px) {
    .all-nutrients-grid { grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  }
  .all-nutrients-footer {
    display: flex; justify-content: flex-end;
    padding-top: 8px; border-top: 1px solid var(--border);
    margin-top: 12px;
  }
  .all-nutrients-footer .btn { min-width: 120px; height: 40px; }

  /* New-category dialog body. */
  .newcat-body { display: flex; flex-direction: column; gap: 4px; padding: 8px 4px 12px; }
  .newcat-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 12px; }
  .newcat-actions .btn { min-width: 110px; height: 40px; }

  /* Responsive */
  @media (min-width: 768px) {
    .grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
      gap: 16px;
      align-items: start;
    }
  }
</style>
