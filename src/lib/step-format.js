/**
 * step-format.js — tiny markdown-ish formatter for recipe step text.
 *
 * Steps are stored as plain text so existing imports (Mealie, Tandoor,
 * Paprika, schema.org/Recipe) round-trip without a serialization
 * change. To let users emphasize key moments without forcing rich-text
 * markup into the storage layer, we accept three lightweight inline
 * markers in the text and render them to a small allowed-tag HTML
 * subset on display:
 *
 *     **bold**           → <strong>bold</strong>
 *     *italic*           → <em>italic</em>
 *     __underline__      → <u>underline</u>
 *
 * Anything else passes through as plain text. The output goes through
 * an HTML escape pass FIRST so user content can't smuggle script /
 * style / event handlers — only the three permitted tags survive.
 *
 * Time-chip detection (splitWithTimes) operates on the RAW text, so the
 * caller passes each plain-text segment through formatStepText() AFTER
 * splitting. This way "Bake **15 minutes**" still renders the time
 * chip on "15 minutes" and the bold on the surrounding word(s).
 */

function _escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a step-text fragment with bold / italic / underline markdown.
 * Returns an HTML string safe to inject via {@html ...}.
 */
export function formatStepText(text) {
  if (!text) return '';
  let out = _escapeHtml(text);
  // Bold: **...** — must come before italic so "**word**" isn't
  // mis-parsed as two italic *word*s.
  out = out.replace(/\*\*([^\*\n]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *...*
  out = out.replace(/\*([^\*\n]+)\*/g, '<em>$1</em>');
  // Underline: __...__
  out = out.replace(/__([^_\n]+)__/g, '<u>$1</u>');
  return out;
}
