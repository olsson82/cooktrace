/**
 * brand-mark.js — inline SVG fragment of the CookTrace mark for use
 * inside share cards (recipe + shopping). Simplified vs the app icon
 * (no filters / gradients) so it rasterises cleanly at small sizes
 * and embeds inside any SVG canvas without ID clashes.
 *
 * The mark mirrors the full logo: three fork tines, neck + handle,
 * sweeping "trace" curve up to a dot in the upper-right.
 */

/**
 * Render the brand glyph at (x, y) with a side-length of `size`. The
 * mark is drawn in a 24-unit viewBox so the caller picks pixel size.
 *
 * @param {number} x       top-left x in SVG coordinates
 * @param {number} y       top-left y in SVG coordinates
 * @param {number} size    rendered width = height in SVG pixels
 * @returns {string}       SVG fragment to inline inside a parent <svg>
 */
export function brandGlyph(x, y, size = 22) {
  const s = size / 24; // scale factor against the 24-unit design grid
  return `
    <g transform="translate(${x}, ${y}) scale(${s})" fill="#4FFFB0">
      <!-- Three fork tines -->
      <rect x="2"   y="1.5" width="1.6" height="6" rx="0.8" />
      <rect x="5.2" y="1.5" width="1.6" height="6" rx="0.8" />
      <rect x="8.4" y="1.5" width="1.6" height="6" rx="0.8" />
      <!-- Neck curve under the tines -->
      <path d="M 2.4 7.5 C 2.4 10.2 6 10.6 6 10.6 C 6 10.6 9.6 10.2 9.6 7.5"
            fill="none" stroke="#4FFFB0" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Handle -->
      <rect x="5.2" y="10.4" width="1.6" height="8" rx="0.8" />
      <!-- Trace curve sweeping up to the dot -->
      <path d="M 6 18.4 C 8.5 17.3 12.5 13.4 19 6"
            fill="none" stroke="#4FFFB0" stroke-width="1.5" stroke-linecap="round" />
      <!-- Trace end-dot -->
      <circle cx="19" cy="6" r="1.6" />
    </g>
  `;
}

/**
 * Convenience helper: render the brand glyph + "COOKTRACE" wordmark
 * as a single horizontally-centered footer block at (centerX, baseline).
 * Used identically by recipe and shopping cards so the footer reads
 * the same across share types.
 *
 * @param {number} centerX  horizontal centre of the footer
 * @param {number} baseline y-coordinate of the wordmark's baseline
 * @param {number} [glyph]  glyph size in px (default 22)
 * @returns {string}        SVG fragment
 */
export function brandFooter(centerX, baseline, glyph = 22) {
  // Rough width of "COOKTRACE" at font-size 13 with letter-spacing 3:
  // 9 chars × ~7px + 8 × 3px = ~87px. Glyph + 8px gap = ~117px total.
  const textWidth = 87;
  const gap = 10;
  const totalW = glyph + gap + textWidth;
  const x0 = centerX - totalW / 2;
  const glyphY = baseline - glyph + 4;
  return `
    ${brandGlyph(x0, glyphY, glyph)}
    <text x="${x0 + glyph + gap}" y="${baseline}"
      font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      font-size="13" font-weight="700" letter-spacing="3" fill="#4FFFB0">COOKTRACE</text>
  `;
}
