<script>
  /**
   * PhotoImportDialog — first-class "Import from Photo" entry on the
   * Recipes page. Same plumbing as the Trace chat photo flow, but
   * surfaced as a standalone modal so users discover it without going
   * through the assistant.
   *
   * Flow:
   *   1. User picks (or takes) an image
   *   2. Image is sent to the configured AI provider with a tight
   *      system prompt that says "extract the recipe and call
   *      create_recipe". Tool catalog is cut down to just create_recipe
   *      so the model can't get distracted.
   *   3. We capture the created recipe via aiChat's onToolResult hook,
   *      then navigate to the new recipe.
   *
   * Env-locked installs disable this — the server proxy doesn't relay
   * tools, so photo import via the proxy can't write a recipe.
   */
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { push } from 'svelte-spa-router';
  import {
    aiEnabled, aiProvider, aiApiKey, aiModel, aiBaseUrl,
  } from '../../stores/settings.js';
  import { showError, showSuccess } from '../../stores/toast.js';
  import { portal } from '../../lib/portal.js';
  import { callAI, TOOLS, AI_DEFAULT_MODELS } from '../../lib/aiChat.js';

  export let open = false;
  export let envLocked = false;
  const dispatch = createEventDispatcher();

  let phase = 'pick';   // 'pick' | 'busy' | 'done' | 'error'
  let preview = null;   // data URL
  let rawImage = null;  // { base64, mimeType }
  let progressLine = '';
  let createdRecipe = null;
  let errorMessage = '';
  let _fileInput;

  $: if (open) _reset();

  function _reset() {
    phase = 'pick';
    preview = null;
    rawImage = null;
    progressLine = '';
    createdRecipe = null;
    errorMessage = '';
  }

  function close() {
    open = false;
    dispatch('close');
  }

  function _pickFile() { _fileInput?.click(); }
  function _onFile(e) {
    const f = e.target?.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      showError('Pick an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      preview = dataUrl;
      rawImage = {
        base64: String(dataUrl).split(',')[1] || '',
        mimeType: f.type || 'image/jpeg',
      };
    };
    reader.readAsDataURL(f);
    if (e.target) e.target.value = '';
  }
  function _clearPick() { preview = null; rawImage = null; }

  function _buildImageMessage(provider, text, image) {
    if (provider === 'claude') {
      return { role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
        { type: 'text', text },
      ]};
    } else if (provider === 'gemini') {
      return { role: 'user', content: text, _image: image };
    }
    // OpenAI + OpenAI-compatible
    return { role: 'user', content: [
      { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
      { type: 'text', text },
    ]};
  }

  // Cut down the tool catalog: create_recipe only, so the model can't
  // wander into get_pantry or anything else while reading the photo.
  $: photoTools = TOOLS.filter(t => t.name === 'create_recipe');

  async function importIt() {
    if (!rawImage) return;
    phase = 'busy';
    progressLine = 'Trace is reading the photo…';
    createdRecipe = null;

    const provider = $aiProvider;
    const apiKey   = $aiApiKey;
    const model    = $aiModel || AI_DEFAULT_MODELS[provider] || '';
    const baseUrl  = $aiBaseUrl;

    const sys = `You are CookTrace's recipe-import vision assistant. The user has attached a photo of a recipe. Extract the recipe and call the create_recipe tool with the result.

Rules:
- ALWAYS call create_recipe. Don't summarize or describe what you see in plain text.
- Pull a clean recipe name (drop magazine flourishes like "Aunt Edna's Famous").
- Ingredients: split into qty / unit / name / note. Qty stays as a string ("1", "1/2", "1 1/2").
- Steps: numbered. Use a short title only when the source has one.
- If the image isn't a recipe (or is illegible), call create_recipe anyway with a stub name like "Imported Recipe" and a single step explaining what you saw, so the user can clean it up.
- Don't fabricate. If a field isn't visible, omit it.`;

    const userMsg = _buildImageMessage(provider, 'Please import this recipe.', rawImage);

    try {
      await callAI({
        provider, apiKey, model, baseUrl,
        messages: [userMsg],
        systemPrompt: sys,
        tools: photoTools,
        onToolCall:   (name) => { progressLine = `Calling ${name.replace(/_/g, ' ')}…`; },
        onToolResult: (name, result) => {
          if (name === 'create_recipe' && result && result.ok && result.recipe) {
            createdRecipe = result.recipe;
          }
        },
      });
      if (createdRecipe) {
        phase = 'done';
        progressLine = '';
      } else {
        phase = 'error';
        errorMessage = 'Trace finished but did not save a recipe. Try a clearer photo or import via chat.';
      }
    } catch (e) {
      phase = 'error';
      errorMessage = e.message || 'Photo import failed.';
    }
  }

  function openCreated() {
    if (!createdRecipe) return;
    showSuccess(`Imported "${createdRecipe.name}"`);
    close();
    push(`/recipes/${createdRecipe.id}`);
  }
</script>

{#if open}
  <div class="backdrop" use:portal on:click={close}
    in:fade={{ duration: 140 }} out:fade={{ duration: 100 }}>
    <div class="modal" on:click|stopPropagation>
      <header class="head">
        <h3>Import from Photo</h3>
        <button class="btn-icon" on:click={close} aria-label="Close" title="Close">
          <span class="material-symbols-rounded">close</span>
        </button>
      </header>

      {#if envLocked}
        <div class="state info">
          <span class="material-symbols-rounded">lock</span>
          <p>Photo import isn't available when the AI provider is configured via environment variables (the server proxy doesn't relay tool calls). Ask the admin to switch to the user-key flow, or use Trace chat with image attach.</p>
        </div>
      {:else if !$aiEnabled}
        <div class="state info">
          <span class="material-symbols-rounded">smart_toy</span>
          <p>Trace is disabled. Enable it in <a href="#/settings" on:click|preventDefault={() => { close(); push('/settings'); }}>Settings → Trace Assistant</a> first.</p>
        </div>
      {:else if phase === 'pick'}
        <p class="hint">Snap a cookbook page, a handwritten card, or any photo with a recipe on it. Trace will read it and import the result.</p>
        {#if preview}
          <div class="preview-wrap">
            <img class="preview" src={preview} alt="" />
            <button class="preview-clear" on:click={_clearPick} aria-label="Pick a different image">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
        {:else}
          <button class="picker" on:click={_pickFile}>
            <span class="material-symbols-rounded">add_a_photo</span>
            <span>Pick a Photo</span>
            <span class="picker-sub">From your library or camera</span>
          </button>
        {/if}
        <input type="file" accept="image/*" capture="environment"
          bind:this={_fileInput} on:change={_onFile} hidden />
        <footer class="actions">
          <button class="btn btn-secondary" on:click={close}>Cancel</button>
          <button class="btn btn-primary" on:click={importIt} disabled={!rawImage}>
            <span class="material-symbols-rounded">auto_awesome</span>
            Import
          </button>
        </footer>
      {:else if phase === 'busy'}
        <div class="state busy">
          {#if preview}<img class="preview busy" src={preview} alt="" />{/if}
          <span class="material-symbols-rounded spin">progress_activity</span>
          <p class="progress">{progressLine || 'Working…'}</p>
        </div>
      {:else if phase === 'done'}
        <div class="state done">
          <span class="material-symbols-rounded done-icon">check_circle</span>
          <h4>Imported "{createdRecipe?.name || 'Recipe'}"</h4>
          <p>Trace saved it to your library. Open it to review and edit.</p>
        </div>
        <footer class="actions">
          <button class="btn btn-secondary" on:click={close}>Done</button>
          <button class="btn btn-primary" on:click={openCreated}>
            <span class="material-symbols-rounded">open_in_new</span>
            Open Recipe
          </button>
        </footer>
      {:else if phase === 'error'}
        <div class="state error">
          <span class="material-symbols-rounded">error</span>
          <p>{errorMessage}</p>
        </div>
        <footer class="actions">
          <button class="btn btn-secondary" on:click={close}>Cancel</button>
          <button class="btn btn-primary" on:click={() => phase = 'pick'}>Try Again</button>
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex; align-items: center; justify-content: center;
    z-index: 1200;
    padding: 16px;
  }
  .modal {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    width: 100%; max-width: 480px;
    max-height: 88vh;
    overflow-y: auto;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
    display: flex; flex-direction: column;
  }
  .head {
    display: flex; align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }
  .head h3 { flex: 1; margin: 0; font-size: 17px; font-weight: 700; color: var(--text-1); }
  .btn-icon {
    background: transparent; border: none; cursor: pointer;
    color: var(--text-3); padding: 4px;
    border-radius: var(--radius-sm);
  }
  .btn-icon:hover { color: var(--text-1); background: var(--surface-2); }
  .btn-icon .material-symbols-rounded { font-size: 22px; }

  .hint {
    margin: 14px 16px 0;
    color: var(--text-3); font-size: 13px; line-height: 1.5;
  }

  .picker {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 6px;
    margin: 16px;
    padding: 36px 20px;
    border: 2px dashed var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    color: var(--text-1);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color var(--dur-fast), background var(--dur-fast);
  }
  .picker:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--surface-2));
  }
  .picker .material-symbols-rounded { font-size: 36px; color: var(--accent); }
  .picker-sub { color: var(--text-3); font-size: 12px; font-weight: 500; }

  .preview-wrap {
    position: relative;
    margin: 16px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--surface-2);
  }
  .preview {
    width: 100%;
    max-height: 320px;
    object-fit: contain;
    display: block;
  }
  .preview-clear {
    position: absolute; top: 8px; right: 8px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    border-radius: 50%;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .preview-clear .material-symbols-rounded { font-size: 16px; }

  .state {
    margin: 20px 16px;
    text-align: center;
    color: var(--text-3);
    font-size: 14px;
    line-height: 1.5;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
  }
  .state .material-symbols-rounded { font-size: 36px; color: var(--accent); }
  .state.busy .preview {
    margin: 0 auto 6px;
    width: auto; max-width: 100%; max-height: 160px;
    border-radius: var(--radius-md);
  }
  .state.busy .spin { font-size: 32px; animation: spin 1.2s linear infinite; }
  .state.error .material-symbols-rounded { color: var(--error, #f87171); }
  .state.error p { color: var(--error, #f87171); }
  .state.done h4 { margin: 4px 0 0; color: var(--text-1); font-size: 16px; }
  .state.done p  { margin: 0; }
  .state.done .done-icon { color: var(--success, #4ade80); }
  .state.info p { color: var(--text-2); }
  .state.info a { color: var(--accent); }
  .progress { margin: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .actions {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
  }
  .actions .btn { display: inline-flex; align-items: center; gap: 6px; }
  .actions .btn .material-symbols-rounded { font-size: 16px; }
</style>
