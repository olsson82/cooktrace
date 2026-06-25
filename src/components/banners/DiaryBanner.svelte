<script>
  import { DB } from '../../lib/db.js';

  let noAnim = DB.getSetting('disableAnimations', false);
  let noLoop = !DB.getSetting('loopBannerAnimations', true);
  if (typeof window !== 'undefined') {
    window.addEventListener('wl:setting', () => {
      noAnim = DB.getSetting('disableAnimations', false);
      noLoop = !DB.getSetting('loopBannerAnimations', true);
    });
  }
</script>

<!--
  Cook Diary banner — wall calendar with meal dots scattered across days,
  current-day highlight, dinner plate + utensils on the right.
  Mirrors NutriTrace banner pattern (different from NT's diary banner —
  this is the cooking/meal-plan view).
-->
<svg
  class="cookdiary-banner-svg"
  class:no-anim={noAnim}
  class:no-loop={noLoop}
  viewBox="0 0 500 120"
  preserveAspectRatio="xMidYMid slice"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <defs>
    <radialGradient id="cdb-glow" cx="50%" cy="50%" r="42%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.18" />
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"    />
    </radialGradient>
    <linearGradient id="cdb-page-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.13" />
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.04" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="500" height="120" fill="url(#cdb-glow)" />

  <!-- Calendar grid (5 cols × 3 rows) on the left -->
  <rect class="cdb-page" x="100" y="14" width="220" height="92" rx="3" fill="url(#cdb-page-grad)" />

  <!-- Header bar -->
  <line class="cdb-header-line" x1="100" y1="30" x2="320" y2="30" />
  <text class="cdb-month" x="110" y="26">MAY</text>

  <!-- Vertical grid lines -->
  <line class="cdb-grid" x1="144" y1="30" x2="144" y2="106" />
  <line class="cdb-grid" x1="188" y1="30" x2="188" y2="106" />
  <line class="cdb-grid" x1="232" y1="30" x2="232" y2="106" />
  <line class="cdb-grid" x1="276" y1="30" x2="276" y2="106" />
  <!-- Horizontal grid lines -->
  <line class="cdb-grid" x1="100" y1="55" x2="320" y2="55" />
  <line class="cdb-grid" x1="100" y1="80" x2="320" y2="80" />

  <!-- Highlighted "today" cell -->
  <rect class="cdb-today" x="190" y="57" width="42" height="22" rx="2" />

  <!-- Meal-planned dots (scattered) -->
  <circle class="cdb-dot d1" cx="120" cy="42"  r="2" />
  <circle class="cdb-dot d2" cx="164" cy="42"  r="2" />
  <circle class="cdb-dot d3" cx="252" cy="42"  r="2" />
  <circle class="cdb-dot d4" cx="296" cy="42"  r="2" />
  <circle class="cdb-dot d5" cx="120" cy="68"  r="2" />
  <circle class="cdb-dot d6" cx="208" cy="68"  r="2.5" /> <!-- today -->
  <circle class="cdb-dot d7" cx="296" cy="68"  r="2" />
  <circle class="cdb-dot d8" cx="164" cy="92"  r="2" />
  <circle class="cdb-dot d9" cx="252" cy="92"  r="2" />

  <!-- Plate + utensils on right side -->
  <g class="cdb-plate">
    <circle class="cdb-plate-outer" cx="410" cy="60" r="32" />
    <circle class="cdb-plate-inner" cx="410" cy="60" r="22" />
  </g>
  <!-- Fork (left of plate) -->
  <g class="cdb-utensils">
    <line class="cdb-fork-handle" x1="368" y1="92" x2="378" y2="48" />
    <line class="cdb-tine" x1="376" y1="48" x2="378" y2="36" />
    <line class="cdb-tine" x1="378" y1="48" x2="380" y2="36" />
    <line class="cdb-tine" x1="380" y1="48" x2="382" y2="36" />
    <!-- Knife (right of plate) -->
    <line class="cdb-knife-handle" x1="452" y1="92" x2="442" y2="48" />
    <path class="cdb-knife-blade" d="M 442,48 L 438,38 L 446,38 Z" />
  </g>
</svg>

<style>
  .cookdiary-banner-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .cdb-page {
    stroke: var(--accent);
    stroke-opacity: 0.2;
    stroke-width: 1;
    animation: cdb-fade-in 0.4s ease both;
  }

  .cdb-header-line { stroke: var(--accent); stroke-opacity: 0.3; stroke-width: 1; }
  .cdb-month {
    fill: var(--accent);
    opacity: 0.5;
    font-size: 10px;
    font-weight: 700;
    font-family: ui-sans-serif, system-ui, sans-serif;
    letter-spacing: 0.1em;
  }
  .cdb-grid { stroke: var(--accent); stroke-opacity: 0.14; stroke-width: 0.6; }

  .cdb-today {
    fill: var(--accent);
    fill-opacity: 0.18;
    stroke: var(--accent);
    stroke-opacity: 0.45;
    stroke-width: 1;
    animation: cdb-pulse 2s ease-in-out infinite;
  }
  @keyframes cdb-pulse {
    0%, 100% { fill-opacity: 0.18; stroke-opacity: 0.45; }
    50%       { fill-opacity: 0.28; stroke-opacity: 0.65; }
  }

  .cdb-dot { fill: var(--accent); opacity: 0.45; animation: cdb-fade-in 0.3s ease both; }
  .d1 { animation-delay: 0.3s; }
  .d2 { animation-delay: 0.35s; }
  .d3 { animation-delay: 0.4s; }
  .d4 { animation-delay: 0.45s; }
  .d5 { animation-delay: 0.5s; }
  .d6 { animation-delay: 0.55s; opacity: 0.7; }
  .d7 { animation-delay: 0.6s; }
  .d8 { animation-delay: 0.65s; }
  .d9 { animation-delay: 0.7s; }

  .cdb-plate-outer { fill: none; stroke: var(--accent); stroke-opacity: 0.4; stroke-width: 1.4; }
  .cdb-plate-inner { fill: none; stroke: var(--accent); stroke-opacity: 0.25; stroke-width: 0.9; }
  .cdb-plate { animation: cdb-fade-in 0.5s ease 0.2s both; }

  .cdb-utensils { animation: cdb-fade-in 0.5s ease 0.4s both; }
  .cdb-fork-handle, .cdb-knife-handle {
    stroke: var(--accent);
    stroke-opacity: 0.5;
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .cdb-tine { stroke: var(--accent); stroke-opacity: 0.45; stroke-width: 1.2; stroke-linecap: round; }
  .cdb-knife-blade { fill: var(--accent); opacity: 0.4; }

  @keyframes cdb-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .cookdiary-banner-svg.no-loop .cdb-today { animation-iteration-count: 1; animation-fill-mode: forwards; }
  .cookdiary-banner-svg.no-anim .cdb-page,
  .cookdiary-banner-svg.no-anim .cdb-dot,
  .cookdiary-banner-svg.no-anim .cdb-plate,
  .cookdiary-banner-svg.no-anim .cdb-utensils,
  .cookdiary-banner-svg.no-anim .cdb-today {
    animation: none;
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .cdb-page, .cdb-dot, .cdb-plate, .cdb-utensils, .cdb-today {
      animation: none !important;
    }
  }
</style>
