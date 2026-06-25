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
  Recipes page banner — open cookbook with ingredient bullets + numbered
  steps, plus a wooden spoon resting on the right page.
  No steam (recipe books don't steam).
-->
<svg
  class="recipes-banner-svg"
  class:no-anim={noAnim}
  class:no-loop={noLoop}
  viewBox="0 0 500 120"
  preserveAspectRatio="xMidYMid slice"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <defs>
    <radialGradient id="rb-glow" cx="50%" cy="50%" r="42%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.18" />
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"    />
    </radialGradient>
    <linearGradient id="rb-page-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.13" />
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.04" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="500" height="120" fill="url(#rb-glow)" />

  <!-- Open cookbook (two pages) -->
  <rect class="rb-page" x="100" y="14" width="130" height="96" rx="3" fill="url(#rb-page-grad)" />
  <rect class="rb-page" x="246" y="14" width="130" height="96" rx="3" fill="url(#rb-page-grad)" />
  <line class="rb-spine" x1="238" y1="14" x2="238" y2="110" />

  <!-- Recipe heading on left page -->
  <line class="rb-rule rl1" x1="112" y1="32" x2="180" y2="32" />
  <!-- Ingredient bullets on left page -->
  <circle class="rb-bullet rb1" cx="116" cy="48" r="1.6" />
  <line class="rb-rule rl2" x1="124" y1="48" x2="216" y2="48" />
  <circle class="rb-bullet rb2" cx="116" cy="62" r="1.6" />
  <line class="rb-rule rl3" x1="124" y1="62" x2="208" y2="62" />
  <circle class="rb-bullet rb3" cx="116" cy="76" r="1.6" />
  <line class="rb-rule rl4" x1="124" y1="76" x2="220" y2="76" />
  <circle class="rb-bullet rb4" cx="116" cy="90" r="1.6" />
  <line class="rb-rule rl5" x1="124" y1="90" x2="200" y2="90" />

  <!-- Numbered steps on right page -->
  <text class="rb-step-num" x="258" y="36">1.</text>
  <line class="rb-rule rr1" x1="270" y1="32" x2="362" y2="32" />
  <text class="rb-step-num" x="258" y="54">2.</text>
  <line class="rb-rule rr2" x1="270" y1="50" x2="358" y2="50" />
  <text class="rb-step-num" x="258" y="72">3.</text>
  <line class="rb-rule rr3" x1="270" y1="68" x2="350" y2="68" />
  <text class="rb-step-num" x="258" y="90">4.</text>
  <line class="rb-rule rr4" x1="270" y1="86" x2="340" y2="86" />

  <!-- Open stockpot with bubbling water + rising steam (no lid).
       Drawn back-to-front so foreground bits sit on top of the pot rim. -->
  <g class="rb-pot">
    <!-- Pot body (slightly tapered, open top) -->
    <path class="rb-pot-body" d="
      M 396,62
      L 458,62
      L 454,100
      L 400,100
      Z
    " />
    <!-- Open rim ellipse (creates the 'looking down into the pot' effect) -->
    <ellipse class="rb-pot-rim" cx="427" cy="62" rx="32" ry="4.5" />
    <!-- Side handles -->
    <rect class="rb-pot-handle" x="386" y="68" width="12" height="6" rx="2" />
    <rect class="rb-pot-handle" x="456" y="68" width="12" height="6" rx="2" />

    <!-- Bubbling water surface — wavy line tracing the surface inside the pot rim -->
    <path class="rb-water" d="
      M 400,64
      Q 408,62 414,64
      Q 420,66 426,64
      Q 432,62 438,64
      Q 446,66 454,64
    " />

  </g>

  <!-- Steam wisps rising from the open pot — more prominent travel + opacity sweep. -->
  <path class="rb-steam s1" d="M 412,56 Q 406,46 414,36 Q 422,26 416,12" />
  <path class="rb-steam s2" d="M 427,54 Q 421,42 430,30 Q 438,18 432,4" />
  <path class="rb-steam s3" d="M 442,56 Q 436,46 444,36 Q 452,26 446,12" />
</svg>

<style>
  .recipes-banner-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .rb-page {
    stroke: var(--accent);
    stroke-opacity: 0.2;
    stroke-width: 1;
    animation: rb-fade-in 0.4s ease both;
  }
  .rb-spine { stroke: var(--accent); stroke-opacity: 0.28; stroke-width: 1.2; }

  .rb-rule {
    stroke: var(--accent);
    stroke-opacity: 0.16;
    stroke-width: 0.9;
    stroke-dasharray: 110;
    stroke-dashoffset: 110;
    animation: rb-draw 0.4s ease both;
  }
  .rl1 { animation-delay: 0.08s; }
  .rl2 { animation-delay: 0.14s; }
  .rl3 { animation-delay: 0.20s; }
  .rl4 { animation-delay: 0.26s; }
  .rl5 { animation-delay: 0.32s; }
  .rr1 { animation-delay: 0.12s; }
  .rr2 { animation-delay: 0.18s; }
  .rr3 { animation-delay: 0.24s; }
  .rr4 { animation-delay: 0.30s; }
  @keyframes rb-draw { to { stroke-dashoffset: 0; } }

  .rb-bullet {
    fill: var(--accent);
    opacity: 0.45;
    animation: rb-fade-in 0.3s ease both;
  }
  .rb1 { animation-delay: 0.08s; }
  .rb2 { animation-delay: 0.14s; }
  .rb3 { animation-delay: 0.20s; }
  .rb4 { animation-delay: 0.26s; }

  .rb-step-num {
    fill: var(--accent);
    opacity: 0.45;
    font-size: 9px;
    font-weight: 700;
    font-family: ui-sans-serif, system-ui, sans-serif;
    animation: rb-fade-in 0.3s ease both;
  }

  /* Open stockpot — body + handles + rim ellipse + water surface + bubbles. */
  .rb-pot {
    animation: rb-pot-place 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.4s both;
    transform-origin: 425px 80px;
  }
  .rb-pot-body, .rb-pot-handle {
    fill: var(--accent);
    fill-opacity: 0.35;
    stroke: var(--accent);
    stroke-opacity: 0.6;
    stroke-width: 1;
  }
  /* Rim is a darker ellipse to suggest the 'looking down inside' depth. */
  .rb-pot-rim {
    fill: color-mix(in srgb, var(--accent) 55%, transparent);
    stroke: var(--accent);
    stroke-opacity: 0.7;
    stroke-width: 1;
  }
  .rb-water {
    fill: none;
    stroke: var(--accent);
    stroke-opacity: 0.7;
    stroke-width: 1.2;
    stroke-linecap: round;
    animation: rb-water-wave 1.6s ease-in-out infinite;
    transform-origin: 427px 64px;
  }
  @keyframes rb-water-wave {
    0%, 100% { transform: scaleY(1); }
    50%       { transform: scaleY(1.4); }
  }

  /* Steam — more prominent rise + opacity sweep. */
  .rb-steam {
    fill: none;
    stroke: var(--accent);
    stroke-opacity: 0.5;
    stroke-width: 1.6;
    stroke-linecap: round;
    transform-origin: 427px 56px;
    animation: rb-steam-rise 3s ease-in-out infinite;
  }
  .s1 { animation-delay: 0s;   animation-duration: 2.8s; }
  .s2 { animation-delay: 0.4s; animation-duration: 3.4s; }
  .s3 { animation-delay: 0.9s; animation-duration: 3.0s; }
  @keyframes rb-steam-rise {
    0%   { transform: translateY(8px)  scaleY(0.7); opacity: 0; }
    25%  { transform: translateY(2px)  scaleY(1);   opacity: 0.7; }
    70%  { transform: translateY(-8px) scaleY(1.05); opacity: 0.55; }
    100% { transform: translateY(-18px) scaleY(0.85); opacity: 0; }
  }

  @keyframes rb-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes rb-pot-place {
    from { transform: translateY(8px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .recipes-banner-svg.no-loop .rb-steam,
  .recipes-banner-svg.no-loop .rb-water {
    animation-iteration-count: 1;
    animation-fill-mode: forwards;
  }
  .recipes-banner-svg.no-anim .rb-page,
  .recipes-banner-svg.no-anim .rb-bullet,
  .recipes-banner-svg.no-anim .rb-step-num,
  .recipes-banner-svg.no-anim .rb-pot,
  .recipes-banner-svg.no-anim .rb-water,
  .recipes-banner-svg.no-anim .rb-steam {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .recipes-banner-svg.no-anim .rb-rule {
    animation: none;
    stroke-dashoffset: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .rb-page, .rb-bullet, .rb-step-num, .rb-pot, .rb-water, .rb-steam { animation: none !important; }
    .rb-rule { animation: none !important; stroke-dashoffset: 0 !important; }
  }
</style>
