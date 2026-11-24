/* ============================================================
   BEYOND MARIANA – level2.js  (LEVEL 2: CORAL REEF)
   Tropisches Korallenriff: türkises Wasser, God Rays, bunter Sand,
   Korallen / Riesen-Anemonen / Schwämme / Seegras, vier begehbare
   Korallen-Felsbögen, Fisch-Schwärme, Delfin-Schule, Schildkröten,
   Mantas, Riffhai, leuchtende Quallen (schocken das U-Boot),
   versunkene Piraten-Schatztruhe (Bonus) und verstreute Wrackteile
   (Spanten, Anker, Kanonen, Amphoren).

   Enthalten:
   - 3D-Höhenlandschaft: Sanddünen, tiefe Riff-Rinnen, erhöhte Plateaus,
     Hänge werden automatisch felsig eingefärbt.
   - Massive, kantige Felswände (Low-Poly, flat shaded) mit dichtem
     Korallen-, Schwamm- und Seegras-Bewuchs + Kollision.
   - 3 tropische Inseln (Strand, Gras, Palmen, Büsche, Felsen). Die Inseln
     sind Teil des Höhenfelds und damit VOLLSTÄNDIG massiv vom Meeresboden
     bis zur Spitze – kein Hohlraum, nichts zum Darunterdurchschwimmen.
   - Alle Platzierungen (Korallen, Wracks, Truhe, Bögen, Tiere) lesen die
     Höhe aus floorH() und passen sich dem Terrain an.

   NEU in dieser Version:
   - Hindernis-Raster für alle Tiere: Fische, Delfine, Schildkröten, Mantas,
     Riffhai und Quallen weichen Korallen (Gehirn-, Ast-, Geweih-Korallen,
     Schwämme, Anemonen), allen Felsen, den Felsklippen, den Korallenbögen,
     Wrackteilen, Dock-Pfosten und den Inseln aus. Alle Kugel-Kollisionen
     des U-Boots werden dabei mitbenutzt.

   Gleiche Schnittstelle wie world.js (buildLevel1):
     buildLevel2(scene, renderer) -> level
   level.spawn, schools, fauna, sights, sightCount, setViewDistance(v),
   update(dt, ctx), collideSub(p, vel, r), drainEvents(), isAtPlatform(p),
   getPings(pos, yaw, out), visitAll(), dispose()
   Aliase: createLevel2 / updateLevel2
   ============================================================ */

import * as THREE from 'three';

export const WORLD2 = { cameraFar: 1100, darkDepth: 99999, radius: 500 };

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

/* ------------------------------------------------------------
   Welt-Layout
   ------------------------------------------------------------ */
const FOG_COL = 0x20bfd6;
const FOG_BASE = 0.0078;

const PATCHES = [
  { x: 0, z: -95, r: 55 }, { x: -95, z: -215, r: 75 }, { x: 175, z: -300, r: 70 }, { x: 65, z: -335, r: 80 },
  { x: -215, z: -70, r: 70 }, { x: 205, z: -55, r: 65 }, { x: -70, z: -430, r: 70 }, { x: -225, z: -330, r: 60 },
  { x: 120, z: -185, r: 55 }, { x: -20, z: -300, r: 60 },
  /* neue Riff-Flecken (Index 10-14) */
  { x: 140, z: -120, r: 60 }, { x: -190, z: -285, r: 60 }, { x: 15, z: -405, r: 60 }, { x: -130, z: -130, r: 50 }, { x: 260, z: -200, r: 55 }
];
/* Vorberechnung für die schnelle Höhenfunktion */
PATCHES.forEach((p) => { const s = p.r * 0.55; p.k = 1 / (2 * s * s); p.lim = 16 * s * s; });

/* Tropische Inseln: R = Radius der Wasserlinie, peak = Höhe über Wasser.
   Der Unterwasser-Sockel reicht (siehe islandH) bis ca. 2.3 * R und geht
   lückenlos in den Meeresboden über. */
const ISLANDS = [
  { x: -335, z: -125, R: 40, peak: 20, ph: 0.4 },
  { x: 335, z: -70, R: 44, peak: 24, ph: 2.1 },
  { x: 230, z: -395, R: 36, peak: 17, ph: 4.0 }
];

/* Unebener Meeresboden ohne Sonderzonen: Hügel, Dünen, Plateaus, Rinnen */
function rawH(x, z) {
  let h = -40 + 5 * Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013) + 2.6 * Math.sin(x * 0.031 + z * 0.027) + 1.4 * Math.sin(x * 0.071 - z * 0.053);
  for (let i = 0; i < PATCHES.length; i++) {
    const p = PATCHES[i];
    const dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz;
    if (d2 < p.lim) h += 5 * Math.exp(-d2 * p.k);
  }
  /* Bereich um den Dock bleibt eben und tief (Start des U-Boots) */
  const m = smooth(45, 130, Math.hypot(x, (z - 8) * 0.7));
  if (m > 0) {
    const dunes = 2.6 * Math.sin(x * 0.043 + 0.8 * Math.sin(z * 0.019)) * Math.sin(z * 0.036 + 0.6 * Math.sin(x * 0.027))
      + 1.1 * Math.sin((x + z * 0.6) * 0.11) + 0.35 * Math.sin((x * 0.9 + z) * 0.28);
    const n = Math.sin(x * 0.0075 + 0.4) * Math.sin(z * 0.0068 + 1.1) + 0.5 * Math.sin(x * 0.013 - z * 0.011 + 2.0);
    const plateau = 12 * smooth(0.38, 0.52, n);
    const w1 = Math.sin(x * 0.017 + 2.1 * Math.sin(z * 0.009 + 0.5) + 0.9);
    const w2 = Math.sin(z * 0.014 + 1.8 * Math.sin(x * 0.008 + 1.2) + 2.0);
    const chan = 9 * Math.exp(-w1 * w1 * 38) + 7 * Math.exp(-w2 * w2 * 38);
    h += m * (dunes + plateau - chan);
  }
  h += smooth(420, 580, Math.hypot(x, z)) * 55;
  return h;
}

/* Hauptbogen (Sehenswürdigkeit 0) + drei weitere begehbare Bögen */
const ARCH = { x: -95, z: -215, ry: 0.35, R: 20, tube: 6.5, accent: 0x4fd6c0 };
const ARCHES = [
  ARCH,
  { x: 140, z: -120, ry: -0.6, R: 19, tube: 6, accent: 0xff7fa8 },
  { x: -190, z: -285, ry: 1.1, R: 24, tube: 7.2, accent: 0xa77bff },
  { x: 15, z: -405, ry: 0.2, R: 20, tube: 6.5, accent: 0xff9a4a }
];
const CHEST_XZ = { x: 178, z: -292 };
const SHARK_ORBIT = { cx: 65, cz: -340, Rx: 95, Rz: 60, w: 0.07, ph: 0, h0: 14, hA: 3 };
const DOLPHIN_ORBIT = { cx: 20, cz: -210, Rx: 200, Rz: 130, w: 0.06 };

/* Pier-Pfosten (x, z) – reichen bis in den Sand */
const DOCK_PILLARS = [];
[-1, 1].forEach((s) => { for (let z = -12; z <= 28; z += 8) DOCK_PILLARS.push([s * 11.1, z]); });
[-12, 0, 12].forEach((x) => DOCK_PILLARS.push([x, 35]));

const DOCK_BOXES = [
  { x0: -13.2, x1: -9, z0: -16, z1: 32, y0: -90, y1: 1 },
  { x0: 9, x1: 13.2, z0: -16, z1: 32, y0: -90, y1: 1 },
  { x0: -13.2, x1: 13.2, z0: 32, z1: 37, y0: -90, y1: 1 }
];

/* Verstreute Wrack-Stellen */
const WRECK_SITES = [
  { x: -130, z: -40, ry: 0.8, ribs: 7, R: 5.2, anchor: true, cannons: 3, amph: 6, planks: 6 },
  { x: 230, z: -150, ry: -0.4, ribs: 5, R: 4.6, anchor: true, cannons: 4, amph: 5, planks: 5 },
  { x: -40, z: -262, ry: 2.2, ribs: 9, R: 6.0, anchor: true, cannons: 2, amph: 4, planks: 8, wheel: true },
  { x: 100, z: -400, ry: 1.1, ribs: 0, R: 5, anchor: false, cannons: 2, amph: 9, planks: 3 },
  { x: -250, z: -200, ry: 0.3, ribs: 6, R: 5.0, anchor: true, cannons: 3, amph: 4, planks: 5 }
];

/* Ebene Zonen: Truhe, Wracks und Bögen bekommen einen ruhigen Untergrund,
   damit nichts schief im Hang steckt oder schwebt. */
const ZONES = [];
ZONES.push({ x: CHEST_XZ.x, z: CHEST_XZ.z, r: 24 });
WRECK_SITES.forEach((S) => ZONES.push({ x: S.x, z: S.z, r: 17 }));
ARCHES.forEach((A) => ZONES.push({ x: A.x, z: A.z, r: A.R + 14 }));
ZONES.forEach((Z) => { Z.h = rawH(Z.x, Z.z); Z.r2 = Z.r * Z.r; });

/* Inselprofil. u = Entfernung / Wasserlinien-Radius (mit unregelmäßiger Küste).
   u < 1  : Strand und Berg, durchgehend massiv bis 0 m und höher
   u 1..2.3: Sockel – von der Wasserlinie sanft abfallend bis zum Meeresboden
   Jeder Punkt innerhalb von u < 2.3 ist Boden, also gibt es nirgends einen
   Hohlraum unter der Insel. */
function islandH(I, x, z, h0) {
  const dx = x - I.x, dz = z - I.z;
  const d2 = dx * dx + dz * dz, far = I.R * 2.9;
  if (d2 >= far * far) return h0;
  const a = Math.atan2(dz, dx);
  const k = 0.11 * Math.sin(a * 3 + I.ph) + 0.07 * Math.sin(a * 5 + I.ph * 2.3) + 0.04 * Math.sin(a * 8 + I.ph * 0.7);
  const u = Math.sqrt(d2) / (I.R * (1 + k));
  if (u >= 2.3) return h0;
  if (u < 1) {
    let T = I.peak * Math.pow(1 - u, 1.7);
    T += 1.8 * Math.sin(x * 0.21 + I.ph) * Math.sin(z * 0.19 - I.ph) * smooth(2.5, 9, T);
    T += 1.0 * Math.sin(x * 0.5 + z * 0.43) * smooth(4, 10, T);
    return T;
  }
  const t = (u - 1) / 1.3;
  return h0 * (t * t * (3 - 2 * t));
}

/* Endgültige Bodenhöhe (inkl. Inseln) – von allem im Level benutzt */
function floorH(x, z) {
  let h = rawH(x, z);
  for (let i = 0; i < ZONES.length; i++) {
    const Z = ZONES[i];
    const dx = x - Z.x, dz = z - Z.z, d2 = dx * dx + dz * dz;
    if (d2 >= Z.r2) continue;
    const w = 1 - smooth(Z.r * 0.5, Z.r, Math.sqrt(d2));
    h += (Z.h - h) * w;
  }
  for (let i = 0; i < ISLANDS.length; i++) h = islandH(ISLANDS[i], x, z, h);
  return h;
}

/* Tiere umschwimmen die Inseln (Radialprojektion, bleibt stetig) */
function avoidIslands(o, k) {
  for (let i = 0; i < ISLANDS.length; i++) {
    const I = ISLANDS[i];
    const dx = o.x - I.x, dz = o.z - I.z, lim = I.R * k;
    const d2 = dx * dx + dz * dz;
    if (d2 < lim * lim) {
      const d = Math.sqrt(d2) || 0.001;
      o.x = I.x + dx / d * lim; o.z = I.z + dz / d * lim;
    }
  }
}

function orbitPos(o, t, out) {
  const a = o.w * t + o.ph;
  out.x = o.cx + Math.sin(a) * o.Rx;
  out.z = o.cz + Math.cos(a) * o.Rz;
  avoidIslands(out, 1.9);
  out.y = Math.min(-3, floorH(out.x, out.z) + o.h0 + o.hA * Math.sin(a * 1.7 + o.ph * 2));
  return out;
}

/* Delfine: schwimmen im Verband in Wellenbögen */
function dolphinPos(i, t, out) {
  const o = DOLPHIN_ORBIT;
  const a = o.w * t - i * 0.05;
  const side = (i % 2 ? 1 : -1) * (i > 1 ? 2 : 1) * 4;
  out.x = o.cx + Math.sin(a) * (o.Rx + side);
  out.z = o.cz + Math.cos(a) * (o.Rz + side * 0.6);
  avoidIslands(out, 1.9);
  const wave = Math.sin(t * 0.85 - i * 0.35);
  const fl = floorH(out.x, out.z);
  out.y = Math.min(-2.5, Math.max(fl + 4, -11 + 8.5 * wave));
  return out;
}

/* ------------------------------------------------------------
   Geometrie-Helfer
   ------------------------------------------------------------ */
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
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.stroke();
      }
    }
  }, true);
}

function rippleTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c4f4ff'; ctx.fillRect(0, 0, w, h);
    const r = mulberry32(11);
    for (let k = 0; k < 160; k++) {
      const x = r() * w, y = r() * h, l = 10 + r() * 30;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.15 + r() * 0.3).toFixed(2) + ')';
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
    ctx.fillStyle = '#0d3a4a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff8a2a'; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8fefff'; ctx.font = 'bold 62px "Avenir Next","Segoe UI",sans-serif';
    ctx.fillText('MARIANA TOURS', w / 2, 58);
    ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 34px "Avenir Next","Segoe UI",sans-serif';
    ctx.fillText('CORAL REEF · KORALLENRIFF', w / 2, 112);
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
  m.customProgramCacheKey = () => 'coral-v1';
  return m;
}

/* ------------------------------------------------------------
   Korallen-Geometrien
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

/* Geweihkoralle: schlanke, hoch aufstrebende Äste mit durchgehender Spitze */
function geoStag(r) {
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const grow = (base, dir, len, rad, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.62, rad, len, 5, 1, true);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    g.translate(base.x, base.y, base.z);
    parts.push(g);
    if (depth <= 0) return;
    const tip = base.clone().addScaledVector(dir, len);
    for (let i = 0; i < 2; i++) {
      const d = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.0, 0.45 + r() * 0.3, (r() - 0.5) * 1.0)).normalize();
      grow(tip, d, len * 0.8, rad * 0.7, depth - 1);
    }
    if (depth > 1) {
      const d = dir.clone().add(new THREE.Vector3((r() - 0.5) * 0.3, 0.2, (r() - 0.5) * 0.3)).normalize();
      grow(tip, d, len * 0.85, rad * 0.75, depth - 1);
    }
  };
  for (let i = 0; i < 2; i++) {
    const d = new THREE.Vector3((r() - 0.5) * 0.7, 1, (r() - 0.5) * 0.7).normalize();
    grow(new THREE.Vector3((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5), d, 1.4, 0.13, 2);
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

/* Tonnenschwamm-Gruppe: offene Vasen mit Rand */
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

function geoAnemone(r) {
  const parts = [];
  const base = new THREE.CylinderGeometry(0.8, 1.1, 1.0, 9, 1, true);
  base.translate(0, 0.5, 0);
  parts.push(base);
  [[0.15, 10, 0.15], [0.45, 16, 0.45], [0.75, 20, 0.8]].forEach(([rad, n, tilt]) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r() * 0.2, len = 1.4 + r() * 1.0;
      const g = new THREE.CylinderGeometry(0.02, 0.07, len, 4, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateZ(-(tilt + r() * 0.25));
      g.rotateY(a);
      g.translate(Math.cos(a) * rad, 1.0, -Math.sin(a) * rad);
      parts.push(g);
    }
  });
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

/* ------------------------------------------------------------
   Kantige Felsblöcke (Low-Poly, viele Facetten) für Klippen & Inseln.
   Die Verschiebung hängt nur von der Position ab, daher bleiben
   gemeinsame Ecken zusammen (keine Risse).
   ------------------------------------------------------------ */
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function geoRockBlock(rx, ry, rz, taper, yaw, lean, seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const sd = Math.floor(seed * 7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.74 + 0.5 * hash3(Math.round(x * 40) + sd, Math.round(y * 40), Math.round(z * 40));
    const vx = x * k, vy = y * k, vz = z * k;
    const f = 1 - taper * smooth(-1, 1, vy);
    p.setXYZ(i, vx * f * rx, vy * ry, vz * f * rz);
  }
  g.rotateZ(lean);
  g.rotateY(yaw);
  return g;
}

/* ------------------------------------------------------------
   Palmen, Büsche (Inseln)
   ------------------------------------------------------------ */
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

function geoFrond(T, az, L) {
  const N = 5, ca = Math.cos(az), sa = Math.sin(az), pos = [];
  const Lp = [], Rp = [];
  for (let j = 0; j <= N; j++) {
    const s = j / N, out = s * L;
    const y = T.y + 1.3 * Math.sin(s * 2.2) - 1.5 * s * s;
    const cx = T.x + ca * out, cz = T.z + sa * out, w = 0.55 * (1 - s * 0.75);
    Lp.push([cx - sa * w, y, cz + ca * w]);
    Rp.push([cx + sa * w, y, cz - ca * w]);
  }
  for (let j = 0; j < N; j++) {
    pos.push(...Lp[j], ...Rp[j], ...Lp[j + 1], ...Rp[j], ...Rp[j + 1], ...Lp[j + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function geoPalm() {
  const items = [];
  const H = 9, lean = 2.4, SEG = 6;
  const P = (t) => new THREE.Vector3(lean * t * t, H * t, 0);
  for (let i = 0; i < SEG; i++) {
    const a = P(i / SEG), b = P((i + 1) / SEG);
    items.push({ geo: cylBetween(a, b, 0.42 - 0.22 * (i / SEG), 0.42 - 0.22 * ((i + 1) / SEG), 6), col: i % 2 ? 0x8a6a42 : 0x7a5a38 });
  }
  const top = P(1);
  for (let k = 0; k < 9; k++) {
    const az = k / 9 * Math.PI * 2 + k * 0.3;
    items.push({ geo: geoFrond(top, az, 3.6 + (k % 3) * 0.5), col: k % 2 ? 0x2f9a48 : 0x3bb257 });
  }
  for (let k = 0; k < 3; k++) {
    const nut = new THREE.SphereGeometry(0.24, 6, 5);
    nut.translate(top.x + Math.cos(k * 2.1) * 0.4, top.y - 0.35, top.z + Math.sin(k * 2.1) * 0.4);
    items.push({ geo: nut, col: 0x4a2f1c });
  }
  return mergeColored(items);
}

function geoBush() {
  const items = [];
  [[0, 0.5, 0, 1.0, 0x2f8a3a], [0.8, 0.35, 0.3, 0.75, 0x3da34a], [-0.7, 0.35, -0.3, 0.8, 0x2a7a35], [0.1, 0.4, -0.8, 0.7, 0x35963f]].forEach(([x, y, z, s, c]) => {
    const g = new THREE.IcosahedronGeometry(s, 0);
    g.translate(x, y, z);
    items.push({ geo: g, col: c });
  });
  return mergeColored(items);
}

/* ------------------------------------------------------------
   Wrack-Geometrien (Anker, Kanone, Amphore, Steuerrad)
   ------------------------------------------------------------ */
function geoAnchor() {
  const parts = [];
  const shank = new THREE.CylinderGeometry(0.17, 0.22, 5.8, 8); shank.translate(0, 0.4, 0); parts.push(shank);
  const stock = new THREE.CylinderGeometry(0.13, 0.13, 3, 6); stock.rotateX(Math.PI / 2); stock.translate(0, 2.7, 0); parts.push(stock);
  const ring = new THREE.TorusGeometry(0.5, 0.09, 6, 12); ring.translate(0, 3.7, 0); parts.push(ring);
  const arms = new THREE.TorusGeometry(1.5, 0.18, 6, 16, Math.PI); arms.rotateZ(Math.PI); arms.translate(0, -1.0, 0); parts.push(arms);
  [-1, 1].forEach((s) => {
    const f = new THREE.ConeGeometry(0.45, 1.0, 4);
    f.rotateZ(-s * 0.9);
    f.translate(s * 1.55, -0.85, 0);
    parts.push(f);
  });
  return mergeGeos(parts);
}

function geoCannon() {
  const parts = [];
  const barrel = new THREE.CylinderGeometry(0.32, 0.5, 3.2, 12); barrel.rotateX(Math.PI / 2); parts.push(barrel);
  const muz = new THREE.TorusGeometry(0.36, 0.08, 6, 12); muz.translate(0, 0, 1.6); parts.push(muz);
  const base = new THREE.TorusGeometry(0.52, 0.07, 6, 12); base.translate(0, 0, -1.0); parts.push(base);
  const casc = new THREE.SphereGeometry(0.22, 8, 6); casc.translate(0, 0, -1.75); parts.push(casc);
  const trun = new THREE.CylinderGeometry(0.11, 0.11, 1.5, 6); trun.rotateZ(Math.PI / 2); trun.translate(0, 0, 0.1); parts.push(trun);
  return mergeGeos(parts);
}

function geoAmphoraBody() {
  const pts = [[0.0, 0], [0.25, 0], [0.45, 0.5], [0.62, 1.2], [0.55, 1.8], [0.28, 2.3], [0.22, 2.6], [0.3, 2.75], [0.0, 2.75]]
    .map((q) => new THREE.Vector2(q[0], q[1]));
  return new THREE.LatheGeometry(pts, 12);
}

function geoAmphoraHandles() {
  const parts = [];
  [-1, 1].forEach((s) => {
    const h = new THREE.TorusGeometry(0.28, 0.05, 5, 8, Math.PI);
    h.rotateZ(-s * Math.PI / 2);
    h.translate(s * 0.5, 2.15, 0);
    parts.push(h);
  });
  return mergeGeos(parts);
}

function geoWheel() {
  const parts = [];
  parts.push(new THREE.TorusGeometry(0.9, 0.07, 6, 16));
  for (let k = 0; k < 4; k++) {
    const sp = new THREE.CylinderGeometry(0.04, 0.04, 2.1, 5);
    sp.rotateZ(k * Math.PI / 4);
    parts.push(sp);
  }
  parts.push(new THREE.SphereGeometry(0.16, 8, 6));
  for (let k = 0; k < 8; k++) {
    const h = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5);
    const a = k * Math.PI / 4;
    h.rotateZ(a);
    h.translate(Math.sin(-a) * 0, 0, 0);
    h.translate(-Math.sin(a) * 1.1, Math.cos(a) * 1.1, 0);
    parts.push(h);
  }
  return mergeGeos(parts);
}

/* ------------------------------------------------------------
   Fische
   ------------------------------------------------------------ */
const SPECIES = {
  clown: { size: 1.9, speed: 4.4, body: (x, y, z) => (((z > 0.14 && z < 0.24) || (z < -0.12 && z > -0.22)) ? 0xffffff : 0xff7a1a), tail: 0xff7a1a, fin: 0xff9a3a },
  tang: { size: 2.6, speed: 5.0, body: (x, y, z) => ((z > 0.2 && z < 0.28 && y > -0.2) ? 0x0a1a3a : 0x1f6bff), tail: 0xffe040, fin: 0x1f6bff },
  yellow: { size: 2.4, speed: 5.2, body: () => 0xffe033, tail: 0xffd01a, fin: 0xfff3a0 },
  parrot: { size: 2.8, speed: 4.8, body: (x, y) => (y < -0.1 ? 0xff5cb0 : 0x31f2a0), tail: 0xff5cb0, fin: 0x7dffd0 },
  chromis: { size: 1.6, speed: 5.4, body: (x, y) => (y > 0.05 ? 0x2fd8ff : 0x9bf4ff), tail: 0x2fd8ff, fin: 0x7ceaff },
  royal: { size: 2.2, speed: 4.8, body: (x, y, z) => (z > 0.1 ? 0xb040ff : 0xffe033), tail: 0xffe033, fin: 0xd080ff },
  red: { size: 2.5, speed: 4.6, body: (x, y) => (y < -0.1 ? 0xffd0c0 : 0xff4040), tail: 0xff4040, fin: 0xff8080 },
  butterfly: { size: 2.3, speed: 5.0, body: (x, y, z) => ((z > 0.2 && z < 0.3) ? 0x202020 : 0xffe860), tail: 0xffe860, fin: 0xffffff }
};

function fishGeo(sp) {
  const body = new THREE.SphereGeometry(0.5, 12, 8);
  body.scale(0.36, 0.55, 1);
  return mergeColored([
    { geo: body, col: sp.body },
    { geo: triGeo([0, 0, -0.42, 0, 0.3, -0.82, 0, -0.3, -0.82]), col: sp.tail },
    { geo: triGeo([0, 0.26, 0.22, 0, 0.54, -0.1, 0, 0.2, -0.28]), col: sp.fin },
    { geo: triGeo([0.15, -0.06, 0.2, 0.42, -0.2, -0.02, 0.14, -0.14, -0.04]), col: sp.fin },
    { geo: triGeo([-0.15, -0.06, 0.2, -0.42, -0.2, -0.02, -0.14, -0.14, -0.04]), col: sp.fin }
  ]);
}

/* ------------------------------------------------------------
   Großtiere
   ------------------------------------------------------------ */
function buildTurtle() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const shellM = new THREE.MeshStandardMaterial({ color: 0x4a9a52, roughness: 0.6, flatShading: true });
  const plateM = new THREE.MeshStandardMaterial({ color: 0x2f7a3c, roughness: 0.6, flatShading: true });
  const bellyM = new THREE.MeshStandardMaterial({ color: 0xe9dcae, roughness: 0.7 });
  const skinM = new THREE.MeshStandardMaterial({ color: 0x7bb872, roughness: 0.65 });
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

function buildManta() {
  const g = new THREE.Group();
  const topM = new THREE.MeshStandardMaterial({ color: 0x26384f, roughness: 0.55, side: THREE.FrontSide });
  const botM = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.6, side: THREE.BackSide });
  const edge = [[0, 1.2], [1.9, 0.55], [4, -0.35], [1.6, -0.55], [0, -0.9]];
  const wingGeo = (sign) => {
    const pts = edge.map((q) => [q[0] * sign, q[1]]);
    const pos = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const ny = a[1] * b[0] - a[0] * b[1];
      const v = ny >= 0 ? [0, 0.18, 0, a[0], 0, a[1], b[0], 0, b[1]] : [0, 0.18, 0, b[0], 0, b[1], a[0], 0, a[1]];
      for (let k = 0; k < 9; k++) pos.push(v[k]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  };
  const wings = [];
  [-1, 1].forEach((s) => {
    const w = new THREE.Group();
    const geo = wingGeo(s);
    w.add(new THREE.Mesh(geo, topM), new THREE.Mesh(geo, botM));
    g.add(w); wings.push(w);
  });
  const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), topM);
  bodyM.scale.set(0.9, 0.55, 1.5); bodyM.position.set(0, 0.1, 0.2); g.add(bodyM);
  [-1, 1].forEach((s) => {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6).rotateX(Math.PI / 2), topM);
    h.position.set(s * 0.3, 0.05, 1.35); g.add(h);
  });
  const tg = new THREE.CylinderGeometry(0.03, 0.12, 4, 6); tg.rotateX(-Math.PI / 2); tg.translate(0, 0.05, -2.8);
  g.add(new THREE.Mesh(tg, topM));
  return { g, wings };
}

function buildShark() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const gray = new THREE.MeshStandardMaterial({ color: 0x72879a, roughness: 0.5, metalness: 0.1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeef3f6, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), gray); torso.scale.set(0.95, 0.85, 4.0); body.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), white); belly.scale.set(0.9, 0.6, 3.9); belly.position.y = -0.32; body.add(belly);
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dark); e.position.set(s * 0.62, 0.25, 3.0); body.add(e);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2, 3), gray);
    f.scale.set(1, 1, 0.3); f.position.set(s * 0.9, -0.4, 1.3); f.rotation.set(0.3, 0, -s * 1.25); body.add(f);
  });
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 4), gray);
  dorsal.scale.set(1, 1, 0.35); dorsal.position.set(0, 1.0, 0.6); dorsal.rotation.x = -0.35; body.add(dorsal);
  const dTip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 4), white);
  dTip.scale.set(1, 1, 0.35); dTip.position.set(0, 1.62, 0.43); dTip.rotation.x = -0.35; body.add(dTip);
  const tail = new THREE.Group(); tail.position.set(0, 0, -3.7); body.add(tail);
  const up = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 4), gray);
  up.scale.set(0.25, 1, 1); up.position.set(0, 0.8, -0.4); up.rotation.x = -0.6; tail.add(up);
  const low = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 4), gray);
  low.scale.set(0.25, 1, 1); low.position.set(0, -0.5, -0.3); low.rotation.x = Math.PI + 0.64; tail.add(low);
  g.scale.setScalar(1.25);
  return { g, body, tail };
}

/* Delfin: Kopf zeigt nach +z (wie Hai/Schildkröte), Schwanzpartie + Fluke gelenkig */
function buildDolphin() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const topM = new THREE.MeshStandardMaterial({ color: 0x6f8fab, roughness: 0.4, metalness: 0.05 });
  const botM = new THREE.MeshStandardMaterial({ color: 0xe6eef4, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.2 });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), topM); torso.scale.set(0.42, 0.44, 1.35); body.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), botM); belly.scale.set(0.36, 0.3, 1.3); belly.position.y = -0.17; body.add(belly);
  const melon = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), topM); melon.scale.set(0.95, 0.9, 1.1); melon.position.set(0, 0.02, 1.2); body.add(melon);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.62, 10).rotateX(Math.PI / 2), topM); beak.position.set(0, -0.04, 1.62); body.add(beak);
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.56, 8).rotateX(Math.PI / 2), botM); jaw.position.set(0, -0.12, 1.58); body.add(jaw);
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), dark); e.position.set(s * 0.3, 0.1, 1.3); body.add(e);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 3), topM);
    f.scale.set(1, 1, 0.3); f.position.set(s * 0.42, -0.2, 0.6); f.rotation.set(0.4, 0, -s * 1.8); body.add(f);
  });
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 4), topM);
  dorsal.scale.set(1, 1, 0.28); dorsal.position.set(0, 0.52, 0.1); dorsal.rotation.x = -0.55; body.add(dorsal);

  const rear = new THREE.Group(); rear.position.set(0, 0, -1.15); body.add(rear);
  const stock = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), topM); stock.scale.set(0.24, 0.26, 1.1); stock.position.z = -0.6; rear.add(stock);
  const fluke = new THREE.Group(); fluke.position.set(0, 0, -1.6); rear.add(fluke);
  [-1, 1].forEach((s) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), topM);
    f.scale.set(0.55, 0.05, 0.3); f.position.set(s * 0.5, 0, -0.1); f.rotation.y = s * 0.45; fluke.add(f);
  });
  const fc = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), topM); fc.scale.set(0.2, 0.06, 0.28); fluke.add(fc);

  g.scale.setScalar(1.7);
  return { g, body, rear, fluke };
}

/* ============================================================
   buildLevel2
   ============================================================ */
export function buildLevel2(scene, renderer) {
  void renderer;
  const root = new THREE.Group();
  root.name = 'level2-coral-reef';
  scene.add(root);

  const prevFog = scene.fog, prevBg = scene.background;
  scene.background = new THREE.Color(FOG_COL);
  scene.fog = new THREE.FogExp2(FOG_COL, FOG_BASE);

  const rng = mulberry32(20261120);
  const events = [];
  const ev = (type, data) => events.push(Object.assign({ type }, data));
  let time = 0;
  const dummy = new THREE.Object3D();
  const _tmp = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  /* ---------- Licht ---------- */
  root.add(new THREE.HemisphereLight(0xb8f4ff, 0xffe0a8, 1.5));
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.6);
  sun.position.set(-80, 220, 60);
  root.add(sun); root.add(sun.target);

  /* ---------- Wasseroberfläche (von unten und von oben sichtbar) ---------- */
  const rippleTex = rippleTexture();
  rippleTex.repeat.set(60, 60);
  const surfGeo = new THREE.PlaneGeometry(3000, 3000); surfGeo.rotateX(-Math.PI / 2);
  const surface = new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({
    map: rippleTex, color: 0xdffcff, side: THREE.BackSide, transparent: true, opacity: 0.9
  }));
  surface.position.y = 0;
  root.add(surface);
  /* Obere Seite des Wassers, damit die Inseln von außen im Meer stehen */
  const surfaceTop = new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({
    map: rippleTex, color: 0x5fdcee, side: THREE.FrontSide, transparent: true, opacity: 0.82, depthWrite: false
  }));
  surfaceTop.position.y = 0;
  root.add(surfaceTop);

  /* ---------- Meeresboden (Höhenfeld inkl. Inseln) ---------- */
  const _pink = new THREE.Color(0.98, 0.78, 0.78), _mint = new THREE.Color(0.78, 0.92, 0.80), _rubble = new THREE.Color(0.80, 0.72, 0.84);
  const _bright = new THREE.Color(1.0, 0.96, 0.82), _beach = new THREE.Color(0.97, 0.92, 0.76);
  const _grassC = new THREE.Color(0.24, 0.52, 0.22), _rockC = new THREE.Color(0.52, 0.46, 0.40);
  function floorColor(x, z, c, h, sl) {
    c.setRGB(0.95, 0.86, 0.66);
    const n1 = Math.sin(x * 0.007 + 1) * Math.sin(z * 0.009 + 2);
    if (n1 > 0.15) c.lerp(_pink, smooth(0.15, 0.7, n1) * 0.6);
    else if (n1 < -0.15) c.lerp(_mint, smooth(0.15, 0.7, -n1) * 0.55);
    let t = 0;
    for (let i = 0; i < PATCHES.length; i++) {
      const p = PATCHES[i], dx = x - p.x, dz = z - p.z, s = p.r * 0.7;
      t = Math.max(t, Math.exp(-(dx * dx + dz * dz) / (2 * s * s)));
    }
    c.lerp(_rubble, t * 0.55);
    c.multiplyScalar(0.9 + 0.1 * (0.5 + 0.5 * Math.sin(x * 0.35 + Math.sin(z * 0.21) * 2.2)));
    /* helles Flachwasser */
    c.lerp(_bright, smooth(-18, -2, h) * 0.5);
    /* Insel: Strand und Gras */
    if (h > -1.5) {
      c.lerp(_beach, smooth(-1.5, 0.3, h));
      const gr = smooth(2.4, 4.6, h + 0.9 * Math.sin(x * 0.3) * Math.sin(z * 0.27));
      if (gr > 0) {
        c.lerp(_grassC, gr * 0.9);
        c.multiplyScalar(0.85 + 0.3 * (0.5 + 0.5 * Math.sin(x * 0.6 + z * 0.5)));
      }
    }
    /* steile Hänge und Berggipfel: Fels */
    const rk = Math.max(smooth(0.55, 1.1, sl) * 0.85, smooth(11, 15, h));
    if (rk > 0) c.lerp(_rockC, rk);
    c.multiplyScalar(0.9 + 0.1 * Math.sin(h * 2.2 + x * 0.04));
    if (h < -44) c.multiplyScalar(0.85 + 0.15 * smooth(-54, -44, h));
  }
  const causticTex = causticTexture();
  causticTex.repeat.set(60, 60);
  {
    const fg = new THREE.PlaneGeometry(1300, 1300, 240, 240);
    fg.rotateX(-Math.PI / 2);
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

  /* ---------- God Rays ---------- */
  const rayTex = rayTexture();
  const rays = [];
  for (let i = 0; i < 18; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: rayTex, color: 0xfff0b8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const geo = new THREE.PlaneGeometry(6 + rng() * 14, 150); geo.translate(0, -75, 0);
    const m = new THREE.Mesh(geo, mat); m.rotation.y = rng() * Math.PI; m.renderOrder = 4;
    const holder = new THREE.Group(); holder.rotation.z = 0.3; holder.add(m);
    root.add(holder);
    rays.push({ holder, mat, bx: rng() * 360, bz: rng() * 360, ph: rng() * 6.28 });
  }

  /* ---------- Schwebeteilchen ---------- */
  const dotTex = dotTexture();
  const PLK = 600, PLK_S = 120;
  const plkBase = new Float32Array(PLK * 3);
  for (let i = 0; i < PLK * 3; i++) plkBase[i] = rng() * PLK_S;
  const plkGeo = new THREE.BufferGeometry();
  const plkPos = new Float32Array(PLK * 3);
  plkGeo.setAttribute('position', new THREE.BufferAttribute(plkPos, 3));
  const plankton = new THREE.Points(plkGeo, new THREE.PointsMaterial({
    map: dotTex, size: 0.45, color: 0xeaffff, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true
  }));
  plankton.frustumCulled = false;
  root.add(plankton);

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
     Bögen: Transformationen vorab (für blocked(), Sehenswürdigkeit, Bau)
     ========================================================== */
  const archList = ARCHES.map((A) => {
    const c = Math.cos(A.ry), s = Math.sin(A.ry);
    const ay = Math.max(
      floorH(A.x + A.R * c, A.z - A.R * s),
      floorH(A.x - A.R * c, A.z + A.R * s),
      floorH(A.x, A.z)
    ) - 4;
    const toWorld = (lx, ly, lz) => new THREE.Vector3(A.x + lx * c + lz * s, ay + ly, A.z - lx * s + lz * c);
    return { A, c, s, ay, toWorld };
  });
  const archC = archList[0].c, archS = archList[0].s, archAY = archList[0].ay;

  /* ==========================================================
     Platzierung von Korallen, Felsen, Seegras
     ========================================================== */
  const spheres = [];       // Kollisionskugeln {x,y,z,r}
  const addSphere = (x, y, z, r) => spheres.push({ x, y, z, r });
  const pl = { branch: [], stag: [], brain: [], tube: [], sponge: [], fan: [], anem: [], rock: [], grass: [] };
  const BRANCH_COLS = [0xff4f9a, 0xff8a2a, 0xa05cff, 0x57ff8a, 0xff3fd0, 0x2fe8ff, 0xffd23a];
  const STAG_COLS = [0x2fe8ff, 0xffd23a, 0xff8a2a, 0xa05cff, 0xff4f9a];
  const BRAIN_COLS = [0xff9ac4, 0xffc27a, 0xc9a3ff, 0x8dffb8, 0xffe27a, 0x7be8ff, 0xff7a1a];
  const TUBE_COLS = [0x2fe8ff, 0xff4fd8, 0xffd23a, 0x7dffa0];
  const SPONGE_COLS = [0xff8a2a, 0xb05cff, 0xffd23a, 0xff5fa0, 0x2fe8ff];
  const FAN_COLS = [0xc060ff, 0xff5fa0, 0xff8a50, 0x2fe8ff, 0xffd23a, 0xff4fd8];
  const ANEM_COLS = [0xff6ad5, 0xb67bff, 0x7dffb0, 0xffa94d];
  const ROCK_COLS = [0x9c8b76, 0x8a7a68, 0xb09a80, 0x7c7266];
  const GRASS_COLS = [0x3fae4a, 0x5cd35a, 0x2e9a5a, 0x7ce06a];
  const COLS = { branch: BRANCH_COLS, stag: STAG_COLS, brain: BRAIN_COLS, tube: TUBE_COLS, sponge: SPONGE_COLS, fan: FAN_COLS, anem: ANEM_COLS };

  function blocked(x, z) {
    if (x > -24 && x < 24 && z > -30 && z < 46) return true;                                   // Dock
    for (let i = 0; i < archList.length; i++) {                                                // Durchfahrten der Bögen
      const E = archList[i];
      const dx = x - E.A.x, dz = z - E.A.z;
      const lx = dx * E.c - dz * E.s, lz = dx * E.s + dz * E.c;
      if (Math.abs(lx) < E.A.R - 3 && Math.abs(lz) < E.A.tube * 2) return true;
    }
    if (Math.hypot(x - CHEST_XZ.x, z - CHEST_XZ.z) < 16) return true;                          // Schatztruhe
    for (let i = 0; i < WRECK_SITES.length; i++) {                                             // Wrack-Stellen
      if (Math.hypot(x - WRECK_SITES[i].x, z - WRECK_SITES[i].z) < 9) return true;
    }
    for (let i = 0; i < ISLANDS.length; i++) {                                                 // Inseln (eigene Bepflanzung)
      if (Math.hypot(x - ISLANDS[i].x, z - ISLANDS[i].z) < ISLANDS[i].R * 1.5) return true;
    }
    return false;
  }

  function put(type, x, z, s, cols, extra) {
    if (blocked(x, z)) return null;
    const fy = floorH(x, z);
    if (fy > -4) return null;
    const o = { x, y: fy - 0.12, z, s, ry: rng() * 6.283, tx: (rng() - 0.5) * 0.14, tz: (rng() - 0.5) * 0.14, c: cols[Math.floor(rng() * cols.length)] };
    if (extra) Object.assign(o, extra);
    pl[type].push(o);
    return o;
  }
  const polar = (p, spread) => {
    const a = rng() * 6.283, r = p.r * spread * Math.sqrt(rng());
    return [p.x + Math.cos(a) * r, p.z + Math.sin(a) * r];
  };
  const anemSpots = [];
  const pushGrass = (x, z, y) => {
    pl.grass.push({ x, y: y === undefined ? floorH(x, z) - 0.05 : y, z, s: 0.7 + rng() * 0.9, sy: 0.8 + rng() * 0.9, ry: rng() * 6.283, tx: 0, tz: 0, c: GRASS_COLS[Math.floor(rng() * GRASS_COLS.length)] });
  };

  PATCHES.forEach((p) => {
    let x, z, o;
    for (let i = 0; i < dn(44); i++) { [x, z] = polar(p, 1); put('branch', x, z, 0.8 + rng() * 1.1, BRANCH_COLS); }
    for (let i = 0; i < dn(26); i++) { [x, z] = polar(p, 1); put('stag', x, z, 0.9 + rng() * 1.2, STAG_COLS); }
    for (let i = 0; i < dn(30); i++) {
      [x, z] = polar(p, 1.05);
      const s = 0.9 + rng() * 2.1;
      o = put('brain', x, z, s, BRAIN_COLS);
      if (o && s > 2.3) addSphere(x, o.y + s * 0.35, z, s * 0.8);
    }
    for (let i = 0; i < dn(20); i++) { [x, z] = polar(p, 1); put('tube', x, z, 0.8 + rng() * 0.8, TUBE_COLS); }
    for (let i = 0; i < dn(12); i++) { [x, z] = polar(p, 1); put('sponge', x, z, 0.9 + rng() * 1.1, SPONGE_COLS); }
    for (let i = 0; i < dn(24); i++) { [x, z] = polar(p, 1); put('fan', x, z, 1.2 + rng() * 1.4, FAN_COLS); }
    for (let i = 0; i < 6; i++) { [x, z] = polar(p, 0.9); o = put('anem', x, z, 1.6 + rng() * 1.8, ANEM_COLS); if (o) anemSpots.push(o); }
    for (let i = 0; i < 8; i++) {
      [x, z] = polar(p, 1.1);
      const s = 2.5 + rng() * 6.5;
      o = put('rock', x, z, s, ROCK_COLS, { sy: s * (0.7 + rng() * 0.4) });
      if (o) addSphere(x, o.y + s * 0.25, z, s * 0.78);
    }
    for (let i = 0; i < dn(110); i++) {
      [x, z] = polar(p, 1.4);
      if (blocked(x, z)) continue;
      for (let k = 0; k < 6; k++) pushGrass(x + (rng() - 0.5) * 1.4, z + (rng() - 0.5) * 1.4);
    }
  });
  // verstreute Felsen und Seegras-Felder auf freiem Sand
  for (let i = 0; i < 40; i++) {
    const a = rng() * 6.283, r = 40 + rng() * 380;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 1.5 + rng() * 3;
    const o = put('rock', x, z, s, ROCK_COLS, { sy: s * 0.8 });
    if (o && s > 2.5) addSphere(x, o.y + s * 0.25, z, s * 0.78);
  }
  for (let i = 0; i < dn(70); i++) {
    const a = rng() * 6.283, r = 40 + rng() * 400;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z)) continue;
    if (floorH(x, z) > -4) continue;
    for (let k = 0; k < 6; k++) pushGrass(x + (rng() - 0.5) * 2, z + (rng() - 0.5) * 2);
  }
  // leuchtende Korallen-Gruppen auf dem freien Riffboden
  {
    const TYPES = ['branch', 'branch', 'stag', 'brain', 'brain', 'fan', 'sponge', 'tube'];
    for (let i = 0; i < dn(70); i++) {
      const a = rng() * 6.283, r = 35 + rng() * 400;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const n = 5 + Math.floor(rng() * 5);
      for (let k = 0; k < n; k++) {
        const aa = rng() * 6.283, rr = rng() * 9;
        const x = cx + Math.cos(aa) * rr, z = cz + Math.sin(aa) * rr;
        const type = TYPES[Math.floor(rng() * TYPES.length)];
        const s = type === 'brain' ? 0.8 + rng() * 1.6 : 0.8 + rng() * 1.1;
        put(type, x, z, s, COLS[type]);
      }
    }
  }

  /* ---------- Fundamente der Pier-Pfosten (Fels + Bewuchs) ---------- */
  DOCK_PILLARS.forEach(([x, z]) => {
    const fy = floorH(x, z);
    const s = 1.4 + rng() * 0.7;
    pl.rock.push({ x, y: fy - 0.3, z, s, sy: s * 0.8, ry: rng() * 6.283, tx: 0, tz: 0, c: ROCK_COLS[Math.floor(rng() * ROCK_COLS.length)] });
    const a0 = rng() * 6.283;
    const s2 = 0.9 + rng() * 0.6;
    pl.rock.push({ x: x + Math.cos(a0) * 1.5, y: floorH(x + Math.cos(a0) * 1.5, z + Math.sin(a0) * 1.5) - 0.3, z: z + Math.sin(a0) * 1.5, s: s2, sy: s2 * 0.8, ry: rng() * 6.283, tx: 0, tz: 0, c: ROCK_COLS[Math.floor(rng() * ROCK_COLS.length)] });
    const T = ['branch', 'brain', 'sponge', 'fan', 'stag'];
    for (let k = 0; k < 4; k++) {
      const a = rng() * 6.283, rr = 1.6 + rng() * 1.2;
      const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      const type = T[Math.floor(rng() * T.length)];
      pl[type].push({ x: px, y: floorH(px, pz) - 0.1, z: pz, s: 0.5 + rng() * 0.6, ry: rng() * 6.283, tx: 0, tz: 0, c: COLS[type][Math.floor(rng() * COLS[type].length)] });
    }
    for (let k = 0; k < 4; k++) {
      const a = rng() * 6.283, rr = 1.2 + rng() * 1.6;
      pushGrass(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
    }
  });

  /* ---------- Korallen-Felsbögen (4 Stück, begehbar) ---------- */
  const archMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const algae = new THREE.Color(0.25, 0.5, 0.3);
  archList.forEach((E, idx) => {
    const A = E.A;
    const grp = new THREE.Group();
    grp.position.set(A.x, E.ay, A.z);
    grp.rotation.y = A.ry;
    root.add(grp);

    const ag = new THREE.TorusGeometry(A.R, A.tube, 16, 36, Math.PI);
    const p = ag.attributes.position, n = ag.attributes.normal;
    const col = new Float32Array(p.count * 3), c = new THREE.Color(), accent = new THREE.Color(A.accent);
    const ph = idx * 1.7;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 0.9 * Math.sin(x * 0.35 + z * 0.5 + ph) * Math.cos(y * 0.3 - z * 0.4) + 0.5 * Math.sin(x * 0.9 + y * 0.7 + z * 0.6);
      p.setXYZ(i, x + n.getX(i) * k, y + n.getY(i) * k, z + n.getZ(i) * k);
      c.setRGB(0.80, 0.66, 0.48);
      c.multiplyScalar(0.82 + 0.18 * Math.sin(y * 0.4 + x * 0.2 + ph));
      const nz = 0.5 + 0.5 * Math.sin(x * 0.23 + y * 0.31 + z * 0.47 + ph);
      c.lerp(accent, (idx === 0 ? 0.25 : 0.5) * smooth(0.3, 0.85, nz));
      if (y < 3) c.lerp(algae, 0.5 * (1 - y / 3));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    ag.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ag.computeVertexNormals();
    grp.add(new THREE.Mesh(ag, archMat));

    // Kollision entlang des Bogens
    const nSph = Math.ceil(Math.PI * A.R / 3.8);
    for (let k = 0; k <= nSph; k++) {
      const th = k / nSph * Math.PI;
      const w = E.toWorld(A.R * Math.cos(th), A.R * Math.sin(th), 0);
      addSphere(w.x, w.y, w.z, A.tube * 0.95);
    }
    // Fels-Stützen links/rechts
    [-1, 1].forEach((s) => {
      const w = E.toWorld(s * (A.R + 4), -3, 0);
      pl.rock.push({ x: w.x, y: w.y, z: w.z, s: A.tube * 1.3, sy: A.tube * 1.05, ry: rng() * 6.283, tx: 0, tz: 0, c: ROCK_COLS[0] });
      addSphere(w.x, w.y + 2, w.z, A.tube * 1.1);
    });
    // Korallen-, Schwamm- und Anemonen-Bewuchs
    const ARCH_TYPES = [['branch', 0.26], ['brain', 0.44], ['sponge', 0.58], ['anem', 0.70], ['fan', 0.82], ['stag', 0.92], ['tube', 1.01]];
    const nCor = Math.round((idx === 0 ? 100 : 120) * Math.max(0.6, DENSITY));
    for (let i = 0; i < nCor; i++) {
      const th = (0.1 + rng() * 0.8) * Math.PI, phi = (rng() - 0.5) * 2.6;
      const lx = A.R * Math.cos(th) + Math.cos(th) * Math.cos(phi) * A.tube * 0.95;
      const ly = A.R * Math.sin(th) + Math.sin(th) * Math.cos(phi) * A.tube * 0.95;
      const lz = Math.sin(phi) * A.tube * 0.95;
      const w = E.toWorld(lx, ly, lz);
      const r = rng();
      let type = 'tube';
      for (let q = 0; q < ARCH_TYPES.length; q++) if (r < ARCH_TYPES[q][1]) { type = ARCH_TYPES[q][0]; break; }
      pl[type].push({ x: w.x, y: w.y, z: w.z, s: 0.7 + rng() * 0.9, ry: rng() * 6.283, tx: 0, tz: 0, c: COLS[type][Math.floor(rng() * COLS[type].length)] });
    }
    // Seegras auf den Pfeilern und dem Scheitel
    for (let i = 0; i < 46; i++) {
      const leg = rng();
      const th = (leg < 0.4 ? 0.02 + rng() * 0.14 : (leg < 0.8 ? 0.84 + rng() * 0.14 : 0.35 + rng() * 0.3)) * Math.PI;
      const phi = (rng() - 0.5) * 2.4;
      const lx = A.R * Math.cos(th) + Math.cos(th) * Math.cos(phi) * A.tube * 0.95;
      const ly = A.R * Math.sin(th) + Math.sin(th) * Math.cos(phi) * A.tube * 0.95;
      const lz = Math.sin(phi) * A.tube * 0.95;
      const w = E.toWorld(lx, ly, lz);
      for (let k = 0; k < 4; k++) pushGrass(w.x + (rng() - 0.5) * 1.2, w.z + (rng() - 0.5) * 1.2, w.y);
    }
    // Wehendes Seegras, das von der Innenseite herabhängt
    for (let i = 0; i < 34; i++) {
      const th = (0.1 + rng() * 0.8) * Math.PI;
      const rin = A.R - A.tube * 0.85;
      const w = E.toWorld(rin * Math.cos(th), rin * Math.sin(th), (rng() - 0.5) * A.tube * 1.2);
      pl.grass.push({ x: w.x, y: w.y, z: w.z, s: 0.8 + rng() * 0.8, sy: 0.8 + rng() * 0.8, ry: rng() * 6.283, tx: Math.PI, tz: 0, c: GRASS_COLS[Math.floor(rng() * GRASS_COLS.length)] });
    }
  });
  const archPos = new THREE.Vector3(ARCH.x, archAY + 6, ARCH.z);

  /* ==========================================================
     KANTIGE FELSWÄNDE & KLIPPEN (Low-Poly, mit Bewuchs + Kollision)
     Alle Blöcke werden zu EINEM Mesh zusammengefasst (ein Draw-Call).
     ========================================================== */
  const cragItems = [];
  const cragMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const _cc = new THREE.Color();

  function cragColor(baseY, topY, seed, tint) {
    const span = Math.max(1, topY - baseY);
    return (x, y, z) => {
      const t = clamp((y - baseY) / span, 0, 1);
      const band = 0.5 + 0.5 * Math.sin(y * 0.85 + x * 0.04 + z * 0.03 + seed);
      let r = 0.56 + 0.14 * band, g = 0.49 + 0.09 * band, b = 0.42 + 0.04 * band;
      if (band > 0.8) r += 0.07 + (tint % 3) * 0.02;                 // rötliche Gesteinsschichten
      const tp = smooth(0.75, 1, t) * 0.4;                            // helle, ausgebleichte Kante oben
      r = lerp(r, 0.82, tp); g = lerp(g, 0.77, tp); b = lerp(b, 0.70, tp);
      const al = (1 - smooth(0, 0.28, t)) * 0.55;                     // Algen am Fuß
      r = lerp(r, 0.26, al); g = lerp(g, 0.45, al); b = lerp(b, 0.32, al);
      const hv = 0.92 + 0.16 * hash3(Math.round(x * 3), Math.round(y * 3), Math.round(z * 3));
      return _cc.setRGB(r * hv, g * hv, b * hv);
    };
  }

  const CLIFF_TYPES = [['branch', 0.22], ['stag', 0.38], ['brain', 0.48], ['sponge', 0.62], ['fan', 0.80], ['tube', 0.88], ['anem', 0.92], ['grass', 1.01]];

  /* Bewuchs auf der Oberfläche eines Blocks (Korallen wachsen entlang der Flächennormale) */
  function cover(B, n) {
    const cyaw = Math.cos(B.yaw), syaw = Math.sin(B.yaw);
    for (let i = 0; i < n; i++) {
      const ny = -0.25 + 1.25 * rng();
      const nh = Math.sqrt(Math.max(0, 1 - ny * ny));
      const a = rng() * 6.283;
      const nx0 = Math.cos(a) * nh, nz0 = Math.sin(a) * nh;
      const f = 1 - B.taper * smooth(-1, 1, ny);
      const lx = nx0 * B.rx * f * 0.96, lz = nz0 * B.rz * f * 0.96, ly = ny * B.ry;
      const wx = B.x + lx * cyaw + lz * syaw, wz = B.z - lx * syaw + lz * cyaw, wy = B.cy + ly;
      if (wy < floorH(wx, wz) + 1.2) continue;
      let nxl = nx0 / (B.rx * f), nyl = ny / B.ry, nzl = nz0 / (B.rz * f);
      const nl = Math.hypot(nxl, nyl, nzl) || 1;
      nxl /= nl; nyl /= nl; nzl /= nl;
      const nv = new THREE.Vector3(nxl * cyaw + nzl * syaw, nyl + 0.9, -nxl * syaw + nzl * cyaw).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(UP, nv).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rng() * 6.283));
      const r = rng();
      let type = 'grass';
      for (let k = 0; k < CLIFF_TYPES.length; k++) if (r < CLIFF_TYPES[k][1]) { type = CLIFF_TYPES[k][0]; break; }
      if (type === 'grass') {
        pl.grass.push({ x: wx, y: wy - 0.1, z: wz, s: 0.8 + rng() * 0.9, sy: 0.9 + rng() * 0.9, ry: 0, tx: 0, tz: 0, q, c: GRASS_COLS[Math.floor(rng() * GRASS_COLS.length)] });
      } else {
        pl[type].push({ x: wx, y: wy - 0.15, z: wz, s: 1.0 + rng() * 1.3, ry: 0, tx: 0, tz: 0, q, c: COLS[type][Math.floor(rng() * COLS[type].length)] });
      }
    }
  }

  function addBlock(B) {
    const g = geoRockBlock(B.rx, B.ry, B.rz, B.taper, B.yaw, B.lean, B.seed);
    g.translate(B.x, B.cy, B.z);
    cragItems.push({ geo: g, col: cragColor(B.cy - B.ry, B.cy + B.ry, B.seed, B.tint || 0) });
    if (B.collide) {
      const rs = 0.82 * Math.min(B.rx, B.rz);
      const lo = B.cy - B.ry + rs * 0.9, hi = B.cy + B.ry - rs * 0.7;
      if (hi <= lo) addSphere(B.x, B.cy, B.z, Math.min(rs, B.ry * 1.1));
      else {
        const nS = Math.max(2, Math.ceil((hi - lo) / rs) + 1);
        for (let k = 0; k < nS; k++) {
          const y = lo + (hi - lo) * k / (nS - 1);
          const nyy = (y - B.cy) / B.ry;
          addSphere(B.x, y, B.z, rs * (1 - B.taper * 0.8 * smooth(-1, 1, nyy)));
        }
      }
    }
    if (B.cover) cover(B, dn(Math.round(12 + B.ry * 1.6)));
  }

  const CLIFFS = [
    { x: -60, z: -130, ry: 0.6, n: 6, w: 8, h: 24 },
    { x: 95, z: -70, ry: -0.4, n: 7, w: 8, h: 28 },
    { x: -165, z: -150, ry: 1.3, n: 6, w: 9, h: 30 },
    { x: -10, z: -170, ry: 0.1, n: 5, w: 8, h: 22 },
    { x: 60, z: -250, ry: 2.3, n: 7, w: 9, h: 30 },
    { x: -120, z: -340, ry: 0.2, n: 6, w: 9, h: 28 },
    { x: -110, z: -400, ry: 1.0, n: 5, w: 8, h: 26 },
    { x: 150, z: -200, ry: 0.9, n: 6, w: 8, h: 26 },
    { x: 275, z: -250, ry: 1.6, n: 6, w: 9, h: 28 },
    { x: -250, z: -270, ry: 0.7, n: 6, w: 9, h: 30 },
    { x: -60, z: -370, ry: -0.5, n: 5, w: 8, h: 24 },
    { x: -215, z: -130, ry: 1.4, n: 5, w: 8, h: 26 },
    { x: -110, z: 50, ry: -0.9, n: 6, w: 8, h: 26 },
    { x: 130, z: 70, ry: 0.4, n: 6, w: 8, h: 26 }
  ];

  const nearKeep = (x, z) => {
    if (x > -42 && x < 42 && z > -48 && z < 64) return true;                       // Dock + Startbereich
    for (let i = 0; i < ARCHES.length; i++) if (Math.hypot(x - ARCHES[i].x, z - ARCHES[i].z) < 40) return true;
    if (Math.hypot(x - CHEST_XZ.x, z - CHEST_XZ.z) < 32) return true;
    for (let i = 0; i < WRECK_SITES.length; i++) if (Math.hypot(x - WRECK_SITES[i].x, z - WRECK_SITES[i].z) < 22) return true;
    return false;
  };
  const nearIsland = (x, z, f) => ISLANDS.some((I) => Math.hypot(x - I.x, z - I.z) < I.R * f);

  CLIFFS.forEach((C) => {
    const dX = Math.cos(C.ry), dZ = -Math.sin(C.ry);
    for (let k = 0; k < C.n; k++) {
      const s = (k - (C.n - 1) / 2) * C.w * 1.2;
      const bx = C.x + dX * s + (rng() - 0.5) * C.w * 0.5;
      const bz = C.z + dZ * s + (rng() - 0.5) * C.w * 0.6;
      if (nearKeep(bx, bz) || nearIsland(bx, bz, 2.4)) continue;
      const rx = C.w * (0.6 + 0.25 * rng()), rz = rx * (0.85 + 0.3 * rng());
      let fMin = floorH(bx, bz);
      fMin = Math.min(fMin, floorH(bx + rx, bz), floorH(bx - rx, bz), floorH(bx, bz + rz), floorH(bx, bz - rz));
      const prof = 0.5 + 0.5 * Math.sin(Math.PI * (k + 0.5) / C.n);
      const hgt = C.h * (0.55 + 0.45 * prof) * (0.8 + 0.4 * rng());
      const baseY = fMin - 3;
      let ryB = hgt / 2 + 1.5;
      ryB = Math.min(ryB, (-7 - baseY) / 2);          // Oberkante bleibt unter -7 m, man kann drüber fahren
      if (ryB < 4) continue;
      const cy = baseY + ryB;
      addBlock({
        x: bx, z: bz, cy, rx, ry: ryB, rz, taper: 0.22 + rng() * 0.12, yaw: rng() * 6.283,
        lean: (rng() - 0.5) * 0.1, seed: rng() * 50, tint: k, collide: true, cover: true
      });
      if (ryB > 8) {                                   // zweite, schmalere Stufe für Zacken und Felsbänder
        const c2 = cy + ryB * 0.7;
        const ry2 = Math.min(ryB * 0.42, -7 - c2);
        if (ry2 >= 3) {
          addBlock({
            x: bx + (rng() - 0.5) * rx * 0.5, z: bz + (rng() - 0.5) * rz * 0.5, cy: c2,
            rx: rx * 0.62, ry: ry2, rz: rz * 0.62, taper: 0.3, yaw: rng() * 6.283,
            lean: (rng() - 0.5) * 0.14, seed: rng() * 50, tint: k + 1, collide: true, cover: true
          });
        }
      }
    }
  });

  /* ==========================================================
     TROPISCHE INSELN: Palmen, Büsche, Gras, Felsen und Flachwasser-Riff.
     Der massive Sockel steckt bereits im Höhenfeld (islandH).
     ========================================================== */
  const palmList = [], bushList = [];
  const SHORE_TYPES = ['branch', 'brain', 'fan', 'sponge', 'stag', 'tube'];

  ISLANDS.forEach((I) => {
    // Palmen
    for (let t = 0, np = 0; t < 700 && np < 18; t++) {
      const a = rng() * 6.283, u = 0.15 + rng() * 0.75;
      const x = I.x + Math.cos(a) * I.R * u, z = I.z + Math.sin(a) * I.R * u;
      const h = floorH(x, z);
      if (h < 1.3 || h > 11) continue;
      palmList.push({ x, y: h - 0.4, z, rx: 0, ry: rng() * 6.283, rz: 0, s: 0.9 + rng() * 0.7 });
      np++;
    }
    // Büsche
    for (let t = 0, nb = 0; t < 700 && nb < 28; t++) {
      const a = rng() * 6.283, u = 0.1 + rng() * 0.8;
      const x = I.x + Math.cos(a) * I.R * u, z = I.z + Math.sin(a) * I.R * u;
      const h = floorH(x, z);
      if (h < 1.6 || h > 13) continue;
      bushList.push({ x, y: h - 0.2, z, rx: 0, ry: rng() * 6.283, rz: 0, s: 1.0 + rng() * 1.2 });
      nb++;
    }
    // Gras auf der Insel
    for (let t = 0, ng = 0; t < 600 && ng < 70; t++) {
      const a = rng() * 6.283, u = 0.2 + rng() * 0.72;
      const x = I.x + Math.cos(a) * I.R * u, z = I.z + Math.sin(a) * I.R * u;
      const h = floorH(x, z);
      if (h < 1.5 || h > 9) continue;
      for (let k = 0; k < 4; k++) pushGrass(x + (rng() - 0.5) * 1.4, z + (rng() - 0.5) * 1.4, floorH(x, z) - 0.05);
      ng++;
    }
    // Strand-Felsbrocken (kantig)
    for (let t = 0, nr = 0; t < 400 && nr < 8; t++) {
      const a = rng() * 6.283, u = 0.8 + rng() * 0.18;
      const x = I.x + Math.cos(a) * I.R * u, z = I.z + Math.sin(a) * I.R * u;
      const h = floorH(x, z);
      if (h < 0.2 || h > 2.8) continue;
      const rr = 1.0 + rng() * 1.6;
      addBlock({ x, z, cy: h + rr * 0.35, rx: rr, ry: rr * 0.9, rz: rr * (0.8 + rng() * 0.4), taper: 0.15, yaw: rng() * 6.283, lean: 0, seed: rng() * 50, tint: nr, collide: false, cover: false });
      nr++;
    }
    // Gipfelfelsen
    for (let t = 0, ns = 0; t < 400 && ns < 6; t++) {
      const a = rng() * 6.283, u = rng() * 0.4;
      const x = I.x + Math.cos(a) * I.R * u, z = I.z + Math.sin(a) * I.R * u;
      const h = floorH(x, z);
      if (h < 5) continue;
      const rr = 2.2 + rng() * 2.6;
      addBlock({ x, z, cy: h + rr * 0.7, rx: rr, ry: rr * (1.1 + rng() * 0.6), rz: rr * (0.8 + rng() * 0.4), taper: 0.3, yaw: rng() * 6.283, lean: (rng() - 0.5) * 0.15, seed: rng() * 50, tint: ns, collide: false, cover: false });
      ns++;
    }
    // Flachwasser-Riff am Inselhang: Korallen entlang der Sockel-Neigung
    for (let t = 0, nc = 0; t < 900 && nc < dn(110); t++) {
      const a = rng() * 6.283, u = 1.08 + rng() * 1.0;
      const x = I.x + Math.cos(a) * I.R * u, z = I.z + Math.sin(a) * I.R * u;
      const h = floorH(x, z);
      if (h > -3.5 || h < -34) continue;
      const type = SHORE_TYPES[Math.floor(rng() * SHORE_TYPES.length)];
      pl[type].push({ x, y: h - 0.12, z, s: 0.8 + rng() * 1.2, ry: rng() * 6.283, tx: (rng() - 0.5) * 0.14, tz: (rng() - 0.5) * 0.14, c: COLS[type][Math.floor(rng() * COLS[type].length)] });
      nc++;
    }
    // Seegras im Flachwasser
    for (let t = 0, ng = 0; t < 500 && ng < 40; t++) {
      const a = rng() * 6.283, u = 1.05 + rng() * 0.5;
      const x = I.x + Math.cos(a) * I.R * u, z = I.z + Math.sin(a) * I.R * u;
      const h = floorH(x, z);
      if (h > -1.2 || h < -16) continue;
      for (let k = 0; k < 5; k++) pushGrass(x + (rng() - 0.5) * 1.6, z + (rng() - 0.5) * 1.6);
      ng++;
    }
  });

  const palmMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
  const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });

  /* Alle kantigen Felsblöcke (Klippen, Gipfel, Strand) als ein Mesh */
  {
    const cragMesh = new THREE.Mesh(mergeColored(cragItems), cragMat);
    cragMesh.frustumCulled = false;
    root.add(cragMesh);
  }

  /* ==========================================================
     Wrack-Teile: Spanten, Anker, Kanonen, Amphoren, Planken
     ========================================================== */
  const wreckTex = woodTexture();
  const wreckWood = new THREE.MeshStandardMaterial({ map: wreckTex, color: 0x8a8f78, roughness: 0.95, side: THREE.DoubleSide });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x4d4439, roughness: 0.85, metalness: 0.25, flatShading: true });
  const clayMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const CLAY_COLS = [0xb0643a, 0x9a5a3a, 0xc27a48, 0x8f6a4a];

  function decorInst(geo, mat, list, tinted) {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const col = new THREE.Color();
    list.forEach((o, i) => {
      dummy.position.set(o.x, o.y, o.z);
      dummy.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
      dummy.scale.setScalar(o.s || 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (tinted) { col.setHex(o.c); mesh.setColorAt(i, col); }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    root.add(mesh);
  }

  decorInst(geoPalm(), palmMat, palmList, false);
  decorInst(geoBush(), bushMat, bushList, false);

  const anchorList = [], cannonList = [], amphList = [], plankList = [];
  const SITE_CORAL = ['branch', 'brain', 'sponge', 'fan', 'stag', 'tube'];

  WRECK_SITES.forEach((S) => {
    const sc = Math.cos(S.ry), ss = Math.sin(S.ry);
    const toW = (lx, lz) => [S.x + lx * sc + lz * ss, S.z - lx * ss + lz * sc];
    const around = (rMin, rMax) => {
      const a = rng() * 6.283, r = rMin + rng() * (rMax - rMin);
      const x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r;
      return [x, z, floorH(x, z)];
    };

    // Schiffs-Spanten (verwittert, teils abgebrochen)
    if (S.ribs > 0) {
      let minF = 1e9;
      for (let k = 0; k < S.ribs; k++) {
        const [wx, wz] = toW(0, (k - (S.ribs - 1) / 2) * 2.2);
        minF = Math.min(minF, floorH(wx, wz));
      }
      const g = new THREE.Group();
      g.position.set(S.x, minF - 0.3, S.z);
      g.rotation.y = S.ry;
      root.add(g);
      for (let k = 0; k < S.ribs; k++) {
        const t = S.ribs > 1 ? k / (S.ribs - 1) : 0.5;
        const R = S.R * (0.55 + 0.45 * Math.sin(t * Math.PI));
        const arc = Math.PI * (0.62 + rng() * 0.38);
        const lz = (k - (S.ribs - 1) / 2) * 2.2;
        const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.28, 5, 16, arc), wreckWood);
        rib.rotation.z = Math.PI;
        rib.position.set(0, R * 0.7, lz);
        const mirror = rng() < 0.5;
        if (mirror) rib.scale.x = -1;
        g.add(rib);
        // intakes Ende der Spante: Kollision + Bewuchs
        const ex = mirror ? R : -R;
        const [wx, wz] = toW(ex, lz);
        const wy = g.position.y + R * 0.7;
        addSphere(wx, wy, wz, 1.5);
        if (rng() < 0.85) {
          const type = SITE_CORAL[Math.floor(rng() * SITE_CORAL.length)];
          pl[type].push({ x: wx, y: wy - 0.2, z: wz, s: 0.6 + rng() * 0.7, ry: rng() * 6.283, tx: 0, tz: 0, c: COLS[type][Math.floor(rng() * COLS[type].length)] });
        }
      }
      // umgestürzter Mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 10, 8), wreckWood);
      const [mx, mz] = toW(S.R * 0.5, -(S.ribs * 1.1 + 3.5));
      mast.position.set(mx, floorH(mx, mz) + 0.5, mz);
      mast.rotation.set(0, S.ry + 0.4, 1.45);
      root.add(mast);
      // Bewuchs und Felsen um die Spanten
      for (let k = 0; k < 4; k++) {
        const [x, z, y] = around(3, 9);
        const s = 0.8 + rng() * 1.2;
        pl.rock.push({ x, y: y - 0.2, z, s, sy: s * 0.8, ry: rng() * 6.283, tx: 0, tz: 0, c: ROCK_COLS[Math.floor(rng() * ROCK_COLS.length)] });
      }
      for (let k = 0; k < 10; k++) { const [x, z, y] = around(2, 10); pushGrass(x, z, y); }
    }

    // Ruder-Steuerrad
    if (S.wheel) {
      const [x, z, y] = around(3, 6);
      const wh = new THREE.Mesh(geoWheel(), wreckWood);
      wh.position.set(x, y + 0.5, z);
      wh.rotation.set(1.2, rng() * 6, 0);
      wh.scale.setScalar(1.3);
      root.add(wh);
    }

    // Anker
    if (S.anchor) {
      const [x, z, y] = around(3, 8);
      anchorList.push({ x, y: y + 0.6, z, rx: 0, ry: rng() * 6.283, rz: 1.2 + rng() * 0.3, s: 1.1 + rng() * 0.3 });
      addSphere(x, y + 0.8, z, 1.8);
    }

    // Kanonen
    for (let k = 0; k < S.cannons; k++) {
      const [x, z, y] = around(2, 9);
      cannonList.push({ x, y: y + 0.35, z, rx: -(0.05 + rng() * 0.3), ry: rng() * 6.283, rz: 0, s: 1.0 + rng() * 0.3 });
      addSphere(x, y + 0.5, z, 1.2);
    }

    // Amphoren
    const [acx, acz] = around(5, 10);
    for (let k = 0; k < S.amph; k++) {
      const x = acx + (rng() - 0.5) * 5, z = acz + (rng() - 0.5) * 5;
      const y = floorH(x, z);
      const lying = rng() < 0.7;
      amphList.push({
        x, y: lying ? y + 0.15 : y - 0.5, z,
        rx: 0, ry: rng() * 6.283, rz: lying ? (rng() < 0.5 ? -1 : 1) * (1.15 + rng() * 0.3) : (rng() - 0.5) * 0.3,
        s: 0.8 + rng() * 0.5, c: CLAY_COLS[Math.floor(rng() * CLAY_COLS.length)]
      });
    }

    // Planken
    for (let k = 0; k < S.planks; k++) {
      const [x, z, y] = around(1, 11);
      plankList.push({ x, y: y + 0.1, z, rx: (rng() - 0.5) * 0.3, ry: rng() * 6.283, rz: (rng() - 0.5) * 0.3, s: 0.7 + rng() * 0.8 });
    }
  });

  decorInst(geoAnchor(), ironMat, anchorList, false);
  decorInst(geoCannon(), ironMat, cannonList, false);
  decorInst(geoAmphoraBody(), clayMat, amphList, true);
  decorInst(geoAmphoraHandles(), clayMat, amphList, true);
  decorInst(new THREE.BoxGeometry(0.4, 0.14, 2.8), wreckWood, plankList, false);

  /* ==========================================================
     HINDERNIS-RASTER für alle Tiere
     Enthält alle Kollisionskugeln des U-Boots (Felsklippen, Bögen,
     Wrackteile, große Korallen/Felsen) plus ALLE Korallen (Gehirn-,
     Ast-, Geweih-Korallen, Schwämme, Anemonen), alle Felsen
     (auch kleine) und die Dock-Pfosten. Raster-Zellen 24 m, damit pro
     Tier nur wenige Hindernisse geprüft werden.
     ========================================================== */
  const OB_C = 24, OB_M = 12;
  const obGrid = new Map();
  const obKey = (ix, iz) => (ix + 2048) * 8192 + (iz + 2048);
  {
    const obAll = [];
    spheres.forEach((c) => obAll.push({ x: c.x, y: c.y, z: c.z, r: c.r }));
    pl.rock.forEach((o) => obAll.push({ x: o.x, y: o.y + (o.sy || o.s) * 0.3, z: o.z, r: o.s * 0.85 }));
    pl.brain.forEach((o) => obAll.push({ x: o.x, y: o.y + o.s * 0.4, z: o.z, r: o.s * 0.9 }));
    pl.branch.forEach((o) => obAll.push({ x: o.x, y: o.y + o.s * 1.0, z: o.z, r: o.s * 1.2 }));
    pl.stag.forEach((o) => obAll.push({ x: o.x, y: o.y + o.s * 1.0, z: o.z, r: o.s * 1.1 }));
    pl.sponge.forEach((o) => obAll.push({ x: o.x, y: o.y + o.s * 0.7, z: o.z, r: o.s * 1.1 }));
    pl.anem.forEach((o) => obAll.push({ x: o.x, y: o.y + o.s * 1.0, z: o.z, r: o.s * 1.5 }));
    DOCK_PILLARS.forEach((q) => { [-3, -9, -15, -21, -27].forEach((y) => obAll.push({ x: q[0], y, z: q[1], r: 1.0 })); });
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
      const c = list[i];
      const dx = pos.x - c.x, dy = pos.y - c.y, dz = pos.z - c.z;
      const lim = c.r + margin, sf = lim + 4;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= sf * sf) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d, ny = dy / d, nz = dz / d;
      if (d < lim) {
        pos.x = c.x + nx * lim; pos.y = c.y + ny * lim; pos.z = c.z + nz * lim;
        if (vel) {
          const vn = vel.x * nx + vel.y * ny + vel.z * nz;
          if (vn < 0) { vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
        }
      } else if (vel && dt > 0) {
        const k = (sf - d) / 4 * 30 * dt;
        vel.x += nx * k; vel.y += ny * k; vel.z += nz * k;
      }
    }
  }

  /* ---------- Instanzierte Meshes ---------- */
  function makeInst(geo, mat, list) {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const col = new THREE.Color();
    list.forEach((o, i) => {
      dummy.position.set(o.x, o.y, o.z);
      if (o.q) dummy.quaternion.copy(o.q);
      else dummy.rotation.set(o.tx || 0, o.ry || 0, o.tz || 0);
      dummy.scale.set(o.s, o.sy || o.s, o.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.setHex(o.c);
      col.offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.12);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  }
  makeInst(geoBranch(rng), coralMat({ sway: 0.03, glow: 0.3 }), pl.branch);
  makeInst(geoStag(rng), coralMat({ sway: 0.05, glow: 0.32 }), pl.stag);
  makeInst(geoBrain(), coralMat({ glow: 0.22 }), pl.brain);
  makeInst(geoTube(rng), coralMat({ double: true, glow: 0.32 }), pl.tube);
  makeInst(geoSponge(rng), coralMat({ double: true, glow: 0.3 }), pl.sponge);
  makeInst(geoFan(), coralMat({ double: true, sway: 0.05, glow: 0.3 }), pl.fan);
  makeInst(geoAnemone(rng), coralMat({ sway: 0.1, glow: 0.4 }), pl.anem);
  makeInst(geoRock(), coralMat({ glow: 0, rough: 0.95 }), pl.rock);
  makeInst(geoBlade(), coralMat({ double: true, sway: 0.12, glow: 0.15, rough: 0.8 }), pl.grass);

  /* ==========================================================
     Dock (Plattform an der Oberfläche) – Pfosten bis in den Sand
     ========================================================== */
  const buoys = [];
  {
    const dock = new THREE.Group(); root.add(dock);
    const woodTex = woodTexture();
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x46535f, roughness: 0.45, metalness: 0.7 });
    const add = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); dock.add(b); return b; };

    // Pfosten: von der Pier-Oberkante bis in den Sandboden
    DOCK_PILLARS.forEach(([x, z]) => {
      const fl = floorH(x, z), top = 0.5, bot = fl - 1.5, h = top - bot;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, h, 10), darkWood);
      pil.position.set(x, (top + bot) / 2, z);
      dock.add(pil);
    });

    [-1, 1].forEach((s) => {
      add(4.2, 1.0, 48, wood, s * 11.1, 0.3, 8);
      add(0.2, 0.2, 48, darkWood, s * 13.0, 1.9, 8);
      [-3, -12, -22].forEach((y) => add(0.35, 0.35, 48, darkWood, s * 11.1, y, 8));   // Längsstreben
      for (let z = -14; z <= 30; z += 6) add(0.2, 1.4, 0.2, darkWood, s * 13.0, 1.3, z);
      const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 8), steel);
      lampPost.position.set(s * 12.4, 2.2, -14); dock.add(lampPost);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
      bulb.position.set(s * 12.4, 4.1, -14); dock.add(bulb);
    });
    add(26.4, 1.0, 5, wood, 0, 0.3, 34.5);
    [-3, -12, -22].forEach((y) => add(26.4, 0.35, 0.35, darkWood, 0, y, 35));         // Querstreben Rückwand
    // Schild
    [-8, 8].forEach((x) => add(0.4, 8, 0.4, darkWood, x, 4.8, 36.6));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.4), new THREE.MeshBasicMaterial({ map: signTexture() }));
    sign.rotation.y = Math.PI; sign.position.set(0, 7.2, 36.3); dock.add(sign);
    add(14.6, 5, 0.3, darkWood, 0, 7.2, 36.7);
    // Kisten und Fässer
    add(1.4, 1.2, 1.4, darkWood, -9, 1.4, 33);
    add(1.2, 1.0, 1.2, darkWood, -7.4, 1.3, 33.4);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.5 }));
    barrel.position.set(8.5, 1.5, 33.2); dock.add(barrel);
    // Palmen
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
    // Bojen
    [[-9, -19], [9, -19], [0, -24]].forEach(([x, z], i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xff3a3a, roughness: 0.4 }));
      b.position.set(x, 0.1, z); dock.add(b); buoys.push({ m: b, ph: i * 1.7 });
    });
  }

  /* ==========================================================
     Fisch-Schwärme
     ========================================================== */
  const fishMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x222222 });
  const fishGeos = {};
  Object.keys(SPECIES).forEach((k) => { fishGeos[k] = fishGeo(SPECIES[k]); });
  const schools = [];
  function centerAt(s, t, out) {
    const a = t * s.w + s.ph;
    out.x = s.base.x + Math.sin(a) * s.R;
    out.z = s.base.z + Math.cos(a * 0.83) * s.R * 0.8;
    avoidIslands(out, 2.1);
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
    const spread = spKey === 'clown' ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const off = new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 0.6, rng() - 0.5).normalize().multiplyScalar(spread * Math.cbrt(rng()));
      s.fish.push({
        pos: s.c.clone().add(off), vel: new THREE.Vector3((rng() - 0.5) * 2, 0, (rng() - 0.5) * 2),
        off, ph: rng() * 6.28, size: sp.size * (0.85 + rng() * 0.3)
      });
    }
    schools.push(s);
  }
  const aSpot = (i) => anemSpots[Math.min(i, anemSpots.length - 1)] || { x: PATCHES[0].x, z: PATCHES[0].z };
  addSchool('clown', aSpot(2), 8, 28, 4, 0.3);
  addSchool('clown', aSpot(14), 8, 28, 4, 0.28);
  addSchool('clown', aSpot(30), 8, 28, 4, 0.32);
  addSchool('clown', aSpot(46), 8, 24, 4, 0.29);
  addSchool('clown', aSpot(62), 8, 24, 4, 0.31);
  addSchool('yellow', PATCHES[0], 40, 30, 8, 0.12);
  addSchool('yellow', PATCHES[8], 45, 30, 9, 0.1);
  addSchool('yellow', PATCHES[11], 45, 28, 8, 0.11);
  addSchool('tang', PATCHES[1], 45, 30, 9, 0.11);
  addSchool('tang', PATCHES[4], 50, 30, 10, 0.1);
  addSchool('tang', PATCHES[12], 50, 28, 9, 0.12);
  addSchool('parrot', PATCHES[3], 60, 26, 11, 0.09);
  addSchool('parrot', PATCHES[6], 55, 26, 11, 0.1);
  addSchool('parrot', PATCHES[14], 55, 24, 10, 0.095);
  addSchool('chromis', PATCHES[2], 50, 32, 8, 0.11);
  addSchool('chromis', PATCHES[9], 50, 32, 9, 0.1);
  addSchool('chromis', PATCHES[13], 45, 30, 8, 0.12);
  addSchool('royal', PATCHES[5], 45, 24, 7, 0.1);
  addSchool('royal', PATCHES[10], 45, 24, 7, 0.09);
  addSchool('red', PATCHES[7], 40, 22, 6, 0.09);
  addSchool('red', PATCHES[12], 40, 22, 6, 0.1);
  addSchool('butterfly', PATCHES[10], 40, 22, 7, 0.1);
  addSchool('butterfly', PATCHES[13], 40, 22, 7, 0.11);
  addSchool('butterfly', PATCHES[3], 42, 22, 7, 0.095);

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
      avoidObs(f.pos, f.vel, f.size * 0.55 + 0.8, dt);     // Korallen, Felsen, Klippen, Bögen, Wrackteile umschwimmen
      avoidIslands(f.pos, 1.2);                            // Inseln umschwimmen
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
     Schildkröten, Delfine, Mantas, Riffhai
     ========================================================== */
  const turtles = [];
  [[1, 1.8], [3, 2.2], [4, 1.6], [8, 2.0], [6, 1.9], [0, 1.7], [2, 2.1], [5, 1.5], [7, 2.3], [10, 1.8]].forEach(([pi, size], i) => {
    const t = buildTurtle();
    t.g.scale.setScalar(size);
    root.add(t.g);
    const o = { cx: PATCHES[pi].x, cz: PATCHES[pi].z, Rx: 40 + i * 8, Rz: 30 + i * 6, w: 0.06 + i * 0.005, ph: i * 1.9, h0: 9 + i * 1.8, hA: 4 };
    turtles.push({ t, o, ph: i * 1.3, pos: t.g.position, m: size * 2.2 });
  });

  const dolphins = [];
  for (let i = 0; i < 4; i++) {
    const d = buildDolphin();
    root.add(d.g);
    const D = { d, i, ph: i * 0.9, pos: d.g.position };
    dolphinPos(i, 0, D.pos);
    avoidObs(D.pos, null, 4.5, 0);
    dolphins.push(D);
  }

  const mantas = [];
  [[-100, -200, 1.2], [140, -330, 2.0], [-170, -380, 1.5]].forEach(([cx, cz, size], i) => {
    const m = buildManta();
    m.g.scale.setScalar(size);
    root.add(m.g);
    const o = { cx, cz, Rx: 150, Rz: 110, w: 0.045 - i * 0.005, ph: i * 2.3, h0: 18, hA: 8 };
    mantas.push({ m, o, ph: i * 1.1, w: { pos: m.g.position }, mg: size * 4.5 });
  });
  const sharkB = buildShark();
  root.add(sharkB.g);
  const shark = { b: sharkB, pos: sharkB.g.position };
  orbitPos(SHARK_ORBIT, 0, shark.pos);
  avoidObs(shark.pos, null, 7, 0);

  /* ==========================================================
     Quallen
     ========================================================== */
  const JELLY_COLS = [0xff5fd0, 0x6fd8ff, 0xb48cff, 0x7dffb0];
  const jellyBell = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const tentParts = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.283, len = 2.6 + (i % 3) * 0.8;
    const g = new THREE.CylinderGeometry(0.03, 0.05, len, 4, 1, true);
    g.translate(Math.cos(a) * 0.55, -len / 2, Math.sin(a) * 0.55);
    tentParts.push(g);
  }
  const jellyTent = mergeGeos(tentParts);
  const jellyMats = JELLY_COLS.map((c) => new THREE.MeshStandardMaterial({
    color: c, emissive: c, emissiveIntensity: 1.1, transparent: true, opacity: 0.72, side: THREE.DoubleSide, roughness: 0.3, depthWrite: false
  }));
  const jellies = [];
  for (let i = 0, tries = 0; i < 30 && tries < 300; tries++) {
    const p = PATCHES[Math.floor(rng() * PATCHES.length)];
    const x = p.x + (rng() - 0.5) * p.r * 1.6, z = p.z + (rng() - 0.5) * p.r * 1.6;
    if (blocked(x, z)) continue;
    const s = 1.4 + rng() * 1.8, mat = jellyMats[i % jellyMats.length];
    const g = new THREE.Group();
    const bell = new THREE.Mesh(jellyBell, mat); bell.scale.set(s, s * 0.8, s); g.add(bell);
    const tent = new THREE.Mesh(jellyTent, mat); tent.scale.set(s, s, s); g.add(tent);
    const base = new THREE.Vector3(x, Math.min(-6, floorH(x, z) + 8 + rng() * 14), z);
    g.position.copy(base);
    root.add(g);
    jellies.push({ g, pos: g.position, base, bell, tent, ph: rng() * 6.28, s, r: s * 1.25 + 0.3 });
    i++;
  }

  /* ==========================================================
     Piraten-Schatztruhe + Schiffswrack (Bonus-Spot)
     ========================================================== */
  const chestY = floorH(CHEST_XZ.x, CHEST_XZ.z) - 0.3;
  const chest = { open: 0, target: 0 };
  const chestG = new THREE.Group();
  chestG.position.set(CHEST_XZ.x, chestY, CHEST_XZ.z);
  chestG.rotation.set(0, 0.6, 0.08);
  chestG.scale.setScalar(2.2);
  root.add(chestG);
  {
    const woodTex = woodTexture();
    const woodM = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
    const ironM = new THREE.MeshStandardMaterial({ color: 0x2c2c33, roughness: 0.4, metalness: 0.6 });
    const goldM = new THREE.MeshStandardMaterial({ color: 0xffc933, emissive: 0xff9a00, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.25 });
    const lidM = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8, side: THREE.DoubleSide });
    const bx = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.5), woodM); bx.position.y = 0.5; chestG.add(bx);
    [-0.8, 0, 0.8].forEach((x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.04, 1.56), ironM); b.position.set(x, 0.5, 0); chestG.add(b); });
    const lid = new THREE.Group(); lid.position.set(0, 1.0, -0.75); chestG.add(lid);
    const lg = new THREE.CylinderGeometry(0.75, 0.75, 2.4, 14, 1, false, 0, Math.PI); lg.rotateZ(Math.PI / 2);
    const lm = new THREE.Mesh(lg, lidM); lm.position.z = 0.75; lid.add(lm);
    [-0.8, 0, 0.8].forEach((x) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.77, 0.16, 14, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), ironM); b.position.set(x, 0, 0.75); lid.add(b); });
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.1), goldM); lock.position.set(0, 0.98, 0.78); chestG.add(lock);
    const pile = new THREE.Group(); pile.visible = false; chestG.add(pile);
    const pm = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 8), goldM); pm.scale.set(1.0, 0.35, 0.6); pm.position.y = 0.95; pile.add(pm);
    const coinG = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10);
    for (let i = 0; i < 25; i++) {
      const c = new THREE.Mesh(coinG, goldM);
      c.position.set((rng() - 0.5) * 1.6, 1.1 + rng() * 0.2, (rng() - 0.5) * 0.8);
      c.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      pile.add(c);
    }
    const light = new THREE.PointLight(0xffc860, 0, 35, 2); light.position.set(0, 1.6, 0); chestG.add(light);
    const spkGeo = new THREE.BufferGeometry();
    const spkPos = new Float32Array(28 * 3);
    spkGeo.setAttribute('position', new THREE.BufferAttribute(spkPos, 3));
    const spk = new THREE.Points(spkGeo, new THREE.PointsMaterial({
      map: dotTex, size: 0.5, color: 0xffd860, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    spk.frustumCulled = false; spk.visible = false; chestG.add(spk);
    const spkSeed = Array.from({ length: 28 }, () => [rng() - 0.5, rng(), rng() - 0.5]);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.2, 28, 12, 1, true), new THREE.MeshBasicMaterial({
      color: 0xffd060, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    beam.position.y = 14; chestG.add(beam);
    Object.assign(chest, { lid, pile, light, spk, spkPos, spkSeed, beam });
  }
  {   // Münzen auf dem Sand + Wrack-Rippen
    const goldM = new THREE.MeshStandardMaterial({ color: 0xffc933, emissive: 0xff9a00, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.25 });
    const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 10), goldM, 40);
    for (let i = 0; i < 40; i++) {
      const a = rng() * 6.283, r = 1.5 + rng() * 5;
      const x = CHEST_XZ.x + Math.cos(a) * r, z = CHEST_XZ.z + Math.sin(a) * r;
      dummy.position.set(x, floorH(x, z) + 0.05, z);
      dummy.rotation.set((rng() - 0.5) * 0.6, rng() * 6, (rng() - 0.5) * 0.6);
      dummy.scale.setScalar(1); dummy.updateMatrix();
      coins.setMatrixAt(i, dummy.matrix);
    }
    coins.frustumCulled = false; root.add(coins);

    const wreck = new THREE.Group();
    wreck.position.set(CHEST_XZ.x + 16, floorH(CHEST_XZ.x + 16, CHEST_XZ.z + 4), CHEST_XZ.z + 4);
    wreck.rotation.y = 0.5; root.add(wreck);
    const wm = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.9 });
    for (let k = 0; k < 8; k++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.3, 5, 16, Math.PI), wm);
      rib.rotation.z = Math.PI; rib.position.set(0, 4.3, k * 2.1 - 7); rib.scale.y = 0.6 + rng() * 0.4;
      wreck.add(rib);
    }
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 17), wm); keel.position.set(0, -0.8, 0); wreck.add(keel);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 13, 8), wm);
    mast.rotation.z = 1.35; mast.position.set(-5, 1.2, -2); wreck.add(mast);
    addSphere(wreck.position.x, wreck.position.y + 1, wreck.position.z, 3);
  }
  const chestPos = new THREE.Vector3(CHEST_XZ.x, chestY + 1.5, CHEST_XZ.z);

  /* ==========================================================
     Sehenswürdigkeiten
     ========================================================== */
  const sights = [
    { kind: 'arch', visited: false },
    { kind: 'treasure', visited: false },
    { kind: 'shark', visited: false }
  ];
  let sightCount = 0, archPrev = 0, sharkSeen = false, shockCd = -10;

  function mark(i) {
    if (sights[i].visited) return;
    sights[i].visited = true;
    sightCount++;
    ev('sight', { kind: sights[i].kind, count: sightCount });
    if (i === 1) { chest.target = 1; ev('bonus', { eur: 150 }); }
    if (sightCount === 3) ev('all-sights');
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

    const rr = Math.hypot(p.x, p.z);
    if (rr > WORLD2.radius) {
      const nx = p.x / rr, nz = p.z / rr;
      p.x = nx * WORLD2.radius; p.z = nz * WORLD2.radius;
      const vr = vel.x * nx + vel.z * nz;
      if (vr > 0) { vel.x -= nx * vr; vel.z -= nz * vr; impact = Math.max(impact, vr); }
    }

    const maxY = isSub ? 0.5 : -0.8;
    let fh = groundAt(p.x, p.z, R, isSub);

    /* Insel: Der Boden reicht höher als die Wasseroberfläche. Dann wird das U-Boot
       seitlich aus dem massiven Inselkörper geschoben statt nach oben gedrückt. */
    if (fh + R > maxY + 0.01) {
      let best = null, bd = 1e9;
      for (let i = 0; i < ISLANDS.length; i++) {
        const I = ISLANDS[i];
        const d = Math.hypot(p.x - I.x, p.z - I.z) / I.R;
        if (d < bd) { bd = d; best = I; }
      }
      if (best) {
        let nx = p.x - best.x, nz = p.z - best.z;
        const d = Math.hypot(nx, nz) || 0.0001;
        nx /= d; nz /= d;
        for (let moved = 0; moved < 200; moved += 1.5) {
          if (groundAt(p.x, p.z, R, isSub) + R <= maxY) break;
          p.x += nx * 1.5; p.z += nz * 1.5;
        }
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.z -= nz * vn; }
        fh = groundAt(p.x, p.z, R, isSub);
      }
    }

    if (p.y < fh + R) {
      p.y = fh + R;
      if (vel.y < 0) { impact = Math.max(impact, -vel.y); vel.y = 0; }
    }
    if (p.y > maxY) { p.y = maxY; if (vel.y > 0 && isSub) vel.y = 0; }

    for (let i = 0; i < spheres.length; i++) {
      const c = spheres[i];
      const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
      const lim = c.r + R;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= lim * lim) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d, ny = dy / d, nz = dz / d;
      p.x = c.x + nx * lim; p.y = c.y + ny * lim; p.z = c.z + nz * lim;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
    }

    for (let i = 0; i < DOCK_BOXES.length; i++) {
      const b = DOCK_BOXES[i];
      const cx = clamp(p.x, b.x0, b.x1), cy = clamp(p.y, b.y0, b.y1), cz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
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

    if (isSub) {
      for (let i = 0; i < jellies.length; i++) {
        const j = jellies[i];
        const dx = p.x - j.pos.x, dy = p.y - j.pos.y, dz = p.z - j.pos.z;
        const lim = j.r + R * 0.55;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= lim * lim) continue;
        const d = Math.sqrt(d2) || 0.0001;
        p.x = j.pos.x + dx / d * lim; p.y = j.pos.y + dy / d * lim; p.z = j.pos.z + dz / d * lim;
        impact = Math.max(impact, 4);
        if (time - shockCd > 2.5) { shockCd = time; ev('jelly-shock'); }
      }
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

    // God Rays
    for (let i = 0; i < rays.length; i++) {
      const r = rays[i];
      const dx = ((r.bx - cam.x) % 360 + 540) % 360 - 180;
      const dz = ((r.bz - cam.z) % 360 + 540) % 360 - 180;
      r.holder.position.set(cam.x + dx, 0, cam.z + dz);
      const edge = Math.max(Math.abs(dx), Math.abs(dz)) / 180;
      r.mat.opacity = 0.16 * (0.65 + 0.35 * Math.sin(time * 0.5 + r.ph)) * (1 - edge * edge * edge);
    }

    // Schwebeteilchen
    for (let i = 0; i < PLK; i++) {
      plkPos[i * 3] = cam.x + wrap(plkBase[i * 3] - cam.x + Math.sin(time * 0.2 + i) * 2, PLK_S);
      plkPos[i * 3 + 1] = cam.y + wrap(plkBase[i * 3 + 1] - cam.y + time * 0.4, PLK_S);
      plkPos[i * 3 + 2] = cam.z + wrap(plkBase[i * 3 + 2] - cam.z, PLK_S);
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

    // Fische (weichen Korallen, Felsen, Klippen, Bögen und Inseln aus)
    for (let i = 0; i < schools.length; i++) updateSchool(schools[i], dt);

    // Schildkröten (weichen Hindernissen aus)
    turtles.forEach((T) => {
      orbitPos(T.o, time, T.pos);
      avoidObs(T.pos, null, T.m, 0);
      orbitPos(T.o, time + 0.6, _tmp);
      avoidObs(_tmp, null, T.m, 0);
      T.t.g.lookAt(_tmp);
      const f = Math.sin(time * 1.8 + T.ph);
      T.t.fl[0].rotation.z = -f * 0.45; T.t.fl[1].rotation.z = f * 0.45;
      T.t.fl[2].rotation.z = -f * 0.2; T.t.fl[3].rotation.z = f * 0.2;
      T.t.body.rotation.z = Math.sin(time * 0.9 + T.ph) * 0.06;
    });

    // Delfine: gemeinsame Wellenbögen (weichen Hindernissen aus)
    dolphins.forEach((D) => {
      dolphinPos(D.i, time, D.pos);
      avoidObs(D.pos, null, 4.5, 0);
      dolphinPos(D.i, time + 0.35, _tmp);
      avoidObs(_tmp, null, 4.5, 0);
      D.d.g.lookAt(_tmp);
      D.d.rear.rotation.x = Math.sin(time * 3.4 + D.ph) * 0.15;
      D.d.fluke.rotation.x = Math.sin(time * 3.4 + D.ph - 0.9) * 0.32;
    });

    // Mantas (weichen Hindernissen aus)
    mantas.forEach((M) => {
      orbitPos(M.o, time, M.m.g.position);
      avoidObs(M.m.g.position, null, M.mg, 0);
      orbitPos(M.o, time + 0.6, _tmp);
      avoidObs(_tmp, null, M.mg, 0);
      M.m.g.lookAt(_tmp);
      const f = Math.sin(time * 1.6 + M.ph) * 0.32;
      M.m.wings[0].rotation.z = -f; M.m.wings[1].rotation.z = f;
    });

    // Riffhai (weicht Hindernissen aus)
    orbitPos(SHARK_ORBIT, time, shark.pos);
    avoidObs(shark.pos, null, 7, 0);
    orbitPos(SHARK_ORBIT, time + 0.6, _tmp);
    avoidObs(_tmp, null, 7, 0);
    shark.b.g.lookAt(_tmp);
    shark.b.tail.rotation.y = Math.sin(time * 3.2) * 0.35;
    shark.b.body.rotation.y = Math.sin(time * 3.2 + 1) * 0.06;

    // Quallen (treiben um Hindernisse herum)
    jellies.forEach((j) => {
      j.pos.set(j.base.x + Math.sin(time * 0.2 + j.ph) * 3, j.base.y + Math.sin(time * 0.6 + j.ph) * 2, j.base.z + Math.cos(time * 0.17 + j.ph) * 3);
      avoidObs(j.pos, null, j.r, 0);
      const pulse = Math.sin(time * 2.2 + j.ph);
      j.bell.scale.set(j.s * (1 - pulse * 0.06), j.s * (0.8 + pulse * 0.16), j.s * (1 - pulse * 0.06));
      j.tent.scale.y = j.s * (1 - pulse * 0.1);
    });

    // Schatztruhe
    chest.open += clamp(chest.target - chest.open, -dt * 0.9, dt * 0.9);
    const eo = smooth(0, 1, chest.open);
    chest.lid.rotation.x = -eo * 1.9;
    chest.pile.visible = chest.open > 0.2;
    chest.light.intensity = 70 * eo * (0.8 + 0.2 * Math.sin(time * 5));
    chest.beam.material.opacity = 0.1 + 0.05 * Math.sin(time * 2) + 0.1 * eo;
    chest.spk.visible = chest.open > 0.5;
    if (chest.spk.visible) {
      for (let i = 0; i < 28; i++) {
        const s = chest.spkSeed[i], q = (time * 0.7 + s[1]) % 1;
        chest.spkPos[i * 3] = s[0] * 2.4; chest.spkPos[i * 3 + 1] = 1.1 + q * 4; chest.spkPos[i * 3 + 2] = s[2] * 1.4;
      }
      chest.spk.geometry.attributes.position.needsUpdate = true;
    }

    // Sehenswürdigkeiten
    if (!sights[0].visited) {
      const dx = sp.x - ARCH.x, dz = sp.z - ARCH.z;
      const lx = dx * archC - dz * archS, lz = dx * archS + dz * archC, ly = sp.y - archAY;
      if (Math.abs(lz) < 45) {
        const s = lz >= 0 ? 1 : -1;
        if (archPrev !== 0 && s !== archPrev && Math.hypot(lx, ly) < ARCH.R - ARCH.tube) mark(0);
        archPrev = s;
      } else archPrev = 0;
    }
    if (!sights[1].visited && sp.distanceTo(chestPos) < 24) mark(1);
    const dShark = sp.distanceTo(shark.pos);
    if (!sights[2].visited && dShark < 36) mark(2);
    if (!sharkSeen && dShark < 150) { sharkSeen = true; ev('shark-found'); }
  }

  /* ==========================================================
     Öffentliche Schnittstelle
     ========================================================== */
  const pingTargets = [archPos, chestPos, shark.pos];
  const level = {
    group: root,
    WORLD: WORLD2,
    meta: {
      icons: ['🌉', '💰', '🦈'],
      names: { de: ['Felsbogen', 'Schatz', 'Riffhai'], en: ['Arch', 'Treasure', 'Reef shark'] }
    },
    spawn: { position: new THREE.Vector3(0, -3.2, 12), yaw: 0 },
    islands: ISLANDS,
    schools,
    fauna: {
      pods: [
        { members: turtles.map((T) => ({ pos: T.pos })) },
        { members: [{ pos: shark.pos }] },
        { members: dolphins.map((D) => ({ pos: D.pos })) }
      ],
      rays: mantas.map((M) => ({ w: M.w })),
      jellies
    },
    sights,
    get sightCount() { return sightCount; },
    get time() { return time; },

    setViewDistance(v) { scene.fog.density = FOG_BASE / Math.max(0.3, v); },
    update,
    collideSub,
    drainEvents() { const out = events.slice(); events.length = 0; return out; },
    isAtPlatform(p) { return Math.abs(p.x) < 16 && p.z > -22 && p.z < 36 && p.y > -12; },

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
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
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

/* Aliase im Stil von world.js */
export const createLevel2 = buildLevel2;
export function updateLevel2(level, dt, ctx) { level.update(dt, ctx); }
