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
  Shopping page banner — paper shopping list with check-marks + a basket
  with veggie tops poking out.
  Mirrors NutriTrace banner pattern.
-->
<svg
  class="shopping-banner-svg"
  class:no-anim={noAnim}
  class:no-loop={noLoop}
  viewBox="0 0 500 120"
  preserveAspectRatio="xMidYMid slice"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <defs>
    <radialGradient id="sb-glow" cx="50%" cy="50%" r="42%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.18" />
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"    />
    </radialGradient>
    <linearGradient id="sb-page-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.13" />
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.04" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="500" height="120" fill="url(#sb-glow)" />

  <!-- Notepad on the left with shopping items -->
  <rect class="sb-page" x="100" y="14" width="180" height="92" rx="3" fill="url(#sb-page-grad)" />

  <!-- Header rule -->
  <line class="sb-header-rule" x1="112" y1="32" x2="170" y2="32" />

  <!-- Checkbox + line items -->
  <g class="sb-item i1">
    <rect class="sb-check sb-checked" x="112" y="42" width="9" height="9" rx="1.5" />
    <path class="sb-tick" d="M 114,46 L 116,49 L 119,44" />
    <line class="sb-strike" x1="126" y1="47" x2="262" y2="47" />
    <line class="sb-rule" x1="126" y1="47" x2="262" y2="47" />
  </g>
  <g class="sb-item i2">
    <rect class="sb-check sb-checked" x="112" y="58" width="9" height="9" rx="1.5" />
    <path class="sb-tick" d="M 114,62 L 116,65 L 119,60" />
    <line class="sb-strike" x1="126" y1="63" x2="240" y2="63" />
    <line class="sb-rule" x1="126" y1="63" x2="240" y2="63" />
  </g>
  <g class="sb-item i3">
    <rect class="sb-check" x="112" y="74" width="9" height="9" rx="1.5" />
    <line class="sb-rule" x1="126" y1="79" x2="262" y2="79" />
  </g>
  <g class="sb-item i4">
    <rect class="sb-check" x="112" y="90" width="9" height="9" rx="1.5" />
    <line class="sb-rule" x1="126" y1="95" x2="246" y2="95" />
  </g>

  <!-- Shopping basket on the right -->
  <g class="sb-basket">
    <!-- Basket body (trapezoid) -->
    <path class="sb-basket-body" d="M 332,60 L 460,60 L 446,108 L 346,108 Z" />
    <!-- Basket top rim -->
    <line class="sb-basket-rim" x1="328" y1="60" x2="464" y2="60" />
    <!-- Basket weave lines -->
    <line class="sb-weave" x1="356" y1="68" x2="356" y2="104" />
    <line class="sb-weave" x1="380" y1="66" x2="380" y2="106" />
    <line class="sb-weave" x1="404" y1="66" x2="404" y2="106" />
    <line class="sb-weave" x1="428" y1="68" x2="428" y2="104" />

    <!-- Carrot top + leaves poking out -->
    <path class="sb-carrot" d="M 360,60 L 358,40 M 360,60 L 354,42 M 360,60 L 364,40 M 360,60 L 368,44" />
    <!-- Bread loaf rounded peek -->
    <path class="sb-bread" d="M 384,58 Q 396,38 408,58" />
    <!-- Bottle neck -->
    <rect class="sb-bottle" x="430" y="40" width="8" height="22" rx="1.5" />
    <rect class="sb-bottle-cap" x="429" y="36" width="10" height="5" rx="1" />
  </g>
</svg>

<style>
  .shopping-banner-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .sb-page {
    stroke: var(--accent);
    stroke-opacity: 0.2;
    stroke-width: 1;
    animation: sb-fade-in 0.4s ease both;
  }
  .sb-header-rule { stroke: var(--accent); stroke-opacity: 0.3; stroke-width: 1.4; }

  .sb-check {
    fill: none;
    stroke: var(--accent);
    stroke-opacity: 0.45;
    stroke-width: 1;
  }
  .sb-checked { fill: var(--accent); fill-opacity: 0.18; stroke-opacity: 0.55; }
  .sb-tick {
    fill: none;
    stroke: var(--accent);
    stroke-opacity: 0.7;
    stroke-width: 1.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sb-rule {
    stroke: var(--accent);
    stroke-opacity: 0.16;
    stroke-width: 0.8;
    stroke-dasharray: 140;
    stroke-dashoffset: 140;
    animation: sb-draw 0.35s ease both;
  }
  .sb-strike {
    stroke: var(--accent);
    stroke-opacity: 0.45;
    stroke-width: 0.8;
  }

  .sb-item { animation: sb-fade-in 0.35s ease both; }
  .i1 { animation-delay: 0.10s; }
  .i2 { animation-delay: 0.18s; }
  .i3 { animation-delay: 0.26s; }
  .i4 { animation-delay: 0.34s; }
  .i1 .sb-rule { animation-delay: 0.10s; }
  .i2 .sb-rule { animation-delay: 0.18s; }
  .i3 .sb-rule { animation-delay: 0.26s; }
  .i4 .sb-rule { animation-delay: 0.34s; }

  @keyframes sb-draw { to { stroke-dashoffset: 0; } }

  /* Basket */
  .sb-basket { animation: sb-basket-arrive 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.3s both; }
  .sb-basket-body {
    fill: var(--accent);
    fill-opacity: 0.18;
    stroke: var(--accent);
    stroke-opacity: 0.45;
    stroke-width: 1.2;
  }
  .sb-basket-rim {
    stroke: var(--accent);
    stroke-opacity: 0.55;
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .sb-weave {
    stroke: var(--accent);
    stroke-opacity: 0.28;
    stroke-width: 0.7;
  }

  .sb-carrot { stroke: var(--accent); stroke-opacity: 0.55; stroke-width: 1.6; stroke-linecap: round; fill: none; }
  .sb-bread { fill: var(--accent); fill-opacity: 0.35; stroke: var(--accent); stroke-opacity: 0.5; stroke-width: 0.8; }
  .sb-bottle { fill: var(--accent); fill-opacity: 0.28; stroke: var(--accent); stroke-opacity: 0.45; stroke-width: 0.8; }
  .sb-bottle-cap { fill: var(--accent); fill-opacity: 0.5; }

  @keyframes sb-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sb-basket-arrive {
    from { transform: translateY(8px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
  }

  .shopping-banner-svg.no-anim .sb-page,
  .shopping-banner-svg.no-anim .sb-item,
  .shopping-banner-svg.no-anim .sb-basket {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .shopping-banner-svg.no-anim .sb-rule { animation: none; stroke-dashoffset: 0; }
  @media (prefers-reduced-motion: reduce) {
    .sb-page, .sb-item, .sb-basket { animation: none !important; }
    .sb-rule { animation: none !important; stroke-dashoffset: 0 !important; }
  }
</style>
