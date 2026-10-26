// The illustrated world map on the entry screen. Everything is one SVG so the cities,
// their emblems, the roads between them and the locks always line up at any screen size.

const INK = '#23284a';
const FONT = `'Lilita One', 'Arial Rounded MT Bold', sans-serif`;

// Where each district sits on the 400×860 map, in unlock order.
const SPOTS = [
  { x: 200, y: 660 },
  { x: 268, y: 482 },
  { x: 134, y: 300 },
];

const RIBBON = { traditional: ['#ff6a4a', '#c23b2a'], futuristic: ['#8f5cff', '#5a2fc4'], ranch: ['#3fbf4a', '#23863a'] };

function emblemTraditional() {
  return `
    <circle r="62" fill="url(#skyOld)"/>
    <circle cx="-30" cy="-34" r="11" fill="#fff3a0"/>
    <path d="M-70 18 C-40 0 -10 8 10 4 C30 0 50 6 70 14 V70 H-70Z" fill="#6fd65a"/>
    <g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round">
      <rect x="-52" y="-6" width="30" height="38" rx="2" fill="#ffc9da"/>
      <path d="M-55 -6 L-37 -24 L-19 -6Z" fill="#ff6f59"/>
      <rect x="-46" y="4" width="8" height="9" fill="#8fd6ff"/>
      <rect x="-12" y="-40" width="24" height="72" rx="2" fill="#fff2d4"/>
      <path d="M-15 -40 L0 -62 L15 -40Z" fill="#14a394"/>
      <circle cx="0" cy="-24" r="8" fill="#fff"/>
      <path d="M0 -24 V-30 M0 -24 H5" stroke-width="2"/>
      <rect x="-6" y="14" width="12" height="18" rx="5" fill="#14a394"/>
      <rect x="20" y="-2" width="32" height="34" rx="2" fill="#ffe07a"/>
      <path d="M17 -2 L36 -20 L55 -2Z" fill="#e8553a"/>
      <rect x="27" y="8" width="8" height="9" fill="#8fd6ff"/>
    </g>
    <g stroke="${INK}" stroke-width="1.5">
      ${[0, 1, 2, 3].map((i) => `<path d="M${-52 + i * 7.5} 18 h7.5 l-1 6 h-5.5z" fill="${i % 2 ? '#fff' : '#ff4f3a'}"/>`).join('')}
      ${[0, 1, 2, 3].map((i) => `<path d="M${20 + i * 8} 18 h8 l-1 6 h-6z" fill="${i % 2 ? '#fff' : '#ff9a1f'}"/>`).join('')}
    </g>
    <rect x="-70" y="32" width="140" height="40" fill="#e0603e"/>
    <path d="M-70 40 H70 M-70 50 H70 M-70 60 H70" stroke="#c84a32" stroke-width="2"/>
    <circle cx="-60" cy="22" r="10" fill="#3fbf4a" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="60" cy="24" r="9" fill="#3fbf4a" stroke="${INK}" stroke-width="2.5"/>`;
}

function emblemFuturistic() {
  const towers = [[-48, -10, 18, '#3ff0ff'], [-26, -40, 20, '#ff3fd6'], [-2, -55, 22, '#3ff0ff'], [24, -30, 18, '#ff3fd6'], [44, -4, 16, '#3ff0ff']];
  return `
    <circle r="62" fill="url(#skyNeo)"/>
    ${[[-40, -40], [30, -48], [44, -20], [-18, -54], [10, -30], [-50, -18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join('')}
    <path d="M30 -44 a12 12 0 1 0 10 18 a10 10 0 1 1 -10 -18z" fill="#ffe9a8"/>
    ${towers.map(([x, y, w, c]) => `
      <rect x="${x}" y="${y}" width="${w}" height="${80 - y}" rx="3" fill="#1d1645" stroke="${c}" stroke-width="2.5" filter="url(#neonGlow)"/>
      ${Array.from({ length: Math.floor((40 - y) / 10) }, (_, k) => `<rect x="${x + 4}" y="${y + 6 + k * 10}" width="${w - 8}" height="3" rx="1.5" fill="${c}" opacity=".85"/>`).join('')}`).join('')}
    <path d="M-2 -55 L9 -72 L20 -55" fill="#1d1645" stroke="#3ff0ff" stroke-width="2.5"/>
    <path d="M9 -72 V-80" stroke="#ff3fd6" stroke-width="2.5"/>
    <path d="M-70 26 C-30 6 30 6 70 26" fill="none" stroke="#3ff0ff" stroke-width="4" filter="url(#neonGlow)"/>
    <rect x="-14" y="8" width="26" height="9" rx="4.5" fill="#fff" stroke="${INK}" stroke-width="2"/>
    <rect x="-70" y="40" width="140" height="30" fill="#140e30"/>`;
}

function emblemRanch() {
  return `
    <circle r="62" fill="url(#skyRanch)"/>
    <circle cx="20" cy="2" r="26" fill="#fff1a8"/>
    <path d="M-70 4 C-30 -14 10 6 70 -6 V70 H-70Z" fill="#b9de6e"/>
    <path d="M-70 22 C-20 8 30 26 70 16 V70 H-70Z" fill="#8fcf52"/>
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M${-60 + i * 26} 70 L${-30 + i * 14} 24" stroke="#79b843" stroke-width="3"/>`).join('')}
    <g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round">
      <rect x="-50" y="-14" width="44" height="36" fill="#d8453a"/>
      <path d="M-55 -14 L-28 -36 L-1 -14Z" fill="#8e2a20"/>
      <rect x="-38" y="2" width="20" height="20" fill="#fff"/>
      <path d="M-38 2 L-18 22 M-18 2 L-38 22" stroke-width="2"/>
      <path d="M26 24 L32 -26 L38 24Z" fill="#fff"/>
      <circle cx="32" cy="-26" r="3.5" fill="#ffd23f"/>
    </g>
    <g stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="#fff">
      <path d="M32 -26 L32 -52 L38 -48 L33 -26Z"/>
      <path d="M32 -26 L56 -24 L54 -18 L33 -25Z"/>
      <path d="M32 -26 L30 0 L24 -4 L31 -27Z"/>
      <path d="M32 -26 L8 -30 L10 -36 L31 -27Z"/>
    </g>
    <path d="M-66 40 H66" stroke="#fff" stroke-width="3"/>
    ${[-56, -36, -16, 4, 24, 44].map((x) => `<path d="M${x} 32 V48" stroke="#fff" stroke-width="3"/>`).join('')}`;
}

const EMBLEMS = { traditional: emblemTraditional, futuristic: emblemFuturistic, ranch: emblemRanch };

function lock() {
  return `
    <g class="big-lock" transform="translate(0 16) scale(.82)">
      <path d="M-22 -14 V-30 a22 22 0 0 1 44 0 V-14" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/>
      <path d="M-22 -14 V-30 a22 22 0 0 1 44 0 V-14" fill="none" stroke="#e9eef5" stroke-width="8" stroke-linecap="round"/>
      <rect x="-36" y="-18" width="72" height="56" rx="12" fill="#ffc12b" stroke="${INK}" stroke-width="5"/>
      <rect x="-30" y="-12" width="60" height="14" rx="6" fill="#ffe070"/>
      <circle cy="8" r="8" fill="${INK}"/>
      <path d="M0 10 V24" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    </g>`;
}

function ribbon(text, theme) {
  const [c1, c2] = RIBBON[theme] || RIBBON.traditional;
  const w = Math.max(110, text.length * 15 + 40);
  return `
    <g transform="translate(0 -84)">
      <path d="M${-w / 2 - 16} 4 h22 v22 h-22 l8 -11z" fill="${c2}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M${w / 2 + 16} 4 h-22 v22 h22 l-8 -11z" fill="${c2}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="${-w / 2}" y="-10" width="${w}" height="32" rx="8" fill="${c1}" stroke="${INK}" stroke-width="3.5"/>
      <rect x="${-w / 2 + 6}" y="-6" width="${w - 12}" height="9" rx="4" fill="#fff" opacity=".25"/>
      <text y="7" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="21" fill="#fff" stroke="${INK}" stroke-width="5" paint-order="stroke" letter-spacing=".5">${text}</text>
    </g>`;
}

function city(c, i, { unlocked, current, progress, why }) {
  const p = SPOTS[i] || SPOTS[SPOTS.length - 1];
  const art = (EMBLEMS[c.theme] || emblemTraditional)();
  return `
    <g transform="translate(${p.x} ${p.y}) scale(.86)"><g class="map-city ${unlocked ? 'open' : 'locked'} ${current ? 'current' : ''}" data-city="${c.id}" role="button" tabindex="0" aria-label="${c.title}${unlocked ? '' : ' (locked)'}">
      <ellipse cy="74" rx="62" ry="12" fill="#1c3a2a" opacity=".22"/>
      <g class="emblem">
        <g clip-path="url(#emblemClip)" ${unlocked ? '' : 'filter="url(#lockedLook)"'}>${art}</g>
        <circle r="62" fill="none" stroke="#fff" stroke-width="5"/>
        <circle r="66" fill="none" stroke="${INK}" stroke-width="5"/>
        ${unlocked ? '' : `<circle r="62" fill="#1b2144" opacity=".18"/>${lock()}`}
      </g>
      ${ribbon(c.title, c.theme)}
      ${unlocked
        ? `<g transform="translate(0 86)">
            <rect x="-52" y="-15" width="104" height="30" rx="15" fill="#5ad13a" stroke="${INK}" stroke-width="3.5"/>
            <rect x="-46" y="-11" width="92" height="9" rx="4.5" fill="#fff" opacity=".3"/>
            <text text-anchor="middle" dominant-baseline="middle" y="1" font-family="${FONT}" font-size="17" fill="#fff" stroke="${INK}" stroke-width="4" paint-order="stroke">${current ? 'PLAY' : 'ENTER'} · ${progress}%</text>
          </g>`
        : `<g transform="translate(0 86)">
            <rect x="${-Math.max(70, why.length * 3.6)}" y="-13" width="${Math.max(140, why.length * 7.2)}" height="26" rx="13" fill="rgba(27,33,68,.82)" stroke="#fff" stroke-width="2.5"/>
            <text text-anchor="middle" dominant-baseline="middle" y="1" font-family="${FONT}" font-size="13" fill="#fff">${why}</text>
          </g>`}
    </g></g>`;
}

export function worldMapSVG(cities, info) {
  const pts = cities.map((_, i) => SPOTS[i] || SPOTS[SPOTS.length - 1]);
  const road = pts.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `S${(pts[i - 1].x + p.x) / 2 + (i % 2 ? 90 : -90)} ${(pts[i - 1].y + p.y) / 2} ${p.x} ${p.y}`)).join(' ');
  return `
  <svg class="worldmap" viewBox="0 0 400 860" preserveAspectRatio="xMidYMid meet" aria-label="World map">
    <defs>
      <clipPath id="emblemClip"><circle r="62"/></clipPath>
      <linearGradient id="skyOld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc9ff"/><stop offset="1" stop-color="#d9f4ff"/></linearGradient>
      <linearGradient id="skyNeo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1145"/><stop offset="1" stop-color="#5a2fa0"/></linearGradient>
      <linearGradient id="skyRanch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9f6b"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
      <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="lockedLook"><feColorMatrix type="saturate" values=".55"/></filter>
      <pattern id="waves" width="40" height="22" patternUnits="userSpaceOnUse"><path d="M2 12 q8 -7 16 0 t16 0" fill="none" stroke="#fff" stroke-width="2.2" opacity=".35" stroke-linecap="round"/></pattern>
    </defs>
    <rect width="400" height="860" fill="#4fb8f5"/>
    <rect width="400" height="860" fill="url(#waves)"/>
    <!-- land -->
    <path d="M40 120 C20 60 120 30 200 50 C300 20 390 80 375 180 C395 260 360 330 380 420 C400 520 350 600 370 700 C385 790 290 830 200 815 C100 840 20 790 30 690 C10 600 50 520 25 430 C0 340 45 280 30 210 C25 170 45 150 40 120Z" fill="#7fd45a" stroke="${INK}" stroke-width="5"/>
    <path d="M60 140 C50 90 130 70 200 82 C290 60 350 110 345 185 C360 260 330 330 348 420 C362 510 320 590 338 690 C350 770 280 795 200 785 C110 800 55 760 60 680 C45 600 80 520 58 430 C40 350 75 290 62 215Z" fill="#9be07a"/>
    <!-- river -->
    <path d="M375 300 C320 310 300 350 250 330 C200 310 170 360 120 350 C80 342 50 380 30 370" fill="none" stroke="#5cc3ff" stroke-width="16" stroke-linecap="round"/>
    <path d="M375 300 C320 310 300 350 250 330 C200 310 170 360 120 350 C80 342 50 380 30 370" fill="none" stroke="#8fdcff" stroke-width="6" stroke-linecap="round"/>
    <!-- mountains near the far district -->
    <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
      <path d="M250 150 L285 90 L320 150Z" fill="#a8a3c9"/><path d="M285 90 L273 111 L285 106 L296 112Z" fill="#fff"/>
      <path d="M300 160 L330 112 L360 160Z" fill="#9893bd"/><path d="M330 112 L320 128 L331 124 L340 130Z" fill="#fff"/>
    </g>
    <!-- fields -->
    <g opacity=".9">
      <rect x="60" y="230" width="46" height="30" rx="4" fill="#ffd96b" transform="rotate(-8 83 245)"/>
      <rect x="110" y="236" width="40" height="28" rx="4" fill="#c9e07a" transform="rotate(-8 130 250)"/>
      <rect x="290" y="560" width="44" height="30" rx="4" fill="#c9e07a" transform="rotate(6 312 575)"/>
    </g>
    <!-- forests -->
    ${[[80, 470], [100, 492], [70, 510], [320, 250], [340, 270], [310, 715], [332, 735], [90, 760], [112, 778], [60, 300]].map(([x, y]) => `<g><rect x="${x - 2}" y="${y}" width="4" height="10" fill="#8a6747"/><circle cx="${x}" cy="${y - 4}" r="12" fill="#3fbf4a" stroke="${INK}" stroke-width="2.5"/><circle cx="${x - 4}" cy="${y - 8}" r="4" fill="#8ff07a"/></g>`).join('')}
    <!-- road linking the districts -->
    <path d="${road}" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
    <path d="${road}" fill="none" stroke="#fff3d6" stroke-width="8" stroke-linecap="round"/>
    <path d="${road}" fill="none" stroke="#e0b06a" stroke-width="2.5" stroke-dasharray="8 10" stroke-linecap="round"/>
    <!-- clouds -->
    <g class="map-clouds" fill="#fff" opacity=".9">
      <g><ellipse cx="60" cy="560" rx="34" ry="14"/><ellipse cx="78" cy="550" rx="20" ry="14"/></g>
      <g><ellipse cx="330" cy="70" rx="30" ry="12"/><ellipse cx="315" cy="62" rx="18" ry="12"/></g>
    </g>
    ${cities.map((c, i) => city(c, i, info[i])).join('')}
  </svg>`;
}
