/* ============================================================
   BEYOND MARIANA – level4.js  (LEVEL 4: SUNKEN MAYA AMAZON RIVER)
   Versunkener Maya-Tempel im Amazonas-Mangrovenfluss.
   Breiter, flacher, lichtdurchfluteter Dschungelfluss (KEIN Tiefseegraben):
   Smaragdgrün / Fluss-Türkis, goldene God Rays, goldene Pollen,
   Mangroven mit Stelzen- und Luftwurzeln, Seerosen an der Oberfläche,
   Urzeit-Farne, bunte Fluss-Korallen, Moos-Felsen, Piranha- und
   Neonfisch-Schwärme, rosa Flussdelfine, Schildkröten.

   Maya-Architektur im Flussbett: überwucherte Säulen, zerbrochene
   Statuen, Stelen mit goldenen Reliefs, türkise Jade-Kristalle.

   3 Sehenswürdigkeiten:
     0  Versunkenes Maya-Sonnentor (Durchtauchen, Mangroven-Wurzel-Vorhang)
     1  Überwucherte Jade-Pyramide (Jade-Feuerschalen + goldene Partikel)
     2  Quetzalcoatl-Flussschlange (Kollision -> Bounce-Rückstoß)

   NEU in dieser Version:
   - Hindernis-Raster für alle schwimmenden Tiere: Mangroven-Stämme
     und Stelzenwurzeln, Säulen, Statuen, Stelen, Felsen, Gehirnkorallen,
     Jade-Kristalle, Dock-Pfosten, Sonnentor und Pyramide (gedrehte Boxen).
     Fische, Flussdelfine, Schildkröten und jedes Segment der
     Quetzalcoatl-Schlange lenken rechtzeitig um diese Objekte herum
     bzw. werden sanft herausgeschoben.

   Gleiche Schnittstelle wie level2.js:
   level.spawn, schools, fauna, sights, sightCount, setViewDistance(v),
   update(dt, ctx), collideSub(p, vel, r), drainEvents(), isAtPlatform(p),
   getPings(pos, yaw, out), visitAll(), dispose()
   Aliase: createLevel4 / updateLevel4

   Extras:
   - markLevel3Complete()  -> in script.js aufrufen, wenn Level 3 abgeschlossen ist
   - isLevel4Unlocked()    -> in ui.js für die Level-Auswahl
   - level4Reward(stars)   -> Tour-Belohnung 1.800 – 2.500 €
   - l4Text(lang)          -> Texte in en / de / fr / nl / pl (Fallback: en)
   ============================================================ */

import * as THREE from 'three';

export const WORLD4 = { cameraFar: 900, darkDepth: 99999, radius: 600 };

/* ------------------------------------------------------------
   Freischaltung, Belohnung, Texte
   ------------------------------------------------------------ */
export const LEVEL4_UNLOCK_KEY = 'bm_level3_complete';
export function isLevel4Unlocked() {
  try { return localStorage.getItem(LEVEL4_UNLOCK_KEY) === '1'; } catch (e) { return false; }
}
export function markLevel3Complete() {
  try { localStorage.setItem(LEVEL4_UNLOCK_KEY, '1'); } catch (e) { /* ignorieren */ }
}

export const LEVEL4_REWARD = { min: 1800, max: 2500 };
/* Perfekte Tour (5.0 Sterne) = 2.500 €, ab 3.5 Sterne = 1.800 € */
export function level4Reward(stars) {
  const t = Math.min(1, Math.max(0, ((stars || 0) - 3.5) / 1.5));
  return Math.round((LEVEL4_REWARD.min + (LEVEL4_REWARD.max - LEVEL4_REWARD.min) * t) / 10) * 10;
}

export const L4_TEXT = {
  en: {
    title: 'Sunken Maya Amazon River',
    desc: 'A warm, sunlit jungle river. Dive between mangrove roots and find the lost Maya temple!',
    names: ['Sunken Maya Sun Gate', 'Overgrown Jade Pyramid', 'Quetzalcoatl River Serpent'],
    found: ['Wow! The golden Sun Gate!', 'The glowing Jade Pyramid!', 'The giant feathered serpent!']
  },
  de: {
    title: 'Versunkener Maya-Amazonas',
    desc: 'Ein warmer, sonniger Dschungelfluss. Tauche zwischen Mangrovenwurzeln und finde den verlorenen Maya-Tempel!',
    names: ['Versunkenes Maya-Sonnentor', 'Überwucherte Jade-Pyramide', 'Quetzalcoatl-Flussschlange'],
    found: ['Wow! Das goldene Sonnentor!', 'Die leuchtende Jade-Pyramide!', 'Die riesige Gefiederte Schlange!']
  },
  fr: {
    title: 'Fleuve Amazone Maya englouti',
    desc: 'Un fleuve de jungle chaud et ensoleillé. Plonge entre les racines de mangrove et trouve le temple maya perdu !',
    names: ['Porte du Soleil maya engloutie', 'Pyramide de jade envahie', 'Serpent-fleuve Quetzalcoatl'],
    found: ['Waouh ! La Porte du Soleil dorée !', 'La pyramide de jade lumineuse !', 'Le serpent à plumes géant !']
  },
  nl: {
    title: 'Verzonken Maya-Amazone',
    desc: 'Een warme, zonnige jungle-rivier. Duik tussen mangrovewortels en vind de verloren Maya-tempel!',
    names: ['Verzonken Maya-Zonnepoort', 'Overwoekerde Jade-piramide', 'Quetzalcoatl-rivierslang'],
    found: ['Wauw! De gouden Zonnepoort!', 'De gloeiende Jade-piramide!', 'De gigantische gevederde slang!']
  },
  pl: {
    title: 'Zatopiona Amazonka Majów',
    desc: 'Ciepła, słoneczna rzeka w dżungli. Nurkuj między korzeniami namorzynów i znajdź zaginioną świątynię Majów!',
    names: ['Zatopiona Brama Słońca Majów', 'Zarośnięta Piramida z Jadeitu', 'Rzeczny Wąż Quetzalcoatl'],
    found: ['Wow! Złota Brama Słońca!', 'Świecąca Piramida z Jadeitu!', 'Gigantyczny pierzasty wąż!']
  }
};
export function l4Text(lang) {
  const base = L4_TEXT.en, t = L4_TEXT[lang] || base;
  return {
    title: t.title || base.title,
    desc: t.desc || base.desc,
    names: t.names || base.names,
    found: t.found || base.found
  };
}

/* Dichte-Regler: 1 = volle Pracht, 0.6 = leichter für ältere iPads */
const DENSITY = 1;
const dn = (n) => Math.max(1, Math.round(n * DENSITY));

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ------------------------------------------------------------
   Welt-Layout: ein breiter, sanft mäandernder Fluss (Richtung -z)
   ------------------------------------------------------------ */
const FOG_COL = 0x1fae8c;
const FOG_BASE = 0.0098;
const Z_FRONT = 52, Z_BACK = -560;

/* Flussmitte (bei z = 20 genau x = 0, dort liegt der Dock) */
function riverX(z) {
  const q = z - 20;
  return 40 * Math.sin(q * 0.008) + 22 * (Math.sin(q * 0.02 + 0.4) - Math.sin(0.4));
}
function riverDX(z) { return (riverX(z + 1) - riverX(z - 1)) * 0.5; }
function halfW(z) { return 128 + 22 * Math.sin(z * 0.012 + 1.0); }

/* Korallen-Flecken entlang des Flusses */
const PATCHES = [];
{
  const r = mulberry32(4404);
  for (let i = 0; i < 16; i++) {
    const z = lerp(-20, -520, i / 15) + (r() - 0.5) * 20;
    PATCHES.push({ x: riverX(z) + (r() - 0.5) * 110, z, r: 45 + r() * 30 });
  }
  PATCHES.forEach((p) => { const s = p.r * 0.55; p.k = 1 / (2 * s * s); p.lim = 16 * s * s; });
}

const GATE = (() => {
  const z = -165;
  return { x: riverX(z) + 14, z, ry: Math.atan(riverDX(z)) + 0.15, gap: 13, H: 12 };
})();
const PYR = (() => {
  const z = -335;
  return { x: riverX(z) - 8, z, ry: 0.4, tiers: 5, half0: 32, th: 4.6 };
})();

/* Pier-Pfosten und Kollisionsboxen (wie in Level 2) */
const DOCK_PILLARS = [];
[-1, 1].forEach((s) => { for (let z = -12; z <= 28; z += 8) DOCK_PILLARS.push([s * 11.1, z]); });
[-12, 0, 12].forEach((x) => DOCK_PILLARS.push([x, 35]));
const DOCK_BOXES = [
  { x0: -13.2, x1: -9, z0: -16, z1: 32, y0: -90, y1: 1 },
  { x0: 9, x1: 13.2, z0: -16, z1: 32, y0: -90, y1: 1 },
  { x0: -13.2, x1: 13.2, z0: 32, z1: 37, y0: -90, y1: 1 }
];

/* Flussbett ohne Sonderzonen */
function bedH(x, z) {
  let h = -27 + 2.0 * Math.sin(x * 0.017 + 1.3) * Math.cos(z * 0.015) + 1.5 * Math.sin(x * 0.043 - z * 0.037) + 0.6 * Math.sin(x * 0.11 + z * 0.093);
  const dx = x - riverX(z), ad = Math.abs(dx), w = halfW(z);
  h -= 3.2 * Math.exp(-(dx * dx) / (2 * 55 * 55));                 // tiefere Rinne in der Flussmitte
  for (let i = 0; i < PATCHES.length; i++) {
    const p = PATCHES[i];
    const px = x - p.x, pz = z - p.z, d2 = px * px + pz * pz;
    if (d2 < p.lim) h += 3.5 * Math.exp(-d2 * p.k);
  }
  /* Bereich um den Dock bleibt eben und tief */
  const m = smooth(40, 120, Math.hypot(x, (z - 8) * 0.7));
  h = lerp(-26, h, m);
  /* sanfte Ufer */
  const e = smooth(w - 55, w + 25, ad);
  const crest = 3.4 + 1.6 * Math.sin(x * 0.06) * Math.sin(z * 0.05) + 1.0 * Math.sin(x * 0.17 + z * 0.13);
  h = lerp(h, crest, e);
  h += smooth(w + 25, w + 130, ad) * 14;
  /* geschlossene Enden des Flusses */
  h = lerp(h, crest + 2, smooth(-535, -605, z));
  h = lerp(h, crest + 2, smooth(42, 90, z));
  return h;
}

/* Ebene Zonen für Tor und Pyramide */
const ZONES = [
  { x: GATE.x, z: GATE.z, r: 42 },
  { x: PYR.x, z: PYR.z, r: 62 }
];
ZONES.forEach((Z) => { Z.h = bedH(Z.x, Z.z); Z.r2 = Z.r * Z.r; });

function floorH(x, z) {
  let h = bedH(x, z);
  for (let i = 0; i < ZONES.length; i++) {
    const Z = ZONES[i];
    const dx = x - Z.x, dz = z - Z.z, d2 = dx * dx + dz * dz;
    if (d2 >= Z.r2) continue;
    const w = 1 - smooth(Z.r * 0.5, Z.r, Math.sqrt(d2));
    h += (Z.h - h) * w;
  }
  return h;
}

/* Umlaufbahnen für Delfine und Schildkröten */
const DOL = { cx: riverX(-250), cz: -250, Rx: 50, Rz: 190, w: 0.06 };

function orbitPos(o, t, out) {
  const a = o.w * t + o.ph;
  out.x = o.cx + Math.sin(a) * o.Rx;
  out.z = o.cz + Math.cos(a) * o.Rz;
  out.y = Math.min(-3, floorH(out.x, out.z) + o.h0 + o.hA * Math.sin(a * 1.7 + o.ph * 2));
  return out;
}
function dolphinPos(i, t, out) {
  const a = DOL.w * t - i * 0.05;
  const side = (i % 2 ? 1 : -1) * (i > 1 ? 2 : 1) * 4;
  out.x = DOL.cx + Math.sin(a) * (DOL.Rx + side);
  out.z = DOL.cz + Math.cos(a) * (DOL.Rz + side * 0.6);
  const wave = Math.sin(t * 0.85 - i * 0.35);
  const fl = floorH(out.x, out.z);
  out.y = Math.min(-2.5, Math.max(fl + 4, -10 + 7 * wave));
  return out;
}

/* ------------------------------------------------------------
   Geometrie-Helfer
   ------------------------------------------------------------ */
const _cc = new THREE.Color();

function mergeGeos(list) {
  const pos = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i++) pos.push(a[i]);
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.computeVertexNormals();
  return m;
}

function mergeColored(list) {
  const pos = [], col = [], c = new THREE.Color();
  for (const it of list) {
    const g = it.geo.index ? it.geo.toNonIndexed() : it.geo;
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      pos.push(x, y, z);
      c.set(typeof it.col === 'function' ? it.col(x, y, z) : it.col);
      col.push(c.r, c.g, c.b);
    }
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  m.computeVertexNormals();
  return m;
}

function triGeo(v) {            // beidseitig sichtbares Dreieck
  const g = new THREE.BufferGeometry();
  const r = [v[6], v[7], v[8], v[3], v[4], v[5], v[0], v[1], v[2]];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.concat(r), 3));
  return g;
}

function cylBetween(a, b, r0, r1, seg) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate(a.x, a.y, a.z);
  return g;
}

/* Steinfarbe mit Moos am Fuß und in Flecken */
function stoneCol(mossH, seed) {
  return (x, y, z) => {
    const hv = 0.9 + 0.2 * hash3(Math.round(x * 2.5), Math.round(y * 2.5), Math.round(z * 2.5));
    let r = 0.60, g = 0.64, b = 0.56;
    const band = 0.5 + 0.5 * Math.sin(y * 0.9 + seed);
    r -= 0.06 * band; g -= 0.05 * band; b -= 0.05 * band;
    const patch = smooth(0.45, 0.9, 0.5 + 0.5 * Math.sin(x * 0.9 + z * 0.8 + y * 0.35 + seed * 2));
    const m = clamp((1 - smooth(0, mossH, y)) * 0.75 + patch * 0.35, 0, 0.9);
    r = lerp(r, 0.22, m); g = lerp(g, 0.46, m); b = lerp(b, 0.20, m);
    return _cc.setRGB(r * hv, g * hv, b * hv);
  };
}

/* Rindenfarbe: oben warmes Braun, unter Wasser algiges Grün */
function rootCol(x, y, z) {
  const t = smooth(0.5, -14, y);
  const hv = 0.9 + 0.2 * hash3(Math.round(x * 3), Math.round(y * 2), Math.round(z * 3));
  return _cc.setRGB(lerp(0.44, 0.22, t) * hv, lerp(0.30, 0.36, t) * hv, lerp(0.18, 0.16, t) * hv);
}

/* ------------------------------------------------------------
   Texturen
   ------------------------------------------------------------ */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function causticTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b9b9b9'; ctx.fillRect(0, 0, w, h);
    const r = mulberry32(7);
    ctx.lineJoin = 'round';
    for (let k = 0; k < 46; k++) {
      const cx = r() * w, cy = r() * h, rad = 14 + r() * 26, n = 6 + Math.floor(r() * 4), ph = r() * 6.28;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = i / n * Math.PI * 2, rr = rad * (0.75 + 0.25 * Math.sin(a * 3 + ph));
          const x = cx + ox + Math.cos(a) * rr, y = cy + oy + Math.sin(a) * rr;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,248,200,0.55)'; ctx.lineWidth = 3; ctx.stroke();
      }
    }
  }, true);
}

function rippleTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c8f4dc'; ctx.fillRect(0, 0, w, h);
    const r = mulberry32(11);
    for (let k = 0; k < 160; k++) {
      const x = r() * w, y = r() * h, l = 10 + r() * 30;
      ctx.strokeStyle = 'rgba(255,255,230,' + (0.15 + r() * 0.3).toFixed(2) + ')';
      ctx.lineWidth = 2 + r() * 3;
      for (const ox of [-w, 0, w]) {
        ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.quadraticCurveTo(x + ox + l / 2, y + 4, x + ox + l, y); ctx.stroke();
      }
    }
  }, true);
}

function rayTexture() {
  return canvasTex(64, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.6, 'rgba(0,0,0,0.45)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  });
}

function dotTexture() {
  return canvasTex(32, 32, (ctx, w, h) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}

function woodTexture() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(0, 0, w, h);
    const r = mulberry32(5);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(' + (40 + Math.floor(r() * 40)) + ',25,10,0.25)';
      ctx.fillRect(0, i * 16, w, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, i * 16 + 14, w, 2);
    }
  }, true);
}

function signTexture() {
  return canvasTex(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#0d4a3a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffc933'; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9fffd8'; ctx.font = 'bold 62px "Avenir Next","Segoe UI",sans-serif';
    ctx.fillText('MARIANA TOURS', w / 2, 58);
    ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 32px "Avenir Next","Segoe UI",sans-serif';
    ctx.fillText('AMAZONAS · MAYA RIVER', w / 2, 112);
  });
}

/* Goldenes Maya-Relief: Glyphen-Raster auf dunklem Stein */
function reliefTexture() {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#34382a'; ctx.fillRect(0, 0, w, h);
    const r = mulberry32(31);
    ctx.strokeStyle = '#ffd24a'; ctx.fillStyle = '#ffd24a'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.strokeRect(8, 8, w - 16, h - 16);
    const cols = 2, rows = 5, cw = (w - 32) / cols, ch = (h - 32) / rows;
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const x0 = 16 + cx * cw + 8, y0 = 16 + cy * ch + 8, ww = cw - 16, hh = ch - 16;
      ctx.lineWidth = 4; ctx.strokeRect(x0, y0, ww, hh);
      const kind = Math.floor(r() * 4), mx = x0 + ww / 2, my = y0 + hh / 2;
      if (kind === 0) {
        ctx.beginPath(); ctx.arc(mx, my, ww * 0.28, 0, 6.283); ctx.stroke();
        ctx.fillRect(mx - 6, my - 6, 12, 12);
      } else if (kind === 1) {
        for (let k = 0; k < 4; k++) ctx.fillRect(x0 + 10 + k * 8, y0 + hh - 16 - k * 14, ww - 20 - k * 16, 10);
      } else if (kind === 2) {
        ctx.beginPath();
        ctx.moveTo(mx - ww * 0.3, my); ctx.lineTo(mx + ww * 0.3, my);
        ctx.moveTo(mx, my - hh * 0.3); ctx.lineTo(mx, my + hh * 0.3);
        ctx.stroke();
        ctx.fillRect(x0 + 8, y0 + 8, 12, 12); ctx.fillRect(x0 + ww - 20, y0 + hh - 20, 12, 12);
      } else {
        ctx.beginPath(); ctx.arc(mx - 10, my - 8, 10, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + 14, my - 8, 10, 0, 6.283); ctx.fill();
        ctx.fillRect(mx - 18, my + 8, 36, 8);
      }
    }
  }, true);
}

/* Maya-Sonnenscheibe mit Strahlen und Gesicht */
function sunTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 20, c, c, c);
    g.addColorStop(0, '#fff2a8'); g.addColorStop(0.55, '#ffc93a'); g.addColorStop(1, '#d98a10');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c - 6, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#7a4a08'; ctx.lineWidth = 6;
    [60, 110, 170, 225].forEach((rr) => { ctx.beginPath(); ctx.arc(c, c, rr, 0, 6.283); ctx.stroke(); });
    ctx.fillStyle = '#7a4a08';
    for (let i = 0; i < 16; i++) {
      ctx.save(); ctx.translate(c, c); ctx.rotate(i / 16 * 6.283);
      ctx.beginPath(); ctx.moveTo(180, -14); ctx.lineTo(240, 0); ctx.lineTo(180, 14); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillRect(c - 46, c - 34, 28, 22); ctx.fillRect(c + 18, c - 34, 28, 22);
    ctx.fillRect(c - 8, c - 8, 16, 34);
    ctx.fillRect(c - 40, c + 40, 80, 14); ctx.fillRect(c - 28, c + 58, 56, 10);
  });
}

/* ------------------------------------------------------------
   Korallen-Material (Instanzfarbe + Leuchten + Wiegen im Strom)
   ------------------------------------------------------------ */
const timeU = { value: 0 };

function coralMat(o) {
  o = o || {};
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: o.rough === undefined ? 0.55 : o.rough, metalness: 0,
    side: o.double ? THREE.DoubleSide : THREE.FrontSide
  });
  const sway = o.sway || 0;
  const glow = o.glow === undefined ? 0.28 : o.glow;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.uniforms.uSway = { value: sway };
    sh.uniforms.uGlow = { value: glow };
    sh.vertexShader = 'uniform float uTime;\nuniform float uSway;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x * 0.07 + instanceMatrix[3].z * 0.05;
         float amt = uSway * max(position.y, 0.0);
         transformed.x += sin(uTime * 1.4 + ph + position.y * 0.9) * amt;
         transformed.z += cos(uTime * 1.1 + ph * 1.3 + position.y * 0.8) * amt * 0.8;
       #endif`
    );
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uGlow;'
    );
  };
  m.customProgramCacheKey = () => 'coral-l4';
  return m;
}

/* ------------------------------------------------------------
   Korallen- und Pflanzen-Geometrien
   ------------------------------------------------------------ */
function geoBranch(r) {
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const grow = (base, dir, len, rad, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.72, rad, len, 5, 1, true);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    g.translate(base.x, base.y, base.z);
    parts.push(g);
    if (depth <= 0) return;
    const tip = base.clone().addScaledVector(dir, len);
    for (let i = 0; i < 2; i++) {
      const d = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.2, r() * 0.3, (r() - 0.5) * 1.2)).normalize();
      grow(tip, d, len * 0.74, rad * 0.72, depth - 1);
    }
  };
  for (let i = 0; i < 2; i++) {
    const d = new THREE.Vector3((r() - 0.5) * 0.6, 1, (r() - 0.5) * 0.6).normalize();
    grow(new THREE.Vector3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3), d, 1.5, 0.2, 3);
  }
  return mergeGeos(parts);
}

function geoBrain() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.09 * Math.sin(x * 8 + z * 3) * Math.sin(y * 8 + x * 2);
    x *= k; y *= k * 0.62; z *= k;
    p.setXYZ(i, x, Math.max(y, -0.25), z);
  }
  g.translate(0, 0.2, 0);
  g.computeVertexNormals();
  return g;
}

function geoTube(r) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.283, d = r() * 0.7, h = 1 + r() * 2.2, rad = 0.2 + r() * 0.12;
    const g = new THREE.CylinderGeometry(rad * 1.15, rad, h, 7, 1, true);
    g.translate(0, h / 2, 0);
    g.rotateZ((r() - 0.5) * 0.3);
    g.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    parts.push(g);
  }
  return mergeGeos(parts);
}

function geoSponge(r) {
  const parts = [];
  [[0, 0, 1.7, 0.55], [0.85, 0.35, 1.15, 0.42], [-0.6, 0.75, 0.95, 0.38], [0.15, -0.9, 1.35, 0.46], [-0.95, -0.35, 0.7, 0.32]].forEach(([x, z, h, rad]) => {
    const wob = 0.9 + r() * 0.2;
    const g = new THREE.CylinderGeometry(rad * 1.05 * wob, rad * 0.7, h, 10, 2, true);
    g.translate(0, h / 2 - 0.1, 0);
    g.translate(x, 0, z);
    parts.push(g);
    const ring = new THREE.TorusGeometry(rad * 1.05 * wob, 0.07, 5, 10);
    ring.rotateX(Math.PI / 2);
    ring.translate(x, h - 0.1, z);
    parts.push(ring);
  });
  return mergeGeos(parts);
}

function geoFan() {
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const a = 0.2 + i * (Math.PI - 0.4) / 11;
    const g = new THREE.CylinderGeometry(0.025, 0.04, 1.65, 4);
    g.translate(0, 0.825, 0);
    g.rotateZ(a - Math.PI / 2);
    parts.push(g);
  }
  [0.5, 0.95, 1.4].forEach((rad) => {
    const t = new THREE.TorusGeometry(rad, 0.025, 4, 20, Math.PI - 0.4);
    t.rotateZ(0.2);
    parts.push(t);
  });
  const stalk = new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5);
  stalk.translate(0, -0.1, 0);
  parts.push(stalk);
  return mergeGeos(parts);
}

function geoRock() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.22 * Math.sin(x * 4.1 + y * 2.3) * Math.cos(z * 3.7 - y * 1.9) + 0.1 * Math.sin(x * 9 + z * 7);
    p.setXYZ(i, x * k, Math.max(y * k, -0.4), z * k);
  }
  g.computeVertexNormals();
  return g;
}

function geoBlade() {
  const g = new THREE.PlaneGeometry(0.32, 2.4, 1, 4);
  g.translate(0, 1.2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 2.4;
    p.setX(i, p.getX(i) * (1 - t * 0.85));
    p.setZ(i, t * t * 0.6);
  }
  g.computeVertexNormals();
  return g;
}

/* Urzeit-Farn: bogenförmig überhängende, gezackte Wedel */
function geoFern(r) {
  const pos = [];
  const NF = 9, N = 8;
  for (let f = 0; f < NF; f++) {
    const az = f / NF * Math.PI * 2 + r() * 0.4, L = 2.6 + r() * 1.2, up = 0.9 + r() * 0.6;
    const ca = Math.cos(az), sa = Math.sin(az);
    const Lp = [], Rp = [];
    for (let j = 0; j <= N; j++) {
      const s = j / N, out = 0.15 + s * L;
      const y = Math.max(0.05, 0.2 + 2.2 * up * s - 2.6 * s * s);
      const cx = ca * out, cz = sa * out;
      const wd = 0.5 * Math.pow(1 - s, 0.7) * (j % 2 ? 1.0 : 0.62) + 0.02;
      Lp.push([cx - sa * wd, y, cz + ca * wd]);
      Rp.push([cx + sa * wd, y, cz - ca * wd]);
    }
    for (let j = 0; j < N; j++) pos.push(...Lp[j], ...Rp[j], ...Lp[j + 1], ...Rp[j], ...Rp[j + 1], ...Lp[j + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/* Jade-Kristallgruppe (sechseckige Prismen mit Spitze) */
function geoCrystal(r) {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const h = 1.2 + r() * 2.8 * (i === 0 ? 1.6 : 1), rad = 0.28 + r() * 0.22;
    const body = new THREE.CylinderGeometry(rad * 0.85, rad, h, 6, 1);
    body.translate(0, h / 2, 0);
    const tip = new THREE.ConeGeometry(rad * 0.85, rad * 1.6, 6);
    tip.translate(0, h + rad * 0.8, 0);
    const g = mergeGeos([body, tip]);
    const a = r() * 6.283, d = i === 0 ? 0 : 0.3 + r() * 0.7, tilt = i === 0 ? 0 : 0.25 + r() * 0.45;
    g.rotateZ(tilt); g.rotateY(a);
    g.translate(Math.cos(a + 1.3) * d * 0.9, -0.1, Math.sin(a + 1.3) * d * 0.9);
    parts.push(g);
  }
  return mergeGeos(parts);
}

/* ------------------------------------------------------------
   Maya-Steinmetzarbeiten: Säulen, Statuen, Köpfe, Stelen
   ------------------------------------------------------------ */
function geoColumn(nDrums, capital, lastShort) {
  const items = [];
  const col = stoneCol(4, nDrums);
  for (let i = 0; i < nDrums; i++) {
    const h = (i === nDrums - 1 && lastShort) ? 1.6 : 3.0;
    const g = new THREE.CylinderGeometry(1.75, 1.85, h, 10, 1);
    g.translate(0, i * 3.0 + h / 2, 0);
    items.push({ geo: g, col });
    if (i < nDrums - 1) {
      const ring = new THREE.TorusGeometry(1.86, 0.16, 5, 12);
      ring.rotateX(Math.PI / 2); ring.translate(0, (i + 1) * 3.0, 0);
      items.push({ geo: ring, col });
    }
  }
  if (capital) {
    const y = nDrums * 3.0;
    items.push({ geo: new THREE.BoxGeometry(4.8, 1.1, 4.8).translate(0, y + 0.55, 0), col });
    items.push({ geo: new THREE.BoxGeometry(3.8, 0.8, 3.8).translate(0, y + 1.5, 0), col });
  } else if (lastShort) {
    items.push({ geo: new THREE.BoxGeometry(1.2, 0.9, 1.0).translate(0.5, (nDrums - 1) * 3.0 + 2.0, 0.3), col });
  }
  return mergeColored(items);
}

function statueParts(col, withHead) {
  const items = [];
  const box = (w, h, d, x, y, z) => items.push({ geo: new THREE.BoxGeometry(w, h, d).translate(x, y, z), col });
  box(4.4, 1.8, 4.4, 0, 0.9, 0);                 // Sockel
  box(3.0, 4.2, 2.2, 0, 3.9, 0);                 // Körper
  box(4.6, 1.3, 2.4, 0, 6.65, 0);                // Schultern
  box(0.9, 3.4, 1.2, -2.55, 4.6, 0.2);           // Arme
  box(0.9, 3.4, 1.2, 2.55, 4.6, 0.2);
  if (withHead) {
    box(2.0, 2.2, 2.0, 0, 8.4, 0);               // Kopf
    box(0.5, 0.7, 0.6, 0, 8.25, 1.15);           // Nase
    box(3.0, 0.9, 2.8, 0, 9.95, 0);              // Kopfschmuck
    box(2.3, 1.0, 2.2, 0, 10.9, 0);
    box(1.4, 1.1, 1.4, 0, 11.95, 0);
  } else {
    box(1.4, 1.0, 1.2, 0.3, 7.7, 0.2);           // abgebrochener Hals
  }
  return items;
}
function geoStatue(broken) { return mergeColored(statueParts(stoneCol(5, broken ? 2 : 1), !broken)); }
function geoHead() {
  const col = stoneCol(2, 7);
  const items = [];
  const box = (w, h, d, x, y, z) => items.push({ geo: new THREE.BoxGeometry(w, h, d).translate(x, y, z), col });
  box(2.0, 2.2, 2.0, 0, 1.1, 0); box(0.5, 0.7, 0.6, 0, 0.95, 1.15);
  box(3.0, 0.9, 2.8, 0, 2.65, 0); box(2.3, 1.0, 2.2, 0, 3.6, 0); box(1.4, 1.1, 1.4, 0, 4.65, 0);
  return mergeColored(items);
}
function geoStela() {
  return mergeColored([{ geo: new THREE.BoxGeometry(2.8, 9.0, 1.1).translate(0, 4.5, 0), col: stoneCol(4, 3) }]);
}

/* ------------------------------------------------------------
   Mangrove: Stamm, Blätterdach, Stelzenwurzeln (mit Kollision),
   Luftwurzeln, die von oben ins Wasser hängen.
   Alles ist an der Wasseroberfläche (y = 0) verankert.
   ------------------------------------------------------------ */
function geoMangrove(r, opt) {
  const items = [], colliders = [];
  const big = !!opt.big;
  items.push({ geo: new THREE.CylinderGeometry(0.8, 1.15, 11, 7).translate(0, 2.5, 0), col: rootCol });

  const LEAF = [0x2f8a3a, 0x3da34a, 0x236b32, 0x4bb552];
  const nb = big ? 6 : 4;
  for (let i = 0; i < nb; i++) {
    const a = i / nb * 6.283 + r(), d = i === 0 ? 0 : 2.5 + r() * 3.5, rad = 3.2 + r() * 1.8;
    const bx = Math.cos(a) * d, bz = Math.sin(a) * d, by = 9.5 + r() * 2.5;
    const g = new THREE.IcosahedronGeometry(rad, 0);
    g.scale(1, 0.72, 1); g.translate(bx, by, bz);
    items.push({ geo: g, col: LEAF[i % 4] });
    items.push({ geo: cylBetween(new THREE.Vector3(0, 6.5, 0), new THREE.Vector3(bx * 0.8, by - 1.2, bz * 0.8), 0.42, 0.25, 5), col: rootCol });
  }
  /* Unterseite des Blätterdachs: von unten als dunkle Schatten an der Oberfläche sichtbar */
  const nm = big ? 7 : 4;
  for (let i = 0; i < nm; i++) {
    const a = i / nm * 6.283 + r(), d = 3 + r() * (big ? 7 : 4), rad = 4 + r() * 3;
    const g = new THREE.IcosahedronGeometry(rad, 0);
    g.scale(1, 0.3, 1); g.translate(Math.cos(a) * d, 2.3, Math.sin(a) * d);
    items.push({ geo: g, col: i % 2 ? 0x1f6b30 : 0x2a8a3a });
  }
  /* Stelzenwurzeln: steigen vom Stamm auf, bilden einen Bogen und enden im Flussbett */
  for (let k = 0; k < opt.roots; k++) {
    const a = k / opt.roots * 6.283 + (r() - 0.5) * 0.6;
    const Er = (big ? 8 : 6) + r() * (big ? 9 : 6), ca = Math.cos(a), sa = Math.sin(a);
    const sy = 1.0 + r() * 3.0;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.5, sy, sa * 0.5),
      new THREE.Vector3(ca * Er * 0.45, sy + 3 + r() * 1.5, sa * Er * 0.45),
      new THREE.Vector3(ca * Er * 0.85, -3 - r() * 3, sa * Er * 0.85),
      new THREE.Vector3(ca * Er, -34, sa * Er)
    ]);
    const rad = 0.7 + r() * 0.3;
    items.push({ geo: new THREE.TubeGeometry(curve, big ? 14 : 9, rad, 5, false), col: rootCol });
    if (opt.collide) {
      for (let q = 1; q <= 16; q++) {
        const pt = curve.getPoint(q / 16.5);
        if (pt.y < 3) colliders.push([pt.x, pt.y, pt.z, rad * 1.25]);
      }
    }
  }
  /* Luftwurzeln: dünn, hängen von oben ins Wasser */
  for (let k = 0; k < opt.hang; k++) {
    const a = r() * 6.283, d = 0.5 + r() * (big ? 8 : 5), sx = Math.cos(a) * d, sz = Math.sin(a) * d;
    const len = 6 + r() * 18, jx = (r() - 0.5) * 1.6, jz = (r() - 0.5) * 1.6;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 2.0, sz),
      new THREE.Vector3(sx + jx * 0.4, 2.0 - len * 0.35, sz + jz * 0.4),
      new THREE.Vector3(sx + jx, 2.0 - len, sz + jz)
    ]);
    items.push({ geo: new THREE.TubeGeometry(curve, 5, 0.2, 4, false), col: rootCol });
  }
  return { geo: mergeColored(items), colliders };
}

/* ------------------------------------------------------------
   Fische
   ------------------------------------------------------------ */
const SPECIES = {
  neon: { size: 1.5, speed: 5.4, shape: [0.3, 0.4, 1], body: (x, y, z) => (y > 0.0 ? 0x23d8ff : (z < 0.05 ? 0xff2f3a : 0xf4f4ff)), tail: 0xff5a5a, fin: 0xffd8d8 },
  piranha: { size: 2.7, speed: 4.6, shape: [0.3, 0.62, 0.95], body: (x, y) => (y < -0.08 ? 0xff5a2a : 0x6f8a96), tail: 0x2a2f33, fin: 0xff6a3a },
  discus: { size: 2.6, speed: 3.6, shape: [0.2, 1.0, 0.85], body: (x, y, z) => ((Math.abs(y) > 0.3 || (z > 0.25 && z < 0.32)) ? 0x1a9aa8 : 0xff9a2a), tail: 0xff7a2a, fin: 0x3fe0d0 },
  dorado: { size: 3.1, speed: 5.0, shape: [0.34, 0.55, 1.1], body: (x, y) => (y < -0.05 ? 0xfff0a0 : 0xffb020), tail: 0xff8a10, fin: 0xffd860 },
  rummy: { size: 2.0, speed: 5.2, shape: [0.3, 0.5, 1], body: (x, y, z) => (z > 0.2 ? 0xff3a3a : 0xdcdcdc), tail: 0xff3a3a, fin: 0xffffff }
};

function fishGeo(sp) {
  const body = new THREE.SphereGeometry(0.5, 12, 8);
  body.scale(sp.shape[0], sp.shape[1], sp.shape[2]);
  return mergeColored([
    { geo: body, col: sp.body },
    { geo: triGeo([0, 0, -0.42, 0, 0.3, -0.82, 0, -0.3, -0.82]), col: sp.tail },
    { geo: triGeo([0, 0.26, 0.22, 0, 0.54, -0.1, 0, 0.2, -0.28]), col: sp.fin },
    { geo: triGeo([0.15, -0.06, 0.2, 0.42, -0.2, -0.02, 0.14, -0.14, -0.04]), col: sp.fin },
    { geo: triGeo([-0.15, -0.06, 0.2, -0.42, -0.2, -0.02, -0.14, -0.14, -0.04]), col: sp.fin }
  ]);
}

/* ------------------------------------------------------------
   Großtiere: Schildkröte (Fluss) und rosa Flussdelfin (Boto)
   ------------------------------------------------------------ */
function buildTurtle() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const shellM = new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 0.6, flatShading: true });
  const plateM = new THREE.MeshStandardMaterial({ color: 0x3f6a2c, roughness: 0.6, flatShading: true });
  const bellyM = new THREE.MeshStandardMaterial({ color: 0xe9dcae, roughness: 0.7 });
  const skinM = new THREE.MeshStandardMaterial({ color: 0x8aa860, roughness: 0.65 });
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), shellM);
  shell.scale.set(1.15, 0.6, 1.55); body.add(shell);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bellyM);
  belly.scale.set(1.1, 0.28, 1.5); body.add(belly);
  [[0, 0.58, 0], [0.5, 0.5, 0.45], [-0.5, 0.5, 0.45], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]].forEach((q) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.34, 6, 4), plateM);
    p.scale.set(1, 0.35, 1); p.position.set(q[0], q[1], q[2]); body.add(p);
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), skinM);
  head.scale.set(1, 0.9, 1.25); head.position.set(0, 0.05, 1.75); body.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 10), skinM);
  neck.rotation.x = Math.PI / 2; neck.position.set(0, 0.03, 1.4); body.add(neck);
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeM);
    e.position.set(s * 0.27, 0.15, 1.95); body.add(e);
  });
  const fl = [];
  [-1, 1].forEach((s) => {
    const pv = new THREE.Group(); pv.position.set(s * 0.95, -0.05, 0.8);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 6), skinM);
    f.scale.set(1.3, 0.12, 0.45); f.position.set(s * 1.05, 0, 0.1); f.rotation.y = -s * 0.35;
    pv.add(f); body.add(pv); fl.push(pv);
  });
  [-1, 1].forEach((s) => {
    const pv = new THREE.Group(); pv.position.set(s * 0.75, -0.05, -1.2);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), skinM);
    f.scale.set(1.1, 0.12, 0.5); f.position.set(s * 0.5, 0, -0.1);
    pv.add(f); body.add(pv); fl.push(pv);
  });
  return { g, body, fl };
}

function buildDolphin() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const topM = new THREE.MeshStandardMaterial({ color: 0xe49ab8, roughness: 0.4, metalness: 0.05 });
  const botM = new THREE.MeshStandardMaterial({ color: 0xffd9e6, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.2 });
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), topM); torso.scale.set(0.42, 0.44, 1.35); body.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), botM); belly.scale.set(0.36, 0.3, 1.3); belly.position.y = -0.17; body.add(belly);
  const melon = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), topM); melon.scale.set(0.95, 0.9, 1.1); melon.position.set(0, 0.02, 1.2); body.add(melon);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.95, 10).rotateX(Math.PI / 2), topM); beak.position.set(0, -0.04, 1.78); body.add(beak);
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.85, 8).rotateX(Math.PI / 2), botM); jaw.position.set(0, -0.12, 1.72); body.add(jaw);
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), dark); e.position.set(s * 0.3, 0.1, 1.3); body.add(e);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 3), topM);
    f.scale.set(1, 1, 0.3); f.position.set(s * 0.42, -0.2, 0.6); f.rotation.set(0.4, 0, -s * 1.8); body.add(f);
  });
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 4), topM);
  dorsal.scale.set(1, 1, 0.28); dorsal.position.set(0, 0.5, 0.1); dorsal.rotation.x = -0.55; body.add(dorsal);
  const rear = new THREE.Group(); rear.position.set(0, 0, -1.15); body.add(rear);
  const stock = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), topM); stock.scale.set(0.24, 0.26, 1.1); stock.position.z = -0.6; rear.add(stock);
  const fluke = new THREE.Group(); fluke.position.set(0, 0, -1.6); rear.add(fluke);
  [-1, 1].forEach((s) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), topM);
    f.scale.set(0.55, 0.05, 0.3); f.position.set(s * 0.5, 0, -0.1); f.rotation.y = s * 0.45; fluke.add(f);
  });
  g.scale.setScalar(1.7);
  return { g, body, rear, fluke };
}

/* ============================================================
   buildLevel4
   ============================================================ */
export function buildLevel4(scene, renderer) {
  void renderer;
  const root = new THREE.Group();
  root.name = 'level4-maya-amazon';
  scene.add(root);

  const prevFog = scene.fog, prevBg = scene.background;
  scene.background = new THREE.Color(FOG_COL);
  scene.fog = new THREE.FogExp2(FOG_COL, FOG_BASE);

  const rng = mulberry32(20261124);
  const events = [];
  const ev = (type, data) => events.push(Object.assign({ type }, data));
  let time = 0;
  const dummy = new THREE.Object3D();
  const _tmp = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  /* ---------- Licht ---------- */
  root.add(new THREE.HemisphereLight(0xc8ffd6, 0xf6dc9c, 1.5));
  const sun = new THREE.DirectionalLight(0xffe7a6, 2.7);
  sun.position.set(-60, 220, 80);
  root.add(sun); root.add(sun.target);

  /* ---------- Wasseroberfläche (Seerosen-Schatten scheinen von oben durch) ---------- */
  const rippleTex = rippleTexture();
  rippleTex.repeat.set(70, 70);
  const surfGeo = new THREE.PlaneGeometry(3000, 3000); surfGeo.rotateX(-Math.PI / 2);
  root.add(new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({
    map: rippleTex, color: 0xbff5d8, side: THREE.BackSide, transparent: true, opacity: 0.66
  })));
  root.add(new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({
    map: rippleTex, color: 0x2fb89a, side: THREE.FrontSide, transparent: true, opacity: 0.8, depthWrite: false
  })));

  /* ---------- Flussboden (Höhenfeld) ---------- */
  const _mud = new THREE.Color(0.55, 0.42, 0.30), _moss = new THREE.Color(0.35, 0.55, 0.30), _rubble = new THREE.Color(0.72, 0.66, 0.5);
  const _bankMud = new THREE.Color(0.45, 0.34, 0.22), _jungle = new THREE.Color(0.18, 0.42, 0.16), _rockC = new THREE.Color(0.45, 0.42, 0.38);
  function floorColor(x, z, c, h, sl) {
    c.setRGB(0.80, 0.70, 0.48);                                   // goldener Flusssand
    const n1 = Math.sin(x * 0.011 + 1) * Math.sin(z * 0.013 + 2);
    if (n1 > 0.1) c.lerp(_mud, smooth(0.1, 0.7, n1) * 0.6);
    else if (n1 < -0.1) c.lerp(_moss, smooth(0.1, 0.7, -n1) * 0.55);
    let t = 0;
    for (let i = 0; i < PATCHES.length; i++) {
      const p = PATCHES[i], dx = x - p.x, dz = z - p.z, s = p.r * 0.7;
      t = Math.max(t, Math.exp(-(dx * dx + dz * dz) / (2 * s * s)));
    }
    c.lerp(_rubble, t * 0.5);
    c.multiplyScalar(0.88 + 0.12 * (0.5 + 0.5 * Math.sin(x * 0.33 + Math.sin(z * 0.2) * 2.2)));
    c.lerp(_moss, smooth(-16, -2, h) * 0.4);
    if (h > -3) c.lerp(_bankMud, smooth(-3, -0.5, h) * 0.7);
    if (h > 0.4) c.lerp(_jungle, smooth(0.4, 2.4, h) * 0.95);
    if (sl > 0.5) c.lerp(_rockC, smooth(0.5, 1.0, sl) * 0.8);
    if (h < -32) c.multiplyScalar(0.85 + 0.15 * smooth(-40, -32, h));
  }
  const causticTex = causticTexture();
  causticTex.repeat.set(60, 60);
  {
    const fg = new THREE.PlaneGeometry(760, 760, 230, 230);
    fg.rotateX(-Math.PI / 2);
    fg.translate(0, 0, -250);
    const p = fg.attributes.position;
    const col = new Float32Array(p.count * 3), c = new THREE.Color();
    const E = 2.5;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = floorH(x, z);
      const sl = Math.hypot(floorH(x + E, z) - h, floorH(x, z + E) - h) / E;
      p.setY(i, h);
      floorColor(x, z, c, h, sl);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    fg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    fg.computeVertexNormals();
    root.add(new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, map: causticTex, roughness: 0.95 })));
  }

  /* ---------- Goldene God Rays ---------- */
  const rayTex = rayTexture();
  const rays = [];
  for (let i = 0; i < 26; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: rayTex, color: 0xffe08a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const geo = new THREE.PlaneGeometry(6 + rng() * 16, 170); geo.translate(0, -85, 0);
    const m = new THREE.Mesh(geo, mat); m.rotation.y = rng() * Math.PI; m.renderOrder = 4;
    const holder = new THREE.Group(); holder.rotation.z = 0.28; holder.add(m);
    root.add(holder);
    rays.push({ holder, mat, bx: rng() * 360, bz: rng() * 360, ph: rng() * 6.28 });
  }

  /* ---------- Schwebende goldene Dschungel-Pollen ---------- */
  const dotTex = dotTexture();
  const PLK = 700, PLK_S = 120;
  const plkBase = new Float32Array(PLK * 3);
  for (let i = 0; i < PLK * 3; i++) plkBase[i] = rng() * PLK_S;
  const plkGeo = new THREE.BufferGeometry();
  const plkPos = new Float32Array(PLK * 3);
  plkGeo.setAttribute('position', new THREE.BufferAttribute(plkPos, 3));
  const pollen = new THREE.Points(plkGeo, new THREE.PointsMaterial({
    map: dotTex, size: 0.6, color: 0xffdf80, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  }));
  pollen.frustumCulled = false;
  root.add(pollen);

  /* ---------- Luftblasen vom Propeller ---------- */
  const BUB = 80;
  const bubPos = new Float32Array(BUB * 3).fill(-9999);
  const bubLife = new Float32Array(BUB);
  const bubGeo = new THREE.BufferGeometry();
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
  const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({
    map: dotTex, size: 0.7, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true
  }));
  bubbles.frustumCulled = false;
  root.add(bubbles);
  let bubAcc = 0, bubIdx = 0;

  /* ==========================================================
     Kollisions-Container
     ========================================================== */
  const spheres = [];                // statische Kugeln {x,y,z,r}
  const obbs = [];                   // gedrehte Boxen (Tor, Pyramide)
  const trees = [];                  // Mangroven mit Wurzel-Kugeln
  const treeObs = [];                // zusätzliche Baum-Hindernisse (Stämme) nur für Tiere
  const addSphere = (x, y, z, r) => spheres.push({ x, y, z, r });

  /* Koordinaten-Rahmen für Tor und Pyramide (lokal -> Welt) */
  function frame(o, ay) {
    const c = Math.cos(o.ry), s = Math.sin(o.ry);
    return { o, c, s, ay, toWorld: (lx, ly, lz) => new THREE.Vector3(o.x + lx * c + lz * s, ay + ly, o.z - lx * s + lz * c) };
  }
  const gateF = frame(GATE, floorH(GATE.x, GATE.z));
  const pyrF = frame(PYR, floorH(PYR.x, PYR.z));
  function addObb(F, cx, cz, hx, hz, ly0, ly1) {
    obbs.push({ ox: F.o.x, oz: F.o.z, c: F.c, s: F.s, cx, cz, hx, hz, y0: F.ay + ly0, y1: F.ay + ly1 });
  }

  function keepClear(x, z) {
    if (x > -28 && x < 28 && z > -36 && z < 52) return true;                                // Dock
    const dx = x - GATE.x, dz = z - GATE.z;
    const lx = dx * gateF.c - dz * gateF.s, lz = dx * gateF.s + dz * gateF.c;
    if (Math.abs(lx) < 46 && Math.abs(lz) < 26) return true;                                // Sonnentor
    if (Math.hypot(x - PYR.x, z - PYR.z) < 50) return true;                                 // Pyramide
    return false;
  }
  const blocked = keepClear;

  /* ==========================================================
     Platzierung von Pflanzen, Korallen, Felsen, Maya-Ruinen
     ========================================================== */
  const pl = {
    branch: [], brain: [], tube: [], fan: [], sponge: [], grass: [], fern: [], rock: [], crystal: [],
    colT: [], colM: [], colB: [], statue: [], statueB: [], head: [], stela: [], relief: []
  };
  const BRANCH_COLS = [0xff8a2a, 0xff4fd8, 0x2fe8c8, 0x9bff4a, 0xffd23a, 0xa05cff, 0xff4f6a];
  const BRAIN_COLS = [0xffc27a, 0x9bffb8, 0xffe27a, 0x7be8ff, 0xff9ac4, 0xc9a3ff, 0xff7a1a];
  const TUBE_COLS = [0x2fe8c8, 0xff4fd8, 0xffd23a, 0x9bff4a];
  const SPONGE_COLS = [0xff8a2a, 0xb05cff, 0xffd23a, 0x2fe8c8, 0xff5fa0];
  const FAN_COLS = [0xff5fa0, 0xff8a50, 0x2fe8c8, 0xffd23a, 0xc060ff, 0x9bff4a];
  const FERN_COLS = [0x2f9a3a, 0x3fc04a, 0x1f7a3a, 0x7ee060, 0x58b83a];
  const ROCK_COLS = [0x6f8a5a, 0x5a7a4a, 0x7a8a72, 0x8a8f7a, 0x4f6a45];
  const GRASS_COLS = [0x3fae4a, 0x5cd35a, 0x2e9a5a, 0x9ce06a];
  const JADE_COLS = [0x2fffd0, 0x20e8b8, 0x4dffe8, 0x18c9a0];
  const COLS = { branch: BRANCH_COLS, brain: BRAIN_COLS, tube: TUBE_COLS, sponge: SPONGE_COLS, fan: FAN_COLS, fern: FERN_COLS, rock: ROCK_COLS, crystal: JADE_COLS };

  function put(type, x, z, s, cols, extra, maxH) {
    if (blocked(x, z)) return null;
    const fy = floorH(x, z);
    if (fy > (maxH === undefined ? -3 : maxH)) return null;
    const o = { x, y: fy - 0.12, z, s, ry: rng() * 6.283, tx: (rng() - 0.5) * 0.14, tz: (rng() - 0.5) * 0.14, c: cols[Math.floor(rng() * cols.length)] };
    if (extra) Object.assign(o, extra);
    pl[type].push(o);
    return o;
  }
  const polar = (p, spread) => {
    const a = rng() * 6.283, r = p.r * spread * Math.sqrt(rng());
    return [p.x + Math.cos(a) * r, p.z + Math.sin(a) * r];
  };
  const pushGrass = (x, z, y) => {
    pl.grass.push({ x, y: y === undefined ? floorH(x, z) - 0.05 : y, z, s: 0.7 + rng() * 0.9, sy: 0.8 + rng() * 0.9, ry: rng() * 6.283, tx: 0, tz: 0, c: GRASS_COLS[Math.floor(rng() * GRASS_COLS.length)] });
  };
  const inChannel = (x, z, k) => Math.abs(x - riverX(z)) < halfW(z) - (k === undefined ? 30 : k);

  /* ---------- Korallen-Flecken, Farne, Moos-Felsen, Seegras ---------- */
  PATCHES.forEach((p) => {
    let x, z, o;
    for (let i = 0; i < dn(34); i++) { [x, z] = polar(p, 1); put('branch', x, z, 0.8 + rng() * 1.1, BRANCH_COLS); }
    for (let i = 0; i < dn(24); i++) {
      [x, z] = polar(p, 1.05);
      const s = 0.9 + rng() * 1.8;
      o = put('brain', x, z, s, BRAIN_COLS);
      if (o && s > 2.1) addSphere(x, o.y + s * 0.35, z, s * 0.8);
    }
    for (let i = 0; i < dn(18); i++) { [x, z] = polar(p, 1); put('tube', x, z, 0.8 + rng() * 0.8, TUBE_COLS); }
    for (let i = 0; i < dn(10); i++) { [x, z] = polar(p, 1); put('sponge', x, z, 0.9 + rng() * 1.1, SPONGE_COLS); }
    for (let i = 0; i < dn(18); i++) { [x, z] = polar(p, 1); put('fan', x, z, 1.2 + rng() * 1.4, FAN_COLS); }
    for (let i = 0; i < dn(40); i++) { [x, z] = polar(p, 1.2); put('fern', x, z, 1.1 + rng() * 1.5, FERN_COLS, null, 1); }
    for (let i = 0; i < 6; i++) {
      [x, z] = polar(p, 1.1);
      const s = 2.5 + rng() * 5.5;
      o = put('rock', x, z, s, ROCK_COLS, { sy: s * (0.7 + rng() * 0.4) });
      if (o && s > 3.4) addSphere(x, o.y + s * 0.25, z, s * 0.78);
    }
    for (let i = 0; i < dn(40); i++) {
      [x, z] = polar(p, 1.4);
      if (blocked(x, z)) continue;
      for (let k = 0; k < 5; k++) pushGrass(x + (rng() - 0.5) * 1.4, z + (rng() - 0.5) * 1.4);
    }
  });
  /* verstreute Moos-Felsen, Farne und Wasserpflanzen auf freiem Flussboden */
  for (let i = 0, tries = 0; i < dn(110) && tries < 600; tries++) {
    const z = lerp(40, -545, rng()), x = riverX(z) + (rng() - 0.5) * 2 * (halfW(z) - 26);
    const s = 1.5 + rng() * 3.5;
    const o = put('rock', x, z, s, ROCK_COLS, { sy: s * 0.8 });
    if (!o) continue;
    if (s > 2.8) addSphere(x, o.y + s * 0.25, z, s * 0.78);
    i++;
  }
  for (let i = 0, tries = 0; i < dn(220) && tries < 800; tries++) {
    const z = lerp(40, -545, rng()), x = riverX(z) + (rng() - 0.5) * 2 * (halfW(z) - 20);
    if (put('fern', x, z, 1.2 + rng() * 1.8, FERN_COLS, null, 1)) i++;
  }
  for (let i = 0, tries = 0; i < dn(70) && tries < 400; tries++) {
    const z = lerp(40, -545, rng()), x = riverX(z) + (rng() - 0.5) * 2 * (halfW(z) - 20);
    if (blocked(x, z) || floorH(x, z) > -4) continue;
    for (let k = 0; k < 6; k++) pushGrass(x + (rng() - 0.5) * 2, z + (rng() - 0.5) * 2);
    i++;
  }
  /* bunte Fluss-Korallen-Gruppen auf dem freien Flussboden */
  {
    const TYPES = ['branch', 'branch', 'brain', 'brain', 'fan', 'sponge', 'tube'];
    for (let i = 0; i < dn(60); i++) {
      const z = lerp(30, -540, rng()), cx = riverX(z) + (rng() - 0.5) * 2 * (halfW(z) - 40), cz = z;
      const n = 5 + Math.floor(rng() * 5);
      for (let k = 0; k < n; k++) {
        const aa = rng() * 6.283, rr = rng() * 9;
        const x = cx + Math.cos(aa) * rr, zz = cz + Math.sin(aa) * rr;
        const type = TYPES[Math.floor(rng() * TYPES.length)];
        put(type, x, zz, type === 'brain' ? 0.8 + rng() * 1.5 : 0.8 + rng() * 1.1, COLS[type]);
      }
    }
  }

  /* ---------- Maya-Ruinen verteilt im Fluss ---------- */
  function ruinCluster(cx, cz) {
    const n = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const a = rng() * 6.283, d = 3 + rng() * 9, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (blocked(x, z)) continue;
      const fy = floorH(x, z), kind = rng();
      if (kind < 0.38) {                                                  // aufrechte Säule
        const tall = rng() < 0.5, hgt = tall ? 18 : 11, tilt = (rng() - 0.5) * 0.12;
        pl[tall ? 'colT' : 'colM'].push({ x, y: fy - 0.6, z, s: 1, ry: rng() * 6.283, tx: tilt, tz: tilt * 0.7 });
        for (let h = 2; h < hgt - 1; h += 4.2) addSphere(x, fy - 0.6 + h, z, 2.1);
      } else if (kind < 0.54) {                                           // Säulenstumpf
        pl.colB.push({ x, y: fy - 0.6, z, s: 1, ry: rng() * 6.283, tx: 0, tz: 0 });
        addSphere(x, fy + 1.4, z, 2.4);
      } else if (kind < 0.7) {                                            // umgestürzte Säule
        const ang = rng() * 6.283;
        pl.colM.push({ x, y: fy + 1.4, z, s: 1, ry: ang, tx: 0, tz: Math.PI / 2 });
        for (let t = 2; t <= 10; t += 4) addSphere(x - Math.cos(ang) * t, fy + 1.4, z + Math.sin(ang) * t, 2.1);
      } else if (kind < 0.84) {                                           // (zerbrochene) Statue
        const broken = rng() < 0.6, tl = (rng() - 0.5) * 0.4;
        pl[broken ? 'statueB' : 'statue'].push({ x, y: fy - 0.5, z, s: 1, ry: rng() * 6.283, tx: tl, tz: tl * 0.6 });
        addSphere(x, fy + 2.2, z, 2.6); addSphere(x, fy + 5.4, z, 2.4);
        if (broken) {
          const hx = x + (rng() - 0.5) * 8, hz = z + (rng() - 0.5) * 8;
          pl.head.push({ x: hx, y: floorH(hx, hz) + 0.2, z: hz, s: 1, ry: rng() * 6.283, tx: 0.5 + rng() * 0.6, tz: (rng() - 0.5) * 0.8 });
          addSphere(hx, floorH(hx, hz) + 1.6, hz, 2.0);
        }
      } else {                                                            // Stele mit goldenem Relief
        const ry = rng() * 6.283, sn = Math.sin(ry), cs = Math.cos(ry);
        pl.stela.push({ x, y: fy - 0.8, z, s: 1, ry, tx: 0, tz: 0 });
        [1, -1].forEach((sg) => pl.relief.push({ x: x + sn * 0.58 * sg, y: fy - 0.8 + 5.2, z: z + cs * 0.58 * sg, s: 1, ry: ry + (sg < 0 ? Math.PI : 0), tx: 0, tz: 0 }));
        addSphere(x, fy + 1.5, z, 2.0); addSphere(x, fy + 4.5, z, 2.0); addSphere(x, fy + 7.5, z, 1.8);
      }
    }
    /* Jade-Kristalle, Moos-Felsen, Farne, Korallen und Gras drumherum */
    for (let k = 0; k < 1 + Math.floor(rng() * 2); k++) {
      const a = rng() * 6.283, d = 4 + rng() * 10;
      put('crystal', cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.9 + rng() * 1.5, JADE_COLS);
    }
    for (let k = 0; k < 3; k++) {
      const a = rng() * 6.283, d = 4 + rng() * 11, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const s = 2 + rng() * 3, o = put('rock', x, z, s, ROCK_COLS, { sy: s * 0.8 });
      if (o && s > 3.2) addSphere(x, o.y + s * 0.25, z, s * 0.78);
    }
    for (let k = 0; k < 8; k++) {
      const a = rng() * 6.283, d = 2 + rng() * 13;
      put('fern', cx + Math.cos(a) * d, cz + Math.sin(a) * d, 1.4 + rng() * 1.4, FERN_COLS, null, 1);
    }
    for (let k = 0; k < 4; k++) {
      const a = rng() * 6.283, d = 3 + rng() * 12, T = ['branch', 'brain', 'fan', 'tube'][Math.floor(rng() * 4)];
      put(T, cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.8 + rng() * 1.0, COLS[T]);
    }
    for (let k = 0; k < 10; k++) {
      const a = rng() * 6.283, d = 2 + rng() * 12, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!blocked(x, z) && floorH(x, z) < -4) pushGrass(x, z);
    }
  }
  for (let i = 0, tries = 0; i < dn(26) && tries < 300; tries++) {
    const z = lerp(10, -540, (i + rng() * 0.8) / 26), x = riverX(z) + (rng() - 0.5) * 2 * (halfW(z) - 70);
    if (blocked(x, z)) continue;
    ruinCluster(x, z);
    i++;
  }
  /* einzelne Jade-Kristalle */
  for (let i = 0, tries = 0; i < dn(16) && tries < 200; tries++) {
    const z = lerp(30, -540, rng()), x = riverX(z) + (rng() - 0.5) * 2 * (halfW(z) - 40);
    if (put('crystal', x, z, 1.2 + rng() * 1.8, JADE_COLS)) i++;
  }

  /* ==========================================================
     MANGROVEN: Stelzen- und Luftwurzeln, Bögen, Blätterdach
     ========================================================== */
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const rngT = mulberry32(777);
  const FULL = [0, 1, 2].map((i) => geoMangrove(rngT, { roots: 9, hang: 14, big: true, collide: true }));
  const BANK = geoMangrove(rngT, { roots: 4, hang: 6, big: false, collide: false });
  const treeInst = [[], [], [], []];                 // 3 volle Varianten + Ufer-Variante
  const treeXZ = [];

  function placeTree(v, x, z, s, ry) {
    treeInst[v].push({ x, z, s, ry });
    treeXZ.push([x, z]);
    /* Stamm- und Wurzelkern als Hindernis für Tiere (auch bei Ufer-Bäumen) */
    treeObs.push({ x, y: -1.5, z, r: 1.6 * s });
    treeObs.push({ x, y: -4.5, z, r: 2.4 * s });
    if (v === 3) treeObs.push({ x, y: -7, z, r: 5.5 * s });
    if (v > 2) return;
    const cs = Math.cos(ry), sn = Math.sin(ry), sp = [];
    FULL[v].colliders.forEach(([lx, ly, lz, r]) => {
      const wx = x + (lx * cs + lz * sn) * s, wz = z + (-lx * sn + lz * cs) * s, wy = ly * s;
      if (wy < floorH(wx, wz) - 1.0) return;         // im Boden versunken
      sp.push({ x: wx, y: wy, z: wz, r: r * s });
    });
    trees.push({ x, z, r2: (18 * s + 8) * (18 * s + 8), sp });
  }

  /* Mangroven-Inseln mitten im Fluss */
  for (let i = 0, tries = 0; i < dn(30) && tries < 500; tries++) {
    const z = lerp(20, -540, rng()), x = riverX(z) + (rng() - 0.5) * 2 * (halfW(z) - 48);
    if (keepClear(x, z) || Math.hypot(x - PYR.x, z - PYR.z) < 56) continue;
    if (treeXZ.some((q) => Math.hypot(q[0] - x, q[1] - z) < 30)) continue;
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const a = rng() * 6.283, d = k === 0 ? 0 : 7 + rng() * 5;
      const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d;
      if (keepClear(tx, tz) || floorH(tx, tz) > -8) continue;
      placeTree(Math.floor(rng() * 3), tx, tz, 0.95 + rng() * 0.4, rng() * 6.283);
    }
    i++;
  }
  /* Mangroven-Ring um die Pyramide (die Flussschlange gleitet hindurch) */
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * 6.283 + 0.2, d = 76 + (k % 3) * 6;
    const tx = PYR.x + Math.sin(a) * d, tz = PYR.z + Math.cos(a) * d;
    if (floorH(tx, tz) > -8) continue;
    placeTree(k % 3, tx, tz, 1.0 + rng() * 0.3, rng() * 6.283);
  }
  /* Zwei große Mangroven am Sonnentor */
  [-1, 1].forEach((sg, i) => {
    const w = gateF.toWorld(sg * 42, 0, 6 * sg);
    placeTree(i, w.x, w.z, 1.25, rng() * 6.283);
  });
  /* dichte Mangroven-Ufer */
  for (let z = 44; z > -548; z -= 11) {
    for (const side of [-1, 1]) {
      for (let row = 0; row < 2; row++) {
        const zz = z + (rng() - 0.5) * 8;
        const ad = halfW(zz) + (row ? 14 + rng() * 22 : -4 + rng() * 10);
        const x = riverX(zz) + side * ad + (rng() - 0.5) * 6;
        if (Math.abs(x) < 30 && zz > -36 && zz < 52) continue;
        if (rng() < 1 - 0.85 * DENSITY && DENSITY < 1) continue;
        placeTree(3, x, zz, 0.9 + rng() * 0.6, rng() * 6.283);
      }
    }
  }
  treeInst.forEach((list, v) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(v < 3 ? FULL[v].geo : BANK.geo, treeMat, list.length);
    list.forEach((o, i) => {
      dummy.position.set(o.x, 0, o.z);
      dummy.rotation.set(0, o.ry, 0);
      dummy.scale.setScalar(o.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    root.add(mesh);
  });

  /* ---------- Seerosenblätter und Blüten an der Oberfläche ---------- */
  {
    const padGeo = new THREE.CircleGeometry(1.2, 12, 0.35, Math.PI * 2 - 0.7);
    padGeo.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide });
    const pads = [], flowers = [];
    const PAD_COLS = [0x2f8a3a, 0x3da34a, 0x57b84a, 0x2a7a35];
    const okPad = (x, z) => !(x > -20 && x < 20 && z > -24 && z < 44) && floorH(x, z) < -2.5;
    treeXZ.forEach(([tx, tz]) => {
      if (Math.abs(tx - riverX(tz)) > halfW(tz) + 4) return;
      for (let k = 0; k < 6; k++) {
        const a = rng() * 6.283, d = 5 + rng() * 14, x = tx + Math.cos(a) * d, z = tz + Math.sin(a) * d;
        if (okPad(x, z)) pads.push([x, z, 0.8 + rng() * 1.4]);
      }
    });
    for (let i = 0, tries = 0; i < dn(160) && tries < 600; tries++) {
      const z = lerp(40, -545, rng()), x = riverX(z) + (rng() - 0.5) * 2 * (halfW(z) - 10);
      if (!okPad(x, z)) continue;
      const n = 1 + Math.floor(rng() * 4);
      for (let k = 0; k < n; k++) pads.push([x + (rng() - 0.5) * 7, z + (rng() - 0.5) * 7, 0.8 + rng() * 1.4]);
      i++;
    }
    const padMesh = new THREE.InstancedMesh(padGeo, padMat, pads.length);
    const col = new THREE.Color();
    pads.forEach(([x, z, s], i) => {
      dummy.position.set(x, 0.07, z); dummy.rotation.set(0, rng() * 6.283, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
      padMesh.setMatrixAt(i, dummy.matrix);
      col.setHex(PAD_COLS[Math.floor(rng() * PAD_COLS.length)]); padMesh.setColorAt(i, col);
      if (rng() < 0.18) flowers.push([x + (rng() - 0.5) * s, z + (rng() - 0.5) * s]);
    });
    padMesh.instanceMatrix.needsUpdate = true;
    if (padMesh.instanceColor) padMesh.instanceColor.needsUpdate = true;
    padMesh.frustumCulled = false;
    root.add(padMesh);
    if (flowers.length) {
      const fMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.38, 0.55, 7).translate(0, 0.3, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x442233 }), flowers.length);
      const FL = [0xff7ac8, 0xffffff, 0xffc0e0, 0xfff0a0];
      flowers.forEach(([x, z], i) => {
        dummy.position.set(x, 0.08, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1 + rng() * 0.8); dummy.updateMatrix();
        fMesh.setMatrixAt(i, dummy.matrix);
        col.setHex(FL[Math.floor(rng() * FL.length)]); fMesh.setColorAt(i, col);
      });
      fMesh.instanceMatrix.needsUpdate = true;
      if (fMesh.instanceColor) fMesh.instanceColor.needsUpdate = true;
      fMesh.frustumCulled = false;
      root.add(fMesh);
    }
  }

  /* ==========================================================
     SEHENSWÜRDIGKEIT 0: Versunkenes Maya-Sonnentor
     ========================================================== */
  const reliefTex = reliefTexture();
  const reliefMat = new THREE.MeshStandardMaterial({
    map: reliefTex, emissiveMap: reliefTex, emissive: 0xffffff, emissiveIntensity: 0.85,
    roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide
  });
  const gateRelief = reliefTex.clone();
  gateRelief.needsUpdate = true; gateRelief.wrapS = gateRelief.wrapT = THREE.RepeatWrapping; gateRelief.repeat.set(8, 1);
  const gateFriezeMat = new THREE.MeshStandardMaterial({
    map: gateRelief, emissiveMap: gateRelief, emissive: 0xffffff, emissiveIntensity: 0.8,
    roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide
  });
  const sunTex = sunTexture();
  const sunMat = new THREE.MeshStandardMaterial({
    map: sunTex, emissiveMap: sunTex, emissive: 0xffffff, emissiveIntensity: 1.0,
    alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.35
  });
  const haloMat = new THREE.MeshBasicMaterial({
    map: dotTex, color: 0xffd060, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false
  });
  const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });

  {
    const G = new THREE.Group();
    G.position.set(GATE.x, gateF.ay, GATE.z);
    G.rotation.y = GATE.ry;
    root.add(G);
    const col = stoneCol(9, 1.3), items = [];
    const box = (w, h, d, x, y, z) => items.push({ geo: new THREE.BoxGeometry(w, h, d).translate(x, y, z), col });
    [-1, 1].forEach((sg) => {
      box(11, 12.5, 9, sg * 18.5, 6.25 - 0.25, 0);          // Pfeiler
      box(13, 3.2, 11.6, sg * 19.5, 1.0, 0);                // Sockel
      box(1.4, 12, 0.9, sg * 13.9, 6, 4.8);                 // Pfeiler-Rippen
      box(1.4, 12, 0.9, sg * 13.9, 6, -4.8);
    });
    box(50, 8, 9, 0, 16, 0);                                // Fries-Balken
    box(54, 2.4, 11.2, 0, 21.2, 0);                         // Gesims
    box(50, 1.0, 10, 0, 22.9, 0);
    items.push({ geo: new THREE.BoxGeometry(9, 2.2, 9.6).translate(0, 24.3, 0), col });
    G.add(new THREE.Mesh(mergeColored(items), stoneMat));

    /* Kollision: Pfeiler, Sockel, Fries, Gesims (Durchfahrt ±13 m, 12 m hoch) */
    [-1, 1].forEach((sg) => {
      addObb(gateF, sg * 18.5, 0, 5.5, 4.5, -4, 12.5);
      addObb(gateF, sg * 19.5, 0, 6.5, 5.8, -4, 3.2);
    });
    addObb(gateF, 0, 0, 25, 4.5, 12, 20);
    addObb(gateF, 0, 0, 27, 5.6, 20, 23.4);

    /* goldene Reliefs auf den Pfeilern und dem Fries */
    [-1, 1].forEach((sg) => [1, -1].forEach((fz) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 9.2), reliefMat);
      m.position.set(sg * 18.5, 6.0, fz * 4.56); if (fz < 0) m.rotation.y = Math.PI;
      G.add(m);
    }));
    [1, -1].forEach((fz) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.0), gateFriezeMat);
      m.position.set(0, 14.2, fz * 4.56); if (fz < 0) m.rotation.y = Math.PI;
      G.add(m);
      /* Sonnenscheibe + Leuchtschein */
      const d = new THREE.Mesh(new THREE.CircleGeometry(4.0, 40), sunMat);
      d.position.set(0, 17.2, fz * 4.62); if (fz < 0) d.rotation.y = Math.PI;
      G.add(d);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(38, 38), haloMat);
      h.position.set(0, 17.2, fz * 5.1); h.renderOrder = 5;
      G.add(h);
    });
    const gl = new THREE.PointLight(0xffc860, 70, 55, 2); gl.position.set(0, 16, 0); G.add(gl);

    /* Vorhang aus herabhängenden Mangroven-Wurzeln (zum Hindurchtauchen) */
    const rootItems = [];
    for (let k = 0; k < 22; k++) {
      let lx = (rng() - 0.5) * 24;
      if (Math.abs(lx) < 3.5) lx = (lx < 0 ? -1 : 1) * (3.5 + rng() * 4);
      const lz = (rng() - 0.5) * 7, len = 2.5 + rng() * 6.5, j = (rng() - 0.5) * 0.8;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(lx, 12.2, lz), new THREE.Vector3(lx + j * 0.5, 12.2 - len * 0.5, lz), new THREE.Vector3(lx + j, 12.2 - len, lz + j * 0.4)
      ]);
      rootItems.push({ geo: new THREE.TubeGeometry(curve, 5, 0.16 + rng() * 0.1, 4, false), col: k % 3 === 0 ? 0x4d6a2c : 0x6b4a2f });
    }
    G.add(new THREE.Mesh(mergeColored(rootItems), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));
  }

  /* ==========================================================
     SEHENSWÜRDIGKEIT 1: Überwucherte Jade-Pyramide
     ========================================================== */
  const flames = [];
  const bowlWorld = [];
  {
    const P = new THREE.Group();
    P.position.set(PYR.x, pyrF.ay, PYR.z);
    P.rotation.y = PYR.ry;
    root.add(P);
    const col = stoneCol(8, 4.1), items = [];
    const box = (w, h, d, x, y, z) => items.push({ geo: new THREE.BoxGeometry(w, h, d).translate(x, y, z), col });
    const TH = PYR.th, NT = PYR.tiers;
    for (let t = 0; t < NT; t++) {
      const h = PYR.half0 - 5 * t, y0 = t === 0 ? -3 : t * TH, y1 = (t + 1) * TH;
      box(2 * h, y1 - y0, 2 * h, 0, (y0 + y1) / 2, 0);                 // Stufe
      box(2 * h + 1.4, 0.8, 2 * h + 1.4, 0, y1 - 0.4, 0);              // Randleiste
      addObb(pyrF, 0, 0, h, h, -4, y1);
      /* Treppen (vorne +z und hinten -z) */
      const base = t * TH, edge = h + 5;
      [1, -1].forEach((sg) => {
        for (let s = 0; s < 4; s++) {
          const run = (s + 1) * 1.25, ht = (s + 1) * 1.15;
          box(9, ht, run, 0, base + ht / 2, sg * (edge - run / 2));
          addObb(pyrF, 0, sg * (edge - run / 2), 4.5, run / 2, base, base + ht);
        }
      });
    }
    /* Tempelchen mit Dachkamm auf der Spitze */
    const top = NT * TH;
    box(14, 6, 12, 0, top + 3, 0);
    box(15.6, 1.2, 13.6, 0, top + 6.6, 0);
    box(11.5, 3.6, 1.8, 0, top + 9.0, 0);
    box(7, 2.0, 1.4, 0, top + 11.8, 0);
    items.push({ geo: new THREE.BoxGeometry(3.2, 4.2, 0.4).translate(0, top + 2.1, 6.15), col: 0x15251a });
    addObb(pyrF, 0, 0, 7, 6, top, top + 6);
    addObb(pyrF, 0, 0, 7.8, 6.8, top + 6, top + 7.2);
    P.add(new THREE.Mesh(mergeColored(items), stoneMat));

    /* leuchtender Eingang und goldene Reliefs */
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.8), new THREE.MeshBasicMaterial({ color: 0x35ffd8 }));
    door.position.set(0, top + 2.1, 6.4); P.add(door);
    [[7.08, 0, Math.PI / 2], [-7.08, 0, -Math.PI / 2]].forEach(([x, z, ry]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.4), reliefMat);
      m.position.set(x, top + 3.2, z); m.rotation.y = ry; P.add(m);
    });
    [1, -1].forEach((sg) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.0), reliefMat);
      m.position.set(0, top + 9.0, sg * 0.95); if (sg < 0) m.rotation.y = Math.PI; P.add(m);
    });

    /* Jade-Einlegearbeiten entlang der Stufen */
    const inl = [];
    for (let t = 0; t < NT; t++) {
      const h = PYR.half0 - 5 * t, y = t * TH + TH * 0.5 + (t === 0 ? 0 : 0);
      for (let k = -4; k <= 4; k++) {
        const u = k * (2 * h - 6) / 9;
        inl.push([u, y, h + 0.2, 0], [u, y, -h - 0.2, Math.PI], [h + 0.2, y, u, Math.PI / 2], [-h - 0.2, y, u, -Math.PI / 2]);
      }
    }
    const jadeInl = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.4, 0.5), new THREE.MeshStandardMaterial({
      color: 0x2fffd0, emissive: 0x10d8b0, emissiveIntensity: 1.2, roughness: 0.25, flatShading: true
    }), inl.length);
    inl.forEach((q, i) => {
      dummy.position.set(q[0], q[1], q[2]); dummy.rotation.set(0, q[3], 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      jadeInl.setMatrixAt(i, dummy.matrix);
    });
    jadeInl.instanceMatrix.needsUpdate = true; jadeInl.frustumCulled = false; P.add(jadeInl);

    /* Jade-Feuerschalen auf den Ecken der Stufen 1, 3 und 5 */
    const bowlGeo = mergeColored([
      { geo: new THREE.CylinderGeometry(1.5, 1.0, 1.1, 10).translate(0, 0.55, 0), col: stoneCol(1, 9) },
      { geo: new THREE.TorusGeometry(1.5, 0.18, 5, 12).rotateX(Math.PI / 2).translate(0, 1.1, 0), col: 0xd8b24a }
    ]);
    const flameGeo = new THREE.ConeGeometry(0.9, 2.6, 8).translate(0, 1.3, 0);
    const flameM = new THREE.MeshBasicMaterial({ color: 0x4dffe0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const flameM2 = new THREE.MeshBasicMaterial({ color: 0x20e8b8, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    [0, 2, 4].forEach((t) => {
      const h = PYR.half0 - 5 * t - 2.4, y = (t + 1) * TH;
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const bx = sx * h, bz = sz * h;
        const bowl = new THREE.Mesh(bowlGeo, stoneMat); bowl.position.set(bx, y, bz); P.add(bowl);
        const f1 = new THREE.Mesh(flameGeo, flameM); f1.position.set(bx, y + 1.0, bz); P.add(f1);
        const f2 = new THREE.Mesh(flameGeo, flameM2); f2.position.set(bx, y + 1.0, bz); f2.scale.set(1.8, 1.5, 1.8); P.add(f2);
        flames.push({ f1, f2, ph: rng() * 6.28 });
        bowlWorld.push(pyrF.toWorld(bx, y + 1.4, bz));
        if (t === 4) {
          const L = new THREE.PointLight(0x35ffd6, 55, 48, 2); L.position.set(bx, y + 2.5, bz); P.add(L);
        }
      });
    });
    /* Farne auf den Stufen */
    for (let t = 0; t < NT; t++) {
      const h = PYR.half0 - 5 * t;
      for (let k = 0; k < 10; k++) {
        const u = (rng() * 2 - 1) * (h - 1.5), side = Math.floor(rng() * 4), edge = h - 1.2;
        const lx = side < 2 ? u : (side === 2 ? edge : -edge), lz = side < 2 ? (side === 0 ? edge : -edge) : u;
        const w = pyrF.toWorld(lx, (t + 1) * TH, lz);
        pl.fern.push({ x: w.x, y: w.y - 0.1, z: w.z, s: 1.2 + rng() * 1.0, ry: rng() * 6.283, tx: 0, tz: 0, c: FERN_COLS[Math.floor(rng() * FERN_COLS.length)] });
      }
    }
    /* Jade-Kristalle am Fuß der Pyramide */
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * 6.283 + 0.3, d = 44 + rng() * 6;
      const x = PYR.x + Math.cos(a) * d, z = PYR.z + Math.sin(a) * d;
      pl.crystal.push({ x, y: floorH(x, z) - 0.1, z, s: 1.3 + rng() * 1.4, ry: rng() * 6.283, tx: 0, tz: 0, c: JADE_COLS[Math.floor(rng() * JADE_COLS.length)] });
    }
  }
  /* goldene Partikel, die aus den Feuerschalen aufsteigen */
  const GP = 120;
  const gpGeo = new THREE.BufferGeometry();
  const gpPos = new Float32Array(GP * 3);
  gpGeo.setAttribute('position', new THREE.BufferAttribute(gpPos, 3));
  const gpSeed = Array.from({ length: GP }, () => [rng(), rng(), rng()]);
  const goldPts = new THREE.Points(gpGeo, new THREE.PointsMaterial({
    map: dotTex, size: 0.7, color: 0xffd860, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  goldPts.frustumCulled = false;
  root.add(goldPts);

  /* ---------- Instanzierte Pflanzen, Korallen, Steine, Ruinen ---------- */
  function makeInst(geo, mat, list) {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const col = new THREE.Color();
    list.forEach((o, i) => {
      dummy.position.set(o.x, o.y, o.z);
      dummy.rotation.set(o.tx || 0, o.ry || 0, o.tz || 0);
      dummy.scale.set(o.s, o.sy || o.s, o.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (o.c !== undefined) {
        col.setHex(o.c);
        col.offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.12);
        mesh.setColorAt(i, col);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  }
  const rngG = mulberry32(4242);
  makeInst(geoBranch(rngG), coralMat({ sway: 0.03, glow: 0.3 }), pl.branch);
  makeInst(geoBrain(), coralMat({ glow: 0.22 }), pl.brain);
  makeInst(geoTube(rngG), coralMat({ double: true, glow: 0.32 }), pl.tube);
  makeInst(geoSponge(rngG), coralMat({ double: true, glow: 0.3 }), pl.sponge);
  makeInst(geoFan(), coralMat({ double: true, sway: 0.05, glow: 0.3 }), pl.fan);
  makeInst(geoFern(rngG), coralMat({ double: true, sway: 0.08, glow: 0.2, rough: 0.8 }), pl.fern);
  makeInst(geoRock(), coralMat({ glow: 0, rough: 0.95 }), pl.rock);
  makeInst(geoBlade(), coralMat({ double: true, sway: 0.12, glow: 0.15, rough: 0.8 }), pl.grass);
  makeInst(geoCrystal(rngG), new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x10d8b0, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.93
  }), pl.crystal);
  makeInst(geoColumn(6, true, false), stoneMat, pl.colT);
  makeInst(geoColumn(4, false, true), stoneMat, pl.colM);
  makeInst(geoColumn(2, false, true), stoneMat, pl.colB);
  makeInst(geoStatue(false), stoneMat, pl.statue);
  makeInst(geoStatue(true), stoneMat, pl.statueB);
  makeInst(geoHead(), stoneMat, pl.head);
  makeInst(geoStela(), stoneMat, pl.stela);
  makeInst(new THREE.PlaneGeometry(2.2, 6.2), reliefMat, pl.relief);

  /* ==========================================================
     HINDERNIS-RASTER für alle schwimmenden Tiere
     Enthält:
       - alle statischen Kugeln (Säulen, Statuen, Stelen, Felsen, große Korallen)
       - Mangroven-Stelzenwurzeln + Stamm-/Wurzelkerne aller Bäume
       - ALLE Felsen, Gehirnkorallen und Jade-Kristalle (auch kleine)
       - Dock-Pfosten
       - Sonnentor und Pyramide (gedrehte Boxen, 3D)
     Alles liegt in einem 2D-Raster (Zellen 24 m), damit pro Tier nur
     wenige Hindernisse geprüft werden müssen.
     ========================================================== */
  const OB_C = 24, OB_M = 12;
  const obGrid = new Map();
  const obKey = (ix, iz) => (ix + 2048) * 8192 + (iz + 2048);
  {
    const obAll = [];
    spheres.forEach((c) => obAll.push({ t: 0, x: c.x, y: c.y, z: c.z, r: c.r }));
    trees.forEach((T) => T.sp.forEach((c) => obAll.push({ t: 0, x: c.x, y: c.y, z: c.z, r: c.r })));
    treeObs.forEach((c) => obAll.push({ t: 0, x: c.x, y: c.y, z: c.z, r: c.r }));
    pl.rock.forEach((o) => obAll.push({ t: 0, x: o.x, y: o.y + (o.sy || o.s) * 0.3, z: o.z, r: o.s * 0.85 }));
    pl.brain.forEach((o) => obAll.push({ t: 0, x: o.x, y: o.y + o.s * 0.4, z: o.z, r: o.s * 0.9 }));
    pl.crystal.forEach((o) => obAll.push({ t: 0, x: o.x, y: o.y + o.s * 1.5, z: o.z, r: o.s * 1.3 }));
    DOCK_PILLARS.forEach((q) => { [-3, -9, -15, -21].forEach((y) => obAll.push({ t: 0, x: q[0], y, z: q[1], r: 1.0 })); });
    obbs.forEach((b) => {
      const wx = b.ox + b.cx * b.c + b.cz * b.s, wz = b.oz - b.cx * b.s + b.cz * b.c;
      obAll.push({ t: 1, b, x: wx, z: wz, r: Math.hypot(b.hx, b.hz) });
    });
    obAll.forEach((o) => {
      const r = o.r + OB_M;
      const ix0 = Math.floor((o.x - r) / OB_C), ix1 = Math.floor((o.x + r) / OB_C);
      const iz0 = Math.floor((o.z - r) / OB_C), iz1 = Math.floor((o.z + r) / OB_C);
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iz = iz0; iz <= iz1; iz++) {
          const k = obKey(ix, iz);
          let l = obGrid.get(k);
          if (!l) { l = []; obGrid.set(k, l); }
          l.push(o);
        }
      }
    });
  }
  /* Lenkt ein Tier um Hindernisse herum.
     pos: wird bei Berührung (Abstand < margin) herausgeschoben,
     vel: (optional) verliert die Bewegung ins Hindernis und bekommt in der
     weichen Zone (margin .. margin+4) einen sanften Ausweich-Impuls. */
  function avoidObs(pos, vel, margin, dt) {
    const list = obGrid.get(obKey(Math.floor(pos.x / OB_C), Math.floor(pos.z / OB_C)));
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.t === 0) {
        const dx = pos.x - o.x, dy = pos.y - o.y, dz = pos.z - o.z;
        const lim = o.r + margin, sf = lim + 4;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= sf * sf) continue;
        const d = Math.sqrt(d2) || 0.0001;
        const nx = dx / d, ny = dy / d, nz = dz / d;
        if (d < lim) {
          pos.x = o.x + nx * lim; pos.y = o.y + ny * lim; pos.z = o.z + nz * lim;
          if (vel) {
            const vn = vel.x * nx + vel.y * ny + vel.z * nz;
            if (vn < 0) { vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
          }
        } else if (vel && dt > 0) {
          const k = (sf - d) / 4 * 30 * dt;
          vel.x += nx * k; vel.y += ny * k; vel.z += nz * k;
        }
      } else {
        const b = o.b;
        const dx = pos.x - b.ox, dz = pos.z - b.oz;
        const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
        const qx = clamp(lx, b.cx - b.hx, b.cx + b.hx), qy = clamp(pos.y, b.y0, b.y1), qz = clamp(lz, b.cz - b.hz, b.cz + b.hz);
        const ex = lx - qx, ey = pos.y - qy, ez = lz - qz;
        const d2 = ex * ex + ey * ey + ez * ez;
        const sf = margin + 4;
        if (d2 >= sf * sf) continue;
        let nlx = 0, ny = 0, nlz = 0, d, inside = false;
        if (d2 > 1e-8) { d = Math.sqrt(d2); nlx = ex / d; ny = ey / d; nlz = ez / d; }
        else {                                   // im Inneren der Box: über die nächste Fläche hinaus
          const pxm = lx - (b.cx - b.hx), pxp = (b.cx + b.hx) - lx, pzm = lz - (b.cz - b.hz), pzp = (b.cz + b.hz) - lz, pym = pos.y - b.y0, pyp = b.y1 - pos.y;
          const m = Math.min(pxm, pxp, pzm, pzp, pym, pyp);
          if (m === pxm) nlx = -1; else if (m === pxp) nlx = 1; else if (m === pzm) nlz = -1; else if (m === pzp) nlz = 1; else if (m === pym) ny = -1; else ny = 1;
          d = -m; inside = true;
        }
        const nx = nlx * b.c + nlz * b.s, nz = -nlx * b.s + nlz * b.c;
        if (d < margin) {
          const push = margin - d;
          pos.x += nx * push; pos.y += ny * push; pos.z += nz * push;
          if (vel) {
            const vn = vel.x * nx + vel.y * ny + vel.z * nz;
            if (vn < 0) { vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
          }
        } else if (vel && dt > 0 && !inside) {
          const k = (sf - d) / 4 * 30 * dt;
          vel.x += nx * k; vel.y += ny * k; vel.z += nz * k;
        }
      }
    }
  }
  /* Bahnen mit Ausweichen (Delfine/Schildkröten): Die Projektion aus dem
     Hindernis heraus ist stetig, die Bahn bleibt also ruckelfrei. */
  function orbitSafe(o, t, out, margin) { orbitPos(o, t, out); avoidObs(out, null, margin, 0); return out; }
  function dolphinSafe(i, t, out, margin) { dolphinPos(i, t, out); avoidObs(out, null, margin, 0); return out; }

  /* ==========================================================
     Dock (Plattform an der Oberfläche) – Pfosten bis in den Sand
     ========================================================== */
  const buoys = [];
  {
    const dock = new THREE.Group(); root.add(dock);
    const woodTex = woodTexture();
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
    const jadeM = new THREE.MeshBasicMaterial({ color: 0x4dffe0 });
    const add = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); dock.add(b); return b; };

    DOCK_PILLARS.forEach(([x, z]) => {
      const fl = floorH(x, z), top = 0.5, bot = fl - 1.5, h = top - bot;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, h, 10), darkWood);
      pil.position.set(x, (top + bot) / 2, z);
      dock.add(pil);
    });
    [-1, 1].forEach((s) => {
      add(4.2, 1.0, 48, wood, s * 11.1, 0.3, 8);
      add(0.2, 0.2, 48, darkWood, s * 13.0, 1.9, 8);
      [-3, -12, -22].forEach((y) => add(0.35, 0.35, 48, darkWood, s * 11.1, y, 8));
      for (let z = -14; z <= 30; z += 6) add(0.2, 1.4, 0.2, darkWood, s * 13.0, 1.3, z);
      /* Maya-Steinfackel mit Jade-Flamme */
      const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x8f9a86, roughness: 0.9, flatShading: true }));
      torch.position.set(s * 12.4, 2.2, -14); dock.add(torch);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), jadeM);
      flame.position.set(s * 12.4, 4.2, -14); dock.add(flame);
    });
    add(26.4, 1.0, 5, wood, 0, 0.3, 34.5);
    [-3, -12, -22].forEach((y) => add(26.4, 0.35, 0.35, darkWood, 0, y, 35));
    [-8, 8].forEach((x) => add(0.4, 8, 0.4, darkWood, x, 4.8, 36.6));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.4), new THREE.MeshBasicMaterial({ map: signTexture() }));
    sign.rotation.y = Math.PI; sign.position.set(0, 7.2, 36.3); dock.add(sign);
    add(14.6, 5, 0.3, darkWood, 0, 7.2, 36.7);
    add(1.4, 1.2, 1.4, darkWood, -9, 1.4, 33);
    add(1.2, 1.0, 1.2, darkWood, -7.4, 1.3, 33.4);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.5 }));
    barrel.position.set(8.5, 1.5, 33.2); dock.add(barrel);
    /* Palmen */
    const palmM = new THREE.MeshStandardMaterial({ color: 0x2e9a4a, roughness: 0.7, side: THREE.DoubleSide });
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.8 });
    const nutM = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.6 });
    [[-11, 35], [11, 35], [-4.5, 36], [4.5, 36]].forEach(([x, z], i) => {
      const palm = new THREE.Group(); palm.position.set(x, 0.8, z); palm.rotation.z = (i % 2 ? -1 : 1) * 0.12; dock.add(palm);
      const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 7, 8); trunkGeo.translate(0, 3.5, 0);
      palm.add(new THREE.Mesh(trunkGeo, trunkM));
      const top = new THREE.Group(); top.position.y = 7; palm.add(top);
      for (let k = 0; k < 7; k++) {
        const lg = new THREE.Group(); lg.rotation.y = k / 7 * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 4), palmM);
        leaf.position.set(0, 0, 2); leaf.rotation.x = 0.5; lg.add(leaf); top.add(lg);
      }
      for (let k = 0; k < 3; k++) {
        const nut = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), nutM);
        nut.position.set(Math.cos(k * 2.1) * 0.35, -0.2, Math.sin(k * 2.1) * 0.35); top.add(nut);
      }
    });
    [[-9, -19], [9, -19], [0, -24]].forEach(([x, z], i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xff3a3a, roughness: 0.4 }));
      b.position.set(x, 0.1, z); dock.add(b); buoys.push({ m: b, ph: i * 1.7 });
    });
  }

  /* ==========================================================
     Fisch-Schwärme: Piranhas, Neonfische, Diskus, Dorado, Rummy
     ========================================================== */
  const fishMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x222222 });
  const fishGeos = {};
  Object.keys(SPECIES).forEach((k) => { fishGeos[k] = fishGeo(SPECIES[k]); });
  const schools = [];
  function centerAt(s, t, out) {
    const a = t * s.w + s.ph;
    out.x = s.base.x + Math.sin(a) * s.R;
    out.z = s.base.z + Math.cos(a * 0.83) * s.R * 0.8;
    out.y = Math.min(-3, floorH(out.x, out.z) + s.h + Math.sin(a * 0.7) * 2.5);
    return out;
  }
  function addSchool(spKey, base, R, n, h, w) {
    const sp = SPECIES[spKey];
    const mesh = new THREE.InstancedMesh(fishGeos[spKey], fishMat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    root.add(mesh);
    const s = { sp: spKey, base, R, h, w, ph: rng() * 6.28, mesh, fish: [], c: new THREE.Vector3(), cvel: new THREE.Vector3(), maxSp: sp.speed };
    centerAt(s, 0, s.c);
    const spread = spKey === 'neon' || spKey === 'rummy' ? 6 : 7;
    for (let i = 0; i < n; i++) {
      const off = new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 0.6, rng() - 0.5).normalize().multiplyScalar(spread * Math.cbrt(rng()));
      s.fish.push({
        pos: s.c.clone().add(off), vel: new THREE.Vector3((rng() - 0.5) * 2, 0, (rng() - 0.5) * 2),
        off, ph: rng() * 6.28, size: sp.size * (0.85 + rng() * 0.3)
      });
    }
    schools.push(s);
  }
  {
    const ORDER = ['neon', 'piranha', 'discus', 'dorado', 'rummy', 'piranha', 'neon', 'discus'];
    for (let i = 0; i < 18; i++) {
      const z = lerp(15, -520, i / 17) + (rng() - 0.5) * 20;
      const base = { x: riverX(z) + (rng() - 0.5) * 70, z };
      const key = ORDER[i % ORDER.length];
      const n = key === 'neon' || key === 'rummy' ? 32 : 26;
      addSchool(key, base, 26 + rng() * 14, n, 6 + rng() * 8, 0.09 + rng() * 0.05);
    }
  }
  function updateSchool(s, dt) {
    _tmp.copy(s.c);
    centerAt(s, time, s.c);
    s.cvel.copy(s.c).sub(_tmp).multiplyScalar(1 / Math.max(dt, 0.001));
    const kv = 1 - Math.exp(-2.2 * dt);
    for (let i = 0; i < s.fish.length; i++) {
      const f = s.fish[i];
      const k = 1 + 0.25 * Math.sin(time * 0.9 + f.ph);
      const tx = s.c.x + f.off.x * k, ty = s.c.y + f.off.y * k, tz = s.c.z + f.off.z * k;
      f.vel.x += ((s.cvel.x + (tx - f.pos.x) * 0.8) - f.vel.x) * kv;
      f.vel.y += ((s.cvel.y + (ty - f.pos.y) * 0.8) - f.vel.y) * kv;
      f.vel.z += ((s.cvel.z + (tz - f.pos.z) * 0.8) - f.vel.z) * kv;
      const spd = f.vel.length();
      if (spd > s.maxSp) f.vel.multiplyScalar(s.maxSp / spd);
      f.pos.addScaledVector(f.vel, dt);
      avoidObs(f.pos, f.vel, f.size * 0.55 + 0.8, dt);     // Bäume, Wurzeln, Säulen, Felsen, Tor, Pyramide umschwimmen
      const fl = floorH(f.pos.x, f.pos.z) + 1.2;
      if (f.pos.y < fl) f.pos.y = fl;
      if (f.pos.y > -2) f.pos.y = -2;
      dummy.position.copy(f.pos);
      if (spd > 0.05) { _look.copy(f.pos).add(f.vel); dummy.lookAt(_look); }
      dummy.rotateY(Math.sin(time * 8 + f.ph) * 0.12);
      dummy.scale.setScalar(f.size);
      dummy.updateMatrix();
      s.mesh.setMatrixAt(i, dummy.matrix);
    }
    s.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ==========================================================
     Schildkröten und rosa Flussdelfine
     ========================================================== */
  const turtles = [];
  [[2, 1.8], [5, 2.2], [8, 1.6], [11, 2.0], [14, 1.9]].forEach(([pi, size], i) => {
    const t = buildTurtle();
    t.g.scale.setScalar(size);
    root.add(t.g);
    const p = PATCHES[pi];
    const o = { cx: p.x, cz: p.z, Rx: 30 + i * 7, Rz: 26 + i * 6, w: 0.06 + i * 0.005, ph: i * 1.9, h0: 8 + i * 1.6, hA: 3.5, m: size * 2.2 };
    turtles.push({ t, o, ph: i * 1.3, pos: t.g.position });
    orbitSafe(o, 0, t.g.position, o.m);
  });
  const dolphins = [];
  for (let i = 0; i < 4; i++) {
    const d = buildDolphin();
    root.add(d.g);
    const D = { d, i, ph: i * 0.9, pos: d.g.position };
    dolphinSafe(i, 0, D.pos, 4.5);
    dolphins.push(D);
  }

  /* ==========================================================
     SEHENSWÜRDIGKEIT 2: Quetzalcoatl – gefiederte Flussschlange
     Smaragdgrün-golden, leuchtende Augen, Kollisions-Kugeln entlang
     des ganzen Körpers (Bounce-Rückstoß). Jedes Körperglied weicht
     Mangroven, Ruinen, Felsen und der Pyramide aus.
     ========================================================== */
  const SERP = { N: 46, space: 3.0, R0: 3.4, w: 0.055, ring: 74 };
  const segPos = Array.from({ length: SERP.N }, () => new THREE.Vector3());
  const segR = Array.from({ length: SERP.N }, (_, i) => (i === 0 ? SERP.R0 : SERP.R0 * 0.85 * (1 - 0.78 * smooth(0.3, 1, i / (SERP.N - 1)))));
  const headCol = new THREE.Vector3();
  const serpPt = new THREE.Vector3(), serpAhead = new THREE.Vector3();

  function serpPath(a, wig, out) {
    const rad = SERP.ring + 9 * Math.sin(2 * a + 0.6) + 4 * Math.sin(5 * a) + wig * 1.8;
    out.x = PYR.x + Math.sin(a) * rad;
    out.z = PYR.z + Math.cos(a) * rad * 0.92;
    out.y = Math.min(-5, floorH(out.x, out.z) + 13 + 6 * Math.sin(3 * a + 1) + wig * 1.4);
    return out;
  }

  const serpBody = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.35, metalness: 0.15, emissive: 0x0a3a22, emissiveIntensity: 0.6
  }), SERP.N);
  serpBody.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  serpBody.frustumCulled = false;
  {
    const c = new THREE.Color();
    for (let i = 0; i < SERP.N; i++) { c.setHex(i % 3 === 1 ? 0xf0b928 : 0x12a064); serpBody.setColorAt(i, c); }
    serpBody.instanceColor.needsUpdate = true;
  }
  root.add(serpBody);

  const featherGeo = new THREE.ConeGeometry(0.5, 3, 4); featherGeo.translate(0, 1.5, 0); featherGeo.rotateX(-Math.PI / 2);
  const serpFeathers = new THREE.InstancedMesh(featherGeo, new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.5, emissive: 0x103a30, emissiveIntensity: 0.6, side: THREE.DoubleSide
  }), SERP.N);
  serpFeathers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  serpFeathers.frustumCulled = false;
  {
    const c = new THREE.Color(), FC = [0x25e8d0, 0xffc933, 0xff5a4a, 0x40e070];
    for (let i = 0; i < SERP.N; i++) { c.setHex(FC[i % 4]); serpFeathers.setColorAt(i, c); }
    serpFeathers.instanceColor.needsUpdate = true;
  }
  root.add(serpFeathers);

  const head = new THREE.Group();
  const serpHead = { head, tongue: [] };
  {
    const emM = new THREE.MeshStandardMaterial({ color: 0x14a868, roughness: 0.35, metalness: 0.15, emissive: 0x0a3a22, emissiveIntensity: 0.6 });
    const goM = new THREE.MeshStandardMaterial({ color: 0xf2b52a, roughness: 0.3, metalness: 0.5, emissive: 0x6a4400, emissiveIntensity: 0.5 });
    const whM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const reM = new THREE.MeshStandardMaterial({ color: 0xe8403a, roughness: 0.4, emissive: 0x551010, emissiveIntensity: 0.5 });
    const eyeM = new THREE.MeshStandardMaterial({ color: 0xfff4a0, emissive: 0xfff08a, emissiveIntensity: 2.4, roughness: 0.2 });
    const dkM = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3 });
    const sph = (m, sx, sy, sz, x, y, z, r) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r || 1, 16, 12), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); head.add(o); return o; };
    sph(emM, 3.6, 3.0, 4.4, 0, 0.1, 2.4);                       // Schädel
    sph(emM, 2.4, 1.8, 3.0, 0, -0.4, 5.6);                       // Schnauze
    sph(goM, 2.0, 0.9, 3.2, 0, -1.5, 4.6);                       // Unterkiefer
    [-1, 1].forEach((s) => {
      sph(eyeM, 0.6, 0.6, 0.6, s * 2.2, 1.0, 3.4);               // leuchtende Augen
      sph(dkM, 0.12, 0.45, 0.2, s * 2.7, 1.0, 3.5);              // Schlitzpupillen
      sph(dkM, 0.28, 0.28, 0.28, s * 0.7, 0.2, 7.2);             // Nasenlöcher
      const brow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 5), goM);
      brow.position.set(s * 2.0, 1.9, 3.6); brow.rotation.set(-1.2, 0, -s * 0.5); head.add(brow);
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.2, 5), whM);
      fang.position.set(s * 0.9, -1.0, 6.6); fang.rotation.x = Math.PI; head.add(fang);
    });
    /* Federkrone */
    const FCOLS = [0x25e8d0, 0xffc933, 0xff5a4a, 0x40e070];
    for (let k = 0; k < 9; k++) {
      const sx = (k - 4) / 4 * 1.3;
      const d = new THREE.Vector3(sx, 0.55, -0.85).normalize();
      const fe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 6, 5), new THREE.MeshStandardMaterial({ color: FCOLS[k % 4], roughness: 0.5, emissive: FCOLS[k % 4], emissiveIntensity: 0.25 }));
      fe.geometry.translate(0, 3, 0);
      fe.position.set(sx * 1.4, 2.2, 1.4);
      fe.quaternion.setFromUnitVectors(UP, d);
      fe.scale.set(1, 1, 0.3);
      head.add(fe);
    }
    /* gespaltene Zunge */
    [-1, 1].forEach((s) => {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.14, 2.2, 4).rotateX(Math.PI / 2), reM);
      t.position.set(s * 0.25, -1.1, 8.4); t.rotation.y = s * 0.2; head.add(t); serpHead.tongue.push(t);
    });
  }
  root.add(head);

  function updateSerpent(dt) {
    const a0 = SERP.w * time, dA = SERP.space / SERP.ring;
    /* Blickpunkt vor dem Kopf (auch er weicht Hindernissen aus) */
    serpPath(a0 + 0.05, Math.sin(-time * 2.4), serpAhead);
    avoidObs(serpAhead, null, SERP.R0 + 2.5, 0);
    for (let i = 0; i < SERP.N; i++) {
      serpPath(a0 - i * dA, Math.sin(i * 0.55 - time * 2.4), segPos[i]);
      avoidObs(segPos[i], null, segR[i] + 2.2, 0);          // jedes Körperglied biegt um Bäume/Ruinen/Felsen
      avoidObs(segPos[i], null, segR[i] + 2.2, 0);          // zweiter Durchgang bei dicht stehenden Hindernissen
    }
    for (let i = 0; i < SERP.N; i++) {
      const r = segR[i];
      dummy.position.copy(segPos[i]);
      dummy.lookAt(i === 0 ? serpAhead : segPos[i - 1]);
      dummy.scale.set(r, r * 0.92, r * 1.25);
      dummy.updateMatrix();
      serpBody.setMatrixAt(i, dummy.matrix);
      /* Rückenfeder */
      dummy.position.set(segPos[i].x, segPos[i].y + r * 0.95, segPos[i].z);
      dummy.lookAt(i === 0 ? serpAhead.x : segPos[i - 1].x, (i === 0 ? serpAhead.y : segPos[i - 1].y) + r * 0.95, i === 0 ? serpAhead.z : segPos[i - 1].z);
      dummy.rotateX(0.5);
      const rr = r / SERP.R0;
      dummy.scale.set(0.35, 1.2 * rr + 0.3, rr * 1.8 + 0.4);
      dummy.updateMatrix();
      serpFeathers.setMatrixAt(i, dummy.matrix);
    }
    serpBody.instanceMatrix.needsUpdate = true;
    serpFeathers.instanceMatrix.needsUpdate = true;
    head.position.copy(segPos[0]);
    head.lookAt(serpAhead.x, serpAhead.y, serpAhead.z);
    const fl = 0.6 + 0.4 * Math.sin(time * 9);
    serpHead.tongue.forEach((t) => { t.scale.set(1, 1, fl); });
    /* Kopf-Kollisionskugel liegt vor dem ersten Körperglied */
    _tmp.copy(segPos[0]).sub(segPos[1]).normalize();
    headCol.copy(segPos[0]).addScaledVector(_tmp, 3.2);
  }
  updateSerpent(0.016);

  /* ==========================================================
     Sehenswürdigkeiten
     ========================================================== */
  const sights = [
    { kind: 'sungate', visited: false },
    { kind: 'pyramid', visited: false },
    { kind: 'serpent', visited: false }
  ];
  let sightCount = 0, gatePrev = 0, serpSeen = false, bumpCd = -10;
  const gatePos = new THREE.Vector3(GATE.x, gateF.ay + 8, GATE.z);
  const pyrPos = new THREE.Vector3(PYR.x, pyrF.ay + 16, PYR.z);

  function mark(i) {
    if (sights[i].visited) return;
    sights[i].visited = true;
    sightCount++;
    ev('sight', { kind: sights[i].kind, count: sightCount });
    if (sightCount === 3) ev('all-sights', { rewardMin: LEVEL4_REWARD.min, rewardMax: LEVEL4_REWARD.max });
  }

  /* ==========================================================
     Kollision
     ========================================================== */
  function groundAt(x, z, R, isSub) {
    let fh = floorH(x, z);
    if (isSub) {
      const q = R * 0.7;
      fh = Math.max(fh, floorH(x + q, z), floorH(x - q, z), floorH(x, z + q), floorH(x, z - q));
    }
    return fh;
  }

  function collideSub(p, vel, R) {
    const isSub = R > 2;
    let impact = 0;

    /* Sanfte Ufer: im breiten Flussbett bleiben */
    const cx = riverX(p.z), wl = halfW(p.z) - 22, dxr = p.x - cx;
    if (Math.abs(dxr) > wl) {
      const sg = dxr > 0 ? 1 : -1;
      p.x = cx + sg * wl;
      const vn = vel.x * sg;
      if (vn > 0) { impact = Math.max(impact, vn * 0.6); vel.x -= sg * vn; }
    }
    if (p.z < Z_BACK + 12) { p.z = Z_BACK + 12; if (vel.z < 0) { impact = Math.max(impact, -vel.z * 0.6); vel.z = 0; } }
    if (p.z > Z_FRONT) { p.z = Z_FRONT; if (vel.z > 0) { impact = Math.max(impact, vel.z * 0.6); vel.z = 0; } }

    const maxY = isSub ? 0.5 : -0.8;
    const fh = groundAt(p.x, p.z, R, isSub);
    if (p.y < fh + R) {
      p.y = fh + R;
      if (vel.y < 0) { impact = Math.max(impact, -vel.y); vel.y = 0; }
    }
    if (p.y > maxY) { p.y = maxY; if (vel.y > 0 && isSub) vel.y = 0; }

    const hit = (sx, sy, sz, sr) => {
      const dx = p.x - sx, dy = p.y - sy, dz = p.z - sz;
      const lim = sr + R, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= lim * lim) return false;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d, ny = dy / d, nz = dz / d;
      p.x = sx + nx * lim; p.y = sy + ny * lim; p.z = sz + nz * lim;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
      return true;
    };

    for (let i = 0; i < spheres.length; i++) { const c = spheres[i]; hit(c.x, c.y, c.z, c.r); }

    /* Mangroven-Stelzenwurzeln (nur nahe Bäume prüfen) */
    for (let i = 0; i < trees.length; i++) {
      const T = trees[i];
      const dx = p.x - T.x, dz = p.z - T.z, lim = Math.sqrt(T.r2) + R;
      if (dx * dx + dz * dz > lim * lim) continue;
      for (let k = 0; k < T.sp.length; k++) { const c = T.sp[k]; hit(c.x, c.y, c.z, c.r); }
    }

    /* Tor und Pyramide (gedrehte Boxen) */
    for (let i = 0; i < obbs.length; i++) {
      const b = obbs[i];
      const dx = p.x - b.ox, dz = p.z - b.oz;
      const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      const qx = clamp(lx, b.cx - b.hx, b.cx + b.hx), qy = clamp(p.y, b.y0, b.y1), qz = clamp(lz, b.cz - b.hz, b.cz + b.hz);
      const ex = lx - qx, ey = p.y - qy, ez = lz - qz;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 >= R * R) continue;
      let nlx = 0, ny = 0, nlz = 0, d;
      if (d2 > 1e-8) { d = Math.sqrt(d2); nlx = ex / d; ny = ey / d; nlz = ez / d; }
      else {
        const pxm = lx - (b.cx - b.hx), pxp = (b.cx + b.hx) - lx, pzm = lz - (b.cz - b.hz), pzp = (b.cz + b.hz) - lz, pym = p.y - b.y0, pyp = b.y1 - p.y;
        const m = Math.min(pxm, pxp, pzm, pzp, pym, pyp);
        if (m === pxm) nlx = -1; else if (m === pxp) nlx = 1; else if (m === pzm) nlz = -1; else if (m === pzp) nlz = 1; else if (m === pym) ny = -1; else ny = 1;
        d = -m;
      }
      const push = R - d;
      const nx = nlx * b.c + nlz * b.s, nz = -nlx * b.s + nlz * b.c;
      p.x += nx * push; p.y += ny * push; p.z += nz * push;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
    }

    /* Dock */
    for (let i = 0; i < DOCK_BOXES.length; i++) {
      const b = DOCK_BOXES[i];
      const qx = clamp(p.x, b.x0, b.x1), qy = clamp(p.y, b.y0, b.y1), qz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R * R) continue;
      let nx, ny, nz, d;
      if (d2 > 1e-8) { d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; }
      else { nx = p.x < (b.x0 + b.x1) / 2 ? -1 : 1; ny = 0; nz = 0; d = 0; }
      const push = R - d;
      p.x += nx * push; p.y += ny * push; p.z += nz * push;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
    }

    /* Quetzalcoatl: fester Körper -> Bounce-Rückstoß, nie hindurchfahren */
    if (isSub) {
      let bumped = false;
      for (let i = 0; i < SERP.N; i++) {
        const c = segPos[i], sr = segR[i] * 1.08;
        const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
        const lim = sr + R, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= lim * lim) continue;
        const d = Math.sqrt(d2) || 0.0001;
        const nx = dx / d, ny = dy / d, nz = dz / d;
        p.x = c.x + nx * lim; p.y = c.y + ny * lim; p.z = c.z + nz * lim;
        const vn = vel.x * nx + vel.y * ny + vel.z * nz;
        if (vn < 0) { vel.x -= nx * vn * 1.6; vel.y -= ny * vn * 1.6; vel.z -= nz * vn * 1.6; }   // Rückstoß
        impact = Math.max(impact, 4 + Math.max(0, -vn));
        bumped = true;
      }
      {
        const dx = p.x - headCol.x, dy = p.y - headCol.y, dz = p.z - headCol.z;
        const lim = SERP.R0 * 1.25 + R, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < lim * lim) {
          const d = Math.sqrt(d2) || 0.0001;
          const nx = dx / d, ny = dy / d, nz = dz / d;
          p.x = headCol.x + nx * lim; p.y = headCol.y + ny * lim; p.z = headCol.z + nz * lim;
          const vn = vel.x * nx + vel.y * ny + vel.z * nz;
          if (vn < 0) { vel.x -= nx * vn * 1.6; vel.y -= ny * vn * 1.6; vel.z -= nz * vn * 1.6; }
          impact = Math.max(impact, 5 + Math.max(0, -vn));
          bumped = true;
        }
      }
      if (bumped && time - bumpCd > 2.5) { bumpCd = time; ev('serpent-bump'); }
    }
    return impact;
  }

  /* ==========================================================
     Update pro Frame
     ========================================================== */
  const _cam = new THREE.Vector3();
  function wrap(v, size) { return (((v % size) + size) % size) - size / 2; }

  function update(dt, ctx) {
    ctx = ctx || {};
    dt = Math.min(dt, 0.1);
    time += dt;
    timeU.value = time;
    const cam = ctx.camPos || _cam;
    const sp = ctx.subPos || cam;

    causticTex.offset.set(time * 0.006, time * 0.004);
    rippleTex.offset.set(time * 0.01, time * 0.007);

    // goldene God Rays
    for (let i = 0; i < rays.length; i++) {
      const r = rays[i];
      const dx = ((r.bx - cam.x) % 360 + 540) % 360 - 180;
      const dz = ((r.bz - cam.z) % 360 + 540) % 360 - 180;
      r.holder.position.set(cam.x + dx, 0, cam.z + dz);
      const edge = Math.max(Math.abs(dx), Math.abs(dz)) / 180;
      r.mat.opacity = 0.2 * (0.65 + 0.35 * Math.sin(time * 0.5 + r.ph)) * (1 - edge * edge * edge);
    }

    // goldene Pollen
    for (let i = 0; i < PLK; i++) {
      plkPos[i * 3] = cam.x + wrap(plkBase[i * 3] - cam.x + Math.sin(time * 0.2 + i) * 2, PLK_S);
      plkPos[i * 3 + 1] = cam.y + wrap(plkBase[i * 3 + 1] - cam.y + time * 0.35, PLK_S);
      plkPos[i * 3 + 2] = cam.z + wrap(plkBase[i * 3 + 2] - cam.z + Math.cos(time * 0.17 + i) * 1.5, PLK_S);
    }
    plkGeo.attributes.position.needsUpdate = true;

    // Blasen
    for (let i = 0; i < BUB; i++) {
      if (bubLife[i] > 0) {
        bubLife[i] -= dt;
        bubPos[i * 3] += Math.sin(time * 3 + i) * 0.4 * dt;
        bubPos[i * 3 + 1] += 3 * dt;
        bubPos[i * 3 + 2] += Math.cos(time * 2.7 + i) * 0.4 * dt;
        if (bubLife[i] <= 0 || bubPos[i * 3 + 1] > 0) { bubLife[i] = 0; bubPos[i * 3 + 1] = -9999; }
      }
    }
    if (ctx.bubblePos && sp.y < -0.5) {
      bubAcc += dt * (6 + (ctx.thrust || 0) * 50);
      while (bubAcc >= 1) {
        bubAcc -= 1;
        const i = bubIdx++ % BUB;
        bubLife[i] = 4 + Math.random() * 2;
        bubPos[i * 3] = ctx.bubblePos.x + (Math.random() - 0.5) * 1.2;
        bubPos[i * 3 + 1] = ctx.bubblePos.y + (Math.random() - 0.5) * 1.2;
        bubPos[i * 3 + 2] = ctx.bubblePos.z + (Math.random() - 0.5) * 1.2;
      }
    }
    bubGeo.attributes.position.needsUpdate = true;

    // Bojen
    buoys.forEach((b) => { b.m.position.y = 0.1 + Math.sin(time * 1.3 + b.ph) * 0.15; });

    // Fische (weichen Hindernissen aus)
    for (let i = 0; i < schools.length; i++) updateSchool(schools[i], dt);

    // Schildkröten (weichen Hindernissen aus)
    turtles.forEach((T) => {
      orbitSafe(T.o, time, T.pos, T.o.m);
      orbitSafe(T.o, time + 0.6, _tmp, T.o.m);
      T.t.g.lookAt(_tmp);
      const f = Math.sin(time * 1.8 + T.ph);
      T.t.fl[0].rotation.z = -f * 0.45; T.t.fl[1].rotation.z = f * 0.45;
      T.t.fl[2].rotation.z = -f * 0.2; T.t.fl[3].rotation.z = f * 0.2;
      T.t.body.rotation.z = Math.sin(time * 0.9 + T.ph) * 0.06;
    });

    // rosa Flussdelfine (weichen Hindernissen aus)
    dolphins.forEach((D) => {
      dolphinSafe(D.i, time, D.pos, 4.5);
      dolphinSafe(D.i, time + 0.35, _tmp, 4.5);
      D.d.g.lookAt(_tmp);
      D.d.rear.rotation.x = Math.sin(time * 3.4 + D.ph) * 0.15;
      D.d.fluke.rotation.x = Math.sin(time * 3.4 + D.ph - 0.9) * 0.32;
    });

    // Quetzalcoatl (jedes Glied weicht Hindernissen aus)
    updateSerpent(dt);

    // Jade-Flammen und aufsteigende Goldpartikel
    flames.forEach((f) => {
      const k = 0.85 + 0.25 * Math.sin(time * 7 + f.ph) + 0.1 * Math.sin(time * 13 + f.ph * 2);
      f.f1.scale.set(1, k, 1); f.f2.scale.set(1.8, 1.4 * k, 1.8);
    });
    for (let i = 0; i < GP; i++) {
      const s = gpSeed[i], b = bowlWorld[i % bowlWorld.length], q = (time * 0.45 + s[1]) % 1;
      const a = q * 6 + s[0] * 6.28;
      gpPos[i * 3] = b.x + Math.cos(a) * (0.4 + q * 1.8) * (0.5 + s[2]);
      gpPos[i * 3 + 1] = b.y + q * 8;
      gpPos[i * 3 + 2] = b.z + Math.sin(a) * (0.4 + q * 1.8) * (0.5 + s[2]);
    }
    gpGeo.attributes.position.needsUpdate = true;

    // Sehenswürdigkeiten
    if (!sights[0].visited) {
      const dx = sp.x - GATE.x, dz = sp.z - GATE.z;
      const lx = dx * gateF.c - dz * gateF.s, lz = dx * gateF.s + dz * gateF.c, ly = sp.y - gateF.ay;
      if (Math.abs(lz) < 45) {
        const s = lz >= 0 ? 1 : -1;
        if (gatePrev !== 0 && s !== gatePrev && Math.abs(lx) < GATE.gap && ly > 0 && ly < GATE.H + 1) mark(0);
        gatePrev = s;
      } else gatePrev = 0;
    }
    if (!sights[1].visited && sp.distanceTo(pyrPos) < 58) mark(1);
    const dSerp = sp.distanceTo(segPos[0]);
    if (!sights[2].visited && dSerp < 38) mark(2);
    if (!serpSeen && dSerp < 160) { serpSeen = true; ev('serpent-found'); }
  }

  /* ==========================================================
     Öffentliche Schnittstelle
     ========================================================== */
  const pingTargets = [gatePos, pyrPos, segPos[0]];
  const names = {};
  Object.keys(L4_TEXT).forEach((k) => { names[k] = L4_TEXT[k].names; });

  const level = {
    group: root,
    WORLD: WORLD4,
    meta: {
      icons: ['☀️', '🔺', '🐍'],
      names,
      title: { en: L4_TEXT.en.title, de: L4_TEXT.de.title, fr: L4_TEXT.fr.title, nl: L4_TEXT.nl.title, pl: L4_TEXT.pl.title },
      reward: { min: LEVEL4_REWARD.min, max: LEVEL4_REWARD.max },
      text: l4Text
    },
    spawn: { position: new THREE.Vector3(0, -3.2, 12), yaw: 0 },
    islands: [],
    schools,
    serpent: { pos: segPos[0], segments: segPos },
    fauna: {
      pods: [
        { members: turtles.map((T) => ({ pos: T.pos })) },
        { members: dolphins.map((D) => ({ pos: D.pos })) },
        { members: [{ pos: segPos[0], r: SERP.R0 * 1.4 }] }
      ],
      rays: [],
      jellies: []
    },
    sights,
    get sightCount() { return sightCount; },
    get time() { return time; },

    setViewDistance(v) { scene.fog.density = FOG_BASE / Math.max(0.3, v); },
    update,
    collideSub,
    drainEvents() { const out = events.slice(); events.length = 0; return out; },
    isAtPlatform(p) { return Math.abs(p.x) < 16 && p.z > -22 && p.z < 36 && p.y > -12; },
    getReward: level4Reward,

    getPings(pos, yaw, out) {
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      out.length = 3;
      for (let i = 0; i < 3; i++) {
        const t = pingTargets[i];
        const dx = t.x - pos.x, dz = t.z - pos.z;
        const fwd = -sy * dx - cy * dz, right = cy * dx - sy * dz;
        let o = out[i];
        if (!o || typeof o !== 'object') o = out[i] = {};
        o.id = i;
        o.ang = Math.atan2(right, fwd);
        o.dist = Math.hypot(dx, t.y - pos.y, dz);
        o.done = sights[i].visited;
      }
      return out;
    },

    visitAll() { for (let i = 0; i < 3; i++) mark(i); },

    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach((m) => {
          ['map', 'emissiveMap'].forEach((k) => { if (m[k]) m[k].dispose(); });
          m.dispose();
        });
        if (o.isInstancedMesh && o.dispose) o.dispose();
      });
      scene.remove(root);
      scene.fog = prevFog || null;
      scene.background = prevBg || null;
      events.length = 0;
    }
  };
  return level;
}

/* Aliase im Stil von world.js / level2.js */
export const createLevel4 = buildLevel4;
export function updateLevel4(level, dt, ctx) { level.update(dt, ctx); }
