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
  Manage page banner — rows of colored "tag" pills sliding into place,
  representing the curation/organization theme of the Manage hub
  (recipe categories, tags, kitchen gear, pantry categories, units,
  cookbooks). Plus a stack of index-card layers and a sort-handle
  motif on the right.
-->
<svg
  class="manage-banner-svg"
  class:no-anim={noAnim}
  class:no-loop={noLoop}
  viewBox="0 0 500 120"
  preserveAspectRatio="xMidYMid slice"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <defs>
    <radialGradient id="mb-glow" cx="50%" cy="50%" r="60%" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.18" />
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"    />
    </radialGradient>
  </defs>

  <!-- Ambient glow -->
  <rect x="0" y="0" width="500" height="120" fill="url(#mb-glow)" />

  <!-- ── Three rows of "tag pills" — different lengths suggest a
       diverse taxonomy. Each row staggers in. ── -->
  <!-- Row 1 -->
  <rect class="mb-pill mp1" x="40"  y="22" width="70"  height="20" rx="10" />
  <rect class="mb-pill mp2" x="118" y="22" width="100" height="20" rx="10" />
  <rect class="mb-pill mp3" x="226" y="22" width="55"  height="20" rx="10" />
  <rect class="mb-pill mp4" x="289" y="22" width="80"  height="20" rx="10" />

  <!-- Row 2 -->
  <rect class="mb-pill mp5" x="40"  y="52" width="55"  height="20" rx="10" />
  <rect class="mb-pill mp6" x="103" y="52" width="120" height="20" rx="10" />
  <rect class="mb-pill mp7" x="231" y="52" width="70"  height="20" rx="10" />
  <rect class="mb-pill mp8" x="309" y="52" width="60"  height="20" rx="10" />

  <!-- Row 3 -->
  <rect class="mb-pill mp9"  x="40"  y="82" width="90"  height="20" rx="10" />
  <rect class="mb-pill mp10" x="138" y="82" width="65"  height="20" rx="10" />
  <rect class="mb-pill mp11" x="211" y="82" width="105" height="20" rx="10" />
  <rect class="mb-pill mp12" x="324" y="82" width="50"  height="20" rx="10" />

  <!-- ── Stack of cards on the right (suggests catalog / index) ── -->
  <g class="mb-stack" transform="translate(420,60)">
    <rect class="mb-card mc3" x="-30" y="-25" width="56" height="46" rx="6" transform="rotate(-6)"  />
    <rect class="mb-card mc2" x="-28" y="-23" width="56" height="46" rx="6" transform="rotate(-1)"  />
    <rect class="mb-card mc1" x="-26" y="-21" width="56" height="46" rx="6" />
    <!-- A line on the front card to suggest a label -->
    <rect class="mb-line" x="-18" y="-13" width="40" height="3" rx="1.5" />
    <rect class="mb-line" x="-18" y="-5"  width="28" height="3" rx="1.5" />
    <rect class="mb-line" x="-18" y="3"   width="34" height="3" rx="1.5" />
  </g>

  <!-- Floating particles -->
  <circle class="mb-particle pp1" cx="20"  cy="10"  r="1.6" />
  <circle class="mb-particle pp2" cx="380" cy="10"  r="1.4" />
  <circle class="mb-particle pp3" cx="490" cy="110" r="1.6" />
  <circle class="mb-particle pp4" cx="350" cy="115" r="1.3" />
</svg>

<style>
  .manage-banner-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  /* Tag pills: alternate two opacity levels and stagger animation
     delays so the row reads as "items being filed in". */
  .mb-pill {
    fill: var(--accent);
    opacity: 0.18;
    transform-box: fill-box;
    transform-origin: left center;
    animation: mb-slide-in 0.5s cubic-bezier(0.34, 1.1, 0.64, 1) both;
  }
  .mp1, .mp4, .mp6, .mp8, .mp9, .mp12 { opacity: 0.28; }
  .mp1  { animation-delay: 0.05s; }
  .mp2  { animation-delay: 0.10s; }
  .mp3  { animation-delay: 0.15s; }
  .mp4  { animation-delay: 0.20s; }
  .mp5  { animation-delay: 0.12s; }
  .mp6  { animation-delay: 0.18s; }
  .mp7  { animation-delay: 0.24s; }
  .mp8  { animation-delay: 0.30s; }
  .mp9  { animation-delay: 0.20s; }
  .mp10 { animation-delay: 0.26s; }
  .mp11 { animation-delay: 0.32s; }
  .mp12 { animation-delay: 0.38s; }

  @keyframes mb-slide-in {
    from { transform: translateX(-12px); opacity: 0; }
    to   { transform: translateX(0);     opacity: var(--end-opacity, 0.18); }
  }
  .mp1, .mp4, .mp6, .mp8, .mp9, .mp12 { --end-opacity: 0.28; }

  /* Card stack — three offset cards with staggered fade-in. The whole
     group gently floats. */
  .mb-stack {
    animation: mb-float 6s ease-in-out infinite;
    transform-origin: 0 0;
  }
  .mb-card {
    fill: var(--accent);
    transform-box: fill-box;
    transform-origin: center;
    animation: mb-card-pop 0.5s cubic-bezier(0.34, 1.1, 0.64, 1) both;
  }
  .mc1 { opacity: 0.38; animation-delay: 0.30s; }
  .mc2 { opacity: 0.22; animation-delay: 0.20s; }
  .mc3 { opacity: 0.12; animation-delay: 0.10s; }

  @keyframes mb-card-pop {
    from { transform: translateY(6px); opacity: 0; }
    to   { transform: translateY(0);   opacity: var(--card-end, 0.38); }
  }
  .mc2 { --card-end: 0.22; }
  .mc3 { --card-end: 0.12; }

  @keyframes mb-float {
    0%, 100% { transform: translate(420px, 60px); }
    50%      { transform: translate(420px, 56px); }
  }

  .mb-line {
    fill: var(--accent);
    opacity: 0.45;
  }

  /* Floating particles */
  .mb-particle {
    fill: var(--accent);
    opacity: 0.10;
    animation: mb-particle-float 3s ease-in-out infinite;
  }
  .pp1 { animation-delay: 0.0s; animation-duration: 3.0s; }
  .pp2 { animation-delay: 0.6s; animation-duration: 2.8s; }
  .pp3 { animation-delay: 1.2s; animation-duration: 3.4s; }
  .pp4 { animation-delay: 0.3s; animation-duration: 2.6s; }

  @keyframes mb-particle-float {
    0%, 100% { transform: translateY(0);    opacity: 0.10; }
    50%      { transform: translateY(-5px); opacity: 0.20; }
  }

  /* No-loop variant: ambient stops after one cycle */
  .manage-banner-svg.no-loop .mb-stack,
  .manage-banner-svg.no-loop .mb-particle {
    animation-iteration-count: 1;
    animation-fill-mode: forwards;
  }

  /* Disable all animations */
  .manage-banner-svg.no-anim .mb-pill,
  .manage-banner-svg.no-anim .mb-card,
  .manage-banner-svg.no-anim .mb-stack,
  .manage-banner-svg.no-anim .mb-particle {
    animation: none;
    transform: none;
  }
  .manage-banner-svg.no-anim .mb-stack { transform: translate(420px, 60px); }
  @media (prefers-reduced-motion: reduce) {
    .mb-pill, .mb-card, .mb-stack, .mb-particle {
      animation: none !important;
    }
    .mb-stack { transform: translate(420px, 60px) !important; }
  }
</style>
