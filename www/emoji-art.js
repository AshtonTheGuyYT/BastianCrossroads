/* Bastion Crossroads — original emoji art.
 * Every emoji here is drawn from scratch as SVG in one house style:
 * chunky ink outline, flat colour, one soft highlight.
 * BX_EMOJI = [{ k: key (unicode char, or ':name:' for Bastion originals), n: name, kw: keywords, c: category, svg }]
 */
(function () {
'use strict';
const INK = '#2A1F33', Y = '#FFC83D', YS = '#F29F2E', W = '#FFFFFF', TEAR = '#5CC3FF', RED = '#F2445A', PINK = '#FF7DA8';
const SW = 2.6;
const P = (d, fill = 'none', o = '') => {
  // o may override the default outline (stroke / stroke-width); never emit an attribute twice
  const st = /\bstroke="/.test(o) ? '' : ` stroke="${INK}"`, sw = /stroke-width="/.test(o) ? '' : ` stroke-width="${SW}"`;
  return `<path d="${d}" fill="${fill}"${st}${sw} stroke-linejoin="round" stroke-linecap="round"${o}/>`;
};
const L = (d, w = 2.8, col = INK, o = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o}/>`;
const F = (d, fill, o = '') => `<path d="${d}" fill="${fill}"${o}/>`;
const C = (x, y, r, fill, stroke = true, o = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke ? ` stroke="${INK}" stroke-width="${SW}"` : ''}${o}/>`;
const E = (x, y, rx, ry, fill, stroke = true, o = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${stroke ? ` stroke="${INK}" stroke-width="${SW}"` : ''}${o}/>`;
const HL = (x, y, rx, ry, rot = -30) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".42" transform="rotate(${rot} ${x} ${y})"/>`;
const G = (inner, t) => `<g transform="${t}">${inner}</g>`;
const svg = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;
const heartD = (cx, cy, s) => {
  // heart centred on (cx, cy), about 26*s wide
  const pts = [[0, 10], [-10, 3, -13, -2, -13, -6], [-13, -10, -10, -13, -6.5, -13], [-3.5, -13, -1.5, -11.4, 0, -9], [1.5, -11.4, 3.5, -13, 6.5, -13], [10, -13, 13, -10, 13, -6], [13, -2, 10, 3, 0, 10]];
  const f = (x, y) => `${(cx + x * s).toFixed(2)} ${(cy + y * s).toFixed(2)}`;
  return `M${f(...pts[0])}` + pts.slice(1).map(q => `C${f(q[0], q[1])} ${f(q[2], q[3])} ${f(q[4], q[5])}`).join('') + 'z';
};
const starD = (cx, cy, R, r, pts = 5, rot = -90) => { let d = ''; for (let i = 0; i < pts * 2; i++) { const a = (rot + i * 180 / pts) * Math.PI / 180, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2); } return d + 'z'; };
const dropD = (x, y, s = 1) => `M${x} ${y}c${-4 * s} ${5 * s} ${-6 * s} ${8 * s} ${-6 * s} ${11 * s}a${6 * s} ${6 * s} 0 0 0 ${12 * s} 0c0-${3 * s}-${2 * s}-${6 * s}-${6 * s}-${11 * s}z`;

/* ---------------- faces ---------------- */
function base(col = Y, shade = YS) {
  return C(32, 33, 27, col, false) + F('M5.4 35.5a26.6 26.6 0 0 0 53.2 0c-5.6 11.6-15.4 18.4-26.6 18.4S11 47.1 5.4 35.5z', shade, ' opacity=".55"') + C(32, 33, 27, 'none') + HL(21, 16, 8.5, 4.6);
}
const EYE = {
  dot: x => E(x, 28, 3.3, 4.4, INK, false) + C(x + 1.2, 26.3, 1.15, W, false),
  happy: x => L(`M${x - 5} 30q5-7 10 0`, 3),
  closed: x => L(`M${x - 5} 27q5 5 10 0`, 3),
  line: x => L(`M${x - 5} 28h10`, 3),
  wide: x => C(x, 28, 6.4, W, true) + C(x, 28.5, 3.2, INK, false) + C(x + 1.2, 27.2, 1, W, false),
  big: x => C(x, 28, 7.4, W, true) + C(x, 29, 5.2, INK, false) + C(x - 1.8, 26.4, 1.9, W, false) + C(x + 2.2, 31.2, 1, W, false) + L(`M${x - 6.4} 31.5q6.4 5.4 12.8 0`, 2.6, TEAR),
  plead: x => C(x, 28, 7, W, true) + C(x, 29.2, 5, INK, false) + C(x - 1.7, 26.7, 1.8, W, false) + C(x + 2, 31.4, .9, W, false),
  heart: x => P(heartD(x, 27.5, .55), RED),
  star: x => P(starD(x, 28, 7, 3.2), '#FF8A1F'),
  x: x => L(`M${x - 4} 24l8 8M${x + 4} 24l-8 8`, 3),
  spiral: x => L(`M${x} 28m-1 0a1.6 1.6 0 1 1 2.6 1.4a3.4 3.4 0 1 1-5.6-3.4a5.4 5.4 0 1 1 8.6 6`, 2.2),
  squintL: x => L(`M${x - 4} 24l7 4-7 4`, 3),
  squintR: x => L(`M${x + 4} 24l-7 4 7 4`, 3),
  side: x => L(`M${x - 5.5} 26h11`, 2.8) + E(x + 2.3, 29.4, 2.6, 2.4, INK, false),
  roll: x => C(x, 28, 6.4, W, true) + C(x + .6, 24.4, 2.9, INK, false),
  money: x => `<text x="${x}" y="33" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="15" text-anchor="middle" fill="#1FA45A" stroke="${INK}" stroke-width="1.4">$</text>`,
  low: x => E(x, 30, 3, 4, INK, false) + C(x + 1, 28.6, 1, W, false),
  glare: x => E(x, 29, 3.4, 3.6, INK, false),
  wink: x => x < 32 ? EYE.dot(x) : EYE.happy(x)
};
const MOUTH = {
  smile: () => L('M21 40q11 10.5 22 0', 3),
  small: () => L('M26 42q6 4.5 12 0', 3),
  grin: () => P('M19 37.5h26c0 9.5-6 15-13 15s-13-5.5-13-15z', INK) + F('M21.3 38.8h21.4c-.2 1.6-.6 3-1.1 4.2H22.4c-.5-1.2-.9-2.6-1.1-4.2z', W) + F('M26 49.4c1.6-2.6 3.8-3.8 6-3.8s4.4 1.2 6 3.8c-1.8 1.4-3.8 2-6 2s-4.2-.6-6-2z', '#FF6B81'),
  laugh: () => P('M16 36h32c0 12-7.5 18.5-16 18.5S16 48 16 36z', INK) + F('M18.4 37.4h27.2c-.2 1.9-.6 3.6-1.2 5.1H19.6c-.6-1.5-1-3.2-1.2-5.1z', W) + F('M24.5 51.3c2-3 4.8-4.6 7.5-4.6s5.5 1.6 7.5 4.6c-2.2 1.6-4.7 2.4-7.5 2.4s-5.3-.8-7.5-2.4z', '#FF6B81'),
  flat: () => L('M24 44h16', 3),
  frown: () => L('M22.5 47q9.5-8.5 19 0', 3),
  o: () => E(32, 44.5, 4, 5, INK, false),
  O: () => E(32, 45, 6.4, 8, INK, false) + F('M27.2 49.5c1.3-1.6 3-2.4 4.8-2.4s3.5.8 4.8 2.4c-1.3 1.6-3 2.3-4.8 2.3s-3.5-.7-4.8-2.3z', '#FF6B81'),
  smirk: () => L('M24 45q9.5 3 15-4.5', 3),
  wavy: () => L('M20 45l4-3.4 4 3.4 4-3.4 4 3.4 4-3.4 4 3.4', 2.8),
  tongue: () => L('M21 40q11 10.5 22 0', 3) + P('M30.5 45.6c-.4 5.4 1.2 9 4.6 9s5-3.6 4.4-9.4', '#FF6B81'),
  tongueOut: () => L('M22 42h20', 3) + P('M27 42c-.6 7 1.6 11 5 11s5.6-4 5-11', '#FF6B81') + L('M32 44v5', 1.8),
  grimace: () => P('M18 38.5h28v10.5c0 1.6-1.3 2.8-2.8 2.8H20.8c-1.5 0-2.8-1.2-2.8-2.8z', W) + L('M18 44.6h28M25 38.5v13.3M32 38.5v13.3M39 38.5v13.3', 2),
  kiss: () => L('M29 39.5q5.5 1.6 1 4q4.5 2.4-1 4.6', 2.8),
  wobble: () => L('M22.5 45.5q2.4-2.6 4.8 0t4.8 0t4.8 0t4.8 0', 2.8),
  sadOpen: () => P('M21 51q11-13 22 0z', INK),
  zip: () => L('M20 44h24', 3) + L('M23 41.5v5M27 41.5v5M31 41.5v5M35 41.5v5M39 41.5v5', 1.8),
  yawn: () => E(32, 45, 7, 8.4, INK, false) + E(32, 48.5, 4, 2.6, '#FF6B81', false),
  none: () => '',
  teeth: () => P('M20 40.5h24v8H20z', W) + L('M20 44.5h24M26 40.5v8M32 40.5v8M38 40.5v8', 1.8),
  smallO: () => E(32, 45, 2.6, 3.2, INK, false),
  pout: () => L('M26 46q6-4 12 0', 3),
  bigSmile: () => P('M18 38h28c-1.4 9-7.4 13.6-14 13.6S19.4 47 18 38z', INK) + F('M20.4 39.3h23.2c-.3 1.5-.8 2.8-1.4 4H21.8c-.6-1.2-1.1-2.5-1.4-4z', W)
};
const BROW = {
  angry: () => L('M16.5 20.5l11 4.4M47.5 20.5l-11 4.4', 3),
  worried: () => L('M17.5 23.5q5-3.4 10-4.4M46.5 23.5q-5-3.4-10-4.4', 3),
  raised: () => L('M36.5 19.5q5-4.6 10-.6', 3) + L('M17.5 21.5h9.5', 3),
  flat: () => L('M18 20.5h9.5M36.5 20.5H46', 3),
  sad: () => L('M18 21.5l9-3M46 21.5l-9-3', 3),
  up: () => L('M18 19.5q4.6-3.4 9.6-1.4M46 19.5q-4.6-3.4-9.6-1.4', 3)
};
const X = {
  blush: () => E(15.5, 38, 4.6, 2.8, PINK, false, ' opacity=".6"') + E(48.5, 38, 4.6, 2.8, PINK, false, ' opacity=".6"'),
  joyTears: () => P('M10.5 27c-5 3.6-7 9-3.6 11.6 3.2 2.4 7.4-.4 7.8-5.6.2-2.4-1.4-4.6-4.2-6z', TEAR) + P('M53.5 27c5 3.6 7 9 3.6 11.6-3.2 2.4-7.4-.4-7.8-5.6-.2-2.4 1.4-4.6 4.2-6z', TEAR),
  tear: () => P(dropD(45, 33, .62), TEAR),
  sob: () => P('M18 32.5c-2 8-2.6 15.6-1 22.4h7c1.2-7 .6-14.6-1.6-22.4z', TEAR) + P('M46 32.5c2 8 2.6 15.6 1 22.4h-7c-1.2-7-.6-14.6 1.6-22.4z', TEAR),
  sweat: () => P(dropD(51, 9, .7), TEAR) + HL(49.6, 17.4, 1.4, 2.4, 0),
  halo: () => E(32, 7.5, 15, 4.2, 'none', false, ` stroke="#FFD94A" stroke-width="3.4"`) + E(32, 7.5, 15, 4.2, 'none', false, ` stroke="${INK}" stroke-width="1" opacity=".5"`),
  hearts3: () => P(heartD(9, 15, .42), RED) + P(heartD(55, 12, .36), RED) + P(heartD(53, 50, .42), RED),
  zzz: () => `<text x="44" y="16" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="12" fill="#7FB6FF" stroke="${INK}" stroke-width="1.2">z</text><text x="52" y="9" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="8.5" fill="#7FB6FF" stroke="${INK}" stroke-width="1">z</text>`,
  steam: () => P('M14 46c-5 0-8 3-8 6s3 4.6 6 3.2c1.6 2.6 6 2.4 6.8-.8 2.6-.2 3.6-4 .8-5.2-.8-2.4-3-3.2-5.6-3.2z', '#F3F5F7') + P('M50 46c5 0 8 3 8 6s-3 4.6-6 3.2c-1.6 2.6-6 2.4-6.8-.8-2.6-.2-3.6-4-.8-5.2.8-2.4 3-3.2 5.6-3.2z', '#F3F5F7'),
  mask: () => P('M15 37c6-3 28-3 34 0v8c0 6-8 10-17 10s-17-4-17-10z', '#F4F7FA') + L('M15 39l-9-4M49 39l9-4', 2.2) + L('M22 43h20M23 48h18', 1.6, '#B8C4CF'),
  thermo: () => P('M39 44l14-14a3 3 0 0 1 4.2 4.2l-14 14z', '#F4F7FA') + L('M42 47l12-12', 2, RED),
  bandage: () => P('M12 17l14-9 4 6-14 9z', '#F6D7B0') + L('M16 13l2 3M20 11l2 3', 1.6, '#C79A6A'),
  partyHat: () => G(P('M22 12L32 -8l10 20c-6 2-14 2-20 0z', '#7A5CFF') + L('M25.4 6l11.6-2M28.6 0l6.2-1', 2.2, '#FFD94A') + C(32, -8, 3.4, '#FF5C9E'), 'translate(10 8) rotate(18 32 6)') + C(8, 14, 1.8, '#FF5C9E', false) + C(12, 6, 1.6, '#3F8CFF', false) + C(56, 48, 1.8, '#4FC27E', false),
  cowboy: () => P('M3 17c4 3 15 4 29 4s25-1 29-4c-2 5-12 8-29 8S5 22 3 17z', '#B5733B') + P('M15 18c0-9 4-16 8-16 3 0 5 3 9 3s6-3 9-3c4 0 8 7 8 16-5 1.5-11 2-17 2s-12-.5-17-2z', '#C98545') + L('M16 14c10 2 22 2 32 0', 2.4, '#7A4A22'),
  nerd: () => C(22, 28, 7.6, 'none') + C(42, 28, 7.6, 'none') + L('M29.6 28h4.8M14.4 26.5l-7-2M49.6 26.5l7-2', 2.6) + P('M28.5 44.5h7v5h-7z', W),
  monocle: () => C(42, 28, 7.2, 'none', false, ` stroke="#E8B53C" stroke-width="2.6"`) + L('M47 33q4 9 1 20', 1.6, '#E8B53C'),
  sunglasses: () => P('M8.5 23.5h47l-1.4 3.4c-.8 6.4-4.4 9.6-10 9.6-5.6 0-9-3.4-10-8.6h-4.2c-1 5.2-4.4 8.6-10 8.6-5.6 0-9.2-3.2-10-9.6z', INK) + F('M14 26.4h11.4c-.4 3.4-2 5.4-5.4 5.4-3 0-5-1.8-6-5.4z', '#fff', ' opacity=".28"') + F('M38.6 26.4H50c-1 3.6-3 5.4-6 5.4-3.4 0-5-2-5.4-5.4z', '#fff', ' opacity=".28"'),
  horns: () => P('M13 18c-4-4-5-10-3-15 3 4 7 6 12 7z', '#7A2FD0') + P('M51 18c4-4 5-10 3-15-3 4-7 6-12 7z', '#7A2FD0'),
  mindBlown: () => P('M14 14c-4-6-1-12 5-11 1-5 8-6 11-2 3-4 10-3 11 2 6-1 9 5 5 11z', '#FF8A1F') + P('M20 12c-1-3 1-6 4-5 1-2.6 4-3 6-1 2-2 5-1.6 6 1 3-1 5 2 4 5z', '#FFD94A'),
  handMouth: () => P('M20 47c0-5 4-8 9-8h8c2.4 0 4 1.6 4 3.6S39.4 46 37 46h-3c3 0 5 1.6 5 3.6S37.4 53 35 53h-9c-3.6 0-6-2.6-6-6z', '#FFD15C') + L('M30 46h7', 1.8, YS),
  shush: () => P('M29 33c0-2 1.4-3.4 3-3.4s3 1.4 3 3.4v18h-6z', '#FFD15C'),
  think: () => P('M40 56c-4-1-7-4-7-8 0-3 2-5 5-5h9c2 0 3.4 1.4 3.4 3.2S49 49.4 47 49.4h-4c2.4 0 4 1.4 4 3.2S45.6 56 43 56z', '#FFD15C') + P('M44 43l5-11c.8-1.8 3-2.4 4.4-1.2 1.2 1 1.4 2.8.6 4.2L49 43', '#FFD15C'),
  icicles: () => P('M14 52l2 7 2-6 2 8 2-7 2 6 2-6z', '#CFF1FF'),
  drool: () => P(dropD(40, 47, .5), TEAR),
  sparkles: () => P(starD(10, 12, 6, 2.2, 4, -90), '#FFD94A') + P(starD(55, 50, 5, 1.8, 4, -90), '#FFD94A'),
  meltBase: () => '',
  bubble: () => C(47, 50, 5, '#D7F2FF', true, ' opacity=".9"'),
  dizzyStars: () => P(starD(14, 8, 5, 2.2), '#FFD94A') + P(starD(32, 3.5, 4.4, 2), '#FFD94A') + P(starD(50, 8, 5, 2.2), '#FFD94A'),
  salute: () => P('M33 14c2-6 8-10 16-10 5 0 9 2 11 5 1.4 2-.2 4.4-2.6 4l-6-1 7 3c2 1 2 4-.4 4.6L50 19l5 3c1.6 1.2.8 3.8-1.2 3.8-8 0-15-2-19-5-1.6-1.4-2.4-3.8-1.8-6.8z', '#FFD15C') + L('M44 14l8 2M43 18l7 2', 1.6, YS),
  hugHands: () => P('M4 46c0-4 3-7 7-7 3 0 5 2 6 5l2 6c1 3-1 6-4 6H10c-3 0-6-3-6-6z', '#FFD15C') + P('M60 46c0-4-3-7-7-7-3 0-5 2-6 5l-2 6c-1 3 1 6 4 6h5c3 0 6-3 6-6z', '#FFD15C')
};

function face(spec) {
  const b = spec.base ? base(spec.base, spec.shade) : base();
  const under = (spec.under || []).map(k => X[k]()).join('');
  const over = (spec.over || []).map(k => X[k]()).join('');
  const eyes = spec.eyes === 'wink' ? EYE.dot(23) + EYE.happy(41)
    : spec.eyes === 'squint' ? EYE.squintL(23) + EYE.squintR(41)
    : spec.eyes2 ? EYE[spec.eyes](23) + EYE[spec.eyes2](41)
    : EYE[spec.eyes](23) + EYE[spec.eyes](41);
  const inner = under + b + (spec.blush ? X.blush() : '') + eyes + (spec.brow ? BROW[spec.brow]() : '') + MOUTH[spec.mouth || 'none']() + over;
  return svg(spec.flip ? G(inner, 'rotate(180 32 32)') : inner);
}

const FACES = [
  ['😀', 'grinning', 'happy smile', { eyes: 'dot', mouth: 'grin' }],
  ['😃', 'smiley', 'happy joy', { eyes: 'wide', mouth: 'grin' }],
  ['😄', 'smile', 'happy laugh', { eyes: 'happy', mouth: 'grin' }],
  ['😁', 'grin', 'beam teeth', { eyes: 'happy', mouth: 'teeth' }],
  ['😆', 'laughing', 'lol xd', { eyes: 'squint', mouth: 'laugh' }],
  ['😅', 'sweat_smile', 'nervous phew', { eyes: 'happy', mouth: 'grin', over: ['sweat'] }],
  ['🤣', 'rofl', 'rolling laughing', { eyes: 'squint', mouth: 'laugh', over: ['joyTears'] }],
  ['😂', 'joy', 'tears laughing lol', { eyes: 'happy', mouth: 'laugh', over: ['joyTears'] }],
  ['🙂', 'slight_smile', 'smile', { eyes: 'dot', mouth: 'small' }],
  ['🙃', 'upside_down', 'silly', { eyes: 'dot', mouth: 'smile', flip: true }],
  ['😉', 'wink', 'flirt', { eyes: 'wink', mouth: 'smile' }],
  ['😊', 'blush', 'happy shy', { eyes: 'happy', mouth: 'smile', blush: true }],
  ['😇', 'innocent', 'angel halo', { eyes: 'happy', mouth: 'smile', under: ['halo'] }],
  ['🥰', 'smiling_hearts', 'love adore', { eyes: 'happy', mouth: 'smile', blush: true, over: ['hearts3'] }],
  ['😍', 'heart_eyes', 'love crush', { eyes: 'heart', mouth: 'grin' }],
  ['🤩', 'star_struck', 'wow amazing', { eyes: 'star', mouth: 'grin' }],
  ['😘', 'kiss', 'love', { eyes: 'wink', mouth: 'kiss', over: [] , extraHeart: true }],
  ['😋', 'yum', 'tasty delicious', { eyes: 'happy', mouth: 'tongue' }],
  ['😛', 'tongue', 'silly', { eyes: 'dot', mouth: 'tongueOut' }],
  ['😜', 'winking_tongue', 'silly joke', { eyes: 'wink', mouth: 'tongueOut' }],
  ['🤪', 'zany', 'crazy goofy', { eyes: 'wide', eyes2: 'dot', mouth: 'tongue' }],
  ['🤑', 'money_mouth', 'rich cash', { eyes: 'money', mouth: 'tongue' }],
  ['🤗', 'hug', 'hugging', { eyes: 'happy', mouth: 'smile', blush: true, over: ['hugHands'] }],
  ['🤭', 'hand_over_mouth', 'oops giggle', { eyes: 'happy', mouth: 'none', blush: true, over: ['handMouth'] }],
  ['🤫', 'shush', 'quiet secret', { eyes: 'dot', mouth: 'pout', over: ['shush'] }],
  ['🤔', 'thinking', 'hmm wonder', { eyes: 'dot', brow: 'raised', mouth: 'smirk', over: ['think'] }],
  ['🤐', 'zipper_mouth', 'secret', { eyes: 'dot', mouth: 'zip' }],
  ['🤨', 'raised_eyebrow', 'suspicious skeptical', { eyes: 'dot', brow: 'raised', mouth: 'flat' }],
  ['😐', 'neutral', 'meh', { eyes: 'dot', mouth: 'flat' }],
  ['😑', 'expressionless', 'blank', { eyes: 'line', mouth: 'flat' }],
  ['😶', 'no_mouth', 'speechless', { eyes: 'dot', mouth: 'none' }],
  ['😏', 'smirk', 'smug', { eyes: 'side', mouth: 'smirk' }],
  ['😒', 'unamused', 'annoyed meh', { eyes: 'side', mouth: 'frown' }],
  ['🙄', 'eye_roll', 'whatever', { eyes: 'roll', mouth: 'flat' }],
  ['😬', 'grimace', 'awkward eek', { eyes: 'dot', mouth: 'grimace' }],
  ['😌', 'relieved', 'calm peaceful', { eyes: 'closed', mouth: 'small', blush: true }],
  ['😔', 'pensive', 'sad thoughtful', { eyes: 'closed', brow: 'sad', mouth: 'pout' }],
  ['😪', 'sleepy', 'tired', { eyes: 'closed', mouth: 'smallO', over: ['bubble'] }],
  ['🤤', 'drool', 'want hungry', { eyes: 'closed', mouth: 'smile', over: ['drool'] }],
  ['😴', 'sleeping', 'sleep zzz', { eyes: 'closed', mouth: 'smallO', over: ['zzz'] }],
  ['😷', 'mask', 'sick ill', { eyes: 'dot', mouth: 'none', over: ['mask'] }],
  ['🤒', 'sick', 'thermometer fever', { eyes: 'low', brow: 'worried', mouth: 'flat', over: ['thermo'] }],
  ['🤕', 'bandage', 'hurt injured', { eyes: 'low', brow: 'worried', mouth: 'frown', over: ['bandage'] }],
  ['🤢', 'nauseated', 'sick gross', { base: '#9BD46A', shade: '#6FB14A', eyes: 'closed', brow: 'worried', mouth: 'wavy' }],
  ['🤮', 'vomit', 'sick gross', { base: '#9BD46A', shade: '#6FB14A', eyes: 'squint', mouth: 'O' }],
  ['🥵', 'hot', 'heat sweating', { base: '#FF6A4D', shade: '#E2442F', eyes: 'low', mouth: 'tongueOut', over: ['sweat'] }],
  ['🥶', 'cold', 'freezing ice', { base: '#7CC8FF', shade: '#4C9EE0', eyes: 'wide', mouth: 'teeth', over: ['icicles'] }],
  ['🥴', 'woozy', 'dizzy drunk', { eyes: 'closed', eyes2: 'wide', mouth: 'wavy', blush: true }],
  ['😵', 'dizzy_face', 'dead knocked out', { eyes: 'x', mouth: 'O' }],
  ['😵‍💫', 'spiral_eyes', 'dizzy confused', { eyes: 'spiral', mouth: 'wavy', over: ['dizzyStars'] }],
  ['🤯', 'mind_blown', 'shocked wow', { eyes: 'wide', mouth: 'O', over: ['mindBlown'] }],
  ['🤠', 'cowboy', 'yeehaw', { eyes: 'dot', mouth: 'grin', over: ['cowboy'] }],
  ['🥳', 'party', 'celebrate birthday', { eyes: 'happy', mouth: 'grin', over: ['partyHat'] }],
  ['😎', 'sunglasses', 'cool', { eyes: 'line', mouth: 'smile', over: ['sunglasses'] }],
  ['🤓', 'nerd', 'geek smart', { eyes: 'dot', mouth: 'smile', over: ['nerd'] }],
  ['🧐', 'monocle', 'inspect fancy', { eyes: 'dot', brow: 'raised', mouth: 'flat', over: ['monocle'] }],
  ['😕', 'confused', 'unsure', { eyes: 'dot', mouth: 'smirk' }],
  ['😟', 'worried', 'nervous', { eyes: 'dot', brow: 'worried', mouth: 'frown' }],
  ['🙁', 'frown', 'sad', { eyes: 'dot', mouth: 'frown' }],
  ['😮', 'open_mouth', 'surprised wow', { eyes: 'dot', mouth: 'o' }],
  ['😯', 'hushed', 'surprised', { eyes: 'dot', brow: 'up', mouth: 'smallO' }],
  ['😲', 'astonished', 'shocked', { eyes: 'wide', brow: 'up', mouth: 'O' }],
  ['😳', 'flushed', 'embarrassed', { eyes: 'wide', mouth: 'smallO', blush: true }],
  ['🥺', 'pleading', 'puppy eyes please', { eyes: 'plead', brow: 'worried', mouth: 'pout' }],
  ['🥹', 'holding_back_tears', 'grateful touched proud teary', { eyes: 'big', brow: 'worried', mouth: 'wobble', blush: true }],
  ['😦', 'frowning', 'shock', { eyes: 'dot', mouth: 'sadOpen' }],
  ['😨', 'fearful', 'scared', { base: '#FFC83D', eyes: 'wide', brow: 'worried', mouth: 'sadOpen', over: ['sweat'] }],
  ['😰', 'anxious', 'nervous sweat', { eyes: 'dot', brow: 'worried', mouth: 'sadOpen', over: ['sweat'] }],
  ['😢', 'cry', 'sad tear', { eyes: 'low', brow: 'sad', mouth: 'frown', over: ['tear'] }],
  ['😭', 'sob', 'crying bawling', { eyes: 'closed', brow: 'sad', mouth: 'O', over: ['sob'] }],
  ['😱', 'scream', 'terrified', { base: '#FFD45C', eyes: 'wide', mouth: 'O', brow: 'up' }],
  ['😖', 'confounded', 'frustrated', { eyes: 'squint', mouth: 'wavy' }],
  ['😞', 'disappointed', 'sad', { eyes: 'closed', brow: 'sad', mouth: 'frown' }],
  ['😩', 'weary', 'tired ugh', { eyes: 'squint', brow: 'worried', mouth: 'sadOpen' }],
  ['🥱', 'yawn', 'bored tired', { eyes: 'closed', mouth: 'yawn' }],
  ['😤', 'triumph', 'huff proud', { eyes: 'glare', brow: 'angry', mouth: 'flat', over: ['steam'] }],
  ['😠', 'angry', 'mad', { eyes: 'glare', brow: 'angry', mouth: 'frown' }],
  ['😡', 'rage', 'furious', { base: '#FF5A4A', shade: '#D8392C', eyes: 'glare', brow: 'angry', mouth: 'frown' }],
  ['🤬', 'cursing', 'swearing', { base: '#FF5A4A', shade: '#D8392C', eyes: 'glare', brow: 'angry', mouth: 'grimace' }],
  ['😈', 'smiling_imp', 'devil evil', { base: '#9B5CF0', shade: '#7A3BD4', eyes: 'glare', brow: 'angry', mouth: 'smile', under: ['horns'] }],
  ['🫠', 'melting', 'embarrassed hot', { eyes: 'dot', mouth: 'small', melt: true }],
  ['🫡', 'salute', 'respect yes', { eyes: 'dot', brow: 'flat', mouth: 'flat', over: ['salute'] }]
];

/* ---------------- standalone drawings ---------------- */
const ART = {};
const add = (k, n, kw, c, inner) => ART[k] = { k, n, kw, c, svg: svg(inner) };

// hearts
const HEARTS = [['❤️', 'heart', '#F2445A'], ['🧡', 'orange_heart', '#FF8A2A'], ['💛', 'yellow_heart', '#FFD23F'], ['💚', 'green_heart', '#3FCB6E'], ['💙', 'blue_heart', '#3F8CFF'], ['💜', 'purple_heart', '#9B5CF0'], ['🖤', 'black_heart', '#3B3150'], ['🤍', 'white_heart', '#F6F3F8'], ['🤎', 'brown_heart', '#9A5B34'], ['🩷', 'pink_heart', '#FF7DB8'], ['🩵', 'light_blue_heart', '#7FD4FF']];
for (const [k, n, col] of HEARTS) add(k, n, 'love heart ' + n.replace('_', ' '), 'Love', P(heartD(32, 33, 1.75), col) + HL(21, 20, 5.5, 3.2));
add('💔', 'broken_heart', 'sad breakup', 'Love', P('M32 21.5c-2.4-4-6-6-10.2-6-6.4 0-11.6 5-11.6 12 0 9 10 18 21.8 26l2.6-8-5-6 6-6-3.6-12z', '#F2445A') + P('M34.6 15.8c2-.2 3.6-.3 5.5-.3 6.4 0 11.6 5 11.6 12 0 9-10 18-21.8 26l3-9-4.8-6 5.6-6-3.8-11z', '#F2445A', ' transform="translate(2.5 0)"'));
add('💕', 'two_hearts', 'love', 'Love', P(heartD(24, 30, 1.25), PINK) + P(heartD(44, 42, .9), '#FF4F8B'));
add('💖', 'sparkling_heart', 'love sparkle', 'Love', P(heartD(32, 34, 1.6), '#FF5C9E') + HL(22, 22, 5, 3) + P(starD(52, 14, 7, 2.4, 4), '#FFE36B') + P(starD(12, 50, 5, 1.8, 4), '#FFE36B'));
add('💗', 'growing_heart', 'love', 'Love', P(heartD(32, 34, 1.75), '#FF7DB8') + P(heartD(32, 32, 1.05), '#FF4F96') + HL(21, 20, 5, 3));
add('💘', 'cupid', 'love arrow', 'Love', L('M8 52L56 12', 3) + P('M50 10l8-2-2 8z', '#C9A26B') + P(heartD(32, 33, 1.5), '#F2445A') + L('M20 42L44 22', 3) + P('M6 50l6 6M10 46l6 6', 'none'));
add('❤️‍🔥', 'heart_on_fire', 'passion', 'Love', P('M32 4c4 8 14 10 14 22 0-6-4-9-4-9 0 6-3 8-5 9 2-6-1-13-5-16 0 6-6 10-6 16-1-3-3-4-3-4 0 3-1 5-1 7 0-10 10-16 10-25z', '#FF8A1F') + P(heartD(32, 37, 1.55), '#F2445A') + HL(22, 25, 4.6, 2.8));
add('💋', 'kiss_mark', 'lips', 'Love', P('M8 32c6-8 14-10 18-8 3 1.5 4 1.5 6 1.5s3 0 6-1.5c4-2 12 0 18 8-6 2-12 3-24 3S14 34 8 32z', '#E8304E') + P('M8 32c4 8 12 14 24 14s20-6 24-14c-6 2-12 3-24 3S14 34 8 32z', '#C81E3B'));

// hands — chunky mitten style, warm yellow
const H = '#FFD15C', HS = '#EBA937';
add('👍', 'thumbsup', 'yes like ok approve', 'Hands', P('M14 30h8v24h-8z', '#4B8DF8') + P('M22 31c5-3 8-8 9-15 .4-3 3-5 5.6-3.8 2.8 1.4 3.4 5 2.4 9.8l-1.4 5h12c3 0 5 2.6 4.4 5.4l-3.6 17c-.6 2.8-3 4.6-5.8 4.6H22z', H) + L('M38 41h7M37 48h6', 2, HS));
add('👎', 'thumbsdown', 'no dislike', 'Hands', G(P('M14 30h8v24h-8z', '#4B8DF8') + P('M22 31c5-3 8-8 9-15 .4-3 3-5 5.6-3.8 2.8 1.4 3.4 5 2.4 9.8l-1.4 5h12c3 0 5 2.6 4.4 5.4l-3.6 17c-.6 2.8-3 4.6-5.8 4.6H22z', H) + L('M38 41h7M37 48h6', 2, HS), 'rotate(180 32 33)'));
add('👋', 'wave', 'hello hi bye', 'Hands', P('M20 30V13c0-2.2 1.8-4 4-4s4 1.8 4 4v14V9c0-2.2 1.8-4 4-4s4 1.8 4 4v18V12c0-2.2 1.8-4 4-4s4 1.8 4 4v24l3-6c1-2 3.4-2.8 5.4-1.6 1.8 1 2.4 3.2 1.4 5.2L48 51c-2.8 5-7.6 8-13.4 8H32c-7 0-12-5-12-12V22c0-2.2 1.8-4 4-4' + '', H) + L('M7 18q-3 5 0 10M5 12q-5 9 0 18M57 6q4 3 4 8', 2.2, '#8FB7FF'));
add('👏', 'clap', 'applause bravo', 'Hands', G(P('M18 52c-6-6-7-14-3-18l10-12c1.4-1.6 4-1.6 5.4 0s1.4 4 0 5.6l2-2.4c1.4-1.6 4-1.6 5.4 0 1.4 1.6 1.4 4 0 5.6l1-1c1.4-1.6 4-1.6 5.4 0s1.4 4 0 5.6L32 51c-4 4-10 5-14 1z', H), 'rotate(-8 32 32)') + G(P('M30 50c-6-6-6-14-2-18l10-12c1.4-1.6 4-1.6 5.4 0s1.4 4 0 5.6l2-2.4c1.4-1.6 4-1.6 5.4 0 1.4 1.6 1.4 4 0 5.6L44 46c-4 4-10 7-14 4z', '#FFC24A'), 'rotate(10 40 32)') + L('M10 14l3 5M20 8l1 6M32 6v6', 2.4, '#FFB13D'));
add('🙏', 'pray', 'please thanks hope', 'Hands', P('M31 8c-3 0-5 2.4-5.4 5.4L22 40l-6 6v12h14V46l2-6z', H) + P('M33 8c3 0 5 2.4 5.4 5.4L42 40l6 6v12H34V46l-2-6z', '#FFC24A') + L('M32 12v26', 2));
add('👌', 'ok_hand', 'okay perfect', 'Hands', P('M24 30c-6 0-10 4-10 9s4 9 10 9c2 0 4-.6 5.6-1.8l2.4 3.8V58h18V44l-3-14V14c0-2.2-1.8-4-4-4s-4 1.8-4 4v14V10c0-2.2-1.8-4-4-4s-4 1.8-4 4v20c-1.6-.6-3.4-1-5-1z', H) + C(24, 39, 4.4, '#fff', true));
add('✌️', 'peace', 'victory two', 'Hands', P('M22 30L16 10c-.6-2.2.6-4.4 2.8-5 2-.6 4.2.6 4.8 2.8L28 24l2-17c.2-2.2 2.2-3.8 4.4-3.6 2.2.2 3.8 2.2 3.6 4.4L36 28c6 0 10 2 12 6v12c0 7-6 13-13 13h-3c-7 0-12-5-12-12V34z', H) + L('M24 38h12M26 45h10', 2, HS));
add('🤞', 'crossed_fingers', 'luck hope', 'Hands', P('M22 32V12c0-2.2 1.8-4 4-4s4 1.8 4 4v16', H) + P('M38 30l-4-20c-.4-2.2 1-4.2 3.2-4.6s4.2 1 4.6 3.2L44 30', '#FFC24A') + P('M20 34c0-3 2-5 5-5h17c3 0 6 3 6 6v10c0 8-6 14-14 14h-2c-7 0-12-5-12-12z', H) + L('M26 38h14M26 45h14', 2, HS));
add('👊', 'punch', 'fist bump', 'Hands', P('M12 28c0-4 3-7 7-7h24c6 0 10 4 10 10v10c0 8-6 14-14 14H24c-7 0-12-5-12-12z', H) + L('M24 21v12M33 21v12M42 21v12', 2.2, HS) + P('M12 34h12c3 0 5 2 5 5s-2 5-5 5H14', H));
add('💪', 'muscle', 'strong flex', 'Hands', P('M10 52c-2-14 2-26 10-34l6-8c2-3 6-2 7 1l1 4-8 9 4 3c4-4 12-6 18-2 6 4 9 12 6 20-2 6-8 9-14 9z', H) + L('M30 42c3-4 9-6 14-4', 2.2, HS));
add('🙌', 'raised_hands', 'celebrate yay', 'Hands', P('M8 30V14c0-2 1.6-3.6 3.6-3.6S15 12 15 14v12V9c0-2 1.6-3.6 3.6-3.6S22 7 22 9v20l2-4c1-2 3-2.6 4.8-1.6 1.6 1 2 3 1 4.8L24 42c-2 4-5 6-9 6h-1c-3.4 0-6-2.6-6-6z', H) + G(P('M8 30V14c0-2 1.6-3.6 3.6-3.6S15 12 15 14v12V9c0-2 1.6-3.6 3.6-3.6S22 7 22 9v20l2-4c1-2 3-2.6 4.8-1.6 1.6 1 2 3 1 4.8L24 42c-2 4-5 6-9 6h-1c-3.4 0-6-2.6-6-6z', H), 'translate(64 0) scale(-1 1)') + L('M26 6l3 4M32 3v5M38 6l-3 4', 2.2, '#FFB13D') + P('M8 46h16v12H8zM40 46h16v12H40z', '#4B8DF8'));
add('👉', 'point_right', 'this there', 'Hands', P('M8 26h32c2.2 0 4 1.8 4 4s-1.8 4-4 4h-2 10c2.4 0 4 1.8 4 4s-1.6 4-4 4h-2c2.2 0 4 1.8 4 4s-1.8 4-4 4h-2c2 0 3.6 1.6 3.6 3.6S46 61.6 44 61.6H22c-7 0-12-5-12-12V36c0-2 .5-4 1.5-5.6z', H) + P('M40 26h16c2.2 0 4 1.8 4 4s-1.8 4-4 4H40', H));
add('👈', 'point_left', 'this there', 'Hands', G(ART['👉'] ? '' : '', ''));
add('👆', 'point_up', 'this above', 'Hands', P('M26 36V8c0-2.4 2-4.4 4.4-4.4S34.8 5.6 34.8 8v20h10c3.6 0 6.4 2.8 6.4 6.4V46c0 8-6 14-14 14h-3c-7 0-12-5-12-12V38c0-1.4 1.4-2.4 3.8-2z', H) + L('M35 36h12M35 43h12', 2, HS));
add('🫶', 'heart_hands', 'love support', 'Hands', P('M32 50C20 44 8 36 8 24c0-6 4-10 9-10 6 0 10 5 15 12 5-7 9-12 15-12 5 0 9 4 9 10 0 12-12 20-24 26z', 'none', ` stroke-width="7" stroke="${H}"`) + P('M32 50C20 44 8 36 8 24c0-6 4-10 9-10 6 0 10 5 15 12 5-7 9-12 15-12 5 0 9 4 9 10 0 12-12 20-24 26z', 'none') + P('M32 42C24 37 16 31 16 24c0-3 2-5 4.4-5 4.6 0 7.6 4 11.6 10 4-6 7-10 11.6-10 2.4 0 4.4 2 4.4 5 0 7-8 13-16 18z', 'none', ' stroke-width="2"'));
add('🤝', 'handshake', 'deal agree', 'Hands', P('M4 26l12-6 10 4 8-4 10 2 16-2 4 18-14 6-8 6c-2 1.6-5 1.4-6.6-.6L26 46c-2-2-5-3-7-5L8 36z', H) + L('M30 32l8 8M34 28l10 10M24 38l6 6', 2, HS) + P('M2 24l8-4 6 18-8 4zM62 24l-8-4-6 18 8 4z', '#4B8DF8'));
add('✍️', 'writing', 'write note', 'Hands', P('M14 54l4-12 26-26 8 8-26 26z', '#FFD94A') + P('M14 54l4-12 8 8z', '#F6D7B0') + P('M44 16l4-4c2-2 5-2 7 0l1 1c2 2 2 5 0 7l-4 4z', '#F2445A'));
// fix point_left as mirror of point_right
ART['👈'].svg = svg(G(ART['👉'].svg.replace(/^<svg[^>]*>|<\/svg>$/g, ''), 'translate(64 0) scale(-1 1)'));

// people-ish & creatures
add('💀', 'skull', 'dead lol', 'Faces', P('M32 6C18 6 9 16 9 28c0 7 3 12 8 15v8c0 3 2 5 5 5h20c3 0 5-2 5-5v-8c5-3 8-8 8-15C55 16 46 6 32 6z', '#F2EEF6') + E(23, 30, 6, 6.6, INK, false) + E(41, 30, 6, 6.6, INK, false) + P('M32 37l-3 6h6z', INK) + L('M26 50v6M32 50v6M38 50v6', 2.2) + HL(22, 14, 6, 3));
add('👻', 'ghost', 'boo spooky halloween', 'Faces', P('M32 5c-12 0-21 9-21 21v31l7-5 7 5 7-5 7 5 7-5 7 5V26C53 14 44 5 32 5z', '#F6F4FB') + E(25, 25, 3.4, 4.6, INK, false) + E(39, 25, 3.4, 4.6, INK, false) + E(32, 37, 4, 5, INK, false) + E(19, 32, 3.4, 2, PINK, false, ' opacity=".6"') + HL(22, 13, 5.4, 3));
add('👽', 'alien', 'ufo space', 'Faces', P('M32 4C18 4 9 14 9 27c0 14 12 31 23 31s23-17 23-31C55 14 46 4 32 4z', '#9EE37D') + P('M14 29c0-5 6-6 12-2 2 2 2 7 0 9-3 2-12 0-12-7zM50 29c0-5-6-6-12-2-2 2-2 7 0 9 3 2 12 0 12-7z', INK) + L('M28 47q4 2 8 0', 2.4) + HL(22, 13, 6, 3.2));
add('🤖', 'robot', 'bot machine', 'Faces', L('M32 4v8', 2.6) + C(32, 4, 3, '#F2445A') + P('M12 14h40c3 0 5 2 5 5v28c0 3-2 5-5 5H12c-3 0-5-2-5-5V19c0-3 2-5 5-5z', '#B9C6D6') + P('M14 22h36v14H14z', '#2E3A4D') + C(24, 29, 4, '#5CF0FF', false) + C(40, 29, 4, '#5CF0FF', false) + P('M22 42h20v5H22z', '#F6F8FA') + L('M27 42v5M32 42v5M37 42v5', 1.6) + P('M2 26h5v14H2zM57 26h5v14h-5z', '#8EA0B6'));
add('💩', 'poop', 'lol', 'Faces', P('M10 52c-4-2-5-7-2-10-3-3-2-8 3-10 0-6 6-8 10-6 0-6 6-10 11-8-1 4 2 6 6 6 5 0 7 4 6 8 5 0 8 4 7 8 5 2 5 8 1 11-1 2-3 3-5 3H14c-1.6 0-3-.6-4-2z', '#A0623B') + E(25, 40, 3.4, 4, '#fff') + E(39, 40, 3.4, 4, '#fff') + C(25.6, 41, 1.8, INK, false) + C(39.6, 41, 1.8, INK, false) + L('M26 49q6 4 12 0', 2.4) + HL(30, 22, 4, 2));
add('🤡', 'clown', 'silly joke', 'Faces', base('#FFF5F0', '#F1D9D3') + P('M3 26c-2-8 2-14 8-14 2 4 0 9-4 12zM61 26c2-8-2-14-8-14-2 4 0 9 4 12z', '#FF5C9E') + EYE.dot(23) + EYE.dot(41) + L('M19 22l8 2M45 22l-8 2', 2) + C(32, 37, 5, '#F2445A') + L('M19 44q13 12 26 0', 3, '#E8304E'));
add('🎃', 'jack_o_lantern', 'halloween pumpkin', 'Faces', P('M32 13c-14 0-25 10-25 23s11 22 25 22 25-9 25-22-11-23-25-23z', '#FF8A1F') + L('M22 15c-4 6-6 13-6 21s2 15 6 21M42 15c4 6 6 13 6 21s-2 15-6 21', 2, '#D8661A') + P('M30 13c0-4 1-7 4-9l3 2c-2 1.4-3 4-3 7z', '#6B8E3A') + P('M19 30l6-6 6 6zM33 30l6-6 6 6z', '#3A1F0F') + P('M17 40c5 6 25 6 30 0l-4 8-4-3-4 4-3-4-4 4-3-4-4 3z', '#3A1F0F'));

// animals — round heads, same ink line
const animalHead = (col, ears, face) => ears + C(32, 35, 22, col) + face;
add('🐱', 'cat', 'kitty meow', 'Animals', animalHead('#FFB648', P('M12 30L9 8l17 10zM52 30l3-22-17 10z', '#FFB648') + F('M14 24l-1.6-11 8 5zM50 24l1.6-11-8 5z', '#FF8FB0'), EYE.dot(24) + EYE.dot(40) + P('M30 40h4l-2 2.4z', '#FF6B81') + L('M32 42.5q-3 4-6 2M32 42.5q3 4 6 2', 2.2) + L('M10 38l9 1M10 44l9-2M54 38l-9 1M54 44l-9-2', 1.6) + HL(24, 20, 6, 3)));
add('🐶', 'dog', 'puppy woof', 'Animals', animalHead('#E9C08F', P('M14 16c-6 2-8 12-6 22l8-4 4-14zM50 16c6 2 8 12 6 22l-8-4-4-14z', '#9A6438'), EYE.dot(24) + EYE.dot(40) + E(32, 42, 7.6, 6, '#F6E3C9', false) + E(32, 39.4, 4, 3, INK, false) + L('M32 42v3q-3 3-6 1M32 45q3 3 6 1', 2.2) + HL(24, 20, 6, 3)));
add('🦊', 'fox', 'sly', 'Animals', animalHead('#FF8A3D', P('M13 30L10 7l18 12zM51 30l3-23-18 12z', '#FF8A3D') + F('M15 23l-1.4-10 7 6zM49 23l1.4-10-7 6z', '#3A1F0F'), P('M12 40c6 10 14 15 20 15s14-5 20-15c-6 2-13 0-20-6-7 6-14 8-20 6z', '#FFF4E6') + EYE.dot(23) + EYE.dot(41) + E(32, 44, 3.4, 2.6, INK, false) + HL(24, 20, 6, 3)));
add('🐸', 'frog', 'ribbit', 'Animals', C(19, 18, 9, '#6CCB5F') + C(45, 18, 9, '#6CCB5F') + E(32, 38, 26, 19, '#6CCB5F') + C(19, 18, 4.6, W, false) + C(45, 18, 4.6, W, false) + C(20, 19, 2.6, INK, false) + C(46, 19, 2.6, INK, false) + L('M16 40q16 12 32 0', 3) + E(13, 36, 3.4, 2, PINK, false, ' opacity=".6"') + E(51, 36, 3.4, 2, PINK, false, ' opacity=".6"'));
add('🐰', 'rabbit', 'bunny', 'Animals', P('M21 26c-4-8-5-20-1-22 4-2 8 8 8 20zM43 26c4-8 5-20 1-22-4-2-8 8-8 20z', '#F6F1F7') + F('M22 22c-2-5-2-12 0-13 2-1 4 5 4 12zM42 22c2-5 2-12 0-13-2-1-4 5-4 12z', '#FFB3CC') + C(32, 39, 20, '#F6F1F7') + EYE.dot(25) + EYE.dot(39) + P('M30 43h4l-2 2.4z', '#FF6B81') + L('M32 45.5q-2.6 3-5 1.4M32 45.5q2.6 3 5 1.4', 2) + E(20, 46, 3.4, 2, PINK, false, ' opacity=".6"') + E(44, 46, 3.4, 2, PINK, false, ' opacity=".6"'));
add('🐻', 'bear', 'teddy', 'Animals', C(14, 16, 7.4, '#A86A3D') + C(50, 16, 7.4, '#A86A3D') + C(14, 16, 3.4, '#E2A87A', false) + C(50, 16, 3.4, '#E2A87A', false) + C(32, 35, 23, '#A86A3D') + EYE.dot(23) + EYE.dot(41) + E(32, 43, 9, 7, '#E2C29B', false) + E(32, 40, 4, 3, INK, false) + L('M32 43v2.4q-3 3-5.6 1M32 45.4q3 3 5.6 1', 2) + HL(24, 20, 6, 3));
add('🐼', 'panda', 'cute', 'Animals', C(14, 16, 7.4, INK) + C(50, 16, 7.4, INK) + C(32, 35, 23, '#FAFAFC') + G(E(23, 32, 5.6, 7.6, INK, false), 'rotate(30 23 32)') + G(E(41, 32, 5.6, 7.6, INK, false), 'rotate(-30 41 32)') + C(24, 32, 2, W, false) + C(40, 32, 2, W, false) + E(32, 42, 4, 3, INK, false) + L('M32 45v1.4q-3 3-5.6 1M32 46.4q3 3 5.6 1', 2));
add('🦉', 'owl', 'wise night', 'Animals', P('M10 14l8 6c4-2 9-3 14-3s10 1 14 3l8-6v24c0 12-10 22-22 22S10 50 10 38z', '#8C6A4F') + C(23, 30, 9, '#FFF4DE') + C(41, 30, 9, '#FFF4DE') + C(23, 30, 4.4, INK, false) + C(41, 30, 4.4, INK, false) + C(24.4, 28.6, 1.4, W, false) + C(42.4, 28.6, 1.4, W, false) + P('M29 38h6l-3 5z', '#FFB13D') + L('M22 48l3 2M30 50l2 1.6M40 48l-3 2', 1.8, '#5D4330'));
add('🦆', 'duck', 'quack', 'Animals', P('M8 40c0-6 6-10 12-8 8 2 14 3 22 0 6-2 12 0 14 6 4 10-6 20-24 20S8 50 8 40z', '#FFD23F') + C(26, 22, 12, '#FFD23F') + P('M36 24c6-2 12-1 14 2-2 3-8 4-14 2z', '#FF8A1F') + EYE.dot(28) + HL(20, 14, 4, 2.4) + L('M18 44q10 6 22 0', 2, '#E8B51E'));
add('🐥', 'chick', 'baby bird', 'Animals', C(32, 38, 20, '#FFE066') + EYE.dot(25) + EYE.dot(39) + P('M28 39h8l-4 5z', '#FF8A1F') + L('M28 14q4-6 6 0q2-5 5-1', 2.2) + E(19, 45, 3.4, 2, PINK, false, ' opacity=".6"') + E(45, 45, 3.4, 2, PINK, false, ' opacity=".6"') + HL(24, 25, 5, 3));
add('🦄', 'unicorn', 'magic rainbow', 'Animals', P('M36 10L42 -2l-1 14z', '#FFD94A') + P('M14 54c-2-14 0-28 10-36 6-5 18-6 26 0 6 5 8 12 6 18-1 4-5 6-9 5l-6-2c-4 6-4 12-2 15z', '#F8F4FF') + P('M24 18c-6 2-10 8-12 14 4-4 8-5 12-4-3 4-4 8-4 12 3-4 6-6 9-6', '#FF7DB8') + P('M28 16c-2 6-1 12 2 16', '#8FD3FF') + EYE.dot(40) + C(52, 34, 1.4, INK, false));
add('🐉', 'dragon', 'fantasy fire', 'Animals', P('M10 50c0-14 8-26 20-30l4-12 6 10c8 2 14 8 16 16 2 6-2 10-8 9l-8-1c-2 6-6 10-12 12-6 2-12 0-18-4z', '#4FC27E') + P('M30 20l-6-8 10 2M40 18l2-10 4 10', '#3A9A5E') + EYE.glare(42) + L('M38 25l8 2', 2.4) + C(51, 36, 1.4, INK, false) + P('M56 38c4 0 6 3 6 6-2-1-4-1-6 0z', '#FF8A1F'));
add('🦇', 'bat', 'night halloween', 'Animals', P('M32 22c-3 0-5 2-6 5-6-8-14-12-22-8 4 3 5 8 4 12 4-2 8-1 10 3 2-3 6-4 9-2l5 8 5-8c3-2 7-1 9 2 2-4 6-5 10-3-1-4 0-9 4-12-8-4-16 0-22 8-1-3-3-5-6-5z', '#5B4A7A') + P('M26 19l2-6 3 6M38 19l-2-6-3 6', '#5B4A7A') + C(28.6, 27, 1.6, '#FFD94A', false) + C(35.4, 27, 1.6, '#FFD94A', false));
add('🐙', 'octopus', 'sea tentacle', 'Animals', P('M32 6c-12 0-20 9-20 20 0 6 2 10 5 13l-7 8c-1 2 0 4 2 4 3 0 6-4 9-6l-2 10c0 2 2 3 4 2 2-2 3-6 5-9l2 10c.4 2 3 2 3.6 0l1.4-10 2 10c.4 2 3 2 3.6 0l2-10c2 3 3 7 5 9 2 1 4 0 4-2l-2-10c3 2 6 6 9 6 2 0 3-2 2-4l-7-8c3-3 5-7 5-13 0-11-8-20-20-20z', '#FF7DA8') + EYE.dot(25) + EYE.dot(39) + L('M28 33q4 3 8 0', 2.2) + HL(24, 14, 5, 3));
add('🐢', 'turtle', 'slow', 'Animals', P('M8 40c0-12 10-20 22-20s22 8 22 20z', '#6CCB5F') + L('M18 26l6 14M30 20v20M42 26l-6 14M11 33h38', 1.8, '#3E8E3A') + C(54, 36, 7, '#9FE08A') + C(56, 34, 1.4, INK, false) + P('M12 40h36l-2 6H14zM14 46l-2 6h6l2-6M40 46l2 6h6l-2-6', '#9FE08A'));
add('🐝', 'bee', 'buzz honey', 'Animals', E(22, 20, 9, 7, '#DFF3FF', true, ' opacity=".9"') + E(40, 20, 9, 7, '#DFF3FF', true, ' opacity=".9"') + E(32, 38, 20, 15, '#FFD23F') + F('M24 24.5c3-.6 5-.6 6-.5v28c-2 0-4-.2-6-.6zM36 24c1 0 3 0 6 .5v27c-2 .4-4 .6-6 .6z', INK) + L('M52 38h7', 2.6) + C(18, 35, 1.8, INK, false));
add('🦋', 'butterfly', 'pretty spring', 'Animals', P('M31 30C27 14 14 6 8 10s0 20 10 22c-8 2-12 10-8 14s14 0 21-12z', '#8F7BFF') + P('M33 30C37 14 50 6 56 10s0 20-10 22c8 2 12 10 8 14s-14 0-21-12z', '#8F7BFF') + C(16, 18, 3.4, '#FFD94A', false) + C(48, 18, 3.4, '#FFD94A', false) + E(32, 34, 2.8, 14, INK, false) + L('M30 20q-3-8-7-10M34 20q3-8 7-10', 1.8));

// food
add('🍕', 'pizza', 'slice food', 'Food', P('M8 14c16-8 32-8 48 0L32 60z', '#FFD36B') + P('M8 14c16-8 32-8 48 0l-3.6 6.6C38 14 26 14 11.6 20.6z', '#D9893A') + C(26, 26, 4, '#E8304E') + C(38, 30, 4, '#E8304E') + C(31, 40, 3.6, '#E8304E') + C(40, 22, 1.6, '#3E8E3A', false) + C(24, 34, 1.6, '#3E8E3A', false));
add('🍔', 'burger', 'hamburger food', 'Food', P('M8 28c0-12 10-20 24-20s24 8 24 20z', '#F2A33B') + C(22, 18, 1, '#FFF4DE', false) + C(32, 14, 1, '#FFF4DE', false) + C(42, 18, 1, '#FFF4DE', false) + P('M6 32c6 3 12-3 18 0s12-3 18 0 12-3 16 0', '#6CCB5F') + P('M8 36h48v6H8z', '#7A4421') + P('M6 46h52l-6 4H12z', '#FFD23F') + P('M8 50h48c0 4-3 7-7 7H15c-4 0-7-3-7-7z', '#F2A33B'));
add('🌮', 'taco', 'mexican food', 'Food', P('M6 46c0-16 12-30 26-30s26 14 26 30z', '#FFD36B') + P('M12 40c4-8 10-14 20-14s16 6 20 14', '#6CCB5F', ' stroke-dasharray="4 3"') + C(22, 36, 3, '#E8304E') + C(34, 32, 3, '#E8304E') + C(43, 38, 2.6, '#E8304E'));
add('🍩', 'donut', 'doughnut sweet', 'Food', P('M8 34a24 24 0 1 0 48 0a24 24 0 1 0-48 0zM25 34a7 7 0 1 1 14 0a7 7 0 1 1-14 0z', '#E8A35C', ' fill-rule="evenodd"') + P('M10 30c2-12 12-20 22-20s20 8 22 20c-2 2-4 0-6 2s-2 6-6 6c-1.4 0-2.4-.6-3.4-1.4a7 7 0 0 0-13.2 0c-1 .8-2 1.4-3.4 1.4-3 0-5-3-7-5-2-1-1-2-3-3z', '#FF8FC0') + L('M20 20l3 1M42 18l2 2M30 16l-1 2M24 30l2-1M44 28l-2 2', 2, '#FFF4A3'));
add('🍰', 'cake', 'dessert birthday', 'Food', P('M6 46L34 22l24 10v18L30 58 6 54z', '#FFF0E4') + P('M6 46L34 22l24 10L30 40z', '#FFB3CC') + P('M30 40l28-8v18L30 58z', '#F8DCCB') + C(44, 18, 5, '#E8304E') + L('M44 13q2-4 5-4', 2, '#3E8E3A'));
add('🧁', 'cupcake', 'sweet', 'Food', P('M14 36h36l-5 22H19z', '#7FC8F8') + L('M24 36l2 22M32 36v22M40 36l-2 22', 1.8, '#4C9EE0') + P('M12 36c-3-6 2-12 8-10 0-8 8-12 14-8 4-4 12-2 12 6 6 0 8 8 4 12z', '#FFB3CC') + C(32, 12, 4, '#E8304E'));
add('🍪', 'cookie', 'snack', 'Food', C(32, 32, 24, '#D9973D') + C(22, 22, 3.2, '#5A3218', false) + C(38, 18, 2.6, '#5A3218', false) + C(42, 34, 3.4, '#5A3218', false) + C(26, 40, 3, '#5A3218', false) + C(34, 46, 2.4, '#5A3218', false) + HL(22, 14, 6, 2.6));
add('🍎', 'apple', 'fruit red', 'Food', P('M32 18c-6-4-18-3-22 8-4 12 4 30 14 30 4 0 5-2 8-2s4 2 8 2c10 0 18-18 14-30-4-11-16-12-22-8z', '#F2445A') + L('M32 18c0-5 1-9 4-12', 2.8, '#6B4423') + P('M36 12c4-6 11-6 14-3-4 5-10 6-14 3z', '#6CCB5F') + HL(20, 26, 4, 7, 20));
add('🍓', 'strawberry', 'fruit', 'Food', P('M32 60C16 50 8 38 10 26c1-6 6-9 12-8 4 1 7 3 10 3s6-2 10-3c6-1 11 2 12 8 2 12-6 24-22 34z', '#F2445A') + P('M18 18l6 4 2-8 6 6 6-6 2 8 6-4-4 8H22z', '#4FC27E') + C(22, 32, 1.2, '#FFE38A', false) + C(32, 30, 1.2, '#FFE38A', false) + C(42, 32, 1.2, '#FFE38A', false) + C(26, 42, 1.2, '#FFE38A', false) + C(38, 42, 1.2, '#FFE38A', false) + C(32, 50, 1.2, '#FFE38A', false));
add('🍌', 'banana', 'fruit', 'Food', P('M10 18c2 22 18 36 42 34 4 0 5-4 1-5-18-1-30-12-34-30-1-3-4-4-6-3z', '#FFD94A') + P('M12 14l2 6 4-2-2-6z', '#7A5B2E'));
add('🍉', 'watermelon', 'fruit summer', 'Food', P('M4 24h56c0 16-12 28-28 28S4 40 4 24z', '#4FC27E') + P('M8 24h48c0 13-10 23-24 23S8 37 8 24z', '#FF5C6E') + E(22, 32, 1.4, 2.4, INK, false) + E(32, 36, 1.4, 2.4, INK, false) + E(42, 32, 1.4, 2.4, INK, false) + E(27, 41, 1.4, 2.4, INK, false) + E(37, 41, 1.4, 2.4, INK, false));
add('🥑', 'avocado', 'guac', 'Food', P('M32 4c-8 0-12 8-14 16-6 6-10 14-8 22 2 10 12 18 22 18s20-8 22-18c2-8-2-16-8-22C44 12 40 4 32 4z', '#4E8A2E') + P('M32 10c-6 0-9 7-11 13-5 5-8 11-6 18 2 8 9 13 17 13s15-5 17-13c2-7-1-13-6-18-2-6-5-13-11-13z', '#D6EE8A', ` stroke="none"`) + C(32, 40, 9, '#9A5B34'));
add('🌶️', 'hot_pepper', 'spicy chili', 'Food', P('M44 14c-6 2-10 8-12 16-4 14-12 22-24 26 18 2 34-8 38-26 1-6 0-12-2-16z', '#E8304E') + P('M44 14c2-4 6-6 10-6-2 2-3 4-3 8', '#4FC27E') + HL(40, 26, 2, 6, 20));
add('🍆', 'eggplant', 'aubergine vegetable', 'Food', P('M44 16c-10-2-20 4-26 14-8 12-8 24 0 28 8 4 18-2 26-14 6-10 8-22 0-28z', '#7A3BD4') + P('M42 12l4-6 6 4-2 4c2 2 2 5 0 7-3-1-6-2-8-4-2 0-3-3 0-5z', '#4FC27E') + HL(26, 36, 3, 9, 30));
add('🍅', 'tomato', 'vegetable', 'Food', C(32, 36, 22, '#F2445A') + P('M32 14l-4-6-4 8-8-2 6 7 10 1 10-1 6-7-8 2-4-8z', '#4FC27E') + HL(22, 28, 4, 7, 20));
add('🥔', 'potato', 'spud', 'Food', P('M12 30c2-12 14-20 28-18s16 14 14 26-14 18-26 16S10 42 12 30z', '#D6A464') + C(24, 28, 1.6, '#9A6E3A', false) + C(38, 22, 1.4, '#9A6E3A', false) + C(42, 40, 1.6, '#9A6E3A', false) + C(28, 44, 1.4, '#9A6E3A', false));
add('🍿', 'popcorn', 'movie snack', 'Food', C(20, 18, 7, '#FFF7DA') + C(32, 13, 8, '#FFF7DA') + C(44, 18, 7, '#FFF7DA') + C(26, 22, 6, '#FFEFB0') + C(38, 22, 6, '#FFEFB0') + P('M12 24h40l-5 34H17z', '#F6F4F8') + F('M18 24h6l2 34h-6zM30 24h6l-.5 34h-5zM42 24h6l-4 34h-4z', '#F2445A'));
add('🍦', 'ice_cream', 'dessert cone', 'Food', P('M20 32l12 28 12-28z', '#E8A35C') + L('M24 36l14 12M28 46l10-10M22 40l6 6', 1.6, '#B87A3A') + C(32, 22, 13, '#FFB3CC') + C(26, 30, 6, '#FFB3CC') + C(38, 30, 6, '#FFB3CC') + C(32, 9, 3, '#E8304E') + HL(26, 16, 4, 2.4));
add('☕', 'coffee', 'drink morning', 'Food', P('M10 26h36v18c0 8-6 14-14 14h-8c-8 0-14-6-14-14z', '#F6F4F8') + P('M46 30c6 0 9 3 9 7s-3 7-9 7', 'none', ' stroke-width="4"') + E(28, 26, 18, 3.4, '#7A4421', false) + L('M20 8q4 4 0 8q-4 4 0 8M30 6q4 4 0 8q-4 4 0 8M40 8q4 4 0 8q-4 4 0 8', 2.2, '#B9C6D6'));
add('🧋', 'boba', 'bubble tea drink', 'Food', L('M38 2l-6 18', 3.4, '#FF7DB8') + P('M14 18h36l-4 40H18z', '#F2D7B6') + P('M13 18h38v6H13z', '#E5D9F5') + C(24, 48, 2.6, '#3A1F0F', false) + C(32, 50, 2.6, '#3A1F0F', false) + C(40, 47, 2.6, '#3A1F0F', false) + C(28, 54, 2.6, '#3A1F0F', false) + C(36, 54, 2.6, '#3A1F0F', false));
add('🍺', 'beer', 'drink cheers', 'Food', P('M12 18h30v38H12z', '#FFC233') + P('M42 24h6c3 0 5 2 5 5v12c0 3-2 5-5 5h-6', 'none', ' stroke-width="3.4"') + P('M10 18c0-6 4-10 9-8 2-4 8-4 10 0 4-2 10 0 10 5 3 0 5 2 5 4z', '#FFFDF6') + L('M20 26v24M28 26v24M36 26v24', 1.6, '#E89B10'));
add('🎂', 'birthday', 'cake party', 'Food', P('M8 34h48v22H8z', '#FFB3CC') + P('M8 34c4 6 8 6 12 0 4 6 8 6 12 0 4 6 8 6 12 0 4 6 8 6 12 0', '#FFF4DE') + P('M14 46h36', 'none', ' stroke="#FF7DA8" stroke-width="2.4"') + P('M20 22h4v12h-4zM30 22h4v12h-4zM40 22h4v12h-4z', '#8FD3FF') + P(dropD(22, 12, .45), '#FFB13D') + P(dropD(32, 12, .45), '#FFB13D') + P(dropD(42, 12, .45), '#FFB13D'));

// nature & weather
add('🔥', 'fire', 'lit hot flame', 'Nature', P('M32 4c2 10 12 14 16 24 5 12-2 30-16 30S11 46 14 34c2-8 7-10 7-16 4 4 5 8 5 12 3-4 4-8 4-12 0-6 2-10 2-14z', '#FF7A1F') + P('M32 30c1 6 8 8 8 16 0 6-4 10-8 10s-8-4-8-10c0-4 2-6 4-8 1 2 2 3 2 5 2-4 2-8 2-13z', '#FFD23F', ' stroke="none"'));
add('✨', 'sparkles', 'magic shine new', 'Nature', P(starD(26, 34, 20, 5, 4, -90), '#FFD94A') + P(starD(49, 13, 10, 2.8, 4, -90), '#FFE98A') + P(starD(50, 50, 7, 2.2, 4, -90), '#FFE98A'));
add('⭐', 'star', 'favorite', 'Nature', P(starD(32, 34, 27, 12), '#FFD23F') + HL(24, 24, 5, 2.6));
add('🌟', 'glowing_star', 'shine', 'Nature', P(starD(32, 34, 27, 12), '#FFD23F') + P(starD(32, 34, 16, 7), '#FFF4A3', ' stroke="none"') + L('M4 8l5 4M60 8l-5 4M32 2v4', 2.4, '#FFB13D'));
add('⚡', 'zap', 'lightning fast power', 'Nature', P('M38 2L12 36h16l-6 26 30-36H34z', '#FFD23F'));
add('🌈', 'rainbow', 'pride colors', 'Nature', L('M6 50a26 26 0 0 1 52 0', 6, '#F2445A') + L('M12 50a20 20 0 0 1 40 0', 6, '#FFB13D') + L('M18 50a14 14 0 0 1 28 0', 6, '#4FC27E') + L('M24 50a8 8 0 0 1 16 0', 6, '#3F8CFF') + C(10, 52, 7, '#fff') + C(54, 52, 7, '#fff'));
add('☀️', 'sunny', 'sun weather', 'Nature', L('M32 2v8M32 54v8M2 32h8M54 32h8M11 11l6 6M47 47l6 6M53 11l-6 6M17 47l-6 6', 3.4, '#FFB13D') + C(32, 32, 16, '#FFD23F') + HL(26, 26, 4, 2.4));
add('🌙', 'moon', 'night sleep', 'Nature', P('M40 6C28 8 20 18 20 30s9 24 22 26c-4 3-10 4-15 4C13 60 4 48 4 33S15 6 30 5c4 0 7 0 10 1z', '#FFE38A') + C(18, 30, 2.4, '#F2C94C', false) + C(14, 44, 1.8, '#F2C94C', false));
add('☁️', 'cloud', 'weather', 'Nature', P('M16 48c-7 0-12-5-12-11s5-11 11-11c2-8 9-14 17-14 9 0 16 6 17 15 6 0 11 5 11 11s-5 10-11 10z', '#F2F6FA'));
add('🌧️', 'rain', 'weather wet', 'Nature', P('M16 36c-7 0-12-5-12-11s5-11 11-11c2-8 9-12 17-12 9 0 16 5 17 13 6 0 11 5 11 11s-5 10-11 10z', '#C9D6E3') + P(dropD(20, 42, .5), TEAR) + P(dropD(34, 44, .5), TEAR) + P(dropD(48, 42, .5), TEAR));
add('❄️', 'snowflake', 'cold winter', 'Nature', L('M32 4v56M8 18l48 28M8 46l48-28', 3.4, '#8FD3FF') + L('M26 8l6 6 6-6M26 56l6-6 6 6M8 26l8-2-2-8M56 38l-8 2 2 8M8 38l8 2-2 8M56 26l-8-2 2-8', 2.6, '#8FD3FF'));
add('💧', 'droplet', 'water', 'Nature', P(dropD(32, 4, 2.2), TEAR) + HL(24, 40, 3, 6, 20));
add('🌊', 'ocean_wave', 'sea surf', 'Nature', P('M4 50c6-22 26-36 42-28 8 4 12 12 10 18-6-6-14-4-16 2 6-2 12 2 12 8H4z', '#3F8CFF') + P('M40 40c4-6 12-6 16 0', 'none', ' stroke="#fff" stroke-width="3"'));
add('🌸', 'blossom', 'flower spring sakura', 'Nature', [0, 72, 144, 216, 288].map(a => G(P('M32 31c-7-4-10-12-6-17 1.6-2 4-1.6 4.6.6 1-2.6 4.2-3 5.4-.4 2.4 5.6-.2 12.6-4 16.8z', '#FFB3CC'), `rotate(${a} 32 33)`)).join('') + C(32, 33, 5, '#FFD94A') + L('M30 30l-1-3M34 30l1-3M32 29v-3', 1.4, '#E8A51E'));
add('🌹', 'rose', 'flower love', 'Nature', L('M32 30v30', 3, '#3E8E3A') + P('M32 46c-8-6-14-2-14 2 6 2 10 0 14-2z', '#4FC27E') + P('M32 30c-10 0-14-8-12-16 3 4 6 4 8 2-2-4 0-8 4-10 4 2 6 6 4 10 2 2 5 2 8-2 2 8-2 16-12 16z', '#E8304E') + L('M28 16q4 4 8 0', 2));
add('🌻', 'sunflower', 'flower summer', 'Nature', L('M32 40v22', 3, '#3E8E3A') + [...Array(12)].map((_, i) => G(P('M32 3c4.4 4.6 4.4 10.6 0 14.6-4.4-4-4.4-10 0-14.6z', '#FFD23F'), `rotate(${i * 30} 32 26)`)).join('') + C(32, 26, 10, '#7A4421') + C(29, 23, 1.2, '#A0623B', false) + C(35, 27, 1.2, '#A0623B', false));
add('🍀', 'clover', 'luck irish', 'Nature', L('M32 32q4 16 14 26', 3, '#3E8E3A') + [0, 90, 180, 270].map(a => G(P(heartD(32, 18, .85), '#4FC27E'), `rotate(${a} 32 32)`)).join(''));
add('🍄', 'mushroom', 'forest', 'Nature', P('M24 36h16l2 20H22z', '#FFF4E6') + P('M6 36C6 20 18 8 32 8s26 12 26 28z', '#E8304E') + C(20, 22, 4, '#fff', false) + C(36, 16, 3.4, '#fff', false) + C(46, 28, 3, '#fff', false) + C(30, 30, 2.4, '#fff', false));
add('🌳', 'tree', 'nature forest', 'Nature', P('M28 40h8v20h-8z', '#8C5A33') + C(32, 26, 20, '#4FC27E') + C(20, 32, 10, '#4FC27E', false) + C(44, 32, 10, '#4FC27E', false) + HL(24, 16, 5, 3));
add('🌵', 'cactus', 'desert', 'Nature', P('M26 60V14c0-4 3-7 6-7s6 3 6 7v46z', '#4FC27E') + P('M26 36h-8c-4 0-6-3-6-6v-8c0-2 1.4-3.4 3.4-3.4S19 20 19 22v6h7M38 30h8v-8c0-2 1.4-3.4 3.4-3.4S53 20 53 22v10c0 3-2 6-6 6h-9', '#4FC27E') + L('M30 18l-2-1M34 26l2-1M30 40l-2-1M34 48l2-1', 1.6, '#2E7A3E'));

// things
add('🎉', 'tada', 'party celebrate congrats', 'Things', P('M6 58l12-36 26 26z', '#FFD23F') + L('M14 34l14 14M10 46l8 8', 2.4, '#FF7DA8') + L('M30 18q2-8 10-8M44 22q8-4 12 2M38 6l2 6M50 12l-4 4', 2.6, '#3F8CFF') + C(54, 30, 2.6, '#F2445A', false) + C(26, 8, 2.4, '#4FC27E', false) + C(48, 40, 2, '#9B5CF0', false));
add('🎁', 'gift', 'present birthday', 'Things', P('M8 26h48v32H8z', '#F2445A') + P('M6 18h52v10H6z', '#FF5C6E') + P('M28 18h8v40h-8z', '#FFD23F') + P('M32 18c-4-8-14-12-16-6-1 4 6 6 16 6zM32 18c4-8 14-12 16-6 1 4-6 6-16 6z', '#FFD23F'));
add('🎈', 'balloon', 'party', 'Things', P('M32 4c-11 0-18 9-18 19s9 21 18 23c9-2 18-13 18-23S43 4 32 4z', '#F2445A') + P('M29 46h6l-3 4z', '#F2445A') + L('M32 50q-4 6 0 10', 2) + HL(24, 16, 4, 6, 20));
add('🎊', 'confetti', 'party', 'Things', C(32, 22, 16, '#FFD23F') + L('M32 38v20', 2.4) + P('M8 50l4-2 1 4zM54 50l-4-2-1 4zM14 10l2 4-4 1zM50 8l-2 4 4 1z', '#FF7DA8') + C(22, 18, 2, '#F2445A', false) + C(38, 26, 2, '#3F8CFF', false) + C(36, 14, 2, '#4FC27E', false));
add('🏆', 'trophy', 'win champion', 'Things', P('M18 6h28v16c0 8-6 14-14 14s-14-6-14-14z', '#FFC233') + P('M18 12H8c0 8 4 12 10 12M46 12h10c0 8-4 12-10 12', 'none') + P('M28 36h8v10h-8z', '#E89B10') + P('M18 46h28v10H18z', '#8C5A33') + HL(25, 14, 3, 5, 10));
add('🥇', 'gold_medal', 'first winner', 'Things', P('M20 4h10l4 22H24zM34 4h10l-4 22h-6z', '#3F8CFF') + C(32, 42, 16, '#FFC233') + C(32, 42, 10, '#FFD94A') + `<text x="32" y="48" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="16" text-anchor="middle" fill="#B87A10">1</text>`);
add('👑', 'crown', 'king queen royal', 'Things', P('M6 22l12 12 14-22 14 22 12-12-6 32H12z', '#FFC233') + C(6, 20, 3.4, '#FFD94A') + C(32, 10, 3.4, '#FFD94A') + C(58, 20, 3.4, '#FFD94A') + C(22, 44, 3, '#F2445A', false) + C(32, 44, 3, '#3F8CFF', false) + C(42, 44, 3, '#4FC27E', false));
add('💎', 'gem', 'diamond jewel', 'Things', P('M14 8h36l10 14-28 36L4 22z', '#7FD4FF') + L('M4 22h56M24 8l-4 14 12 36 12-36-4-14M20 22L32 8l12 14', 1.8) + HL(22, 15, 4, 2));
add('💰', 'moneybag', 'rich cash', 'Things', P('M24 14c-12 8-18 20-16 32 2 10 12 14 24 14s22-4 24-14c2-12-4-24-16-32z', '#D9B064') + P('M24 14l-4-8c4-2 8 0 12 0s8-2 12 0l-4 8z', '#C49A4A') + L('M22 14h20', 3, '#8C5A33') + `<text x="32" y="48" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="22" text-anchor="middle" fill="#2E7A3E">$</text>`);
add('💵', 'dollar', 'money cash bill', 'Things', P('M4 16h56v32H4z', '#9FE08A') + P('M10 22h44v20H10z', 'none', ' stroke-width="1.6"') + C(32, 32, 8, '#6CCB5F') + `<text x="32" y="38" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="14" text-anchor="middle" fill="#2E7A3E">$</text>`);
add('🪙', 'coin', 'money gold', 'Things', E(32, 34, 22, 22, '#E89B10') + E(32, 32, 22, 22, '#FFC233') + C(32, 32, 14, 'none', false, ' stroke="#E89B10" stroke-width="2.4"') + `<text x="32" y="40" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="20" text-anchor="middle" fill="#B87A10">B</text>`);
add('🚀', 'rocket', 'launch space fast', 'Things', P('M44 6c8 0 14 6 14 14L38 40l-14-14z', '#F2F6FA') + P('M58 20c-2-6-8-12-14-14l4-2c6 0 12 6 12 12z', '#F2445A') + C(44, 20, 5, '#5CC3FF') + P('M24 26l-12 2-6 8 10 2M38 40l-2 12-8 6-2-10', '#F2445A') + P('M18 40c-6 2-10 8-12 18 10-2 16-6 18-12z', '#FFB13D'));
add('🎮', 'video_game', 'gaming controller', 'Things', P('M14 18h36c6 0 10 6 10 14l2 14c0 6-6 8-10 4l-8-8H20l-8 8c-4 4-10 2-10-4l2-14c0-8 4-14 10-14z', '#5B4A7A') + L('M18 30h10M23 25v10', 3, '#fff') + C(42, 28, 3, '#FFD23F', false) + C(48, 34, 3, '#4FC27E', false));
add('🎵', 'note', 'music song', 'Things', P('M24 14l24-8v34', 'none', ' stroke-width="4"') + E(18, 48, 8, 6, '#9B5CF0') + E(42, 42, 8, 6, '#9B5CF0') + L('M26 48V14', 4) + L('M50 42V6', 4));
add('🎧', 'headphones', 'music listen', 'Things', P('M8 40v-8c0-14 10-24 24-24s24 10 24 24v8', 'none', ' stroke-width="4.4"') + P('M6 36h12v20H10c-2 0-4-2-4-4zM46 36h12v16c0 2-2 4-4 4h-8z', '#F2445A'));
add('📷', 'camera', 'photo picture', 'Things', P('M6 20h12l4-6h20l4 6h12v32H6z', '#5B6B80') + C(32, 35, 11, '#2E3A4D') + C(32, 35, 6, '#7FD4FF', false) + C(50, 26, 2, '#FFD23F', false));
add('📱', 'phone', 'mobile cell', 'Things', P('M18 4h28c2 0 4 2 4 4v48c0 2-2 4-4 4H18c-2 0-4-2-4-4V8c0-2 2-4 4-4z', '#2E3A4D') + P('M18 10h28v40H18z', '#7FD4FF', ' stroke="none"') + C(32, 55, 1.8, '#B9C6D6', false));
add('💻', 'laptop', 'computer work', 'Things', P('M10 12h44v30H10z', '#2E3A4D') + P('M14 16h36v22H14z', '#7FD4FF', ' stroke="none"') + P('M2 44h60l-4 8H6z', '#B9C6D6'));
add('💡', 'bulb', 'idea light', 'Things', P('M32 4c-11 0-18 8-18 18 0 8 5 12 8 16v6h20v-6c3-4 8-8 8-16 0-10-7-18-18-18z', '#FFE066') + P('M22 44h20v6H22zM24 50h16v4c0 3-3 6-8 6s-8-3-8-6z', '#B9C6D6') + L('M27 30l5 6 5-6', 2, '#E8A51E') + HL(25, 14, 3, 5, 20));
add('🔑', 'key', 'unlock secret', 'Things', P('M7 22a13 13 0 1 0 26 0a13 13 0 1 0-26 0zM12 18a4 4 0 1 1 8 0a4 4 0 1 1-8 0z', '#FFC233', ' fill-rule="evenodd"') + P('M28 30l26 26-4 4-4-4-4 4-4-4 4-4-18-18z', '#FFC233'));
add('🔒', 'lock', 'secure private', 'Things', P('M20 28V20c0-7 5-12 12-12s12 5 12 12v8', 'none', ' stroke-width="5"') + P('M12 28h40v30H12z', '#FFC233') + C(32, 40, 4, INK, false) + P('M30 42h4l1 8h-6z', INK));
add('🔔', 'bell', 'notification alert', 'Things', P('M32 6c-10 0-16 8-16 18v12l-6 8h44l-6-8V24c0-10-6-18-16-18z', '#FFC233') + C(32, 50, 5, '#E89B10') + HL(25, 18, 3, 6, 15));
add('📚', 'books', 'study read', 'Things', P('M8 16h12v42H8z', '#3F8CFF') + P('M20 10h12v48H20z', '#F2445A') + P('M34 18l10-3 12 41-10 3z', '#4FC27E') + L('M10 24h8M22 18h8M36 26l8-2', 2, '#fff'));
add('🔮', 'crystal_ball', 'magic fortune', 'Things', C(32, 28, 22, '#B59CFF') + C(26, 22, 6, '#E5DCFF', false, ' opacity=".7"') + P(starD(38, 34, 5, 2, 4), '#fff', ' stroke="none"') + P('M14 48h36l4 10H10z', '#7A4421'));
add('🗡️', 'dagger', 'blade knife', 'Things', P('M40 6l18-2-2 18-24 24-12-12z', '#DCE6F0') + P('M18 30l16 16-4 4-16-16z', '#C9A26B') + P('M14 44l6 6-10 10-6-6z', '#7A4421'));
add('🛡️', 'shield', 'protect defense', 'Things', P('M32 4l24 8v18c0 16-10 26-24 30C18 56 8 46 8 30V12z', '#3F8CFF') + P('M32 10l18 6v14c0 12-8 20-18 24z', '#7FB6FF', ' stroke="none"') + L('M32 8v50', 2));
add('⏰', 'alarm', 'time clock wake', 'Things', C(32, 36, 22, '#F2445A') + C(32, 36, 16, '#fff') + L('M32 26v10l8 6', 3) + P('M8 16l8-8 6 6-8 8zM56 16l-8-8-6 6 8 8z', '#F2445A'));
add('⌛', 'hourglass', 'time wait', 'Things', P('M14 4h36v6H14zM14 54h36v6H14z', '#8C5A33') + P('M18 10h28c0 10-8 16-12 22 4 6 12 12 12 22H18c0-10 8-16 12-22-4-6-12-12-12-22z', '#DFF3FF') + P('M24 54c2-6 6-8 8-8s6 2 8 8z', '#FFC233', ' stroke="none"') + P('M24 16h16c-2 4-5 7-8 10-3-3-6-6-8-10z', '#FFC233', ' stroke="none"'));
add('📦', 'package', 'box delivery parcel', 'Things', P('M8 20l24-12 24 12v26L32 58 8 46z', '#D9A464') + P('M8 20l24 12 24-12M32 32v26', 'none') + P('M18 15l24 12v8l-6-3v-7L12 18z', '#F2D7A5'));
add('📞', 'telephone', 'call phone ring', 'Things', P('M8 22c0-8 10-12 24-12s24 4 24 12v4c0 2-2 3-4 3h-8c-2 0-3-1-3-3v-3c-6-2-12-2-18 0v3c0 2-1 3-3 3h-8c-2 0-4-1-4-3z', '#F2445A') + P('M18 30h28l6 22H12z', '#F2445A') + C(32, 42, 6, '#fff') + C(32, 42, 2, INK, false));
add('🎥', 'movie_camera', 'video film record', 'Things', P('M6 22h34v24H6z', '#5B6B80') + P('M40 30l16-8v24l-16-8z', '#3E4A5A') + C(14, 14, 7, '#3E4A5A') + C(30, 14, 7, '#3E4A5A') + C(14, 14, 2.4, '#B9C6D6', false) + C(30, 14, 2.4, '#B9C6D6', false) + C(14, 34, 3, '#F2445A', false));
add('📎', 'paperclip', 'attach file', 'Things', L('M40 18v24a10 10 0 0 1-20 0V16a7 7 0 0 1 14 0v24a3.6 3.6 0 0 1-7.2 0V20', 4.4, INK) + L('M40 18v24a10 10 0 0 1-20 0V16a7 7 0 0 1 14 0v24a3.6 3.6 0 0 1-7.2 0V20', 2.4, '#B9C6D6'));
add('🎤', 'microphone', 'mic voice message sing record', 'Things', P('M27 38h10l-1.6 19.5c-.3 2.6-6.5 2.6-6.8 0z', '#3B4352') + P('M22.5 32h19l-2.4 7H24.9z', '#E9B44C') + P('M20 17a12 12 0 0 1 24 0v5a12 12 0 0 1-24 0z', '#9DB0C6') + L('M23 15h18M22 20h20M23 25h18', 1.7, '#62768F') + HL(26, 12, 3.2, 2));
add('🍒', 'cherries', 'fruit cherry', 'Food', L('M22 40q4-20 22-30M42 40q-2-16 2-30', 2.6, '#4E7D3A') + P('M44 10c6-4 12-2 14 2-6 3-10 2-14-2z', '#4FC27E') + C(20, 44, 11, '#E8304E') + C(42, 44, 11, '#C81E3B') + HL(16, 39, 3, 2) + HL(38, 39, 3, 2));
add('📌', 'pin', 'location save', 'Things', P('M24 4h16l-2 18 8 10H18l8-10z', '#F2445A') + L('M32 32v28', 3));

// symbols
add('✅', 'check', 'done yes correct', 'Symbols', P('M6 6h52v52H6z', '#4FC27E', ' rx="10"') + L('M16 34l10 10 22-24', 6, '#fff'));
add('❌', 'x', 'no wrong cross', 'Symbols', L('M12 12l40 40M52 12L12 52', 14, INK) + L('M12 12l40 40M52 12L12 52', 9, '#F2445A'));
add('💯', '100', 'perfect score', 'Symbols', `<text x="32" y="40" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="26" text-anchor="middle" fill="#F2445A" stroke="${INK}" stroke-width="1.6" transform="rotate(-8 32 32)">100</text>` + L('M10 50h44M14 56h36', 3.4, '#F2445A'));
add('❓', 'question', 'what why', 'Symbols', P('M20 22c0-8 6-14 13-14s12 5 12 12c0 6-4 9-8 12-3 2-4 4-4 8h-8c0-6 2-10 6-13 3-2 6-4 6-7 0-3-2-5-5-5-4 0-5 3-5 7z', '#F2445A') + C(32, 52, 5, '#F2445A'));
add('❗', 'exclamation', 'important', 'Symbols', P('M26 6h12l-2 34h-8z', '#F2445A') + C(32, 52, 5.4, '#F2445A'));
add('⚠️', 'warning', 'caution alert', 'Symbols', P('M32 6l28 50H4z', '#FFD23F') + P('M29 22h6l-1 18h-4z', INK) + C(32, 47, 3, INK, false));
add('🚫', 'no_entry', 'forbidden stop', 'Symbols', C(32, 32, 26, '#F2445A') + C(32, 32, 18, '#fff') + L('M19 45l26-26', 8, '#F2445A'));
add('💬', 'speech', 'chat message talk', 'Symbols', P('M12 8h40c4 0 6 2 6 6v24c0 4-2 6-6 6H28L14 56V44h-2c-4 0-6-2-6-6V14c0-4 2-6 6-6z', '#F2F6FA') + C(22, 26, 3, INK, false) + C(32, 26, 3, INK, false) + C(42, 26, 3, INK, false));
add('💭', 'thought', 'thinking dream', 'Symbols', P('M18 40c-7 0-12-5-12-11s5-11 11-11c2-7 8-12 15-12 8 0 14 5 15 12 6 0 11 5 11 11s-5 11-11 11z', '#F2F6FA') + C(16, 50, 4.4, '#F2F6FA') + C(8, 58, 2.6, '#F2F6FA'));
add('💤', 'zzz', 'sleep tired', 'Symbols', `<text x="10" y="56" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="28" fill="#7FB6FF" stroke="${INK}" stroke-width="2">Z</text><text x="32" y="34" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="20" fill="#7FB6FF" stroke="${INK}" stroke-width="1.6">Z</text><text x="46" y="16" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="14" fill="#7FB6FF" stroke="${INK}" stroke-width="1.3">z</text>`);
add('💥', 'boom', 'explosion collision', 'Symbols', P(starD(32, 32, 29, 13, 9, -90), '#FF7A1F') + P(starD(32, 32, 17, 8, 9, -70), '#FFD23F', ' stroke="none"'));
add('💢', 'anger', 'mad symbol', 'Symbols', L('M24 6q2 14-16 18M40 6q-2 14 16 18M24 58q2-14-16-18M40 58q-2-14 16-18', 6, '#F2445A'));
add('💫', 'dizzy', 'star spin', 'Symbols', L('M8 40q10-24 34-18', 3.4, '#FFD23F') + P(starD(46, 22, 14, 6), '#FFD23F'));
add('👀', 'eyes', 'look watching', 'Symbols', E(20, 32, 13, 17, '#fff') + E(44, 32, 13, 17, '#fff') + C(24, 34, 6.6, INK, false) + C(48, 34, 6.6, INK, false) + C(26, 31, 2, '#fff', false) + C(50, 31, 2, '#fff', false));
add('🎯', 'dart', 'target goal bullseye', 'Symbols', C(32, 32, 26, '#fff') + C(32, 32, 19, '#F2445A') + C(32, 32, 12, '#fff') + C(32, 32, 5.4, '#F2445A') + L('M32 32l24-24', 3) + P('M50 6l8-2-2 8z', '#4FC27E'));
add('➕', 'plus', 'add', 'Symbols', L('M32 10v44M10 32h44', 12, INK) + L('M32 10v44M10 32h44', 7, '#4FC27E'));
add('🏁', 'checkered_flag', 'finish race', 'Symbols', L('M10 6v56', 3.6) + P('M10 8h44v28H10z', '#fff') + F('M10 8h11v7H10zM32 8h11v7H32zM21 15h11v7H21zM43 15h11v7H43zM10 22h11v7H10zM32 22h11v7H32zM21 29h11v7H21zM43 29h11v7H43z', INK));
add('🆗', 'ok', 'okay', 'Symbols', P('M4 12h56v40H4z', '#3F8CFF') + `<text x="32" y="42" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="22" text-anchor="middle" fill="#fff">OK</text>`);

// Bastion originals — no standard equivalent, used with :shortcodes:
const BC = 'Bastion';
add(':bastion:', 'bastion', 'crest shield crossroads logo', BC, P('M8 6h8v6h6V6h7v6h6V6h7v6h6V6h8v26c0 14-10 24-24 28C18 56 8 46 8 32z', '#E9B44C') + F('M29 14h6v42l-3 1.6-3-1.6zM12 30h40v6H12z', '#151A22') + L('M32 16v38M14 33h36', 1.2, '#E9B44C', ' stroke-dasharray="2.4 2.4"') + C(32, 33, 5.4, '#E9B44C') + C(32, 33, 2, '#151A22', false));
add(':lantern:', 'lantern', 'light glow night', BC, L('M24 8q8-6 16 0', 2.8) + P('M22 10h20l-2 6H24z', '#5B4A7A') + P('M20 16h24l-2 32H22z', '#FFD36B') + P('M26 22h12l-1 20H27z', '#FFF4A3', ' stroke="none"') + P(dropD(32, 26, .6), '#FF8A1F') + P('M20 48h24v6H20z', '#5B4A7A') + L('M12 30q-4 2 0 6M52 30q4 2 0 6', 2, '#FFD36B'));
add(':swords:', 'swords', 'crossed fight duel', BC, P('M8 6l4-2 36 36-4 4z', '#DCE6F0') + P('M56 6l-4-2-36 36 4 4z', '#DCE6F0') + P('M40 40l12 12-4 4-12-12zM24 40L12 52l4 4 12-12z', '#8C5A33') + L('M36 46l10-10M28 46L18 36', 4.4, '#E9B44C'));
add(':castle:', 'castle', 'fortress home keep', BC, P('M8 22h8v4h6v-4h8v4h4v-4h8v4h6v-4h8v36H8z', '#B9AFA0') + P('M24 58V44c0-4 4-8 8-8s8 4 8 8v14z', '#6B4423') + P('M14 32h6v6h-6zM44 32h6v6h-6z', '#3A3A4A') + P('M30 4l10 4-10 4z', '#F2445A') + L('M30 4v18', 2));
add(':signpost:', 'signpost', 'crossroads direction way', BC, L('M32 10v50', 4, '#8C5A33') + P('M14 12h30l8 6-8 6H14z', '#E9B44C') + P('M50 28H20l-8 6 8 6h30z', '#C9A26B'));
add(':scroll:', 'scroll', 'quest letter old', BC, P('M14 12h34v38c0 4-3 6-6 6H18', '#F6E3C0') + C(14, 14, 5, '#E5CB9C') + P('M18 56c-3 0-6-2-6-6s3-6 6-6h24', '#E5CB9C') + L('M22 22h20M22 30h20M22 38h14', 2, '#B08A55'));
add(':potion:', 'potion', 'magic flask brew', BC, P('M26 6h12v12c8 3 14 11 14 20 0 12-9 20-20 20s-20-8-20-20c0-9 6-17 14-20z', '#E8F4FF') + P('M14 38c6-3 12 3 18 0s12-3 18 0c0 10-8 16-18 16s-18-6-18-16z', '#9B5CF0', ' stroke="none"') + P('M24 4h16v5H24z', '#8C5A33') + C(28, 42, 2, '#E5DCFF', false) + C(36, 46, 1.4, '#E5DCFF', false));
add(':nightshade:', 'nightshade', 'berry poison plant purple', BC, L('M32 4q-4 10 0 18', 2.6, '#3E6B3A') + P('M32 10c8-6 16-4 20 2-8 2-14 2-20-2z', '#4E8A3E') + C(20, 34, 9, '#2E1F48') + C(40, 32, 10, '#3A2560') + C(30, 48, 10, '#2E1F48') + C(17, 31, 2.2, '#9B8BD6', false) + C(37, 28, 2.4, '#9B8BD6', false) + C(27, 45, 2.4, '#9B8BD6', false));
add(':belladonna:', 'belladonna', 'flower bell purple nightshade', BC, L('M32 4v16', 2.6, '#3E6B3A') + P('M32 20c-10 0-16 10-16 22 4-2 6 0 8 2 2-3 5-3 8 0 3-3 6-3 8 0 2-2 4-4 8-2 0-12-6-22-16-22z', '#7A3BD4') + P('M22 40c2-8 5-14 10-17', '#A97BF0', ' stroke="none"') + L('M28 44v8M32 44v10M36 44v8', 1.8, '#FFD94A'));
add(':mandrake:', 'mandrake', 'root scream plant', BC, P('M22 8c2 6 6 10 10 12 4-2 8-6 10-12-4 0-7 2-10 4-3-2-6-4-10-4z', '#4FC27E') + P('M32 20c-10 0-14 8-14 16 0 6 3 10 6 12l-6 10 6-2 4-6c2 1 6 1 8 0l4 6 6 2-6-10c3-2 6-6 6-12 0-8-4-16-14-16z', '#D6A87A') + C(27, 32, 2, INK, false) + C(37, 32, 2, INK, false) + E(32, 40, 3, 4, INK, false));
add(':crown_gem:', 'royal_seal', 'seal stamp official', BC, C(32, 32, 24, '#C81E3B') + C(32, 32, 16, '#E8304E', true) + P('M22 36l3-10 7 6 7-6 3 10z', '#FFD94A'));
add(':torch:', 'torch', 'fire light dungeon', BC, P('M28 30h8l-2 30h-4z', '#8C5A33') + P('M24 26h16v6H24z', '#5B6B80') + P('M32 2c2 6 8 8 8 16 0 5-4 8-8 8s-8-3-8-8c0-4 3-6 4-9 1 2 2 3 2 5 2-3 2-7 2-12z', '#FF7A1F') + P('M32 14c1 3 4 4 4 8 0 2-2 4-4 4s-4-2-4-4c0-2 1-3 2-4 1 1 1 2 1 3 1-2 1-4 1-7z', '#FFD23F', ' stroke="none"'));
add(':dragon_egg:', 'dragon_egg', 'egg fantasy hatch', BC, P('M32 4C20 4 10 22 10 38c0 12 10 22 22 22s22-10 22-22C54 22 44 4 32 4z', '#4FC27E') + F('M20 22c4 2 6 6 6 10M42 18c-2 4-2 8 0 12M16 42c6 0 10 4 12 8M48 40c-6 2-8 6-8 12', 'none', ` stroke="#2E7A3E" stroke-width="2"`) + HL(24, 16, 4, 7, 20));
add(':heart_seal:', 'love_letter', 'letter mail love', BC, P('M6 16h52v36H6z', '#F6F1F7') + L('M6 16l26 20 26-20', 2.6) + P(heartD(32, 34, .9), '#E8304E'));

/* ---------------- assemble ---------------- */
const list = [];
for (const [k, n, kw, spec] of FACES) {
  let s = face(spec);
  if (k === '😘') s = s.replace('</svg>', P(heartD(50, 44, .5), RED) + '</svg>');
  if (k === '🫠') s = svg(face({ eyes: 'dot', mouth: 'small' }).replace(/^<svg[^>]*>|<\/svg>$/g, '').replace('<circle cx="32" cy="33" r="27" fill="#FFC83D"/>', '') ) ;
  list.push({ k, n, kw, c: 'Faces', svg: s });
}
// melting face: draw properly (head sliding into a puddle)
const melt = list.find(e => e.k === '🫠');
melt.svg = svg(P('M8 34c0-15 11-27 24-27s24 12 24 27c0 6-2 10-2 13 0 3 4 4 4 7s-4 5-10 5H14c-6 0-9-2-9-5s4-4 4-7c0-3-1-7-1-13z', Y) + F('M9 44c4 6 12 10 23 10s19-4 23-10c-1 4 3 6 3 9 0 3-4 5-10 5H14c-6 0-9-2-9-5s4-5 4-9z', YS, ' opacity=".55"') + HL(21, 16, 8.5, 4.6) + EYE.dot(23) + EYE.dot(41) + L('M22 40q10 7 20 0', 3) + P(dropD(14, 50, .4), Y));
const order = ['Faces', 'Love', 'Hands', 'Animals', 'Food', 'Nature', 'Things', 'Symbols', 'Bastion'];
for (const e of Object.values(ART)) list.push(e);
list.sort((a, b) => order.indexOf(a.c) - order.indexOf(b.c));
window.BX_EMOJI = list;
window.BX_EMOJI_CATS = order;
})();
