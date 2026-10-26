// "The District — Build Your Town" logo, drawn as SVG so it's sharp at any size.
// Style reference: assets/brand/splash.jpg (script "The" on a wood plank, chunky gold
// DISTRICT with a navy outline and 3D depth, navy ribbon with a gold edge, flowers, a lantern).

const NAVY = '#16264a';
const DEEP = '#0d1730';

function flower(x, y, r, color = '#ff4fa3') {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return `<ellipse cx="${(x + Math.cos(a) * r * 0.62).toFixed(1)}" cy="${(y + Math.sin(a) * r * 0.62).toFixed(1)}" rx="${(r * 0.55).toFixed(1)}" ry="${(r * 0.42).toFixed(1)}" transform="rotate(${(a * 180) / Math.PI + 90} ${(x + Math.cos(a) * r * 0.62).toFixed(1)} ${(y + Math.sin(a) * r * 0.62).toFixed(1)})" fill="${color}"/>`;
  }).join('');
  return `<g stroke="#7a1846" stroke-width="1.2">${petals}</g><circle cx="${x}" cy="${y}" r="${(r * 0.28).toFixed(1)}" fill="#ffd23f" stroke="#c4801a" stroke-width="1"/>`;
}

function leaf(x, y, s, rot) {
  return `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0Z" fill="#3fae3a" stroke="#1f6b26" stroke-width="1.6"/><path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M2 0 H18" stroke="#8ff07a" stroke-width="1.4" opacity=".8"/>`;
}

function cluster(x, y, flip = 1) {
  return `
    ${leaf(x - 18 * flip, y + 6, 1.1, flip > 0 ? 200 : -20)}
    ${leaf(x + 10 * flip, y + 12, 0.9, flip > 0 ? 40 : 140)}
    ${leaf(x - 4 * flip, y - 14, 0.8, -90 + 30 * flip)}
    ${flower(x, y, 11)}
    ${flower(x + 16 * flip, y - 6, 8, '#ff7ac0')}
    ${flower(x - 12 * flip, y + 14, 7, '#ff3f8f')}`;
}

export function logoSVG({ tagline = true, className = 'logo-svg' } = {}) {
  const word = 'DISTRICT';
  const textAttrs = `x="200" y="150" text-anchor="middle" font-family="'Lilita One', 'Arial Rounded MT Bold', sans-serif" font-size="98" letter-spacing="-1"`;
  return `
  <svg class="${className}" viewBox="0 0 400 ${tagline ? 250 : 182}" role="img" aria-label="The District${tagline ? ': Build Your Town' : ''}">
    <defs>
      <linearGradient id="lgGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff4a8"/><stop offset=".45" stop-color="#ffcf3f"/><stop offset="1" stop-color="#f39a1b"/>
      </linearGradient>
      <linearGradient id="lgWood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d79a55"/><stop offset="1" stop-color="#93592a"/>
      </linearGradient>
      <radialGradient id="lgGlow"><stop offset="0" stop-color="#fff6c2"/><stop offset=".45" stop-color="#ffd25a" stop-opacity=".85"/><stop offset="1" stop-color="#ffb02e" stop-opacity="0"/></radialGradient>
      <path id="lgArc" d="M78 214 Q200 194 322 214"/>
    </defs>

    <!-- lantern on its bracket -->
    <g transform="translate(352 -6) scale(.9)">
      <path d="M-30 30 H-4 V16" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="-4" cy="44" r="34" fill="url(#lgGlow)"/>
      <path d="M-16 22 H8 L4 14 H-12Z" fill="${NAVY}" stroke="${DEEP}" stroke-width="2"/>
      <rect x="-14" y="22" width="20" height="30" rx="3" fill="#ffd96b" stroke="${NAVY}" stroke-width="4"/>
      <path d="M-4 22 V52 M-14 37 H6" stroke="${NAVY}" stroke-width="2"/>
      <path d="M-18 52 H10 L4 60 H-12Z" fill="${NAVY}" stroke="${DEEP}" stroke-width="2"/>
      <circle cx="-4" cy="10" r="4" fill="#e8b13a" stroke="${DEEP}" stroke-width="2"/>
    </g>

    <!-- greenery and flowers behind the word -->
    ${cluster(262, 70, 1)}
    ${cluster(330, 76, 1)}

    <!-- wooden plank with script "The" -->
    <g transform="rotate(-6 160 52)">
      <rect x="92" y="22" width="138" height="62" rx="14" fill="${DEEP}" transform="translate(0 5)"/>
      <rect x="92" y="22" width="138" height="62" rx="14" fill="url(#lgWood)" stroke="#3b2414" stroke-width="5"/>
      <path d="M104 40 C140 36 180 44 218 38 M106 66 C150 70 190 62 220 68" stroke="#7a4a22" stroke-width="2" fill="none" opacity=".6"/>
      <circle cx="104" cy="34" r="3" fill="#5a3418"/><circle cx="218" cy="72" r="3" fill="#5a3418"/>
      <text x="161" y="70" text-anchor="middle" font-family="'Pacifico', cursive" font-size="44" fill="#fff3dc" stroke="#4a2a12" stroke-width="7" paint-order="stroke" stroke-linejoin="round">The</text>
    </g>

    <!-- DISTRICT: navy plate, depth, gold face -->
    <text ${textAttrs} dy="10" fill="${DEEP}" stroke="${DEEP}" stroke-width="30" stroke-linejoin="round">${word}</text>
    <text ${textAttrs} fill="${NAVY}" stroke="${NAVY}" stroke-width="26" stroke-linejoin="round">${word}</text>
    <text ${textAttrs} dy="7" fill="#b45d0e" stroke="#b45d0e" stroke-width="5" stroke-linejoin="round">${word}</text>
    <text ${textAttrs} fill="url(#lgGold)" stroke="#8a4708" stroke-width="2.5" stroke-linejoin="round">${word}</text>
    <text ${textAttrs} dy="-3" fill="none" stroke="#fffbe0" stroke-width="1.6" opacity=".55" stroke-linejoin="round">${word}</text>

    ${cluster(44, 170, -1)}
    ${cluster(360, 166, 1)}

    ${tagline ? `
    <!-- Build Your Town ribbon -->
    <g>
      <path d="M58 198 L40 214 L58 230 L80 226 L78 202Z" fill="#132f4d" stroke="${DEEP}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M342 198 L360 214 L342 230 L320 226 L322 202Z" fill="#132f4d" stroke="${DEEP}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M66 196 Q200 172 334 196 L334 234 Q200 210 66 234Z" fill="#1f3f64" stroke="${DEEP}" stroke-width="8" stroke-linejoin="round"/>
      <path d="M66 196 Q200 172 334 196 L334 234 Q200 210 66 234Z" fill="none" stroke="#e8b13a" stroke-width="3.5" stroke-linejoin="round"/>
      <text font-family="'Alfa Slab One', Georgia, serif" font-size="23" fill="#fff6e0" stroke="${DEEP}" stroke-width="4" paint-order="stroke" text-anchor="middle" dy="9"><textPath href="#lgArc" startOffset="50%">Build Your Town</textPath></text>
      <path d="M200 228 l8 8 -8 9 -8 -9Z M188 236 q-6 -6 -12 0 q6 6 12 0Z M212 236 q6 -6 12 0 q-6 6 -12 0Z" fill="#ffc93c" stroke="#8a4708" stroke-width="1.8" stroke-linejoin="round"/>
    </g>` : ''}
  </svg>`;
}
