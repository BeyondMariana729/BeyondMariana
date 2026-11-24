/* ============================================================
   BEYOND MARIANA – shop.js
   Fortnite-Style Daily Shop & Spind (Locker)
   - zweisprachig (EN/DE), Fallback auf Englisch für weitere Sprachen
   - täglicher Shop deterministisch per UTC-Datum, 14-Tage-Sperre
   - Season-Banner nach Kalender + Live-Countdown bis 00:00 UTC
   - Kauf-Popup, Spind, Ausrüsten (U-Boot, Blasen, Kapitän, Touristen)
   - ECHTE 3D-Skins: U-Boot-Anbauten mit Animationen, Partikel-Spuren,
     3D-Hüte für Kapitän & Touristen, Weihnachtsbaum am Dock
   - bringt sein CSS selbst mit
   ============================================================ */

import * as THREE from 'three';

const STORE_KEY = 'beyond-mariana-shop-v1';
const SAVE_KEY = 'beyond-mariana-save-v2';      // Spielstand aus script.js (Geld)
const CATS = ['sub', 'bub', 'cap', 'tou'];
const HAT_SCALE = 1;                              // Hut-Größe bei Touristen (alte Hüte)
const HEAD_FRAC = 0.17;                           // Kopfradius der Touristen im Verhältnis zur Körperhöhe
const TREE_SCALE = 1;                             // Größe des Weihnachtsbaums
const DOCK_OFFSET = new THREE.Vector3(9, -2.4, 2); // Fallback-Position des Baums relativ zum U-Boot
const DS = THREE.DoubleSide;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

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
   Bauplan-Tabellen (generierte Farb-Items)
   ------------------------------------------------------------ */
const HUE = (en, de, h, s, l) => ({ en, de, h, s, l });

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

const SEASON_HUES = {
  halloween: [HUE('Pumpkin', 'Kürbis', 28, 1, 0), HUE('Witch', 'Hexen', 280, 0.9, -0.05), HUE('Ghost', 'Geister', 200, 0.25, 0.15)],
  christmas: [HUE('Holly', 'Stechpalmen', 135, 0.9, -0.05), HUE('Frost', 'Frost', 200, 0.5, 0.1), HUE('Candy', 'Zuckerstangen', 354, 1, 0)],
  valentine: [HUE('Rose', 'Rosen', 345, 0.9, 0), HUE('Cupid', 'Amor', 320, 0.8, 0.05), HUE('Velvet', 'Samt', 350, 0.8, -0.1)],
  summer:    [HUE('Sunny', 'Sonnen', 48, 1, 0), HUE('Palm', 'Palmen', 140, 0.8, 0), HUE('Tropic', 'Tropen', 175, 1, 0)]
};

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
   Handgebaute 3D-Spezial-Items
   ID-Format:  cat:rar:x:key
   season gesetzt -> erscheint nur in dieser Season (ersetzt dort
   den ersten Season-Slot der Reihe), sonst im normalen Tages-Pool
   ------------------------------------------------------------ */
const SPECIALS = [
  /* ---- U-Boote ---- */
  { key: 'cybershark', cat: 'sub', rar: 4, price: 5000, name: { en: 'Cyber-Shark', de: 'Cyber-Hai' },
    vis: { kind: 'shark', hull: '#2b3b55', plain: '#34465f', accent: '#5be4ff', teal: '#1a6c8c', glow: '#2cc8ff', glowI: 0.25, metal: true } },
  { key: 'kraken', cat: 'sub', rar: 4, price: 4900, name: { en: 'Golden Kraken', de: 'Goldener Kraken' },
    vis: { kind: 'kraken', hull: '#e9c46a', plain: '#d9a93a', accent: '#8a1c2b', teal: '#b8860b', glow: '#ffb000', glowI: 0.25, metal: true } },
  { key: 'ufo', cat: 'sub', rar: 4, price: 4800, name: { en: 'UFO Saucer', de: 'UFO-Untertasse' },
    vis: { kind: 'ufo', hull: '#c9d6d1', plain: '#b9c9c3', accent: '#3cff9a', teal: '#14a65e', glow: '#3cff9a', glowI: 0.22, metal: true } },
  { key: 'lava', cat: 'sub', rar: 3, price: 2800, name: { en: 'Lava Dragon', de: 'Lava-Drache' },
    vis: { kind: 'lava', hull: '#3a1a12', plain: '#2a120c', accent: '#ff5a14', teal: '#a02a08', glow: '#ff4a00', glowI: 0.4, metal: false } },
  { key: 'rgb', cat: 'sub', rar: 3, price: 2600, name: { en: 'RGB Gamer Sub', de: 'RGB-Gamer-Sub' },
    vis: { kind: 'rgb', hull: '#1b1f2a', plain: '#222735', accent: '#ff3bd4', teal: '#3b7bff', glow: '#7a5cff', glowI: 0.3, metal: true } },
  { key: 'steam', cat: 'sub', rar: 2, price: 1800, name: { en: 'Steampunk Nautilus', de: 'Steampunk-Nautilus' },
    vis: { kind: 'steam', hull: '#b5651d', plain: '#9c5516', accent: '#d4a548', teal: '#6b3f22', glow: null, glowI: 0, metal: true } },
  { key: 'pizza', cat: 'sub', rar: 2, price: 1700, name: { en: 'Pizza Sub', de: 'Pizza-Sub' },
    vis: { kind: 'pizza', hull: '#e2523a', plain: '#c9432e', accent: '#ffc43d', teal: '#2f9a3f', glow: null, glowI: 0, metal: false } },
  { key: 'banana', cat: 'sub', rar: 1, price: 1100, name: { en: 'Banana Boat', de: 'Bananenboot' },
    vis: { kind: 'banana', hull: '#ffe135', plain: '#f2d11f', accent: '#6b4a1a', teal: '#c9a800', glow: null, glowI: 0, metal: false } },
  { key: 'santa', cat: 'sub', rar: 4, price: 5000, season: 'christmas', name: { en: 'Santa Sleigh Sub', de: 'Weihnachtsmann-Schlitten' },
    vis: { kind: 'santa', hull: '#d6202f', plain: '#f5f5f5', accent: '#ffd23a', teal: '#1f8f3a', glow: '#ff2a2a', glowI: 0.12, metal: false } },

  /* ---- Propeller-Spuren ---- */
  { key: 'rings', cat: 'bub', rar: 4, price: 4200, name: { en: 'Rainbow Rings', de: 'Regenbogen-Ringe' },
    vis: { color: '#ffffff', shape: 'ring', rainbow: true, size: 2, rate: 1,
      layers: [{ shape: 'ring', rainbow: true, size: 2.4, rate: 0.5 }, { shape: 'ring', rainbow: true, size: 1.3, rate: 0.9 }] } },
  { key: 'coins', cat: 'bub', rar: 4, price: 4600, name: { en: 'Coins & Dollars', de: 'Münzen & Dollars' },
    vis: { color: '#ffd23a', shape: 'coin', rainbow: false, size: 1, rate: 1,
      layers: [{ mesh: 'coins', rate: 0.7, buoy: -1.4 }, { shape: 'star', color: '#ffd23a', size: 0.8, rate: 0.8 }] } },
  { key: 'lavaspark', cat: 'bub', rar: 3, price: 2500, name: { en: 'Lava Sparks', de: 'Lava-Funken' },
    vis: { color: '#ff5a14', shape: 'spark', rainbow: false, size: 1, rate: 1,
      layers: [{ shape: 'spark', color: '#ff5a14', size: 1, rate: 1.4, buoy: 0.2 }, { shape: 'orb', color: '#ffb347', size: 1.8, rate: 0.6 }] } },
  { key: 'bolt', cat: 'bub', rar: 3, price: 2700, name: { en: 'Lightning Orbs', de: 'Blitz-Kugeln' },
    vis: { color: '#9de8ff', shape: 'bolt', rainbow: false, size: 1, rate: 1,
      layers: [{ shape: 'bolt', color: '#c8f2ff', size: 1.5, rate: 1 }, { shape: 'orb', color: '#3a9bff', size: 2.4, rate: 0.7 }] } },
  { key: 'slime', cat: 'bub', rar: 2, price: 1600, name: { en: 'Alien Slime', de: 'Alien-Schleim' },
    vis: { color: '#7dff3a', shape: 'blob', rainbow: false, size: 1, rate: 1,
      layers: [{ shape: 'blob', color: '#7dff3a', size: 1.7, rate: 1.1, buoy: -0.3 }, { shape: 'orb', color: '#2aff7a', size: 2.2, rate: 0.4 }] } },
  { key: 'snow', cat: 'bub', rar: 2, price: 1700, season: 'christmas', name: { en: 'Snowflakes', de: 'Schneeflocken' },
    vis: { color: '#ffffff', shape: 'flake', rainbow: false, size: 1, rate: 1,
      layers: [{ shape: 'flake', color: '#ffffff', size: 1.6, rate: 1, buoy: 0.1 }] } },

  /* ---- Kapitäne ---- */
  { key: 'king', cat: 'cap', rar: 4, price: 4400, name: { en: "King's Crown", de: 'Königskrone' },
    vis: { kind: 'king', jacket: '#6a1b9a', pants: '#2a0f3f', cap: '#2a0f3f', trim: '#ffd23a', skin: null, trimGlow: true } },
  { key: 'astro', cat: 'cap', rar: 3, price: 2600, name: { en: 'Astronaut Helmet', de: 'Astronauten-Helm' },
    vis: { kind: 'astro', jacket: '#e8eef4', pants: '#b8c4d0', cap: '#e8eef4', trim: '#ff8a2a', skin: null, trimGlow: false } },
  { key: 'alienant', cat: 'cap', rar: 3, price: 2500, name: { en: 'Alien Antennae', de: 'Alien-Antennen' },
    vis: { kind: 'alien', jacket: '#2f9a3f', pants: '#1a5a26', cap: '#1a5a26', trim: '#9dff7a', skin: '#7be26a', trimGlow: true } },
  { key: 'cyber', cat: 'cap', rar: 3, price: 2700, name: { en: 'Cyber Visor', de: 'Cyber-Visier' },
    vis: { kind: 'cyber', jacket: '#141a26', pants: '#0b0f18', cap: '#0b0f18', trim: '#19e6ff', skin: null, trimGlow: true } },
  { key: 'pirate', cat: 'cap', rar: 2, price: 1600, name: { en: 'Pirate Tricorn', de: 'Piraten-Dreispitz' },
    vis: { kind: 'pirate', jacket: '#7a1f1f', pants: '#1a1414', cap: '#15131a', trim: '#e2b13c', skin: null, trimGlow: false } },
  { key: 'santahat', cat: 'cap', rar: 3, price: 2600, season: 'christmas', name: { en: 'Santa Hat', de: 'Nikolausmütze' },
    vis: { kind: 'santa', jacket: '#c8222f', pants: '#8a1620', cap: '#c8222f', trim: '#ffffff', skin: null, trimGlow: false } },

  /* ---- Touristen-Packs ---- */
  { key: 'aliens', cat: 'tou', rar: 3, price: 2600, name: { en: 'Little Green Aliens', de: 'Kleine Grüne' },
    vis: { kind: 'alien', previewTints: ['#2f9a3f', '#3bb34f', '#27863a'] } },
  { key: 'astros', cat: 'tou', rar: 4, price: 4300, name: { en: 'White Astronauts', de: 'Weiße Astronauten' },
    vis: { kind: 'astro', previewTints: ['#f4f7fa', '#e6ebf0', '#fafcfd'] } },
  { key: 'skeletons', cat: 'tou', rar: 2, price: 1700, name: { en: 'Skeleton Pirates', de: 'Skelett-Piraten' },
    vis: { kind: 'skeleton', previewTints: ['#2a2230', '#3a2a40', '#221a28'] } },
  { key: 'polar', cat: 'tou', rar: 3, price: 2700, season: 'christmas', name: { en: 'Penguins & Snowmen', de: 'Pinguine & Schneemänner' },
    vis: { kind: 'polar', previewTints: ['#f4f8fc', '#232a36', '#f4f8fc'] } }
];

const SPECIAL_MAP = {};
const SPEC_POOL = {};      // 'cat'+rar -> ids im normalen Pool
const SEASON_SPEC = {};    // season -> { 'cat'+rar: id }
SPECIALS.forEach((sp) => {
  const id = sp.cat + ':' + sp.rar + ':x:' + sp.key;
  SPECIAL_MAP[id] = {
    id, cat: sp.cat, rar: sp.rar, def: false, special: true, season: sp.season || null,
    name: sp.name, price: sp.price, vis: sp.vis
  };
  const slot = sp.cat + sp.rar;
  if (sp.season) {
    SEASON_SPEC[sp.season] = SEASON_SPEC[sp.season] || {};
    if (!SEASON_SPEC[sp.season][slot]) SEASON_SPEC[sp.season][slot] = id;
  } else {
    SPEC_POOL[slot] = SPEC_POOL[slot] || [];
    SPEC_POOL[slot].push(id);
  }
});

/* ------------------------------------------------------------
   Farb- und Zufalls-Helfer
   ------------------------------------------------------------ */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

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
    } else if (p[2] === 'x') {
      item = SPECIAL_MAP[id] || null;
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
   Normaler Pool je Kategorie/Seltenheit: 16 Farb-Items + Spezial-Items.
   Index = (Tag * Schrittweite + Offset) mod Poolgröße, Schrittweite teilerfremd
   zur Poolgröße -> jedes Item kommt frühestens nach (Poolgröße >= 16) Tagen wieder.
   Season-Items (nur in ihrer Season): Phase = (Tag + k) mod 15 in {0,5,10}
   -> frühestens nach 15 Tagen wieder; Slot 0 = Spezial-Item der Season, falls vorhanden.
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
        if (phase % 5 === 0) {
          const idx = phase / 5;
          const sp = SEASON_SPEC[season] && SEASON_SPEC[season][cat + rar];
          id = (idx === 0 && sp) ? sp : cat + ':' + rar + ':s:' + season + ':' + idx;
        }
      }
      if (!id) {
        const pool = [];
        for (let n = 0; n < 16; n++) pool.push(cat + ':' + rar + ':b:' + n);
        (SPEC_POOL[cat + rar] || []).forEach((x) => pool.push(x));
        const size = pool.length;
        let stride = [5, 7, 9, 11, 13][rar];
        while (gcd(stride, size) !== 1) stride++;
        const off = hash(cat + rar) % size;
        id = pool[(((D * stride + off) % size) + size) % size];
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
const lang = () => {
  const l = hooks.getLang && hooks.getLang();
  return TX[l] ? l : 'en';
};
const tt = () => TX[lang()];
const nm = (it) => it.name[lang()] || it.name.en;
const sName = (S) => S[lang()] || S.en;

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

function gearPts(cx, cy, r, n) {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const a = i / (n * 2) * Math.PI * 2, rr = i % 2 ? r * 0.78 : r;
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
  if (shape === 'ring') {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="2.6"/>' +
           '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.5) + '" fill="none" stroke="' + c + '" stroke-width="1.2" opacity=".6"/>';
  }
  if (shape === 'spark') {
    const a = r * 1.2, b = r * 0.3;
    return '<polygon points="' + x + ',' + (y - a) + ' ' + (x + b) + ',' + (y - b) + ' ' + (x + a) + ',' + y + ' ' + (x + b) + ',' + (y + b) + ' ' + x + ',' + (y + a) + ' ' + (x - b) + ',' + (y + b) + ' ' + (x - a) + ',' + y + ' ' + (x - b) + ',' + (y - b) + '" fill="' + c + '"/>';
  }
  if (shape === 'coin') {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 1.1) + '" fill="#ffd23a" stroke="#b8860b" stroke-width="1.4"/>' +
           '<text x="' + x + '" y="' + (y + r * 0.5) + '" text-anchor="middle" font-size="' + (r * 1.5) + '" font-weight="900" fill="#a56b00">$</text>';
  }
  if (shape === 'dollar') {
    return '<rect x="' + (x - r * 1.3) + '" y="' + (y - r * 0.75) + '" width="' + (r * 2.6) + '" height="' + (r * 1.5) + '" rx="1.5" fill="#5fd16a" stroke="#2a7a38" stroke-width="1.2"/>' +
           '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.45) + '" fill="#2a7a38" opacity=".6"/>';
  }
  if (shape === 'bolt') {
    return '<polygon points="' + (x + r * 0.2) + ',' + (y - r * 1.2) + ' ' + (x - r * 0.7) + ',' + (y + r * 0.1) + ' ' + (x - r * 0.05) + ',' + (y + r * 0.1) + ' ' + (x - r * 0.3) + ',' + (y + r * 1.2) + ' ' + (x + r * 0.8) + ',' + (y - r * 0.3) + ' ' + (x + r * 0.15) + ',' + (y - r * 0.3) + '" fill="' + c + '"/>';
  }
  if (shape === 'orb') {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 1.4) + '" fill="' + c + '" opacity=".3"/>' +
           '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.8) + '" fill="' + c + '" opacity=".7"/>' +
           '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.35) + '" fill="#fff"/>';
  }
  if (shape === 'blob') {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '"/>' +
           '<circle cx="' + (x - r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.3) + '" fill="#fff" opacity=".7"/>' +
           '<ellipse cx="' + (x + r * 0.1) + '" cy="' + (y + r * 1.3) + '" rx="' + (r * 0.25) + '" ry="' + (r * 0.45) + '" fill="' + c + '"/>';
  }
  if (shape === 'flake') {
    let s = '';
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      s += '<line x1="' + (x - Math.cos(a) * r * 1.2).toFixed(1) + '" y1="' + (y - Math.sin(a) * r * 1.2).toFixed(1) + '" x2="' + (x + Math.cos(a) * r * 1.2).toFixed(1) + '" y2="' + (y + Math.sin(a) * r * 1.2).toFixed(1) + '" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round"/>';
    }
    return s;
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

/* ---- U-Boot-Vorschau mit 3D-Anbauten (d = defs, u = hinter dem Rumpf, o = davor) ---- */
function subOverlay(v, id) {
  const k = v.kind;
  let d = '', u = '', o = '';
  if (k === 'shark') {
    u += '<path d="M50,30 Q56,14 80,4 Q72,18 88,30Z" fill="#26364f" stroke="#5be4ff" stroke-width="1.3"/>' +
         '<path d="M70,56 L98,76 L80,57Z" fill="#26364f" stroke="#5be4ff" stroke-width="1.1"/>';
    for (let i = 0; i < 3; i++) o += '<line x1="' + (90 + i * 4) + '" y1="38" x2="' + (87 + i * 4) + '" y2="51" stroke="#5be4ff" stroke-width="1.8"/>';
    [33, 38, 43, 48, 53].forEach((y) => {
      const x = 20 - Math.abs(y - 43) * 0.18;
      o += '<polygon points="' + x + ',' + (y - 2.6) + ' ' + (x - 7) + ',' + y + ' ' + x + ',' + (y + 2.6) + '" fill="#fff"/>';
    });
  } else if (k === 'kraken') {
    ['M44,58 Q36,74 24,72', 'M60,60 Q58,78 46,78', 'M84,60 Q92,76 104,72', 'M98,52 Q114,60 122,50', 'M104,40 Q118,34 126,42', 'M96,58 Q104,74 120,70'].forEach((p) => {
      u += '<path d="' + p + '" stroke="#ffc933" stroke-width="4.5" fill="none" stroke-linecap="round"/>';
    });
    o += '<polygon points="54,24 54,11 59,17 64,7 69,17 74,11 74,24" fill="#ffd23a" stroke="#b8860b" stroke-width="1"/>' +
         '<circle cx="64" cy="14" r="1.8" fill="#ff2a55"/>';
  } else if (k === 'ufo') {
    u += '<polygon points="30,50 98,50 122,80 6,80" fill="#58ff9c" opacity=".25"/>';
    o += '<ellipse cx="64" cy="47" rx="62" ry="9" fill="#2ee88a" stroke="#c8ffe0" stroke-width="1.5"/>' +
         '<ellipse cx="64" cy="66" rx="34" ry="5" fill="none" stroke="#58ff9c" stroke-width="2" stroke-dasharray="5 3"/>';
    for (let i = 0; i < 8; i++) o += '<circle cx="' + (12 + i * 15) + '" cy="' + (48 + (i % 2)) + '" r="1.8" fill="#fff"/>';
  } else if (k === 'lava') {
    for (let i = 0; i < 5; i++) u += '<polygon points="' + (70 + i * 9) + ',30 ' + (74 + i * 9) + ',' + (16 - i) + ' ' + (78 + i * 9) + ',30" fill="#ff5a14" stroke="#ffb347" stroke-width=".8"/>';
    u += '<circle cx="114" cy="44" r="10" fill="#ff5a14" opacity=".45"/>';
    o += '<path d="M32,32 Q18,14 38,2 Q32,14 44,28Z" fill="#ff7a1a" stroke="#ff3c00" stroke-width="1.2"/>' +
         '<circle cx="114" cy="44" r="5" fill="#ffd27a"/>';
  } else if (k === 'rgb') {
    d += '<linearGradient id="' + id + 'r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff3b3b"/><stop offset=".25" stop-color="#ffd23a"/><stop offset=".5" stop-color="#3bff7a"/><stop offset=".75" stop-color="#3b9bff"/><stop offset="1" stop-color="#d03bff"/></linearGradient>';
    o += '<rect x="24" y="43" width="82" height="4" rx="2" fill="url(#' + id + 'r)"/>' +
         '<rect x="104" y="12" width="24" height="5" rx="1" fill="url(#' + id + 'r)"/>' +
         '<rect x="108" y="17" width="2.5" height="12" fill="#222"/><rect x="120" y="17" width="2.5" height="12" fill="#222"/>';
    for (let i = 0; i < 4; i++) o += '<rect x="' + (34 + i * 20) + '" y="28" width="2" height="32" fill="url(#' + id + 'r)" opacity=".8"/>';
  } else if (k === 'steam') {
    o += '<polygon points="' + gearPts(44, 56, 10, 12) + '" fill="#d4a548" stroke="#6b3f22" stroke-width="1"/><circle cx="44" cy="56" r="3" fill="#6b3f22"/>' +
         '<polygon points="' + gearPts(63, 60, 7, 9) + '" fill="#b5651d" stroke="#6b3f22" stroke-width="1"/><circle cx="63" cy="60" r="2.2" fill="#6b3f22"/>' +
         '<polygon points="' + gearPts(96, 56, 11, 14) + '" fill="#d4a548" stroke="#6b3f22" stroke-width="1"/><circle cx="96" cy="56" r="3" fill="#6b3f22"/>' +
         '<rect x="88" y="8" width="7" height="20" rx="1.5" fill="#b5651d"/><rect x="86" y="6" width="11" height="3" fill="#d4a548"/>' +
         '<circle cx="93" cy="3" r="3.5" fill="#ccc" opacity=".6"/><circle cx="97" cy="-1" r="2.5" fill="#ccc" opacity=".4"/>';
  } else if (k === 'banana') {
    u += '<path d="M98,48 Q122,46 122,20 Q116,40 96,40Z" fill="#ffe135" stroke="#c9a800" stroke-width="1"/>' +
         '<circle cx="122" cy="20" r="2" fill="#5a3a1e"/>';
    o += '<path d="M30,50 Q4,48 12,16 Q8,44 34,42Z" fill="#ffe135" stroke="#c9a800" stroke-width="1.2"/>' +
         '<circle cx="12" cy="16" r="2.4" fill="#5a3a1e"/>';
  } else if (k === 'pizza') {
    u += '<polygon points="44,5 84,5 64,32" fill="#ffc43d" stroke="#e08a00" stroke-width="1"/>' +
         '<rect x="42" y="0" width="44" height="6" rx="3" fill="#b5651d"/>' +
         '<circle cx="56" cy="12" r="3.8" fill="#d62839"/><circle cx="72" cy="12" r="3.8" fill="#d62839"/><circle cx="64" cy="21" r="3.8" fill="#d62839"/>' +
         '<circle cx="64" cy="11" r="1.6" fill="#222"/>';
  } else if (k === 'santa') {
    u += '<path d="M16,56 Q16,76 40,76 L104,76 Q118,76 122,62" stroke="#ffd23a" stroke-width="3.4" fill="none" stroke-linecap="round"/>';
    [40, 64, 88].forEach((x) => { u += '<line x1="' + x + '" y1="76" x2="' + x + '" y2="60" stroke="#ffd23a" stroke-width="2"/>'; });
    o += '<path d="M32,30 Q26,12 36,4 M29,19 Q19,16 17,8 M33,13 Q41,9 43,2" stroke="#6b3f22" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
         '<circle cx="17" cy="53" r="9" fill="#ff2a2a" opacity=".4"/><circle cx="17" cy="53" r="4.6" fill="#ff3b3b"/>' +
         '<ellipse cx="88" cy="24" rx="11" ry="9" fill="#8b1a1a"/><circle cx="88" cy="14" r="2.6" fill="#ffd23a"/>';
  }
  return { d, u, o };
}

function svgSub(v) {
  const id = 'sg' + (uid++);
  const ov = subOverlay(v, id);
  const glow = v.glow ? '<ellipse cx="64" cy="44" rx="54" ry="24" fill="' + v.glow + '" opacity=".35" filter="url(#' + id + 'b)"/>' : '';
  return '<svg viewBox="0 0 130 80"><defs>' +
    '<linearGradient id="' + id + 'h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + shade(v.hull, 0.12) + '"/><stop offset=".55" stop-color="' + v.hull + '"/><stop offset="1" stop-color="' + shade(v.hull, -0.28) + '"/></linearGradient>' +
    '<filter id="' + id + 'b"><feGaussianBlur stdDeviation="5"/></filter>' +
    '<clipPath id="' + id + 'c"><ellipse cx="64" cy="44" rx="46" ry="17"/></clipPath>' + ov.d + '</defs>' +
    glow + ov.u +
    '<polygon points="104,44 120,28 120,60" fill="' + v.plain + '"/>' +
    '<rect x="119" y="34" width="3" height="20" rx="1.5" fill="' + v.accent + '"/>' +
    '<rect x="62" y="22" width="11" height="10" rx="3" fill="' + v.plain + '"/>' +
    '<ellipse cx="64" cy="44" rx="46" ry="17" fill="url(#' + id + 'h)"/>' +
    '<g clip-path="url(#' + id + 'c)"><rect x="56" y="20" width="6" height="50" fill="' + v.accent + '"/><rect x="82" y="20" width="6" height="50" fill="' + v.accent + '"/></g>' +
    '<ellipse cx="33" cy="40" rx="15" ry="11" fill="#bfeaff" opacity=".6" stroke="' + v.accent + '" stroke-width="1.5"/>' +
    '<circle cx="68" cy="47" r="3" fill="#0d2a3a"/><circle cx="76" cy="47" r="3" fill="#0d2a3a"/><circle cx="94" cy="46" r="3" fill="#0d2a3a"/>' +
    ov.o + '</svg>';
}

function layersOf(v) {
  return v.layers || [{ shape: v.shape, color: v.color, rainbow: v.rainbow, size: v.size, rate: v.rate }];
}

function svgBub(v) {
  const L = layersOf(v);
  let s = '<svg viewBox="0 0 120 80"><rect x="4" y="36" width="10" height="14" rx="2" fill="#6b7a86"/>';
  for (let i = 0; i < 7; i++) {
    const x = 22 + i * 14, y = 44 - Math.sin(i * 0.9) * 14, r = 3 + i * 0.9;
    const def = L[i % L.length];
    const shape = def.mesh === 'coins' ? (i % 2 ? 'dollar' : 'coin') : def.shape;
    const col = def.rainbow ? hsl(i * 52, 0.9, 0.62) : (i % 2 ? shade(def.color || '#cfefff', 0.1) : (def.color || '#cfefff'));
    s += shapeSvg(shape, x, y, r, col);
  }
  return s + '</svg>';
}

function svgCap(v) {
  const skin = v.skin || '#ffc9a3';
  const k = v.kind || '';
  let s = '<svg viewBox="0 0 100 100">' +
    '<rect x="34" y="80" width="13" height="14" rx="4" fill="' + v.pants + '"/><rect x="53" y="80" width="13" height="14" rx="4" fill="' + v.pants + '"/>' +
    '<rect x="30" y="52" width="40" height="34" rx="16" fill="' + v.jacket + '"/>' +
    '<circle cx="50" cy="64" r="2" fill="' + v.trim + '"/><circle cx="50" cy="73" r="2" fill="' + v.trim + '"/>' +
    '<circle cx="50" cy="40" r="17" fill="' + skin + '"/>' +
    '<circle cx="43" cy="39" r="4.5" fill="#fff"/><circle cx="57" cy="39" r="4.5" fill="#fff"/>' +
    '<circle cx="43" cy="40" r="2" fill="#111"/><circle cx="57" cy="40" r="2" fill="#111"/>' +
    '<ellipse cx="50" cy="52" rx="7" ry="6" fill="#fff"/>' +
    '<circle cx="50" cy="45" r="3.5" fill="#f08a7a"/>';
  if (!k) {
    s += '<path d="M34 24 Q50 4 66 24Z" fill="#fff"/>' +
         '<rect x="32" y="22" width="36" height="8" rx="3" fill="' + v.cap + '"/>' +
         '<rect x="32" y="27" width="36" height="2" fill="' + v.trim + '"/>' +
         '<ellipse cx="50" cy="31" rx="20" ry="3.5" fill="#111"/>';
  } else if (k === 'king') {
    s += '<polygon points="33,28 33,10 41,19 50,5 59,19 67,10 67,28" fill="#ffd23a" stroke="#b8860b" stroke-width="1.2"/>' +
         '<circle cx="50" cy="9" r="2.2" fill="#ff2a55"/><circle cx="36" cy="14" r="1.8" fill="#3aa0ff"/><circle cx="64" cy="14" r="1.8" fill="#3aa0ff"/>' +
         '<rect x="33" y="24" width="34" height="4" fill="#e0b020"/>';
  } else if (k === 'pirate') {
    s += '<polygon points="22,30 78,30 50,4" fill="#15131a"/><polygon points="26,30 74,30 50,10" fill="#22202b"/>' +
         '<rect x="28" y="27" width="44" height="3" fill="#e2b13c"/>' +
         '<circle cx="50" cy="20" r="3.4" fill="#fff"/><line x1="44" y1="25" x2="56" y2="17" stroke="#fff" stroke-width="1.6"/><line x1="44" y1="17" x2="56" y2="25" stroke="#fff" stroke-width="1.6"/>';
  } else if (k === 'astro') {
    s += '<circle cx="50" cy="40" r="25" fill="rgba(190,235,255,.22)" stroke="#fff" stroke-width="2"/>' +
         '<path d="M33,30 Q50,18 67,30" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>' +
         '<rect x="32" y="56" width="36" height="6" rx="3" fill="#e8eef4" stroke="#9aa6b2"/>' +
         '<line x1="62" y1="17" x2="68" y2="6" stroke="#9aa6b2" stroke-width="1.6"/><circle cx="68" cy="6" r="2.6" fill="#ff3b3b"/>';
  } else if (k === 'alien') {
    s += '<line x1="42" y1="25" x2="34" y2="7" stroke="#6bd04f" stroke-width="2.4"/><circle cx="34" cy="7" r="4" fill="#9dff7a"/>' +
         '<line x1="58" y1="25" x2="66" y2="7" stroke="#6bd04f" stroke-width="2.4"/><circle cx="66" cy="7" r="4" fill="#9dff7a"/>';
  } else if (k === 'cyber') {
    s += '<rect x="31" y="33" width="38" height="10" rx="5" fill="#19e6ff" opacity=".85" stroke="#fff" stroke-width="1"/>' +
         '<rect x="26" y="34" width="6" height="12" rx="2" fill="#141a26" stroke="#19e6ff"/><rect x="68" y="34" width="6" height="12" rx="2" fill="#141a26" stroke="#19e6ff"/>' +
         '<line x1="36" y1="38" x2="64" y2="38" stroke="#fff" stroke-width="1" opacity=".7"/>';
  } else if (k === 'santa') {
    s += '<path d="M33,28 Q38,6 68,14 Q72,22 67,28Z" fill="#c8222f"/>' +
         '<rect x="31" y="25" width="38" height="6" rx="3" fill="#fff"/><circle cx="69" cy="14" r="5" fill="#fff"/>';
  }
  return s + '</svg>';
}

function svgTou(v) {
  const tints = v.previewTints;
  const k = v.kind || '';
  let s = '<svg viewBox="0 0 120 90">';
  [24, 60, 96].forEach((x, i) => {
    const headY = 42, r = 11;
    const peng = k === 'polar' && i % 2 === 1;
    let bodyC = tints[i], headC = '#ffc9a3';
    if (k === 'alien') headC = '#7be26a';
    if (k === 'skeleton') headC = '#e8e3cf';
    if (k === 'polar') { bodyC = peng ? '#232a36' : '#f4f8fc'; headC = peng ? '#232a36' : '#f7fbff'; }
    s += '<rect x="' + (x - 13) + '" y="52" width="26" height="30" rx="12" fill="' + bodyC + '"/>';
    if (peng) s += '<ellipse cx="' + x + '" cy="66" rx="8" ry="12" fill="#fff"/>';
    s += '<circle cx="' + x + '" cy="' + headY + '" r="' + r + '" fill="' + headC + '"' + (k === 'astro' ? '' : '') + '/>';
    if (k === 'alien') {
      s += '<ellipse cx="' + (x - 4) + '" cy="' + (headY - 1) + '" rx="3.2" ry="4.4" fill="#111"/><ellipse cx="' + (x + 4) + '" cy="' + (headY - 1) + '" rx="3.2" ry="4.4" fill="#111"/>';
      s += '<line x1="' + (x - 5) + '" y1="' + (headY - 9) + '" x2="' + (x - 9) + '" y2="' + (headY - 20) + '" stroke="#6bd04f" stroke-width="1.6"/><circle cx="' + (x - 9) + '" cy="' + (headY - 20) + '" r="2.6" fill="#9dff7a"/>';
      s += '<line x1="' + (x + 5) + '" y1="' + (headY - 9) + '" x2="' + (x + 9) + '" y2="' + (headY - 20) + '" stroke="#6bd04f" stroke-width="1.6"/><circle cx="' + (x + 9) + '" cy="' + (headY - 20) + '" r="2.6" fill="#9dff7a"/>';
    } else if (k === 'skeleton') {
      s += '<circle cx="' + (x - 4) + '" cy="' + (headY - 1) + '" r="3" fill="#111"/><circle cx="' + (x + 4) + '" cy="' + (headY - 1) + '" r="3" fill="#111"/>';
      s += '<line x1="' + (x - 4) + '" y1="' + (headY + 6) + '" x2="' + (x + 4) + '" y2="' + (headY + 6) + '" stroke="#111" stroke-width="1.4" stroke-dasharray="1.6 1.4"/>';
      s += '<polygon points="' + (x - 14) + ',' + (headY - 6) + ' ' + (x + 14) + ',' + (headY - 6) + ' ' + x + ',' + (headY - 22) + '" fill="#15131a"/><rect x="' + (x - 11) + '" y="' + (headY - 8) + '" width="22" height="2" fill="#e2b13c"/>';
    } else if (k === 'astro') {
      s += '<circle cx="' + (x - 4) + '" cy="' + (headY - 1) + '" r="1.8" fill="#111"/><circle cx="' + (x + 4) + '" cy="' + (headY - 1) + '" r="1.8" fill="#111"/>';
      s += '<circle cx="' + x + '" cy="' + headY + '" r="' + (r + 4) + '" fill="rgba(190,235,255,.25)" stroke="#fff" stroke-width="1.6"/>';
      s += '<path d="M' + (x - 9) + ' ' + (headY - 3) + ' Q' + x + ' ' + (headY - 8) + ' ' + (x + 9) + ' ' + (headY - 3) + ' L' + (x + 8) + ' ' + (headY + 4) + ' Q' + x + ' ' + (headY + 8) + ' ' + (x - 8) + ' ' + (headY + 4) + 'Z" fill="#ffc933" opacity=".45"/>';
    } else if (k === 'polar') {
      if (peng) {
        s += '<ellipse cx="' + x + '" cy="' + (headY + 2) + '" rx="7.5" ry="7" fill="#fff"/>';
        s += '<circle cx="' + (x - 3) + '" cy="' + (headY - 1) + '" r="1.5" fill="#111"/><circle cx="' + (x + 3) + '" cy="' + (headY - 1) + '" r="1.5" fill="#111"/>';
        s += '<polygon points="' + (x - 3) + ',' + (headY + 3) + ' ' + (x + 3) + ',' + (headY + 3) + ' ' + x + ',' + (headY + 8) + '" fill="#ff8a2a"/>';
      } else {
        s += '<circle cx="' + (x - 3.5) + '" cy="' + (headY - 2) + '" r="1.5" fill="#111"/><circle cx="' + (x + 3.5) + '" cy="' + (headY - 2) + '" r="1.5" fill="#111"/>';
        s += '<polygon points="' + x + ',' + (headY + 1) + ' ' + (x + 9) + ',' + (headY + 3) + ' ' + x + ',' + (headY + 4) + '" fill="#ff8a2a"/>';
        s += '<rect x="' + (x - 11) + '" y="50" width="22" height="4" rx="2" fill="#c8222f"/>';
        s += '<rect x="' + (x - 7) + '" y="' + (headY - 22) + '" width="14" height="13" fill="#15131a"/><rect x="' + (x - 11) + '" y="' + (headY - 10) + '" width="22" height="3" fill="#15131a"/><rect x="' + (x - 7) + '" y="' + (headY - 13) + '" width="14" height="2.5" fill="#c8222f"/>';
      }
    } else {
      s += '<circle cx="' + (x - 4) + '" cy="' + (headY - 1) + '" r="1.8" fill="#111"/><circle cx="' + (x + 4) + '" cy="' + (headY - 1) + '" r="1.8" fill="#111"/>';
      s += hatSvg(v.hat, x, headY - r + 3, r * 0.95, v.hatColor);
    }
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
.sh-prev svg{width:100%;height:100%;overflow:visible}
.sh-name{font:800 12px/1.2 var(--mono,monospace);min-height:2.4em;display:flex;align-items:center;justify-content:center;text-shadow:0 1px 4px rgba(0,0,0,.6)}
.sh-price{font:700 11px var(--mono,monospace);background:rgba(0,0,0,.35);padding:3px 4px;letter-spacing:.06em}
.sh-card.owned .sh-price{color:var(--ok,#5dffb0)}
.sh-card.eq .sh-price{background:var(--ok,#5dffb0);color:#031;font-weight:900}
.sh-rar{position:absolute;left:5px;top:5px;font:800 8px var(--mono,monospace);letter-spacing:.1em;background:rgba(0,0,0,.5);padding:2px 5px;text-transform:uppercase}
.sh-tag{position:absolute;right:5px;top:3px;font-size:14px}
.sh-3d{position:absolute;right:5px;bottom:34px;font:900 9px var(--mono,monospace);letter-spacing:.1em;background:var(--cy,#19e6ff);color:#012;padding:1px 5px;border-radius:2px;box-shadow:0 0 8px rgba(25,230,255,.7)}
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
.sh-mprev svg{width:100%;height:150px;overflow:visible}
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
 .sh-cat{font-size:10px;padding:12px 2px}.sh-rar{display:none}.sh-3d{bottom:28px}
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
  const d3 = it.special ? '<span class="sh-3d">3D</span>' : '';
  return '<button type="button" class="sh-card r' + it.rar + (owned ? ' owned' : '') + (mode === 'locker' && eq ? ' eq' : '') + '" data-id="' + it.id + '">' +
    '<span class="sh-rar">' + t.rar[it.rar] + '</span>' + tag +
    '<div class="sh-prev">' + previewSvg(it) + '</div>' + d3 +
    '<div class="sh-name">' + nm(it) + '</div>' +
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
    '<div class="sh-ban-l"><span class="sh-ban-ic">' + S.icon + '</span><div><div class="sh-ban-t">' + sName(S) + '</div>' +
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
  list.sort((a, b) => b.rar - a.rar || nm(a).localeCompare(nm(b)));
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
    '<div class="sh-mname">' + nm(it) + '</div>' +
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
  toast(tt().bought(nm(it)));
}

function equip(id) {
  const it = getItem(id);
  if (!isOwned(id)) return;
  state.equipped[it.cat] = id;
  saveState();
  if (hooks.onEquipChange) { try { hooks.onEquipChange(); } catch (e) { console.error('[Shop]', e); } }
  render();
  toast(tt().nowEquipped(nm(it)));
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

/* ============================================================
   3D-Skins im Spiel
   ============================================================ */
const subDefaults = new WeakMap();
const cur = { sub: null, shimmer: false, fxTime: 0, skin: null, accs: [], touAcc: [], tree: null };
let fx = null;                // { sub, layers[] }
let dockOverride = null;
const _tmp = new THREE.Vector3();
const _back = new THREE.Vector3();
const _col = new THREE.Color();

/* ---- Material- und Geometrie-Helfer ---- */
const mat = (color, o) => {
  o = o || {};
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.r !== undefined ? o.r : 0.4,
    metalness: o.m !== undefined ? o.m : 0.3,
    emissive: o.e !== undefined ? o.e : 0x000000,
    emissiveIntensity: o.ei || 0,
    side: o.side || THREE.FrontSide,
    transparent: !!o.t,
    opacity: o.op !== undefined ? o.op : 1
  });
};
const glowMat = (color, op) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: DS
});
const put = (parent, geo, m, x, y, z) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x || 0, y || 0, z || 0);
  parent.add(o);
  return o;
};

function extr(fn, depth) {
  const s = new THREE.Shape();
  fn(s);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 14 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/* Röhre mit variablem Radius entlang einer Kurve (rFn(t) = Radius 0..1) */
function tubeTaper(pts, rFn, segs, rad) {
  segs = segs || 24; rad = rad || 8;
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segs, 1, rad, false);
  const p = geo.attributes.position;
  const ctr = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, ctr);
    const r = rFn(i / segs);
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      v.fromBufferAttribute(p, k).sub(ctr).multiplyScalar(r).add(ctr);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function gearGeo(r, teeth, depth) {
  const s = new THREE.Shape();
  const ro = r * 1.18, w = Math.PI * 2 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * w;
    const seq = [[0, r], [0.25, r], [0.35, ro], [0.65, ro], [0.75, r]];
    seq.forEach((q, j) => {
      const a = a0 + q[0] * w;
      const x = Math.cos(a) * q[1], y = Math.sin(a) * q[1];
      if (i === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.32, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function makeCrown(r, h, n, gold, gem) {
  const g = new THREE.Group();
  put(g, new THREE.CylinderGeometry(r, r * 0.92, h * 0.42, 24, 1, true), gold, 0, h * 0.21, 0);
  const ring = put(g, new THREE.TorusGeometry(r, r * 0.05, 6, 24), gold, 0, h * 0.04, 0);
  ring.rotation.x = Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    put(g, new THREE.ConeGeometry(r * 0.2, h * 0.62, 6), gold, Math.cos(a) * r, h * 0.73, Math.sin(a) * r);
    put(g, new THREE.SphereGeometry(r * 0.12, 8, 6), gem, Math.cos(a) * r, h * 1.06, Math.sin(a) * r);
    put(g, new THREE.SphereGeometry(r * 0.09, 8, 6), gem, Math.cos(a + Math.PI / n) * r, h * 0.2, Math.sin(a + Math.PI / n) * r);
  }
  return g;
}

function disposeObj(o) {
  o.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}

/* ============================================================
   U-BOOT-SKINS: Anbauten + Animationen
   Lokale Koordinaten: vorwärts = -Z, rechts = +X, oben = +Y, Rumpfmitte = (0,0,0)
   Jede Funktion baut in Gruppe g und gibt update(dt, t) zurück.
   ============================================================ */
const SKINS = {

  /* ---------- Cyber-Shark ---------- */
  shark(g) {
    const body = mat('#1d2c47', { m: 0.8, r: 0.22, e: 0x0a4a7a, ei: 0.5, side: DS });
    const cyan = new THREE.LineBasicMaterial({ color: 0x5be4ff });
    const finShape = (s) => {
      s.moveTo(0, 0); s.quadraticCurveTo(0.7, 1.7, 2.6, 3.2); s.quadraticCurveTo(2.3, 1.5, 3.4, 0); s.lineTo(0, 0);
    };
    const mkFin = (scale, z, y) => {
      const geo = extr(finShape, 0.26);
      const m = put(g, geo, body, 0, y, z);
      m.rotation.y = -Math.PI / 2;
      m.scale.set(scale, scale, 1);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), cyan));
      return m;
    };
    mkFin(1, 4.3, 2.4);
    mkFin(0.55, 9.0, 2.4);

    const gillM = mat('#0a2a3a', { e: 0x5be4ff, ei: 1.3, r: 0.3 });
    [-1, 1].forEach((side) => {
      const pw = new THREE.Group();
      pw.position.set(side * 2.45, -0.95, 6.0);
      pw.rotation.z = -side * 0.4;
      g.add(pw);
      const geo = extr((s) => { s.moveTo(0, 0.7); s.lineTo(2.4, -1.7); s.lineTo(0.1, -0.5); s.lineTo(0, 0.7); }, 0.12);
      const m = put(pw, geo, body, 0, 0, 0);
      m.rotation.x = -Math.PI / 2;
      m.scale.x = side;
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), cyan));
      for (let k = 0; k < 3; k++) {
        const gl = put(g, new THREE.BoxGeometry(0.06, 0.8, 0.16), gillM, side * 2.69, 0.05, 6.3 + k * 0.38);
        gl.rotation.z = side * 0.35;
      }
    });

    const jaw = new THREE.Group();
    g.add(jaw);
    const toothM = mat('#ffffff', { r: 0.2, m: 0.1, e: 0xffffff, ei: 0.9 });
    const R = 2.65, ty = -1.15;
    for (let i = 0; i < 11; i++) {
      const x = (i - 5) * 0.34;
      const zs = -2 - 4.6 * Math.sqrt(Math.max(0, 1 - (x * x + ty * ty) / (R * R)));
      const tooth = put(jaw, new THREE.ConeGeometry(0.13, 0.55, 8), toothM, x, ty, zs - 0.1);
      tooth.rotation.x = -Math.PI / 2;
    }
    return (dt, t) => {
      jaw.position.z = Math.sin(t * 3) * 0.06;
      toothM.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 4);
      body.emissiveIntensity = 0.4 + 0.25 * Math.sin(t * 2);
      gillM.emissiveIntensity = 1.0 + 0.6 * Math.sin(t * 5);
    };
  },

  /* ---------- Golden Kraken ---------- */
  kraken(g) {
    const gold = mat('#ffc933', { m: 0.9, r: 0.2, e: 0xff9a00, ei: 0.35, side: DS });
    const defs = [
      [-2.3, -1.0, 5.5, -1, -0.4, 0.5], [2.3, -1.0, 5.5, 1, -0.4, 0.5],
      [-2.3, -0.8, 9.5, -1, -0.3, 0.8], [2.3, -0.8, 9.5, 1, -0.3, 0.8],
      [-0.9, -0.3, 12.6, -0.5, -0.1, 1], [0.9, -0.3, 12.6, 0.5, -0.1, 1]
    ];
    const tents = defs.map((d, k) => {
      const rt = new THREE.Group();
      rt.position.set(d[0], d[1], d[2]);
      rt.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(d[3], d[4], d[5]).normalize());
      g.add(rt);
      const segs = [];
      let parent = rt;
      const N = 8, L = 1.15, r0 = 0.36;
      for (let i = 0; i < N; i++) {
        const r = r0 * (1 - i / N * 0.86) + 0.04;
        const s = new THREE.Group();
        s.position.z = i ? L : 0;
        parent.add(s);
        const geo = new THREE.CylinderGeometry(r * 0.84, r, L, 10);
        geo.rotateX(Math.PI / 2);
        geo.translate(0, 0, L / 2);
        s.add(new THREE.Mesh(geo, gold));
        s.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 10, 8), gold));
        segs.push(s);
        parent = s;
      }
      return { segs, ph: k * 1.3 };
    });
    const gem = mat('#ff3355', { e: 0xff2244, ei: 0.8, r: 0.1 });
    const crown = makeCrown(0.8, 0.9, 7, gold, gem);
    crown.position.set(0, 3.3, 2.4);
    g.add(crown);
    return (dt, t) => {
      tents.forEach((T) => T.segs.forEach((s, i) => {
        s.rotation.y = Math.sin(t * 1.7 - i * 0.6 + T.ph) * (0.1 + 0.035 * i);
        s.rotation.x = Math.cos(t * 1.4 - i * 0.5 + T.ph) * (0.08 + 0.03 * i) + 0.04 * i;
      }));
      crown.rotation.y = t * 0.8;
      crown.position.y = 3.3 + Math.sin(t * 2) * 0.05;
      gold.emissiveIntensity = 0.3 + 0.12 * Math.sin(t * 2.5);
    };
  },

  /* ---------- UFO / Alien Saucer ---------- */
  ufo(g) {
    const metal = mat('#3cff9a', { m: 0.9, r: 0.18, e: 0x14c86a, ei: 0.55, side: DS });
    const prof = [[2.75, -0.25], [4.2, -0.35], [6.4, -0.25], [7.6, -0.02], [7.9, 0.12], [7.6, 0.28], [6, 0.5], [3.6, 0.78], [2.75, 0.7]]
      .map((p) => new THREE.Vector2(p[0], p[1]));
    put(g, new THREE.LatheGeometry(prof, 64), metal, 0, -0.3, 5.2);
    const rim = new THREE.Group();
    rim.position.set(0, -0.3, 5.2);
    g.add(rim);
    const lamps = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      const m = new THREE.MeshBasicMaterial({ color: 0x7dffb4 });
      put(rim, new THREE.SphereGeometry(0.2, 8, 6), m, Math.cos(a) * 7.7, 0.08, Math.sin(a) * 7.7);
      lamps.push(m);
    }
    const beamMat = glowMat(0x58ff9c, 0.14);
    put(g, new THREE.CylinderGeometry(4.6, 2.0, 5.2, 40, 1, true), beamMat, 0, -3.2, 5.2);
    const dashGroup = new THREE.Group();
    dashGroup.position.set(0, -2.9, 5.2);
    g.add(dashGroup);
    const dashM = mat('#1a4a2a', { e: 0x58ff9c, ei: 1.6, r: 0.3 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const b = put(dashGroup, new THREE.BoxGeometry(0.7, 0.14, 0.16), dashM, Math.cos(a) * 3.3, 0, Math.sin(a) * 3.3);
      b.rotation.y = -a + Math.PI / 2;
    }
    const baseRing = put(dashGroup, new THREE.TorusGeometry(3.3, 0.06, 6, 48), glowMat(0x9dffc8, 0.7), 0, 0, 0);
    baseRing.rotation.x = Math.PI / 2;
    const pulses = [];
    for (let i = 0; i < 3; i++) {
      const pm = glowMat(0x7dffb4, 0.6);
      const r = put(g, new THREE.TorusGeometry(3.3, 0.07, 6, 48), pm, 0, -1, 5.2);
      r.rotation.x = Math.PI / 2;
      pulses.push({ r, pm, i });
    }
    return (dt, t) => {
      dashGroup.rotation.y = t * 1.5;
      rim.rotation.y = -t * 0.8;
      lamps.forEach((m, i) => { m.color.set(Math.floor(t * 6 + i) % 3 === 0 ? 0xffffff : 0x3cff9a); });
      pulses.forEach((p) => {
        const u = (t * 0.7 + p.i / 3) % 1;
        p.r.position.y = -0.8 - u * 4.4;
        const s = (4.5 - 2.5 * u) / 3.3;
        p.r.scale.set(s, s, s);
        p.pm.opacity = 0.7 * (1 - u);
      });
      beamMat.opacity = 0.12 + 0.05 * Math.sin(t * 4);
      metal.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 2);
    };
  },

  /* ---------- Lava-Dragon ---------- */
  lava(g, sub) {
    const horn = mat('#2a1008', { m: 0.5, r: 0.35, e: 0xff4a00, ei: 0.9, side: DS });
    const hornGeo = tubeTaper([V3(1.3, 1.5, -4.3), V3(1.55, 2.4, -4.8), V3(1.45, 3.1, -5.7), V3(1.1, 3.5, -6.7)], (t) => 0.36 * (1 - t) + 0.025, 24, 10);
    [1, -1].forEach((s) => { const h = put(g, hornGeo, horn); h.scale.x = s; });
    const spikeM = mat('#3a1408', { m: 0.4, r: 0.4, e: 0xff5a14, ei: 1.0 });
    const spikes = [];
    [0.3, 3.8, 4.9, 6.0, 7.1, 8.2, 9.3, 10.4, 11.5].forEach((z, i) => {
      const h = 1.3 - i * 0.07;
      const sp = put(g, new THREE.ConeGeometry(0.32 - i * 0.012, h, 8), spikeM, 0, 2.55 + h / 2, z);
      sp.rotation.x = 0.25;
      spikes.push({ sp, i });
    });
    const coreM = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    const core = put(g, new THREE.SphereGeometry(0.85, 16, 12), coreM, 0, 0.2, 13.0);
    const light = new THREE.PointLight(0xff5a1a, 40, 10, 2);
    light.position.set(0, 0.3, 13.4);
    g.add(light);
    const veinM = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
    [-1, 1].forEach((s) => put(g, new THREE.BoxGeometry(0.08, 0.1, 10), veinM, s * 2.62, -0.7, 6.2));
    return (dt, t) => {
      const p = 0.5 + 0.5 * Math.sin(t * 2.2);
      horn.emissiveIntensity = 0.6 + 0.6 * p;
      spikeM.emissiveIntensity = 0.7 + 0.5 * p;
      spikes.forEach((s) => { s.sp.scale.y = 1 + 0.12 * Math.sin(t * 6 + s.i); });
      core.scale.setScalar(0.9 + 0.22 * p);
      coreM.color.setRGB(1, 0.35 + 0.3 * p, 0.05);
      light.intensity = 28 + 24 * p;
      veinM.color.setRGB(1, 0.25 + 0.3 * p, 0.05);
      if (sub && sub.materials) sub.materials.hull.emissiveIntensity = 0.25 + 0.4 * p;
    };
  },

  /* ---------- RGB-Gamer-Sub ---------- */
  rgb(g, sub) {
    const M = sub.materials;
    const neon = [];
    const mk = (off) => { const m = new THREE.MeshBasicMaterial({ color: 0xffffff }); neon.push({ m, off }); return m; };
    [0.6, 4.4, 7.3, 10.2, 12.1].forEach((z, i) => {
      put(g, new THREE.TorusGeometry(2.69, 0.035, 6, 72), mk(i * 0.12), 0, 0, z);
    });
    [-1, 1].forEach((s, i) => {
      put(g, new THREE.BoxGeometry(0.06, 0.06, 11), mk(0.3 + i * 0.2), s * 2.5, -0.91, 6.2);
      put(g, new THREE.BoxGeometry(0.08, 0.06, 10), mk(0.5 + i * 0.2), s * 0.6, -2.66, 6.5);
    });
    const dark = mat('#14161e', { m: 0.7, r: 0.3, side: DS });
    const wingM = mat('#1b1f2a', { m: 0.7, r: 0.25, e: 0xffffff, ei: 0.25, side: DS });
    [-1, 1].forEach((s) => {
      put(g, new THREE.BoxGeometry(0.1, 1.3, 0.2), dark, s * 1.6, 2.1, 12.3);
      put(g, new THREE.BoxGeometry(0.1, 1.0, 1.7), wingM, s * 2.8, 2.6, 12.3);
    });
    const wing = put(g, new THREE.BoxGeometry(5.6, 0.14, 1.5), wingM, 0, 2.8, 12.3);
    wing.rotation.x = 0.12;
    put(g, new THREE.BoxGeometry(5.6, 0.05, 0.1), mk(0.0), 0, 2.88, 11.55);
    put(g, new THREE.BoxGeometry(5.6, 0.05, 0.1), mk(0.5), 0, 2.78, 13.05);
    return (dt, t) => {
      const hue = (t * 0.3) % 1;
      neon.forEach((n) => n.m.color.setHSL((hue + n.off) % 1, 1, 0.55));
      wingM.emissive.setHSL((hue + 0.2) % 1, 1, 0.5);
      if (M) {
        M.orange.color.setHSL(hue, 1, 0.5);
        M.teal.color.setHSL((hue + 0.5) % 1, 0.9, 0.4);
        M.cyanGlow.emissive.setHSL((hue + 0.2) % 1, 1, 0.55);
        M.cyanGlow.color.setHSL((hue + 0.2) % 1, 1, 0.12);
        M.led.emissive.setHSL((hue + 0.4) % 1, 1, 0.6);
        M.led.color.setHSL((hue + 0.4) % 1, 0.8, 0.8);
        M.hull.emissive.setHSL(hue, 1, 0.5);
        M.hull.emissiveIntensity = 0.22 + 0.1 * Math.sin(t * 3);
      }
    };
  },

  /* ---------- Steampunk-Nautilus ---------- */
  steam(g) {
    const brass = mat('#d4a548', { m: 0.9, r: 0.28, side: DS });
    const copper = mat('#b5651d', { m: 0.85, r: 0.3, side: DS });
    const dark = mat('#3a2a1a', { m: 0.6, r: 0.5 });
    const gears = [];
    const defs = [[2.9, 1.0, 16, 1], [4.5, 0.72, 11, -16 / 11], [10.2, 1.2, 18, 0.6]];
    [-1, 1].forEach((side) => defs.forEach((d, i) => {
      const w = new THREE.Group();
      w.position.set(side * 2.5, -1.25, d[0]);
      w.rotation.y = Math.PI / 2;
      g.add(w);
      const gear = put(w, gearGeo(d[1], d[2], 0.24), i === 1 ? copper : brass);
      put(w, new THREE.CylinderGeometry(0.22, 0.22, 0.4, 14).rotateX(Math.PI / 2), copper);
      gears.push({ gear, k: d[3] * side });
      const axle = new THREE.CylinderGeometry(0.1, 0.1, 0.9, 10);
      axle.rotateZ(Math.PI / 2);
      put(g, axle, dark, side * 2.1, -1.25, d[0]);
    }));
    const topW = new THREE.Group();
    topW.position.set(-1.2, 2.55, 8.0);
    topW.rotation.x = -Math.PI / 2;
    g.add(topW);
    const topGear = put(topW, gearGeo(0.9, 14, 0.22), brass);
    [-1, 1].forEach((s) => {
      const pg = new THREE.CylinderGeometry(0.13, 0.13, 7.5, 12);
      pg.rotateX(Math.PI / 2);
      put(g, pg, copper, s * 1.0, 2.62, 7.75);
      [5, 7, 9, 11].forEach((z) => put(g, new THREE.TorusGeometry(0.2, 0.05, 6, 14), brass, s * 1.0, 2.62, z));
    });
    [1.3, 4.3, 7.3, 10.3].forEach((z) => put(g, new THREE.TorusGeometry(2.69, 0.05, 6, 72), brass, 0, 0, z));
    put(g, new THREE.CylinderGeometry(0.24, 0.28, 1.6, 14), copper, 1.3, 3.0, 6.0);
    const topRing = put(g, new THREE.TorusGeometry(0.26, 0.05, 6, 16), brass, 1.3, 3.8, 6.0);
    topRing.rotation.x = Math.PI / 2;
    const puffs = [];
    for (let i = 0; i < 7; i++) {
      const pm = new THREE.MeshBasicMaterial({ color: 0xcfcfcf, transparent: true, opacity: 0.4, depthWrite: false });
      puffs.push({ m: put(g, new THREE.SphereGeometry(0.28, 10, 8), pm, 1.3, 4, 6), pm, i });
    }
    return (dt, t) => {
      gears.forEach((G) => { G.gear.rotation.z = t * 0.8 * G.k; });
      topGear.rotation.z = -t * 0.9;
      puffs.forEach((p) => {
        const u = (t * 0.35 + p.i / 7) % 1;
        p.m.position.set(1.3 + Math.sin(u * 6 + p.i) * 0.2, 3.9 + u * 3.2, 6.0 + u * 1.2);
        p.m.scale.setScalar(0.5 + u * 1.6);
        p.pm.opacity = 0.5 * (1 - u);
      });
    };
  },

  /* ---------- Banana-Boat ---------- */
  banana(g) {
    const peel = mat('#ffe135', { r: 0.5, m: 0.05, e: 0xffb300, ei: 0.15, side: DS });
    const brown = mat('#5a3a1e', { r: 0.8, m: 0 });
    const bow = [[2.0, -1.0, -3.0], [2.8, -0.5, -4.8], [3.0, 0.4, -6.6]];
    const tail = [[1.4, -0.5, 12.0], [3.0, -0.2, 13.4], [4.5, 1.0, 14.6]];
    const list = [];
    const mk = (pts, side) => {
      const P = pts.map((p) => V3(p[0] * side, p[1], p[2]));
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(tubeTaper(P, (t) => 0.1 + 0.42 * Math.pow(Math.sin(Math.PI * t), 0.55), 28, 10), peel));
      grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), brown).translateX(P[0].x).translateY(P[0].y).translateZ(P[0].z));
      const e = P[P.length - 1];
      grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), brown).translateX(e.x).translateY(e.y).translateZ(e.z));
      g.add(grp);
      list.push({ grp, side, ph: list.length * 0.9 });
    };
    [1, -1].forEach((s) => { mk(bow, s); mk(tail, s); });
    return (dt, t) => {
      list.forEach((b) => { b.grp.rotation.z = Math.sin(t * 1.6 + b.ph) * 0.03 * b.side; b.grp.rotation.x = Math.cos(t * 1.3 + b.ph) * 0.015; });
    };
  },

  /* ---------- Pizza-Sub ---------- */
  pizza(g) {
    const cheese = mat('#ffc43d', { r: 0.35, m: 0.05, e: 0xffa000, ei: 0.15, side: DS });
    const crustM = mat('#b5651d', { r: 0.7, m: 0.02 });
    const pep = mat('#d62839', { r: 0.4, m: 0.05, e: 0x7a0a14, ei: 0.2 });
    const olive = mat('#1a1a1a', { r: 0.3 });
    const green = mat('#2f9a3f', { r: 0.6 });
    const piv = new THREE.Group();
    piv.position.set(0, 2.4, 5.3);
    g.add(piv);
    put(piv, extr((s) => { s.moveTo(1.7, 0); s.lineTo(0, 3.2); s.lineTo(3.4, 3.2); s.lineTo(1.7, 0); }, 0.35), cheese, 0, 0, 0).rotation.y = -Math.PI / 2;
    const fin = piv.children[0];
    fin.position.z = -1.7;
    const crustG = new THREE.CylinderGeometry(0.3, 0.3, 3.6, 14);
    crustG.rotateX(Math.PI / 2);
    put(piv, crustG, crustM, 0, 3.2, 0);
    [[5.3, 4.8], [4.4, 5.1], [6.2, 5.1], [5.3, 3.9], [4.9, 4.4]].forEach((q) => {
      [-1, 1].forEach((s) => {
        const p = put(piv, new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16), pep, s * 0.19, q[1] - 2.4, q[0] - 5.3);
        p.rotation.z = Math.PI / 2;
      });
    });
    [[5.0, 4.3], [5.7, 4.5]].forEach((q) => [-1, 1].forEach((s) => {
      const o = put(piv, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), olive, s * 0.19, q[1] - 2.4, q[0] - 5.3);
      o.rotation.z = Math.PI / 2;
    }));
    [[5.5, 3.6]].forEach((q) => [-1, 1].forEach((s) => {
      const o = put(piv, new THREE.BoxGeometry(0.06, 0.3, 0.2), green, s * 0.19, q[1] - 2.4, q[0] - 5.3);
      o.rotation.x = 0.5;
    }));
    return (dt, t) => {
      piv.rotation.z = Math.sin(t * 1.4) * 0.05;
      cheese.emissiveIntensity = 0.12 + 0.06 * Math.sin(t * 2);
    };
  },

  /* ---------- Santa Sleigh ---------- */
  santa(g) {
    const gold = mat('#ffd23a', { m: 0.9, r: 0.22, e: 0xffa000, ei: 0.3, side: DS });
    const wood = mat('#6b3f22', { r: 0.7, m: 0.05, side: DS });
    const bells = [];
    [-1, 1].forEach((s) => {
      const pts = [V3(s * 1.3, -1.0, -6.4), V3(s * 1.3, -2.2, -5.0), V3(s * 1.3, -2.95, -2.5), V3(s * 1.3, -3.0, 3), V3(s * 1.3, -3.0, 9), V3(s * 1.3, -2.8, 12.2), V3(s * 1.3, -2.2, 13.0)];
      put(g, tubeTaper(pts, () => 0.13, 40, 8), gold);
      [-3.8, -1, 2, 5, 8, 11].forEach((z) => put(g, new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), gold, s * 1.3, -2.65, z));
      [-3, 0, 3, 6, 9].forEach((z) => {
        const b = put(g, new THREE.SphereGeometry(0.11, 8, 6), gold, s * 1.3, -3.2, z);
        bells.push({ b, x: s * 1.3, z });
      });
      const beam = tubeTaper([V3(s * 1.15, 1.9, -4.2), V3(s * 1.5, 2.6, -4.5), V3(s * 1.9, 3.4, -5.0), V3(s * 1.7, 4.2, -5.7)], (t) => 0.13 * (1 - t) + 0.03, 20, 8);
      const t1 = tubeTaper([V3(s * 1.5, 2.6, -4.5), V3(s * 0.9, 3.1, -5.2), V3(s * 0.7, 3.8, -5.5)], (t) => 0.1 * (1 - t) + 0.025, 12, 8);
      const t2 = tubeTaper([V3(s * 1.9, 3.4, -5.0), V3(s * 2.6, 3.9, -5.2), V3(s * 2.9, 4.6, -5.1)], (t) => 0.1 * (1 - t) + 0.025, 12, 8);
      put(g, beam, wood); put(g, t1, wood); put(g, t2, wood);
    });
    const noseM = mat('#ff2a2a', { r: 0.15, m: 0.2, e: 0xff1010, ei: 1.2 });
    const nose = put(g, new THREE.SphereGeometry(0.36, 16, 12), noseM, 0, -1.5, -5.95);
    const nl = new THREE.PointLight(0xff2a2a, 12, 14, 2);
    nl.position.set(0, -1.5, -6.3);
    g.add(nl);
    const sack = put(g, new THREE.SphereGeometry(1, 16, 12), mat('#8b1a1a', { r: 0.8, m: 0 }), 0, 3.3, 8.8);
    sack.scale.set(1.3, 1.1, 1.5);
    const tie = put(g, new THREE.TorusGeometry(0.5, 0.08, 8, 20), gold, 0, 4.3, 8.8);
    tie.rotation.x = Math.PI / 2;
    return (dt, t) => {
      const p = 0.5 + 0.5 * Math.sin(t * 4);
      noseM.emissiveIntensity = 0.8 + 0.9 * p;
      nl.intensity = 8 + 8 * p;
      nose.scale.setScalar(1 + 0.06 * p);
      bells.forEach((b, i) => { b.b.position.x = b.x + Math.sin(t * 3 + i) * 0.05; b.b.position.y = -3.2 + Math.cos(t * 3.4 + i) * 0.03; });
    };
  }
};

function clearSkin() {
  if (cur.skin) {
    if (cur.skin.group.parent) cur.skin.group.parent.remove(cur.skin.group);
    disposeObj(cur.skin.group);
    cur.skin = null;
  }
}

function applySkinExtras(sub, item) {
  clearSkin();
  if (item.def || !item.vis.kind) return;
  const build = SKINS[item.vis.kind];
  if (!build) return;
  const g = new THREE.Group();
  g.name = 'shop-skin';
  sub.group.add(g);
  const upd = build(g, sub);
  cur.skin = { group: g, update: upd };
}

/* ---- U-Boot-Farben ---- */
function applySub(sub, item) {
  const M = sub.materials;
  if (!M || !M.hull) return;
  if (!subDefaults.has(M)) {
    subDefaults.set(M, {
      hull: M.hull.color.getHex(), plain: M.hullPlain.color.getHex(),
      orange: M.orange.color.getHex(), teal: M.teal.color.getHex(),
      metal: M.hull.metalness, rough: M.hull.roughness,
      cyanC: M.cyanGlow.color.getHex(), cyanE: M.cyanGlow.emissive.getHex(), cyanI: M.cyanGlow.emissiveIntensity,
      ledC: M.led.color.getHex(), ledE: M.led.emissive.getHex(), ledI: M.led.emissiveIntensity
    });
  }
  const d = subDefaults.get(M);
  // immer erst auf Standard zurück (auch Lichter/Streifen, die RGB verändert)
  M.hull.color.setHex(d.hull); M.hullPlain.color.setHex(d.plain);
  M.orange.color.setHex(d.orange); M.teal.color.setHex(d.teal);
  M.hull.metalness = d.metal; M.hull.roughness = d.rough;
  M.hull.emissive.setHex(0x000000); M.hull.emissiveIntensity = 0;
  M.cyanGlow.color.setHex(d.cyanC); M.cyanGlow.emissive.setHex(d.cyanE); M.cyanGlow.emissiveIntensity = d.cyanI;
  M.led.color.setHex(d.ledC); M.led.emissive.setHex(d.ledE); M.led.emissiveIntensity = d.ledI;
  cur.shimmer = false;
  if (item.def) return;
  const v = item.vis;
  M.hull.color.set(v.hull); M.hullPlain.color.set(v.plain);
  M.orange.color.set(v.accent); M.teal.color.set(v.teal);
  M.hull.metalness = v.metal ? 0.9 : d.metal;
  M.hull.roughness = v.metal ? 0.18 : d.rough;
  M.hull.emissive.set(v.glow || '#000000');
  M.hull.emissiveIntensity = v.glowI;
  cur.shimmer = !!v.shimmer;
}

/* ============================================================
   KAPITÄN: Farben + 3D-Hüte
   (Materialien werden über ihre Originalfarbe erkannt)
   ============================================================ */
const CAP_ROLES = { 0x1f4aa8: 'jacket', 0x14213d: 'pants', 0x10224d: 'cap', 0xe2b13c: 'trim', 0xffc9a3: 'skin' };

const CAP_ACC = {
  king() {
    const g = new THREE.Group();
    const gold = mat('#ffd23a', { m: 0.9, r: 0.2, e: 0xffa000, ei: 0.45, side: DS });
    const gem = mat('#ff2a55', { e: 0xff2244, ei: 0.9, r: 0.1 });
    const c = makeCrown(0.27, 0.34, 5, gold, gem);
    c.position.y = 1.12;
    g.add(c);
    return { group: g, update: (dt, t) => { gold.emissiveIntensity = 0.4 + 0.15 * Math.sin(t * 3); } };
  },
  pirate() {
    const g = new THREE.Group();
    const black = mat('#15131a', { r: 0.7, m: 0.1, side: DS });
    const gold = mat('#e2b13c', { m: 0.8, r: 0.3 });
    const white = mat('#ffffff', { r: 0.6 });
    put(g, new THREE.CylinderGeometry(0.46, 0.46, 0.05, 3), black, 0, 1.2, 0);
    put(g, new THREE.CylinderGeometry(0.24, 0.3, 0.16, 3), black, 0, 1.3, 0);
    put(g, new THREE.CylinderGeometry(0.315, 0.315, 0.03, 3), gold, 0, 1.23, 0);
    put(g, new THREE.SphereGeometry(0.05, 10, 8), white, 0, 1.3, 0.27);
    const b1 = put(g, new THREE.BoxGeometry(0.16, 0.02, 0.02), white, 0, 1.25, 0.29); b1.rotation.z = 0.6;
    const b2 = put(g, new THREE.BoxGeometry(0.16, 0.02, 0.02), white, 0, 1.25, 0.29); b2.rotation.z = -0.6;
    return { group: g };
  },
  astro() {
    const g = new THREE.Group();
    const glass = mat('#bfeaff', { r: 0.05, m: 0.2, t: true, op: 0.22, side: DS });
    const white = mat('#e8eef4', { r: 0.5, m: 0.2 });
    put(g, new THREE.SphereGeometry(0.36, 24, 16), glass, 0, 1.0, 0);
    const collar = put(g, new THREE.TorusGeometry(0.27, 0.045, 8, 24), white, 0, 0.78, 0);
    collar.rotation.x = Math.PI / 2;
    put(g, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), white, 0.2, 1.4, 0);
    const led = mat('#ff3b3b', { e: 0xff2020, ei: 1, r: 0.2 });
    put(g, new THREE.SphereGeometry(0.035, 8, 6), led, 0.2, 1.56, 0);
    return { group: g, update: (dt, t) => { led.emissiveIntensity = Math.sin(t * 6) > 0 ? 1.4 : 0.1; } };
  },
  alien() {
    const g = new THREE.Group();
    const stalk = mat('#4fb83a', { r: 0.5, m: 0.1 });
    const tip = mat('#9dff7a', { e: 0x7dff4a, ei: 1.1, r: 0.2 });
    const pivots = [];
    [-1, 1].forEach((s, i) => {
      const pv = new THREE.Group();
      pv.position.set(s * 0.1, 1.22, 0);
      pv.rotation.z = -s * 0.35;
      g.add(pv);
      put(pv, new THREE.CylinderGeometry(0.012, 0.016, 0.42, 6), stalk, 0, 0.21, 0);
      put(pv, new THREE.SphereGeometry(0.06, 10, 8), tip, 0, 0.44, 0);
      pivots.push({ pv, s, i });
    });
    return {
      group: g,
      update: (dt, t) => {
        pivots.forEach((p) => { p.pv.rotation.z = -p.s * 0.35 + Math.sin(t * 3 + p.i * 2) * 0.12; });
        tip.emissiveIntensity = 0.9 + 0.5 * Math.sin(t * 4);
      }
    };
  },
  cyber() {
    const g = new THREE.Group();
    const visor = mat('#0a2a33', { e: 0x19e6ff, ei: 1.2, r: 0.1, m: 0.3, t: true, op: 0.85, side: DS });
    const dark = mat('#141a26', { m: 0.7, r: 0.3 });
    const ring = mat('#0a2a33', { e: 0x19e6ff, ei: 1.5 });
    put(g, new THREE.CylinderGeometry(0.31, 0.31, 0.13, 24, 1, true, -1.1, 2.2), visor, 0, 1.08, 0);
    [-1, 1].forEach((s) => {
      const c = put(g, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14), dark, s * 0.27, 1.0, 0);
      c.rotation.z = Math.PI / 2;
      const r = put(g, new THREE.TorusGeometry(0.075, 0.012, 6, 14), ring, s * 0.305, 1.0, 0);
      r.rotation.y = Math.PI / 2;
    });
    return { group: g, update: (dt, t) => { visor.emissiveIntensity = 0.9 + 0.5 * Math.sin(t * 5); ring.emissiveIntensity = 1.2 + 0.6 * Math.sin(t * 7); } };
  },
  santa() {
    const g = new THREE.Group();
    const red = mat('#c8222f', { r: 0.8, m: 0, side: DS });
    const white = mat('#ffffff', { r: 0.95, m: 0 });
    const pv = new THREE.Group();
    pv.position.set(0, 1.2, 0);
    pv.rotation.x = -0.55;
    g.add(pv);
    put(pv, new THREE.ConeGeometry(0.28, 0.55, 20), red, 0, 0.275, 0);
    const pom = put(pv, new THREE.SphereGeometry(0.06, 10, 8), white, 0, 0.58, 0);
    const brim = put(g, new THREE.TorusGeometry(0.26, 0.06, 10, 24), white, 0, 1.2, 0);
    brim.rotation.x = Math.PI / 2;
    return { group: g, update: (dt, t) => { pom.position.x = Math.sin(t * 2.4) * 0.03; } };
  }
};

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

  // 3D-Hüte / Accessoires
  const body = rootObj.children[0] || rootObj;
  body.children.filter((c) => c.userData && c.userData.shopAcc).forEach((c) => { body.remove(c); disposeObj(c); });
  cur.accs = [];
  if (!rootObj.userData.shopHg) {
    rootObj.userData.shopHg = body.children.find((c) => c.isGroup && Math.abs(c.position.y - 1.0) < 1e-4) || null;
  }
  const hg = rootObj.userData.shopHg;
  const kind = !item.def && item.vis.kind;
  if (kind && CAP_ACC[kind]) {
    if (hg) hg.visible = false;
    const acc = CAP_ACC[kind]();
    acc.group.userData.shopAcc = true;
    body.add(acc.group);
    if (acc.update) cur.accs.push(acc.update);
  } else if (hg) {
    hg.visible = true;
  }
}

/* ============================================================
   TOURISTEN: Farben + 3D-Köpfe/Hüte
   (defensiv: tourists.js ist unbekannt; Blickrichtung = lokal +Z angenommen)
   ============================================================ */
function findTouristRoot(t) {
  if (!t) return null;
  if (t.isObject3D) return t;
  const keys = ['group', 'root', 'obj', 'object', 'mesh', 'figure', 'body', 'model'];
  for (let i = 0; i < keys.length; i++) if (t[keys[i]] && t[keys[i]].isObject3D) return t[keys[i]];
  for (const k in t) { if (t[k] && t[k].isObject3D && t[k].children && t[k].children.length) return t[k]; }
  return null;
}

function makeHat(type, color) {
  const g = new THREE.Group();
  g.userData.shopHat = true;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.3 });
  const add = (geo, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); g.add(me); return me; };
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

/* Einheit: Kopfradius = 1, Kopfmitte = Ursprung, Blick = +Z */
const TOU_ACC = {
  alien() {
    const g = new THREE.Group();
    const stalk = mat('#4fb83a', { r: 0.5, m: 0.1 });
    const tip = mat('#9dff7a', { e: 0x7dff4a, ei: 1.1, r: 0.2 });
    const eye = mat('#0a0a0a', { r: 0.1, m: 0.4 });
    const pivots = [];
    [-1, 1].forEach((s, i) => {
      const pv = new THREE.Group();
      pv.position.set(s * 0.45, 0.9, 0);
      pv.rotation.z = -s * 0.4;
      g.add(pv);
      put(pv, new THREE.CylinderGeometry(0.05, 0.07, 1.1, 8), stalk, 0, 0.55, 0);
      put(pv, new THREE.SphereGeometry(0.2, 10, 8), tip, 0, 1.15, 0);
      pivots.push({ pv, s, i });
      const e = put(g, new THREE.SphereGeometry(1, 12, 10), eye, s * 0.4, 0.12, 0.86);
      e.scale.set(0.38, 0.52, 0.2);
      e.rotation.z = -s * 0.4;
    });
    return {
      group: g,
      update: (dt, t) => {
        pivots.forEach((p) => { p.pv.rotation.z = -p.s * 0.4 + Math.sin(t * 3 + p.i * 2) * 0.14; });
        tip.emissiveIntensity = 0.9 + 0.5 * Math.sin(t * 4);
      }
    };
  },
  astro() {
    const g = new THREE.Group();
    const glass = mat('#bfeaff', { r: 0.05, m: 0.2, t: true, op: 0.2, side: DS });
    const gold = mat('#ffc933', { r: 0.1, m: 0.9, t: true, op: 0.5, side: DS });
    const white = mat('#f0f4f8', { r: 0.5, m: 0.2 });
    put(g, new THREE.SphereGeometry(1.4, 24, 16), glass);
    put(g, new THREE.SphereGeometry(1.36, 24, 12, Math.PI / 2 - 1.0, 2.0, 0.95, 1.1), gold);
    const collar = put(g, new THREE.TorusGeometry(1.0, 0.17, 8, 24), white, 0, -1.2, 0);
    collar.rotation.x = Math.PI / 2;
    put(g, new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), white, 0.7, 1.7, 0);
    const led = mat('#ff3b3b', { e: 0xff2020, ei: 1, r: 0.2 });
    put(g, new THREE.SphereGeometry(0.12, 8, 6), led, 0.7, 2.2, 0);
    return { group: g, update: (dt, t) => { led.emissiveIntensity = Math.sin(t * 6) > 0 ? 1.4 : 0.1; } };
  },
  skeleton() {
    const g = new THREE.Group();
    const black = mat('#15131a', { r: 0.7, m: 0.1, side: DS });
    const gold = mat('#e2b13c', { m: 0.8, r: 0.3 });
    const white = mat('#ffffff', { r: 0.6 });
    const socket = mat('#050505', { r: 0.2 });
    put(g, new THREE.CylinderGeometry(1.5, 1.5, 0.18, 3), black, 0, 1.0, 0);
    put(g, new THREE.CylinderGeometry(0.8, 1.0, 0.55, 3), black, 0, 1.35, 0);
    put(g, new THREE.CylinderGeometry(1.05, 1.05, 0.1, 3), gold, 0, 1.08, 0);
    put(g, new THREE.SphereGeometry(0.16, 10, 8), white, 0, 1.38, 0.8);
    [-1, 1].forEach((s) => {
      const e = put(g, new THREE.SphereGeometry(0.28, 12, 10), socket, s * 0.4, 0.2, 0.82);
      e.scale.z = 0.5;
    });
    const nose = put(g, new THREE.ConeGeometry(0.1, 0.25, 6), socket, 0, -0.1, 0.96);
    nose.rotation.x = Math.PI / 2;
    for (let i = -2; i <= 2; i++) put(g, new THREE.BoxGeometry(0.05, 0.3, 0.05), socket, i * 0.17, -0.55, 0.86);
    return { group: g };
  },
  polar(i) {
    const g = new THREE.Group();
    const black = mat('#0a0a0a', { r: 0.2 });
    const orange = mat('#ff8a2a', { r: 0.5 });
    if (i % 2 === 1) {                       // Pinguin
      put(g, new THREE.SphereGeometry(1.1, 18, 14), mat('#232a36', { r: 0.6, m: 0 }));
      const face = put(g, new THREE.SphereGeometry(1, 16, 12), mat('#ffffff', { r: 0.7, m: 0 }), 0, -0.08, 0.7);
      face.scale.set(0.72, 0.7, 0.5);
      [-1, 1].forEach((s) => put(g, new THREE.SphereGeometry(0.1, 8, 6), black, s * 0.28, 0.12, 1.12));
      const beak = put(g, new THREE.ConeGeometry(0.2, 0.45, 10), orange, 0, -0.1, 1.3);
      beak.rotation.x = Math.PI / 2;
    } else {                                 // Schneemann
      put(g, new THREE.SphereGeometry(1.12, 18, 14), mat('#f7fbff', { r: 0.8, m: 0 }));
      [-1, 1].forEach((s) => put(g, new THREE.SphereGeometry(0.1, 8, 6), black, s * 0.35, 0.2, 1.04));
      const nose = put(g, new THREE.ConeGeometry(0.15, 0.7, 10), orange, 0, -0.05, 1.4);
      nose.rotation.x = Math.PI / 2;
      for (let k = -2; k <= 2; k++) put(g, new THREE.SphereGeometry(0.06, 6, 5), black, k * 0.2, -0.42 + Math.abs(k) * 0.05 * -1 + 0.1 * Math.abs(k) * 0.5, 1.04);
      const sc = put(g, new THREE.TorusGeometry(1.0, 0.2, 8, 24), mat('#c8222f', { r: 0.9, m: 0 }), 0, -1.0, 0);
      sc.rotation.x = Math.PI / 2;
      const hatM = mat('#15131a', { r: 0.6 });
      put(g, new THREE.CylinderGeometry(0.55, 0.55, 0.9, 18), hatM, 0, 1.55, 0);
      put(g, new THREE.CylinderGeometry(0.9, 0.9, 0.1, 22), hatM, 0, 1.08, 0);
      put(g, new THREE.CylinderGeometry(0.56, 0.56, 0.18, 18), mat('#c8222f', { r: 0.8 }), 0, 1.25, 0);
    }
    return { group: g };
  }
};

const TOU_KIND = {
  alien: { tint: '#2f9a3f', skin: '#7be26a', amt: 0.6 },
  astro: { tint: '#f3f6f9', skin: null, amt: 0.92 },
  skeleton: { tint: '#2a2230', skin: '#e8e3cf', amt: 0.8 },
  polar: { fn: (i) => (i % 2 ? { tint: '#232a36', skin: '#232a36', amt: 0.92 } : { tint: '#f4f8fc', skin: '#f4f8fc', amt: 0.92 }) }
};

function touCfg(vis, i) {
  if (!vis.kind) return { tint: vis.tint, skin: null, amt: 0.65 };
  const k = TOU_KIND[vis.kind];
  if (!k) return { tint: vis.tint, skin: null, amt: 0.65 };
  return k.fn ? k.fn(i) : k;
}

function applyTourists(tourists, item) {
  const list = tourists && tourists.tourists;
  if (!Array.isArray(list)) return;
  cur.touAcc = [];
  const seen = new Set();
  list.forEach((t, idx) => {
    const r = findTouristRoot(t);
    if (!r) return;
    r.children.filter((c) => c.userData && c.userData.shopHat).forEach((c) => { r.remove(c); disposeObj(c); });
    const cfg = item.def ? { tint: null, skin: null, amt: 0.65 } : touCfg(item.vis, idx);
    // Kleidung / Haut umfärben (Augen- und Extremfarben bleiben)
    r.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m || !m.color || seen.has(m)) return;
        seen.add(m);
        if (m.userData.shopOrig === undefined) m.userData.shopOrig = m.color.getHex();
        const orig = new THREE.Color(m.userData.shopOrig);
        if (!cfg.tint) { m.color.copy(orig); return; }
        const p = {};
        orig.getHSL(p);
        const skin = p.h > 0.02 && p.h < 0.12 && p.s > 0.2 && p.l > 0.45 && p.l < 0.92;
        const extreme = p.l < 0.12 || p.l > 0.93;
        if (skin) { if (cfg.skin) m.color.set(cfg.skin); else m.color.copy(orig); return; }
        if (extreme) { m.color.copy(orig); return; }
        m.color.copy(orig).lerp(_col.set(cfg.tint), cfg.amt);
      });
    });
    if (item.def) return;
    const kind = item.vis.kind;
    if (kind && TOU_ACC[kind]) {
      r.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(r);
      if (box.isEmpty()) return;
      const H = box.max.y - box.min.y;
      const hr = H * HEAD_FRAC;
      const ws = new THREE.Vector3();
      r.getWorldScale(ws);
      const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - hr, (box.min.z + box.max.z) / 2);
      r.worldToLocal(top);
      const acc = TOU_ACC[kind](idx);
      acc.group.userData.shopHat = true;
      acc.group.scale.setScalar(hr / Math.max(0.0001, ws.x));
      acc.group.position.copy(top);
      r.add(acc.group);
      if (acc.update) cur.touAcc.push(acc.update);
    } else if (item.vis.hat && item.vis.hat !== 'none') {
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

/* ============================================================
   PROPELLER-SPUREN (Partikel-Ebenen)
   ============================================================ */
const texCache = new Map();

function shapeTexture(shape) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
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
  } else if (shape === 'ring') {
    g.lineWidth = 9; g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.globalAlpha = 0.6; g.beginPath(); g.arc(32, 32, 14, 0, Math.PI * 2); g.stroke();
  } else if (shape === 'spark') {
    g.beginPath();
    g.moveTo(32, 2); g.lineTo(38, 26); g.lineTo(62, 32); g.lineTo(38, 38); g.lineTo(32, 62); g.lineTo(26, 38); g.lineTo(2, 32); g.lineTo(26, 26);
    g.closePath(); g.fill();
  } else if (shape === 'bolt') {
    g.beginPath();
    g.moveTo(38, 2); g.lineTo(16, 36); g.lineTo(30, 36); g.lineTo(22, 62); g.lineTo(50, 24); g.lineTo(34, 24); g.closePath(); g.fill();
  } else if (shape === 'orb') {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  } else if (shape === 'blob') {
    const gr = g.createRadialGradient(26, 26, 2, 32, 32, 26);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.6, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill();
  } else if (shape === 'flake') {
    g.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
      g.beginPath(); g.moveTo(32 - ca * 28, 32 - sa * 28); g.lineTo(32 + ca * 28, 32 + sa * 28); g.stroke();
      [-1, 1].forEach((s) => {
        const bx = 32 + ca * 17 * s, by = 32 + sa * 17 * s;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + s * 0.9) * 8, by + Math.sin(a + s * 0.9) * 8); g.stroke();
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a - s * 0.9) * 8, by + Math.sin(a - s * 0.9) * 8); g.stroke();
      });
    }
  } else {
    g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.8; g.beginPath(); g.arc(24, 24, 5, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class Layer {
  constructor(def, scene) {
    this.def = def;
    this.scene = scene;
    this.isMesh = !!def.mesh;
    const n = this.n = this.isMesh ? 26 : 110;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.head = 0;
    this.acc = 0;
    this.buoy = def.buoy !== undefined ? def.buoy : 0.6;
    if (this.isMesh) {
      this.group = new THREE.Group();
      scene.add(this.group);
      const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.07, 18);
      const billGeo = new THREE.BoxGeometry(0.62, 0.02, 0.32);
      const coinMat = mat('#ffd23a', { m: 0.9, r: 0.25, e: 0xffa000, ei: 0.7 });
      const billMat = mat('#5fd16a', { r: 0.6, m: 0.05, e: 0x1f9a3a, ei: 0.6 });
      this.spin = new Float32Array(n * 3);
      this.meshes = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(i % 2 ? billGeo : coinGeo, i % 2 ? billMat : coinMat);
        m.visible = false;
        this.group.add(m);
        this.meshes.push(m);
      }
      this.shared = [coinGeo, billGeo, coinMat, billMat];
    } else {
      this.col = new Float32Array(n * 3);
      this.base = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -1e5;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
      const mt = new THREE.PointsMaterial({
        size: def.size || 1, map: shapeTexture(def.shape), vertexColors: true, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
      });
      this.points = new THREE.Points(geo, mt);
      this.points.frustumCulled = false;
      scene.add(this.points);
    }
  }

  emit(sub, power, t) {
    const i = this.head;
    this.head = (this.head + 1) % this.n;
    sub.getBubblePos(_tmp);
    _back.set(0, 0, 1).applyQuaternion(sub.group.quaternion);
    const sp = 2 + power * 9, o = i * 3;
    this.pos[o] = _tmp.x + (Math.random() - 0.5) * 1.2;
    this.pos[o + 1] = _tmp.y + (Math.random() - 0.5) * 1.2;
    this.pos[o + 2] = _tmp.z + (Math.random() - 0.5) * 1.2;
    this.vel[o] = _back.x * sp + (Math.random() - 0.5) * 1.5;
    this.vel[o + 1] = _back.y * sp + 0.8 + Math.random() * 1.2;
    this.vel[o + 2] = _back.z * sp + (Math.random() - 0.5) * 1.5;
    this.max[i] = this.life[i] = (this.isMesh ? 1.6 : 1.0) + Math.random() * 1.0;
    if (this.isMesh) {
      this.spin[o] = (Math.random() - 0.5) * 8;
      this.spin[o + 1] = (Math.random() - 0.5) * 8;
      this.spin[o + 2] = (Math.random() - 0.5) * 8;
      this.meshes[i].visible = true;
    } else {
      if (this.def.rainbow) _col.setHSL((t * 0.5 + Math.random() * 0.3) % 1, 0.9, 0.6);
      else _col.set(this.def.color || '#cfefff');
      this.base[o] = _col.r; this.base[o + 1] = _col.g; this.base[o + 2] = _col.b;
    }
  }

  update(dt, power, under, sub, t) {
    if (under) {
      this.acc += (10 + 55 * power) * (this.def.rate || 1) * dt;
      while (this.acc >= 1) { this.acc -= 1; this.emit(sub, power, t); }
    }
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      if (this.life[i] <= 0) {
        if (this.isMesh) this.meshes[i].visible = false;
        else { this.pos[o + 1] = -1e5; this.col[o] = this.col[o + 1] = this.col[o + 2] = 0; }
        continue;
      }
      this.vel[o + 1] += this.buoy * dt;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      const f = Math.pow(this.life[i] / this.max[i], 0.7);
      if (this.isMesh) {
        const m = this.meshes[i];
        m.position.set(this.pos[o], this.pos[o + 1], this.pos[o + 2]);
        m.rotation.x += this.spin[o] * dt; m.rotation.y += this.spin[o + 1] * dt; m.rotation.z += this.spin[o + 2] * dt;
        m.scale.setScalar(Math.min(1, this.life[i] * 3));
      } else {
        this.col[o] = this.base[o] * f; this.col[o + 1] = this.base[o + 1] * f; this.col[o + 2] = this.base[o + 2] * f;
      }
    }
    if (!this.isMesh) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }

  dispose() {
    if (this.isMesh) {
      if (this.group.parent) this.group.parent.remove(this.group);
      this.shared.forEach((s) => s.dispose());
    } else {
      if (this.points.parent) this.points.parent.remove(this.points);
      this.points.geometry.dispose();
      if (this.points.material.map) this.points.material.map.dispose();
      this.points.material.dispose();
    }
  }
}

export function detachFx() {
  if (!fx) return;
  fx.layers.forEach((l) => l.dispose());
  fx = null;
}

function applyBubbles(sub, item) {
  detachFx();
  if (item.def) return;
  const scene = sub.group.parent;
  if (!scene) return;
  fx = { sub, layers: layersOf(item.vis).map((d) => new Layer(d, scene)) };
}

/* ============================================================
   3D-WEIHNACHTSBAUM am Dock (Dezember oder Christmas-Skin)
   ============================================================ */
function buildTree() {
  const g = new THREE.Group();
  g.name = 'shop-christmas-tree';
  const green = mat('#1f7a3a', { r: 0.7, m: 0, side: DS });
  put(g, new THREE.CylinderGeometry(0.35, 0.45, 1.1, 12), mat('#5a3a1e', { r: 0.8, m: 0 }), 0, 0.55, 0);
  const L = [[0.9, 2.6, 2.3], [2.2, 2.3, 1.85], [3.5, 2.0, 1.4], [4.7, 1.7, 1.0]];
  L.forEach((l) => put(g, new THREE.ConeGeometry(l[2], l[1], 20), green, 0, l[0] + l[1] / 2, 0));
  const cols = ['#ff3355', '#ffd23a', '#3aa0ff', '#ff8a2a', '#c85bff', '#5dffb0'];
  const orn = [];
  let n = 0;
  L.forEach((l, li) => {
    const cnt = 6 + (3 - li) * 2;
    for (let k = 0; k < cnt; k++) {
      const a = k * 2.399 + li;
      const tt2 = 0.2 + ((k * 0.37 + li * 0.21) % 1) * 0.6;
      const rr = l[2] * (1 - tt2) + 0.06;
      const col = cols[n % cols.length];
      const m = mat(col, { r: 0.15, m: 0.6, e: col, ei: 0.6 });
      put(g, new THREE.SphereGeometry(0.14, 10, 8), m, Math.cos(a) * rr, l[0] + tt2 * l[1], Math.sin(a) * rr);
      orn.push({ m, n });
      n++;
    }
  });
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.26 : 0.6;
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.18, bevelEnabled: false });
  starGeo.translate(0, 0, -0.09);
  const starM = mat('#ffd23a', { m: 0.9, r: 0.2, e: 0xffb000, ei: 1.1 });
  const star = put(g, starGeo, starM, 0, 6.75, 0);
  [[2.2, 0.8, '#d62839', '#ffd23a', 0.8, 0.6], [-2.4, 1.2, '#2a7de1', '#ffffff', 0.7, 0.7], [1.2, -2.5, '#2f9a3f', '#ffd23a', 0.9, 0.5],
   [-1.6, -2.2, '#c85bff', '#ffffff', 0.6, 0.6], [3.0, -0.8, '#ff8a2a', '#2a7de1', 0.55, 0.5]].forEach((q) => {
    const w = q[4], h = q[5];
    put(g, new THREE.BoxGeometry(w, h, w), mat(q[2], { r: 0.5, m: 0.1 }), q[0], h / 2, q[1]);
    const rm = mat(q[3], { r: 0.4, m: 0.3 });
    put(g, new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.1), rm, q[0], h / 2, q[1]);
    put(g, new THREE.BoxGeometry(0.1, h + 0.03, w + 0.03), rm, q[0], h / 2, q[1]);
    put(g, new THREE.SphereGeometry(0.12, 8, 6), rm, q[0], h + 0.08, q[1]);
  });
  const light = new THREE.PointLight(0xffd9a0, 25, 22, 2);
  light.position.set(0, 3.2, 0);
  g.add(light);
  g.scale.setScalar(TREE_SCALE);
  return { group: g, update: (dt, t) => {
    star.rotation.y = t * 0.9;
    starM.emissiveIntensity = 0.9 + 0.4 * Math.sin(t * 3);
    orn.forEach((o) => { o.m.emissiveIntensity = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.2 + o.n * 0.8)); });
    light.intensity = 22 + 5 * Math.sin(t * 2.7);
  } };
}

function dockPos(ctx, sub) {
  const d = (ctx && ctx.dock) || dockOverride;
  if (d && d.isVector3) return d.clone();
  if (d && d.isObject3D) return d.getWorldPosition(new THREE.Vector3());
  if (d && typeof d.x === 'number') return new THREE.Vector3(d.x, d.y, d.z);
  return null;
}

function christmasEquipped() {
  return CATS.some((c) => getItem(state.equipped[c]).season === 'christmas');
}

function removeTree() {
  if (!cur.tree) return;
  if (cur.tree.group.parent) cur.tree.group.parent.remove(cur.tree.group);
  disposeObj(cur.tree.group);
  cur.tree = null;
}

function applyTree(ctx, sub) {
  const want = new Date().getMonth() === 11 || christmasEquipped();
  if (!want) { removeTree(); return; }
  const scene = sub.group.parent;
  if (!scene) return;
  if (cur.tree && cur.tree.group.parent !== scene) removeTree();
  const explicit = dockPos(ctx, sub);
  if (!cur.tree) {
    cur.tree = buildTree();
    scene.add(cur.tree.group);
    cur.tree.group.position.copy(explicit || sub.group.position.clone().add(DOCK_OFFSET));
  } else if (explicit) {
    cur.tree.group.position.copy(explicit);
  }
}

/* Dock-Position für den Weihnachtsbaum von außen setzen (Vector3 | Object3D | {x,y,z}) */
export function setDockPosition(p) {
  dockOverride = p || null;
  if (cur.tree && cur.sub) {
    const q = dockPos(null, cur.sub);
    if (q) cur.tree.group.position.copy(q);
  }
}

/* ---- Einstiegspunkte für script.js ---- */
export function applyEquipped(ctx) {
  const sub = ctx && ctx.sub;
  if (!sub) return;
  cur.sub = sub;
  const subItem = getItem(state.equipped.sub);
  applySub(sub, subItem);
  applySkinExtras(sub, subItem);
  applyCaptain(sub.captain, getItem(state.equipped.cap));
  applyBubbles(sub, getItem(state.equipped.bub));
  applyTourists(ctx.tourists, getItem(state.equipped.tou));
  applyTree(ctx, sub);
}

export function updateFx(dt, thr) {
  cur.fxTime += dt;
  const t = cur.fxTime;
  if (cur.shimmer && cur.sub && cur.sub.materials) {
    const M = cur.sub.materials;
    M.hull.emissive.setHSL((t * 0.12) % 1, 0.85, 0.5);
    M.hull.emissiveIntensity = 0.35;
  }
  if (cur.skin && cur.skin.update) cur.skin.update(dt, t);
  for (let i = 0; i < cur.accs.length; i++) cur.accs[i](dt, t);
  for (let i = 0; i < cur.touAcc.length; i++) cur.touAcc[i](dt, t);
  if (cur.tree) cur.tree.update(dt, t);
  if (!fx) return;
  const power = Math.abs(thr || 0);
  const under = fx.sub.group.position.y < 0;
  fx.layers.forEach((l) => l.update(dt, power, under, fx.sub, t));
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
