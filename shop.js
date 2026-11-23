/* ============================================================
   BEYOND MARIANA – shop.js
   Fortnite-Style Daily Shop & Spind (Locker)
   - zweisprachig (EN/DE) nach Spielsprache
   - täglicher Shop deterministisch per UTC-Datum, 14-Tage-Sperre
   - Season-Banner nach Kalender + Live-Countdown bis 00:00 UTC
   - Kauf-Popup, Spind, Ausrüsten (U-Boot, Blasen, Kapitän, Touristen)
   - bringt sein CSS selbst mit
   ============================================================ */

import * as THREE from 'three';

const STORE_KEY = 'beyond-mariana-shop-v1';
const SAVE_KEY = 'beyond-mariana-save-v2';      // Spielstand aus script.js (Geld)
const CATS = ['sub', 'bub', 'cap', 'tou'];
const HAT_SCALE = 1;                              // Hut-Größe bei Touristen anpassen

/* ------------------------------------------------------------
   Texte
   ------------------------------------------------------------ */
const TX = {
  en: {
    shop: 'SHOP', locker: 'LOCKER', back: 'BACK',
    resets: 'Resets in',
    cats: { sub: 'Submarine Skins', bub: 'Propeller Bubbles', cap: 'Captain Skins', tou: 'Tourist Packs' },
    rar: ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'],
    owned: 'OWNED', equipped: 'EQUIPPED', equip: 'TAP TO EQUIP', def: 'DEFAULT',
    confirm: 'Confirm Skin', yes: 'YES', no: 'NO', poor: 'Not enough €',
    bought: (n) => 'You purchased ' + n + '!',
    nowEquipped: (n) => n + ' equipped!',
    lockerHint: 'Tap an item to equip it.',
    boost: 'Higher drop chance for season skins!',
    noBoost: 'Fresh items every day at 00:00 UTC.'
  },
  de: {
    shop: 'SHOP', locker: 'SPIND', back: 'ZURÜCK',
    resets: 'Neuer Shop in',
    cats: { sub: 'U-Boot-Skins', bub: 'Antriebs-Blasen', cap: 'Kapitäns-Skins', tou: 'Touristen-Packs' },
    rar: ['Gewöhnlich', 'Selten', 'Episch', 'Legendär', 'Mythisch'],
    owned: 'IM BESITZ', equipped: 'AUSGERÜSTET', equip: 'ZUM AUSRÜSTEN TIPPEN', def: 'STANDARD',
    confirm: 'Skin bestätigen', yes: 'JA', no: 'NEIN', poor: 'Nicht genug €',
    bought: (n) => 'Du hast ' + n + ' gekauft!',
    nowEquipped: (n) => n + ' ausgerüstet!',
    lockerHint: 'Tippe auf ein Item, um es auszurüsten.',
    boost: 'Erhöhte Drop-Chance für Season-Skins!',
    noBoost: 'Jeden Tag um 00:00 UTC neue Items.'
  }
};

const SEASONS = {
  halloween: { icon: '🎃', en: 'Halloween Season', de: 'Halloween-Season', g: ['#2a0d3a', '#ff7a1a'], boost: true },
  christmas: { icon: '🎄', en: 'Christmas Season', de: 'Weihnachts-Season', g: ['#0b3d2a', '#c8222f'], boost: true },
  valentine: { icon: '💘', en: 'Valentine Season', de: 'Valentins-Season', g: ['#5a0f3a', '#ff4f9a'], boost: true },
  summer:    { icon: '☀️', en: 'Summer Season', de: 'Sommer-Season', g: ['#0a6fb5', '#ffcf3a'], boost: true },
  deepsea:   { icon: '🌊', en: 'Deep Sea Season', de: 'Tiefsee-Season', g: ['#03121c', '#0a5a7a'], boost: false }
};

function currentSeason(date) {
  const md = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  if (md >= 1015 && md <= 1105) return 'halloween';
  if (md >= 1201 && md <= 1231) return 'christmas';
  if (md >= 210 && md <= 220) return 'valentine';
  if (md >= 701 && md <= 831) return 'summer';
  return 'deepsea';
}

/* ------------------------------------------------------------
   Bauplan-Tabellen
   ------------------------------------------------------------ */
const HUE = (en, de, h, s, l) => ({ en, de, h, s, l });

// 16 Basis-Farbthemen -> je Kategorie & Seltenheit 16 Items
const BASE_HUES = [
  HUE('Coral', 'Korall', 10, 1, 0), HUE('Lagoon', 'Lagunen', 185, 1, 0),
  HUE('Kelp', 'Seetang', 110, 0.8, -0.05), HUE('Abyss', 'Abgrund', 225, 0.9, -0.12),
  HUE('Pearl', 'Perlmutt', 40, 0.35, 0.12), HUE('Amber', 'Bernstein', 38, 1, 0),
  HUE('Reef', 'Riff', 160, 1, 0), HUE('Storm', 'Sturm', 215, 0.4, -0.05),
  HUE('Ember', 'Glut', 18, 1, -0.03), HUE('Mint', 'Minz', 145, 0.8, 0.06),
  HUE('Orchid', 'Orchideen', 300, 0.8, 0), HUE('Sand', 'Sand', 45, 0.4, 0.08),
  HUE('Ice', 'Eis', 195, 0.45, 0.14), HUE('Ink', 'Tinten', 255, 0.7, -0.15),
  HUE('Sunset', 'Abendrot', 25, 1, 0.02), HUE('Neon', 'Neon', 95, 1, 0)
];

// je Season 3 Sonder-Themen (nur in der jeweiligen Season im Shop)
const SEASON_HUES = {
  halloween: [HUE('Pumpkin', 'Kürbis', 28, 1, 0), HUE('Witch', 'Hexen', 280, 0.9, -0.05), HUE('Ghost', 'Geister', 200, 0.25, 0.15)],
  christmas: [HUE('Holly', 'Stechpalmen', 135, 0.9, -0.05), HUE('Frost', 'Frost', 200, 0.5, 0.1), HUE('Candy', 'Zuckerstangen', 354, 1, 0)],
  valentine: [HUE('Rose', 'Rosen', 345, 0.9, 0), HUE('Cupid', 'Amor', 320, 0.8, 0.05), HUE('Velvet', 'Samt', 350, 0.8, -0.1)],
  summer:    [HUE('Sunny', 'Sonnen', 48, 1, 0), HUE('Palm', 'Palmen', 140, 0.8, 0), HUE('Tropic', 'Tropen', 175, 1, 0)]
};

// Namens-Endungen je Kategorie und Seltenheit [EN, DE]
const NOUN = {
  sub: [['Skiff', 'Boot'], ['Cruiser', 'Kreuzer'], ['Phantom', 'Phantom'], ['Leviathan', 'Leviathan'], ['Kraken', 'Kraken']],
  bub: [['Fizz', 'Sprudel'], ['Stream', 'Strom'], ['Spark', 'Funke'], ['Comet', 'Komet'], ['Nova', 'Nova']],
  cap: [['Uniform', 'Uniform'], ['Coat', 'Mantel'], ['Admiral', 'Admiral'], ['Commodore', 'Kommodore'], ['Legend', 'Legende']],
  tou: [['Crew', 'Truppe'], ['Squad', 'Gruppe'], ['Party', 'Party'], ['Gala', 'Gala'], ['Royals', 'Royals']]
};

const RAR = [
  { sat: 0.45, price: [400, 600] },
  { sat: 0.6, price: [800, 1100] },
  { sat: 0.7, price: [1400, 1800] },
  { sat: 0.85, price: [2200, 2800] },
  { sat: 0.9, price: [3500, 5000] }
];

const SHAPES = ['circle', 'star', 'heart', 'diamond'];
const HATS = ['cone', 'cap', 'crown', 'tophat'];

const DEFAULT_ITEMS = {
  sub: {
    id: 'sub:def', cat: 'sub', rar: 0, def: true, price: 0, season: null,
    name: { en: 'Classic RV-01', de: 'Klassik RV-01' },
    vis: { hull: '#e6edf3', plain: '#dde6ee', accent: '#ff8a2a', teal: '#1f8f94', glow: null, glowI: 0, metal: false, shimmer: false }
  },
  bub: {
    id: 'bub:def', cat: 'bub', rar: 0, def: true, price: 0, season: null,
    name: { en: 'Standard Bubbles', de: 'Standard-Blasen' },
    vis: { color: '#cfefff', shape: 'circle', rainbow: false, size: 1, rate: 1 }
  },
  cap: {
    id: 'cap:def', cat: 'cap', rar: 0, def: true, price: 0, season: null,
    name: { en: 'Classic Captain', de: 'Klassik-Kapitän' },
    vis: { jacket: '#1f4aa8', pants: '#14213d', cap: '#10224d', trim: '#e2b13c', skin: '#ffc9a3', trimGlow: false }
  },
  tou: {
    id: 'tou:def', cat: 'tou', rar: 0, def: true, price: 0, season: null,
    name: { en: 'Classic Tourists', de: 'Klassische Touristen' },
    vis: { tint: null, hat: 'none', hatColor: '#ffffff', previewTints: ['#5b8fd9', '#d96b6b', '#6bd98f'] }
  }
};

/* ------------------------------------------------------------
   Farb- und Zufalls-Helfer
   ------------------------------------------------------------ */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2, d = mx - mn;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function shade(hex, dl) {
  const p = hexToHsl(hex);
  return hsl(p[0], p[1], p[2] + dl);
}

/* ------------------------------------------------------------
   Item-Erzeugung (deterministisch aus der ID)
   ID-Formate:  cat:rar:b:n          (Basis-Item, n = 0..15)
                cat:rar:s:season:i   (Season-Item, i = 0..2)
                cat:def              (kostenloses Standard-Item)
   ------------------------------------------------------------ */
function makeVis(cat, rar, hue, seed) {
  const s = RAR[rar].sat * hue.s, H = hue.h, dl = hue.l;
  const C = (h, ss, l) => hsl(h, ss, l + dl);
  if (cat === 'sub') {
    return {
      hull: C(H, s * 0.6, 0.74),
      plain: C(H, s * 0.55, 0.7),
      accent: rar === 3 ? '#ffc933' : (rar === 4 ? C(H + 150, 1, 0.58) : C(H + 180, s, 0.52)),
      teal: C(H + 30, s * 0.8, 0.4),
      glow: rar >= 2 ? C(H, 0.9, 0.55) : null,
      glowI: [0, 0, 0.15, 0.28, 0.42][rar],
      metal: rar >= 3,
      shimmer: rar === 4
    };
  }
  if (cat === 'bub') {
    return {
      color: C(H, 0.9, 0.62),
      shape: rar === 0 ? 'circle' : SHAPES[(seed + rar) % 4],
      rainbow: rar === 4,
      size: 1.0 + 0.35 * rar,
      rate: 1 + 0.3 * rar
    };
  }
  if (cat === 'cap') {
    return {
      jacket: C(H, s * 0.75, 0.38),
      pants: C(H, s * 0.5, 0.2),
      cap: C(H + 20, s * 0.7, 0.25),
      trim: rar >= 3 ? '#ffd23a' : C(H + 180, s * 0.6, 0.6),
      skin: rar === 4 ? C(H, 0.55, 0.72) : null,
      trimGlow: rar >= 3
    };
  }
  const tint = C(H, s * 0.85, 0.5);
  return {
    tint,
    hat: rar === 0 ? 'none' : HATS[(seed + rar) % 4],
    hatColor: rar >= 3 ? '#ffd23a' : C(H + 180, 0.7, 0.55),
    previewTints: [tint, shade(tint, 0.1), shade(tint, -0.1)]
  };
}

const itemCache = new Map();

function getItem(id) {
  if (itemCache.has(id)) return itemCache.get(id);
  const p = String(id).split(':');
  const cat = p[0];
  let item = null;
  if (CATS.indexOf(cat) >= 0) {
    if (p[1] === 'def') {
      item = DEFAULT_ITEMS[cat];
    } else {
      const rar = Number(p[1]);
      if (rar >= 0 && rar <= 4) {
        let hue = null, seed = 0, season = null;
        if (p[2] === 'b') {
          seed = Number(p[3]);
          hue = BASE_HUES[seed];
        } else if (p[2] === 's' && SEASON_HUES[p[3]]) {
          season = p[3];
          seed = 16 + Object.keys(SEASON_HUES).indexOf(season) * 3 + Number(p[4]);
          hue = SEASON_HUES[season][Number(p[4])];
        }
        if (hue) {
          const n = NOUN[cat][rar];
          const range = RAR[rar].price;
          const steps = (range[1] - range[0]) / 50 + 1;
          item = {
            id, cat, rar, def: false, season,
            name: { en: hue.en + ' ' + n[0], de: hue.de + '-' + n[1] },
            price: range[0] + 50 * (hash(id) % steps),
            vis: makeVis(cat, rar, hue, seed)
          };
        }
      }
    }
  }
  if (!item) item = DEFAULT_ITEMS[cat] || DEFAULT_ITEMS.sub;
  itemCache.set(id, item);
  return item;
}

/* ------------------------------------------------------------
   Täglicher Shop (UTC), 14-Tage-Sperre
   Basis-Items: Index = (Tag * Schrittweite + Offset) mod 16, Schrittweite ungerade
   -> jedes Item kommt frühestens nach 16 Tagen wieder.
   Season-Items (nur in ihrer Season): Phase = (Tag + k) mod 15 in {0,5,10}
   -> jedes Season-Item kommt frühestens nach 15 Tagen wieder.
   ------------------------------------------------------------ */
const utcDay = () => Math.floor(Date.now() / 86400000);

function dailyIds(D, season) {
  const rows = [];
  CATS.forEach((cat, ci) => {
    const row = [];
    for (let rar = 0; rar < 5; rar++) {
      let id = null;
      if (SEASONS[season].boost) {
        const phase = (D + ci * 3 + rar * 2) % 15;
        if (phase % 5 === 0) id = cat + ':' + rar + ':s:' + season + ':' + (phase / 5);
      }
      if (!id) {
        const stride = [5, 7, 9, 11, 13][rar];
        const off = hash(cat + rar) % 16;
        const n = (((D * stride + off) % 16) + 16) % 16;
        id = cat + ':' + rar + ':b:' + n;
      }
      row.push(id);
    }
    rows.push(row);
  });
  return rows;
}

/* ------------------------------------------------------------
   Speicher
   ------------------------------------------------------------ */
function loadState() {
  const st = { owned: [], equipped: { sub: 'sub:def', bub: 'bub:def', cap: 'cap:def', tou: 'tou:def' } };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (Array.isArray(o.owned)) st.owned = o.owned.filter((x) => typeof x === 'string');
      if (o.equipped) CATS.forEach((c) => { if (typeof o.equipped[c] === 'string') st.equipped[c] = o.equipped[c]; });
    }
  } catch (e) { /* ignorieren */ }
  CATS.forEach((c) => {
    const id = st.equipped[c];
    if (id !== c + ':def' && st.owned.indexOf(id) < 0) st.equipped[c] = c + ':def';
  });
  return st;
}
const state = loadState();
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignorieren */ }
}
const isOwned = (id) => /:def$/.test(id) || state.owned.indexOf(id) >= 0;

/* ------------------------------------------------------------
   Anbindung an script.js
   ------------------------------------------------------------ */
let hooks = {};
const lang = () => ((hooks.getLang && hooks.getLang()) === 'en' ? 'en' : 'de');
const tt = () => TX[lang()];

function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
}
function getMoney() {
  if (hooks.getMoney) return hooks.getMoney();
  return Math.max(0, Number(readSave().money) || 0);
}
function spend(n) {
  if (hooks.spend) return hooks.spend(n);
  const s = readSave();
  const m = Number(s.money) || 0;
  if (m < n) return false;
  s.money = m - n;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { return false; }
  return true;
}
const fmt = (n) => Math.round(n).toLocaleString(lang() === 'de' ? 'de-DE' : 'en-US') + ' €';

/* ------------------------------------------------------------
   Vorschau-Grafiken (SVG)
   ------------------------------------------------------------ */
let uid = 1;

function starPts(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    p.push((cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1));
  }
  return p.join(' ');
}

function shapeSvg(shape, x, y, r, c) {
  if (shape === 'star') return '<polygon points="' + starPts(x, y, r) + '" fill="' + c + '"/>';
  if (shape === 'heart') {
    return '<path transform="translate(' + x + ' ' + y + ') scale(' + r + ')" d="M0,0.9 C-1.2,0 -0.8,-0.9 0,-0.35 C0.8,-0.9 1.2,0 0,0.9Z" fill="' + c + '"/>';
  }
  if (shape === 'diamond') {
    return '<polygon points="' + x + ',' + (y - r) + ' ' + (x + r * 0.8) + ',' + y + ' ' + x + ',' + (y + r) + ' ' + (x - r * 0.8) + ',' + y + '" fill="' + c + '"/>';
  }
  return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="1.6"/>' +
         '<circle cx="' + (x - r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.28) + '" fill="' + c + '" opacity=".8"/>';
}

function hatSvg(type, x, y, r, c) {
  if (type === 'cone') return '<polygon points="' + (x - r) + ',' + y + ' ' + (x + r) + ',' + y + ' ' + x + ',' + (y - r * 2.2) + '" fill="' + c + '"/>';
  if (type === 'cap') return '<path d="M' + (x - r) + ' ' + y + ' A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z" fill="' + c + '"/>';
  if (type === 'crown') {
    return '<polygon points="' + (x - r) + ',' + y + ' ' + (x - r) + ',' + (y - r * 1.2) + ' ' + (x - r / 2) + ',' + (y - r * 0.6) + ' ' + x + ',' + (y - r * 1.4) +
           ' ' + (x + r / 2) + ',' + (y - r * 0.6) + ' ' + (x + r) + ',' + (y - r * 1.2) + ' ' + (x + r) + ',' + y + '" fill="' + c + '"/>';
  }
  if (type === 'tophat') {
    return '<rect x="' + (x - r * 0.7) + '" y="' + (y - r * 1.6) + '" width="' + (r * 1.4) + '" height="' + (r * 1.6) + '" fill="' + c + '"/>' +
           '<rect x="' + (x - r * 1.1) + '" y="' + (y - r * 0.15) + '" width="' + (r * 2.2) + '" height="' + (r * 0.3) + '" fill="' + c + '"/>';
  }
  return '';
}

function svgSub(v) {
  const id = 'sg' + (uid++);
  const glow = v.glow ? '<ellipse cx="64" cy="44" rx="54" ry="24" fill="' + v.glow + '" opacity=".35" filter="url(#' + id + 'b)"/>' : '';
  return '<svg viewBox="0 0 130 80"><defs>' +
    '<linearGradient id="' + id + 'h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + shade(v.hull, 0.12) + '"/><stop offset=".55" stop-color="' + v.hull + '"/><stop offset="1" stop-color="' + shade(v.hull, -0.28) + '"/></linearGradient>' +
    '<filter id="' + id + 'b"><feGaussianBlur stdDeviation="5"/></filter>' +
    '<clipPath id="' + id + 'c"><ellipse cx="64" cy="44" rx="46" ry="17"/></clipPath></defs>' +
    glow +
    '<polygon points="104,44 120,28 120,60" fill="' + v.plain + '"/>' +
    '<rect x="119" y="34" width="3" height="20" rx="1.5" fill="' + v.accent + '"/>' +
    '<rect x="62" y="22" width="11" height="10" rx="3" fill="' + v.plain + '"/>' +
    '<ellipse cx="64" cy="44" rx="46" ry="17" fill="url(#' + id + 'h)"/>' +
    '<g clip-path="url(#' + id + 'c)"><rect x="56" y="20" width="6" height="50" fill="' + v.accent + '"/><rect x="82" y="20" width="6" height="50" fill="' + v.accent + '"/></g>' +
    '<ellipse cx="33" cy="40" rx="15" ry="11" fill="#bfeaff" opacity=".6" stroke="' + v.accent + '" stroke-width="1.5"/>' +
    '<circle cx="68" cy="47" r="3" fill="#0d2a3a"/><circle cx="76" cy="47" r="3" fill="#0d2a3a"/><circle cx="94" cy="46" r="3" fill="#0d2a3a"/>' +
    '</svg>';
}

function svgBub(v) {
  let s = '<svg viewBox="0 0 120 80"><rect x="4" y="36" width="10" height="14" rx="2" fill="#6b7a86"/>';
  for (let i = 0; i < 7; i++) {
    const x = 22 + i * 14, y = 44 - Math.sin(i * 0.9) * 14, r = 3 + i * 0.9;
    const c = v.rainbow ? hsl(i * 52, 0.9, 0.62) : (i % 2 ? shade(v.color, 0.1) : v.color);
    s += shapeSvg(v.shape, x, y, r, c);
  }
  return s + '</svg>';
}

function svgCap(v) {
  const skin = v.skin || '#ffc9a3';
  return '<svg viewBox="0 0 100 100">' +
    '<rect x="34" y="80" width="13" height="14" rx="4" fill="' + v.pants + '"/><rect x="53" y="80" width="13" height="14" rx="4" fill="' + v.pants + '"/>' +
    '<rect x="30" y="52" width="40" height="34" rx="16" fill="' + v.jacket + '"/>' +
    '<circle cx="50" cy="64" r="2" fill="' + v.trim + '"/><circle cx="50" cy="73" r="2" fill="' + v.trim + '"/>' +
    '<circle cx="50" cy="40" r="17" fill="' + skin + '"/>' +
    '<circle cx="43" cy="39" r="4.5" fill="#fff"/><circle cx="57" cy="39" r="4.5" fill="#fff"/>' +
    '<circle cx="43" cy="40" r="2" fill="#111"/><circle cx="57" cy="40" r="2" fill="#111"/>' +
    '<ellipse cx="50" cy="52" rx="7" ry="6" fill="#fff"/>' +
    '<circle cx="50" cy="45" r="3.5" fill="#f08a7a"/>' +
    '<path d="M34 24 Q50 4 66 24Z" fill="#fff"/>' +
    '<rect x="32" y="22" width="36" height="8" rx="3" fill="' + v.cap + '"/>' +
    '<rect x="32" y="27" width="36" height="2" fill="' + v.trim + '"/>' +
    '<ellipse cx="50" cy="31" rx="20" ry="3.5" fill="#111"/>' +
    '</svg>';
}

function svgTou(v) {
  const tints = v.previewTints;
  let s = '<svg viewBox="0 0 120 90">';
  [24, 60, 96].forEach((x, i) => {
    const headY = 42, r = 11;
    s += '<rect x="' + (x - 13) + '" y="52" width="26" height="30" rx="12" fill="' + tints[i] + '"/>';
    s += '<circle cx="' + x + '" cy="' + headY + '" r="' + r + '" fill="#ffc9a3"/>';
    s += '<circle cx="' + (x - 4) + '" cy="' + (headY - 1) + '" r="1.8" fill="#111"/><circle cx="' + (x + 4) + '" cy="' + (headY - 1) + '" r="1.8" fill="#111"/>';
    s += hatSvg(v.hat, x, headY - r + 3, r * 0.95, v.hatColor);
  });
  return s + '</svg>';
}

function previewSvg(item) {
  if (item.cat === 'sub') return svgSub(item.vis);
  if (item.cat === 'bub') return svgBub(item.vis);
  if (item.cat === 'cap') return svgCap(item.vis);
  return svgTou(item.vis);
}

/* ------------------------------------------------------------
   Oberfläche
   ------------------------------------------------------------ */
const CSS = `
#shop{position:fixed;inset:0;z-index:120;display:flex;flex-direction:column;color:var(--ink,#d9f7ff);
 font-family:var(--mono,ui-monospace,Menlo,Consolas,monospace);
 background:radial-gradient(circle at 50% 0,rgba(25,230,255,.12) 0,transparent 55%),
  repeating-radial-gradient(circle at 50% 0,transparent 0 62px,rgba(25,230,255,.06) 62px 63px),#04090c;
 -webkit-user-select:none;user-select:none}
#shop.sh-off{display:none}
.sh-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 10px;
 border-bottom:1px solid var(--cy-dim,rgba(25,230,255,.38))}
.sh-tabs{display:flex;gap:8px;flex:1 1 auto}
.sh-tab{flex:0 1 220px;padding:16px 18px;border:1px solid var(--cy-dim,rgba(25,230,255,.38));border-bottom:3px solid transparent;
 background:rgba(6,12,16,.7);color:var(--ink,#d9f7ff);font:900 18px var(--mono,monospace);letter-spacing:.2em;cursor:pointer}
.sh-tab.on{border-bottom-color:var(--am,#ffb02e);color:var(--am,#ffb02e);background:linear-gradient(180deg,#3b2a0f,#1d1407)}
.sh-right{display:flex;align-items:center;gap:10px;margin-left:auto}
.sh-money{padding:10px 16px;border:1px solid var(--am-dim,rgba(255,176,46,.55));background:#03080a;color:var(--am,#ffb02e);
 font:900 20px var(--mono,monospace);letter-spacing:.08em;text-shadow:0 0 12px rgba(255,176,46,.5);white-space:nowrap}
.sh-close{padding:12px 16px;border:1px solid var(--cy-dim,rgba(25,230,255,.38));border-right:3px solid var(--am,#ffb02e);background:rgba(6,12,16,.72);
 color:var(--ink,#d9f7ff);font:800 12px var(--mono,monospace);letter-spacing:.14em;cursor:pointer}
.sh-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 16px calc(24px + env(safe-area-inset-bottom,0px))}
.sh-banner{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 18px;
 border:1px solid var(--cy-dim,rgba(25,230,255,.38));border-left:4px solid var(--am,#ffb02e);
 background:linear-gradient(90deg,var(--g1),var(--g2))}
.sh-ban-l{display:flex;align-items:center;gap:14px}
.sh-ban-ic{font-size:38px}
.sh-ban-t{font:900 20px var(--mono,monospace);letter-spacing:.14em;text-shadow:0 2px 8px rgba(0,0,0,.6)}
.sh-ban-s{font:700 12px var(--mono,monospace);opacity:.9;margin-top:3px}
.sh-count{font:700 13px var(--mono,monospace);letter-spacing:.1em;padding:8px 12px;background:rgba(0,0,0,.45)}
.sh-count b{color:var(--am,#ffb02e);font-size:18px;margin-left:6px}
.sh-rowh{margin:20px 0 8px;font:800 13px var(--mono,monospace);letter-spacing:.24em;color:var(--am,#ffb02e);text-transform:uppercase}
.sh-rowh::before{content:"◢ ";color:var(--cy,#19e6ff)}
.sh-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.sh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
.sh-card{position:relative;display:flex;flex-direction:column;gap:5px;padding:8px 8px 10px;border:2px solid rgba(255,255,255,.3);border-radius:6px;
 color:#fff;cursor:pointer;text-align:center;overflow:hidden;font-family:inherit;transition:transform .15s,filter .15s}
.sh-card:hover,.sh-card:focus{transform:translateY(-2px);filter:brightness(1.12);outline:none}
.sh-card.r0{background:linear-gradient(160deg,#9aa6af,#4a545c);border-color:#c5ced4}
.sh-card.r1{background:linear-gradient(160deg,#3d9bff,#123c8a);border-color:#8cc4ff}
.sh-card.r2{background:linear-gradient(160deg,#b45dff,#4a1590);border-color:#d6a4ff}
.sh-card.r3{background:linear-gradient(160deg,#ffb02e,#c0470f);border-color:#ffd98a}
.sh-card.r4{background:linear-gradient(145deg,#ff2f4d,#a30f2c 55%,#ffc94a);border-color:#ffd98a;box-shadow:0 0 18px rgba(255,80,80,.45)}
.sh-card.eq{outline:3px solid var(--ok,#5dffb0);outline-offset:1px}
.sh-prev{aspect-ratio:3/2;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);border-radius:4px;padding:4px}
.sh-prev svg{width:100%;height:100%}
.sh-name{font:800 12px/1.2 var(--mono,monospace);min-height:2.4em;display:flex;align-items:center;justify-content:center;text-shadow:0 1px 4px rgba(0,0,0,.6)}
.sh-price{font:700 11px var(--mono,monospace);background:rgba(0,0,0,.35);padding:3px 4px;letter-spacing:.06em}
.sh-card.owned .sh-price{color:var(--ok,#5dffb0)}
.sh-card.eq .sh-price{background:var(--ok,#5dffb0);color:#031;font-weight:900}
.sh-rar{position:absolute;left:5px;top:5px;font:800 8px var(--mono,monospace);letter-spacing:.1em;background:rgba(0,0,0,.5);padding:2px 5px;text-transform:uppercase}
.sh-tag{position:absolute;right:5px;top:3px;font-size:14px}
.sh-cats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.sh-cat{padding:14px 6px;border:1px solid var(--cy-dim,rgba(25,230,255,.38));background:rgba(6,12,16,.7);color:var(--ink,#d9f7ff);
 font:800 13px var(--mono,monospace);letter-spacing:.08em;cursor:pointer}
.sh-cat.on{border-color:var(--am,#ffb02e);color:var(--am,#ffb02e);background:linear-gradient(180deg,#3b2a0f,#1d1407)}
.sh-hint{margin:12px 0;font:700 12px var(--mono,monospace);opacity:.75}
.sh-modal{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:rgba(2,8,12,.82);padding:16px}
.sh-modal.sh-off{display:none}
.sh-mbox{width:min(360px,100%);padding:20px;text-align:center;background:linear-gradient(180deg,#14202a,#0a1115);
 border:2px solid var(--cy-dim,rgba(25,230,255,.38));border-top:3px solid var(--am,#ffb02e)}
.sh-mbox h3{margin:0 0 12px;font:900 18px var(--mono,monospace);letter-spacing:.2em;color:var(--am,#ffb02e)}
.sh-mprev{padding:10px;border:2px solid rgba(255,255,255,.3);border-radius:6px}
.sh-mprev.r0{background:linear-gradient(160deg,#9aa6af,#4a545c)}
.sh-mprev.r1{background:linear-gradient(160deg,#3d9bff,#123c8a)}
.sh-mprev.r2{background:linear-gradient(160deg,#b45dff,#4a1590)}
.sh-mprev.r3{background:linear-gradient(160deg,#ffb02e,#c0470f)}
.sh-mprev.r4{background:linear-gradient(145deg,#ff2f4d,#a30f2c 55%,#ffc94a)}
.sh-mprev svg{width:100%;height:150px}
.sh-mname{margin-top:12px;font:800 16px var(--mono,monospace)}
.sh-mrar{font:700 11px var(--mono,monospace);opacity:.75;margin-top:2px;letter-spacing:.14em;text-transform:uppercase}
.sh-mprice{margin:8px 0 14px;font:900 22px var(--mono,monospace);color:var(--am,#ffb02e)}
.sh-mbtn{display:flex;gap:10px}
.sh-mbtn button{flex:1;padding:14px 8px;border:1px solid var(--cy-dim,rgba(25,230,255,.38));background:rgba(6,12,16,.8);color:var(--ink,#d9f7ff);
 font:800 14px var(--mono,monospace);letter-spacing:.12em;cursor:pointer}
.sh-mbtn .sh-yes{border-color:var(--am,#ffb02e);color:var(--am,#ffb02e);background:linear-gradient(180deg,#3b2a0f,#1d1407)}
.sh-mbtn .sh-yes[disabled]{opacity:.55;border-color:var(--red,#ff5468);color:var(--red,#ff5468);cursor:not-allowed}
.sh-toast{position:absolute;left:50%;top:calc(76px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:6;max-width:90vw;padding:10px 18px;
 background:rgba(0,0,0,.9);border:1px solid var(--am,#ffb02e);font:800 14px var(--mono,monospace);opacity:0;transition:opacity .25s;pointer-events:none;text-align:center}
.sh-toast.show{opacity:1}
@media (max-width:640px){
 .sh-tab{font-size:14px;padding:12px 10px}.sh-money{font-size:15px;padding:8px 10px}
 .sh-name{font-size:10px}.sh-price{font-size:9px}.sh-row{gap:6px}.sh-card{padding:5px 5px 7px}
 .sh-cat{font-size:10px;padding:12px 2px}.sh-rar{display:none}
}`;

let root = null, body = null, modal = null, toastEl = null;
let isOpen = false;
let tab = 'shop';
let lockerCat = 'sub';
let renderedDay = 0;
let ticker = null;
let toastTimer = null;
let pendingId = null;

function countdown() {
  const ms = Math.max(0, (utcDay() + 1) * 86400000 - Date.now());
  const s = Math.floor(ms / 1000);
  const p = (n) => String(n).padStart(2, '0');
  return p(Math.floor(s / 3600)) + ':' + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60);
}

function cardHtml(it, mode) {
  const t = tt();
  const owned = isOwned(it.id);
  const eq = state.equipped[it.cat] === it.id;
  let price;
  if (mode === 'locker') price = eq ? t.equipped : t.equip;
  else price = owned ? t.owned : fmt(it.price);
  const tag = it.season ? '<span class="sh-tag">' + SEASONS[it.season].icon + '</span>' : '';
  return '<button type="button" class="sh-card r' + it.rar + (owned ? ' owned' : '') + (mode === 'locker' && eq ? ' eq' : '') + '" data-id="' + it.id + '">' +
    '<span class="sh-rar">' + t.rar[it.rar] + '</span>' + tag +
    '<div class="sh-prev">' + previewSvg(it) + '</div>' +
    '<div class="sh-name">' + it.name[lang()] + '</div>' +
    '<div class="sh-price">' + price + '</div></button>';
}

function renderShop() {
  const t = tt();
  const D = utcDay();
  renderedDay = D;
  const season = currentSeason(new Date());
  const S = SEASONS[season];
  const ids = dailyIds(D, season);
  let h = '<div class="sh-banner" style="--g1:' + S.g[0] + ';--g2:' + S.g[1] + '">' +
    '<div class="sh-ban-l"><span class="sh-ban-ic">' + S.icon + '</span><div><div class="sh-ban-t">' + S[lang()] + '</div>' +
    '<div class="sh-ban-s">' + (S.boost ? t.boost : t.noBoost) + '</div></div></div>' +
    '<div class="sh-count"><span>' + t.resets + '</span><b id="sh-count">' + countdown() + '</b></div></div>';
  CATS.forEach((cat, ci) => {
    h += '<div class="sh-rowh">' + t.cats[cat] + '</div><div class="sh-row">' +
      ids[ci].map((id) => cardHtml(getItem(id), 'shop')).join('') + '</div>';
  });
  body.innerHTML = h;
}

function ownedItems(cat) {
  const list = state.owned.filter((id) => id.indexOf(cat + ':') === 0).map(getItem);
  list.sort((a, b) => b.rar - a.rar || a.name[lang()].localeCompare(b.name[lang()]));
  return [DEFAULT_ITEMS[cat]].concat(list);
}

function renderLocker() {
  const t = tt();
  let h = '<div class="sh-cats">' + CATS.map((c) =>
    '<button type="button" class="sh-cat' + (c === lockerCat ? ' on' : '') + '" data-cat="' + c + '">' + t.cats[c] + '</button>').join('') + '</div>';
  h += '<div class="sh-hint">' + t.lockerHint + '</div><div class="sh-grid">' +
    ownedItems(lockerCat).map((it) => cardHtml(it, 'locker')).join('') + '</div>';
  body.innerHTML = h;
}

function render() {
  if (!root) return;
  const t = tt();
  const tabs = root.querySelectorAll('.sh-tab');
  tabs[0].textContent = t.shop;
  tabs[1].textContent = t.locker;
  tabs[0].classList.toggle('on', tab === 'shop');
  tabs[1].classList.toggle('on', tab === 'locker');
  root.querySelector('#sh-close').textContent = t.back;
  const top = body.scrollTop;
  if (tab === 'shop') renderShop(); else renderLocker();
  body.scrollTop = top;
  updateMoney();
}

function updateMoney() {
  const el = root && root.querySelector('#sh-money');
  if (el) el.textContent = fmt(getMoney());
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

function openModal(id) {
  const t = tt();
  const it = getItem(id);
  const poor = getMoney() < it.price;
  pendingId = id;
  modal.innerHTML = '<div class="sh-mbox"><h3>' + t.confirm + '</h3>' +
    '<div class="sh-mprev r' + it.rar + '">' + previewSvg(it) + '</div>' +
    '<div class="sh-mname">' + it.name[lang()] + '</div>' +
    '<div class="sh-mrar">' + t.rar[it.rar] + '</div>' +
    '<div class="sh-mprice">' + fmt(it.price) + '</div>' +
    '<div class="sh-mbtn"><button type="button" class="sh-yes" data-act="yes"' + (poor ? ' disabled' : '') + '>' + (poor ? t.poor : t.yes) + '</button>' +
    '<button type="button" data-act="no">' + t.no + '</button></div></div>';
  modal.classList.remove('sh-off');
}

function closeModal() {
  pendingId = null;
  modal.classList.add('sh-off');
}

function buy(id) {
  const it = getItem(id);
  if (isOwned(id)) { closeModal(); return; }
  if (getMoney() < it.price || !spend(it.price)) { openModal(id); return; }
  state.owned.push(id);
  saveState();
  closeModal();
  render();
  toast(tt().bought(it.name[lang()]));
}

function equip(id) {
  const it = getItem(id);
  if (!isOwned(id)) return;
  state.equipped[it.cat] = id;
  saveState();
  if (hooks.onEquipChange) { try { hooks.onEquipChange(); } catch (e) { console.error('[Shop]', e); } }
  render();
  toast(tt().nowEquipped(it.name[lang()]));
}

function onClick(e) {
  const el = e.target.closest ? e.target : null;
  if (!el) return;
  const tabBtn = el.closest('.sh-tab');
  if (tabBtn) { tab = tabBtn.getAttribute('data-tab'); render(); return; }
  if (el.closest('#sh-close')) { closeShop(); return; }
  const act = el.closest('[data-act]');
  if (act) {
    if (act.getAttribute('data-act') === 'yes' && pendingId && !act.disabled) buy(pendingId);
    else closeModal();
    return;
  }
  if (el.classList && el.classList.contains('sh-modal')) { closeModal(); return; }
  const catBtn = el.closest('.sh-cat');
  if (catBtn) { lockerCat = catBtn.getAttribute('data-cat'); render(); return; }
  const card = el.closest('.sh-card');
  if (card) {
    const id = card.getAttribute('data-id');
    if (tab === 'locker') equip(id);
    else if (!isOwned(id)) openModal(id);
  }
}

function onKey(e) {
  if (!isOpen) return;
  if (e.code === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (pendingId) closeModal(); else closeShop();
  }
}

function tick() {
  if (!isOpen) return;
  updateMoney();
  const c = root.querySelector('#sh-count');
  if (c) c.textContent = countdown();
  if (tab === 'shop' && utcDay() !== renderedDay) render();   // neuer Tag -> neuer Shop
}

export function openShop() {
  if (!root) return;
  isOpen = true;
  tab = 'shop';
  closeModal();
  root.classList.remove('sh-off');
  render();
  body.scrollTop = 0;
  clearInterval(ticker);
  ticker = setInterval(tick, 250);
}

export function closeShop() {
  isOpen = false;
  clearInterval(ticker);
  if (root) root.classList.add('sh-off');
}

export function refreshShop() {
  if (isOpen) render();
}

/* ------------------------------------------------------------
   Skins im 3D-Spiel anwenden
   ------------------------------------------------------------ */
const subDefaults = new WeakMap();
const cur = { sub: null, shimmer: false, fxTime: 0 };
let fx = null;
const FX_N = 160;
const _tmp = new THREE.Vector3();
const _back = new THREE.Vector3();
const _col = new THREE.Color();

/* ---- U-Boot ---- */
function applySub(sub, item) {
  const M = sub.materials;
  if (!M || !M.hull) return;
  if (!subDefaults.has(M)) {
    subDefaults.set(M, {
      hull: M.hull.color.getHex(), plain: M.hullPlain.color.getHex(),
      orange: M.orange.color.getHex(), teal: M.teal.color.getHex(),
      metal: M.hull.metalness, rough: M.hull.roughness
    });
  }
  const d = subDefaults.get(M);
  const v = item.vis;
  if (item.def) {
    M.hull.color.setHex(d.hull); M.hullPlain.color.setHex(d.plain);
    M.orange.color.setHex(d.orange); M.teal.color.setHex(d.teal);
    M.hull.metalness = d.metal; M.hull.roughness = d.rough;
    M.hull.emissive.setHex(0x000000); M.hull.emissiveIntensity = 0;
    cur.shimmer = false;
    return;
  }
  M.hull.color.set(v.hull); M.hullPlain.color.set(v.plain);
  M.orange.color.set(v.accent); M.teal.color.set(v.teal);
  M.hull.metalness = v.metal ? 0.9 : d.metal;
  M.hull.roughness = v.metal ? 0.18 : d.rough;
  M.hull.emissive.set(v.glow || '#000000');
  M.hull.emissiveIntensity = v.glowI;
  cur.shimmer = !!v.shimmer;
}

/* ---- Kapitän (Materialien werden über ihre Originalfarbe erkannt) ---- */
const CAP_ROLES = { 0x1f4aa8: 'jacket', 0x14213d: 'pants', 0x10224d: 'cap', 0xe2b13c: 'trim', 0xffc9a3: 'skin' };

function applyCaptain(rootObj, item) {
  if (!rootObj) return;
  rootObj.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m || !m.color) return;
      if (m.userData.shopOrig === undefined) m.userData.shopOrig = m.color.getHex();
      const role = CAP_ROLES[m.userData.shopOrig];
      if (!role) return;
      const val = item.def ? null : item.vis[role];
      if (val) m.color.set(val); else m.color.setHex(m.userData.shopOrig);
      if (role === 'trim' && m.emissive) {
        const glow = !item.def && item.vis.trimGlow;
        m.emissive.set(glow ? item.vis.trim : '#000000');
        m.emissiveIntensity = glow ? 0.5 : 0;
      }
    });
  });
}

/* ---- Touristen (defensiv: tourists.js ist unbekannt) ---- */
function findTouristRoot(t) {
  if (!t) return null;
  if (t.isObject3D) return t;
  const keys = ['group', 'root', 'obj', 'object', 'mesh', 'figure', 'body', 'model'];
  for (let i = 0; i < keys.length; i++) if (t[keys[i]] && t[keys[i]].isObject3D) return t[keys[i]];
  for (const k in t) { if (t[k] && t[k].isObject3D && t[k].children && t[k].children.length) return t[k]; }
  return null;
}

function disposeObj(o) {
  o.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose());
  });
}

function makeHat(type, color) {
  const g = new THREE.Group();
  g.userData.shopHat = true;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.3 });
  const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  if (type === 'cone') add(new THREE.ConeGeometry(0.22, 0.5, 18), 0, 0.25, 0);
  else if (type === 'cap') {
    add(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0);
    add(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 20, 1, false, -Math.PI / 2, Math.PI), 0, 0.02, 0.05);
  } else if (type === 'crown') {
    add(new THREE.CylinderGeometry(0.26, 0.24, 0.12, 20, 1, true), 0, 0.06, 0);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      add(new THREE.ConeGeometry(0.05, 0.16, 6), Math.cos(a) * 0.25, 0.19, Math.sin(a) * 0.25);
    }
  } else if (type === 'tophat') {
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 20), 0, 0.19, 0);
    add(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 24), 0, 0.01, 0);
  }
  g.scale.setScalar(HAT_SCALE);
  return g;
}

function applyTourists(tourists, item) {
  const list = tourists && tourists.tourists;
  if (!Array.isArray(list)) return;
  const tint = item.def ? null : item.vis.tint;
  const seen = new Set();
  list.forEach((t) => {
    const r = findTouristRoot(t);
    if (!r) return;
    // alte Hüte entfernen
    r.children.filter((c) => c.userData && c.userData.shopHat).forEach((c) => { r.remove(c); disposeObj(c); });
    // Kleidung umfärben (Haut-, Augen- und Extremfarben bleiben)
    r.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m || !m.color || seen.has(m)) return;
        seen.add(m);
        if (m.userData.shopOrig === undefined) m.userData.shopOrig = m.color.getHex();
        const orig = new THREE.Color(m.userData.shopOrig);
        if (!tint) { m.color.copy(orig); return; }
        const p = {};
        orig.getHSL(p);
        const skin = p.h > 0.02 && p.h < 0.12 && p.s > 0.2 && p.l > 0.45 && p.l < 0.92;
        const extreme = p.l < 0.12 || p.l > 0.93;
        if (skin || extreme) { m.color.copy(orig); return; }
        m.color.copy(orig).lerp(_col.set(tint), 0.65);
      });
    });
    // Hut oben auf die Figur setzen
    if (!item.def && item.vis.hat !== 'none') {
      r.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(r);
      if (box.isEmpty()) return;
      const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
      r.worldToLocal(top);
      const hat = makeHat(item.vis.hat, item.vis.hatColor);
      const ws = new THREE.Vector3();
      r.getWorldScale(ws);
      hat.scale.setScalar(HAT_SCALE / Math.max(0.0001, ws.x));
      hat.position.copy(top);
      r.add(hat);
    }
  });
}

/* ---- Propeller-Blasen (zusätzlicher Partikel-Effekt) ---- */
function shapeTexture(shape) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 5;
  if (shape === 'star') {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 13 : 29;
      g.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  } else if (shape === 'heart') {
    g.beginPath(); g.moveTo(32, 56);
    g.bezierCurveTo(2, 34, 10, 6, 32, 22);
    g.bezierCurveTo(54, 6, 62, 34, 32, 56);
    g.fill();
  } else if (shape === 'diamond') {
    g.beginPath(); g.moveTo(32, 4); g.lineTo(54, 32); g.lineTo(32, 60); g.lineTo(10, 32); g.closePath(); g.fill();
  } else {
    g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.8; g.beginPath(); g.arc(24, 24, 5, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function detachFx() {
  if (!fx) return;
  if (fx.points.parent) fx.points.parent.remove(fx.points);
  fx.points.geometry.dispose();
  if (fx.points.material.map) fx.points.material.map.dispose();
  fx.points.material.dispose();
  fx = null;
}

function applyBubbles(sub, item) {
  detachFx();
  if (item.def) return;
  const scene = sub.group.parent;
  if (!scene) return;
  const v = item.vis;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(FX_N * 3), col = new Float32Array(FX_N * 3);
  for (let i = 0; i < FX_N; i++) pos[i * 3 + 1] = -1e5;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: v.size, map: shapeTexture(v.shape), vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  fx = {
    sub, points, pos, col, vis: v,
    vel: new Float32Array(FX_N * 3), life: new Float32Array(FX_N), max: new Float32Array(FX_N),
    base: new Float32Array(FX_N * 3), head: 0, acc: 0
  };
}

/* ---- Einstiegspunkte für script.js ---- */
export function applyEquipped(ctx) {
  const sub = ctx && ctx.sub;
  if (!sub) return;
  cur.sub = sub;
  applySub(sub, getItem(state.equipped.sub));
  applyCaptain(sub.captain, getItem(state.equipped.cap));
  applyBubbles(sub, getItem(state.equipped.bub));
  applyTourists(ctx.tourists, getItem(state.equipped.tou));
}

export function updateFx(dt, thr) {
  cur.fxTime += dt;
  if (cur.shimmer && cur.sub && cur.sub.materials) {
    const M = cur.sub.materials;
    M.hull.emissive.setHSL((cur.fxTime * 0.12) % 1, 0.85, 0.5);
    M.hull.emissiveIntensity = 0.35;
  }
  if (!fx) return;
  const sub = fx.sub;
  const v = fx.vis;
  const power = Math.abs(thr || 0);

  if (sub.group.position.y < 0) {
    fx.acc += (10 + 55 * power) * v.rate * dt;
    while (fx.acc >= 1) {
      fx.acc -= 1;
      const i = fx.head;
      fx.head = (fx.head + 1) % FX_N;
      sub.getBubblePos(_tmp);
      _back.set(0, 0, 1).applyQuaternion(sub.group.quaternion);
      const sp = 2 + power * 9;
      fx.pos[i * 3] = _tmp.x + (Math.random() - 0.5) * 1.2;
      fx.pos[i * 3 + 1] = _tmp.y + (Math.random() - 0.5) * 1.2;
      fx.pos[i * 3 + 2] = _tmp.z + (Math.random() - 0.5) * 1.2;
      fx.vel[i * 3] = _back.x * sp + (Math.random() - 0.5) * 1.5;
      fx.vel[i * 3 + 1] = _back.y * sp + 0.8 + Math.random() * 1.2;
      fx.vel[i * 3 + 2] = _back.z * sp + (Math.random() - 0.5) * 1.5;
      fx.max[i] = fx.life[i] = 1.0 + Math.random() * 1.0;
      if (v.rainbow) _col.setHSL((cur.fxTime * 0.5 + Math.random() * 0.3) % 1, 0.9, 0.6);
      else _col.set(v.color);
      fx.base[i * 3] = _col.r; fx.base[i * 3 + 1] = _col.g; fx.base[i * 3 + 2] = _col.b;
    }
  }

  for (let i = 0; i < FX_N; i++) {
    if (fx.life[i] <= 0) continue;
    fx.life[i] -= dt;
    if (fx.life[i] <= 0) {
      fx.pos[i * 3 + 1] = -1e5;
      fx.col[i * 3] = fx.col[i * 3 + 1] = fx.col[i * 3 + 2] = 0;
      continue;
    }
    fx.vel[i * 3 + 1] += 0.6 * dt;
    fx.pos[i * 3] += fx.vel[i * 3] * dt;
    fx.pos[i * 3 + 1] += fx.vel[i * 3 + 1] * dt;
    fx.pos[i * 3 + 2] += fx.vel[i * 3 + 2] * dt;
    const f = Math.pow(fx.life[i] / fx.max[i], 0.7);
    fx.col[i * 3] = fx.base[i * 3] * f;
    fx.col[i * 3 + 1] = fx.base[i * 3 + 1] * f;
    fx.col[i * 3 + 2] = fx.base[i * 3 + 2] * f;
  }
  fx.points.geometry.attributes.position.needsUpdate = true;
  fx.points.geometry.attributes.color.needsUpdate = true;
}

export function getEquipped() {
  return Object.assign({}, state.equipped);
}

/* ------------------------------------------------------------
   Initialisierung
   hooks = { getLang, getMoney, spend(n)->bool, onEquipChange }
   ------------------------------------------------------------ */
export function initShop(h) {
  hooks = h || {};
  if (root) return;

  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  root = document.createElement('div');
  root.id = 'shop';
  root.className = 'sh-off';
  root.innerHTML =
    '<div class="sh-top">' +
      '<div class="sh-tabs"><button type="button" class="sh-tab" data-tab="shop"></button><button type="button" class="sh-tab" data-tab="locker"></button></div>' +
      '<div class="sh-right"><div class="sh-money" id="sh-money"></div><button type="button" class="sh-close" id="sh-close"></button></div>' +
    '</div>' +
    '<div class="sh-body" id="sh-body"></div>' +
    '<div class="sh-modal sh-off" id="sh-modal"></div>' +
    '<div class="sh-toast" id="sh-toast"></div>';
  document.body.appendChild(root);

  body = root.querySelector('#sh-body');
  modal = root.querySelector('#sh-modal');
  toastEl = root.querySelector('#sh-toast');

  root.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey, true);

  const btn = document.getElementById('btn-shop');
  if (btn) btn.addEventListener('click', openShop);
}
