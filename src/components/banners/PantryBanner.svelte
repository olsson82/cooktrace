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
  Pantry page banner — tiered shelves with jars + cans.
  Mirrors the NutriTrace banner pattern.
-->
<svg
  class="pantry-banner-svg"
  class:no-anim={noAnim}
  class:no-loop={noLoop}
  viewBox="0 0 500 120"
  preserveAspectRatio="xMidYMid slice"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <defs>
    <radialGradient id="pb-glow" cx="50%" cy="50%" r="42%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.18" />
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"    />
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="500" height="120" fill="url(#pb-glow)" />

  <!-- Three shelves -->
  <line class="pb-shelf s1" x1="120" y1="44"  x2="380" y2="44" />
  <line class="pb-shelf s2" x1="120" y1="78"  x2="380" y2="78" />
  <line class="pb-shelf s3" x1="120" y1="112" x2="380" y2="112" />

  <!-- Top shelf: spice jars -->
  <g class="pb-jar j1">
    <rect x="140" y="24" width="14" height="20" rx="1.5" />
    <rect class="pb-lid" x="139" y="22" width="16" height="3" rx="1" />
  </g>
  <g class="pb-jar j2">
    <rect x="166" y="22" width="14" height="22" rx="1.5" />
    <rect class="pb-lid" x="165" y="20" width="16" height="3" rx="1" />
  </g>
  <g class="pb-jar j3">
    <rect x="192" y="26" width="14" height="18" rx="1.5" />
    <rect class="pb-lid" x="191" y="24" width="16" height="3" rx="1" />
  </g>
  <g class="pb-jar j4">
    <rect x="218" y="22" width="14" height="22" rx="1.5" />
    <rect class="pb-lid" x="217" y="20" width="16" height="3" rx="1" />
  </g>
  <g class="pb-jar j5">
    <rect x="244" y="24" width="14" height="20" rx="1.5" />
    <rect class="pb-lid" x="243" y="22" width="16" height="3" rx="1" />
  </g>
  <g class="pb-jar j6">
    <rect x="270" y="22" width="14" height="22" rx="1.5" />
    <rect class="pb-lid" x="269" y="20" width="16" height="3" rx="1" />
  </g>

  <!-- Middle shelf: cans -->
  <g class="pb-can c1">
    <rect x="148" y="56" width="20" height="22" rx="2" />
    <line class="pb-can-band" x1="148" y1="64" x2="168" y2="64" />
  </g>
  <g class="pb-can c2">
    <rect x="180" y="58" width="20" height="20" rx="2" />
    <line class="pb-can-band" x1="180" y1="66" x2="200" y2="66" />
  </g>
  <g class="pb-can c3">
    <rect x="212" y="54" width="20" height="24" rx="2" />
    <line class="pb-can-band" x1="212" y1="62" x2="232" y2="62" />
  </g>
  <g class="pb-can c4">
    <rect x="244" y="58" width="20" height="20" rx="2" />
    <line class="pb-can-band" x1="244" y1="66" x2="264" y2="66" />
  </g>
  <g class="pb-can c5">
    <rect x="276" y="56" width="20" height="22" rx="2" />
    <line class="pb-can-band" x1="276" y1="64" x2="296" y2="64" />
  </g>

  <!-- Bottom shelf: bigger jars / boxes -->
  <g class="pb-box b1"><rect x="140" y="88" width="36" height="24" rx="2" /></g>
  <g class="pb-box b2"><rect x="184" y="86" width="28" height="26" rx="2" /></g>
  <g class="pb-jar j7">
    <rect x="224" y="86" width="20" height="26" rx="2" />
    <rect class="pb-lid" x="223" y="84" width="22" height="3" rx="1" />
  </g>
  <g class="pb-box b3"><rect x="252" y="90" width="32" height="22" rx="2" /></g>
  <g class="pb-jar j8">
    <rect x="292" y="86" width="20" height="26" rx="2" />
    <rect class="pb-lid" x="291" y="84" width="22" height="3" rx="1" />
  </g>
</svg>

<style>
  .pantry-banner-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .pb-shelf {
    stroke: var(--accent);
    stroke-opacity: 0.4;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-dasharray: 260;
    stroke-dashoffset: 260;
    animation: pb-draw 0.5s ease both;
  }
  .s1 { animation-delay: 0.05s; }
  .s2 { animation-delay: 0.15s; }
  .s3 { animation-delay: 0.25s; }
  @keyframes pb-draw { to { stroke-dashoffset: 0; } }

  .pb-jar rect, .pb-can rect, .pb-box rect {
    fill: var(--accent);
    fill-opacity: 0.16;
    stroke: var(--accent);
    stroke-opacity: 0.4;
    stroke-width: 0.8;
  }
  .pb-lid { fill-opacity: 0.5 !important; }
  .pb-can-band { stroke: var(--accent); stroke-opacity: 0.3; stroke-width: 0.7; }

  .pb-jar, .pb-can, .pb-box {
    animation: pb-fade-in 0.4s ease both;
  }
  .j1 { animation-delay: 0.30s; }
  .j2 { animation-delay: 0.35s; }
  .j3 { animation-delay: 0.40s; }
  .j4 { animation-delay: 0.45s; }
  .j5 { animation-delay: 0.50s; }
  .j6 { animation-delay: 0.55s; }
  .c1 { animation-delay: 0.40s; }
  .c2 { animation-delay: 0.45s; }
  .c3 { animation-delay: 0.50s; }
  .c4 { animation-delay: 0.55s; }
  .c5 { animation-delay: 0.60s; }
  .b1 { animation-delay: 0.50s; }
  .b2 { animation-delay: 0.55s; }
  .b3 { animation-delay: 0.65s; }
  .j7 { animation-delay: 0.60s; }
  .j8 { animation-delay: 0.70s; }

  @keyframes pb-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .pantry-banner-svg.no-anim .pb-shelf { animation: none; stroke-dashoffset: 0; }
  .pantry-banner-svg.no-anim .pb-jar,
  .pantry-banner-svg.no-anim .pb-can,
  .pantry-banner-svg.no-anim .pb-box { animation: none; opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .pb-shelf { animation: none !important; stroke-dashoffset: 0 !important; }
    .pb-jar, .pb-can, .pb-box { animation: none !important; opacity: 1 !important; transform: none !important; }
  }
</style>
