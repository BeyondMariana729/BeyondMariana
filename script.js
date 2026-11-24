/* ============================================================
   BEYOND MARIANA – script.js  (MARIANA TOURS)
   Spiel-Logik: Renderer, Eingaben (Tastatur / Gamepad / Touch),
   U-Boot-Physik, Kameras, Laufen im U-Boot, Bord-Bar (Pillen/Champagner),
   Greifarm, Sauerstoff, 3 Sehenswürdigkeiten, Bord-WC (Spieler sitzt wirklich),
   Touristen (tourists.js), Live-Bewertung + Geld, Tour-Abrechnung + Shop,
   2-Spieler-Multiplayer (multiplayer.js, PeerJS/WebRTC).

   Levels:
     Level 1 "Arctic Trench"   -> world.js  (buildLevel1, unverändert)
     Level 2 "Coral Reef"      -> level2.js (buildLevel2)
     Level 3 "Mariana Trench"  -> level3.js (buildLevel3, 11.000 m Tiefsee-Graben)
   Level 2 wird freigeschaltet, sobald eine Tour in Level 1 abgerechnet wurde:
     localStorage 'beyondMariana_level2Unlocked' = 'true'  (bleibt dauerhaft)
   Level 3 wird freigeschaltet, sobald eine Tour in Level 2 abgerechnet wurde:
     localStorage 'beyondMariana_level3Unlocked' = 'true'  (bleibt dauerhaft)
   Beim Levelwechsel werden Touristen, U-Boot, Level UND die komplette
   Szene (Geometrien, Materialien, Texturen) entsorgt.
   Level 3 liefert WORLD3.depthScale: die Tiefen-Anzeige (HUD + U-Boot-Display)
   wird damit auf bis zu ~11.000 m hochgerechnet (Physik/Sauerstoff bleiben echt).

   NEU (CrazyGames-Release):
     - 5 Sprachen (EN/DE/FR/NL/PL); sub.js / tourists.js / shop.js bekommen
       weiterhin nur 'de' oder 'en' (alle anderen Sprachen -> 'en')
     - Bord-Bar-Limit: jeder Passagier nur 1x bedient (max. 6 Verkäufe pro Tour),
       danach SOLD OUT; Preis 25–50 € + Sterne-Bonus
     - Riesenfisch-/Anglerfisch-Bounce in Level 2 und 3 (sanfter Rückstoß,
       kurzes weiches Kamera-Rütteln, Warn-Popup)
     - Steuerung: WASD / ZQSD / Pfeiltasten steuern, Maus ziehen = umschauen,
       Enter = Aktion (E im Laufmodus), 5-Sekunden-Steuerungs-Overlay
     - kein hartes Flackern: Kamera-Wackeln weich (Sinus statt Zufall)

   NEU (CrazyGames SDK v3) – STRIKT NUR AUF CRAZYGAMES:
     - isCrazyGamesEnv ist nur dann true, wenn das Spiel wirklich auf CrazyGames läuft
       (Hostname / Ancestor-Origin / Referrer enthält "crazygames", window.CrazyGames.SDK
       vorhanden, SDK.init() erfolgreich und SDK.environment !== 'disabled').
       Auf beyondmarianaa.pages.dev oder lokal bleibt es false: keine SDK-Events,
       keine Werbung, kein Ad-Button, keine Konsolenfehler.
     - loadingStart/loadingStop beim Laden, gameplayStart/gameplayStop bei Level-Start,
       Fortsetzen, Menü und Tour-Abrechnung
     - Midgame-Ad nach der Tour-Abrechnung (NEXT TOUR / TO MENU), Ton währenddessen aus
     - Rewarded-Ad "Watch Ad: +500 €" im Ergebnis-Screen (Button nur auf CrazyGames sichtbar)

   Multiplayer:
     Host erstellt einen Raum (4-stelliger Code), Gast tritt bei, beide starten
     gleichzeitig dasselbe Level (gleicher Zufalls-Seed beim Level-Aufbau).
     Jeder sieht das U-Boot des anderen (interpoliert) mit Namensschild und
     einen Live-Geldvergleich im HUD. Singleplayer bleibt unverändert.

   Passt zu: index.html, ui.js, world.js, level2.js, level3.js, sub.js, tourists.js, multiplayer.js, shop.js
   Steuerung (Tastatur):
     W/Z/↑ vor · S/↓ zurück (im U-Boot: Gas) · A/Q/← links · D/→ rechts
     (beim Laufen: seitwärts) · Leertaste hoch · Shift runter (beim Laufen: Shift = rennen)
     Maus/Finger ziehen = umschauen
     F Licht · G Greifarm · C Kamera wechseln
     E aufstehen/hinsetzen (an Bar/WC: Aktion) · Enter = Aktion
     Esc oder P = Menü
   Gamepad:
     Linker Stick bewegen/lenken · Rechter Stick umschauen
     R2/L2 hoch/runter · L1 Licht · Y Kamera · X aufstehen/hinsetzen
     A Aktion · B Greifarm · Start Menü
   ============================================================ */

import * as THREE from 'three';
import { createSub, SUB } from './sub.js';
import { buildLevel1, WORLD } from './world.js';
import { buildLevel2, WORLD2 } from './level2.js';
import { buildLevel3, WORLD3 } from './level3.js';
import { buildLevel4, WORLD4, isLevel4Unlocked, markLevel3Complete } from './level4.js';
import { createTourists } from './tourists.js';
import { createMultiplayer } from './multiplayer.js';
import * as UI from './ui.js';
import * as Shop from './shop.js';

/* ------------------------------------------------------------
   Kleine Helfer
   ------------------------------------------------------------ */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const deadzone = (v, dz) => {
  dz = dz === undefined ? 0.15 : dz;
  const a = Math.abs(v);
  return a < dz ? 0 : Math.sign(v) * (a - dz) / (1 - dz);
};
const normLevel = (n) => { n = Number(n); return n === 4 ? 4 : (n === 3 ? 3 : (n === 2 ? 2 : 1)); };

/* sub.js / tourists.js / shop.js kennen nur 'de' und 'en' -> alles andere = 'en' */
const toDispLang = (l) => ((l || UI.settings.lang) === 'de' ? 'de' : 'en');

/* Kleiner, schneller Zufallsgenerator mit Seed (für den gemeinsamen Level-Aufbau) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------
   Zusätzliche Texte (5 Sprachen), die ui.js nicht enthält
   Fallback: aktuelle Sprache -> Englisch
   ------------------------------------------------------------ */
const TX = {
  en: {
    loading: 'Loading world …',
    armOut: 'Grabber arm extended',
    armIn: 'Grabber arm retracted',
    hintFlush: 'Onboard toilet: E / ACTION sits you down',
    hintFlushSeated: 'On the loo: E / ACTION flushes · move or STAND UP to get up',
    wcSit: 'You are sitting on the onboard toilet. E / ACTION flushes, moving stands you up.',
    wcOccupied: 'Occupied! A tourist is sitting on the onboard toilet.',
    flush: 'Flush! The rubber duck is dancing …',
    loadError: 'Loading error: ',
    tourError: 'Tourist error: '
  },
  de: {
    loading: 'Welt wird geladen …',
    armOut: 'Greifarm ausgefahren',
    armIn: 'Greifarm eingefahren',
    hintFlush: 'Bord-WC: E / AKTION setzt dich hin',
    hintFlushSeated: 'Auf dem Klo: E / AKTION spült · bewegen oder AUFSTEHEN zum Aufstehen',
    wcSit: 'Du sitzt auf dem Bord-WC. E / AKTION spült, Bewegen steht wieder auf.',
    wcOccupied: 'Besetzt! Gerade sitzt ein Tourist auf dem Bord-WC.',
    flush: 'Spülung! Die Quietscheente tanzt …',
    loadError: 'Fehler beim Laden: ',
    tourError: 'Touristen-Fehler: '
  },
  fr: {
    loading: 'Chargement du monde …',
    armOut: 'Bras de préhension sorti',
    armIn: 'Bras de préhension rentré',
    hintFlush: 'Toilettes de bord : E / ACTION pour s’asseoir',
    hintFlushSeated: 'Sur les toilettes : E / ACTION tire la chasse · bougez ou SE LEVER pour se lever',
    wcSit: 'Vous êtes assis sur les toilettes de bord. E / ACTION tire la chasse, bouger vous relève.',
    wcOccupied: 'Occupé ! Un touriste est assis sur les toilettes de bord.',
    flush: 'Chasse d’eau ! Le canard en plastique danse …',
    loadError: 'Erreur de chargement : ',
    tourError: 'Erreur touriste : '
  },
  nl: {
    loading: 'Wereld laden …',
    armOut: 'Grijparm uitgeschoven',
    armIn: 'Grijparm ingetrokken',
    hintFlush: 'Boordtoilet: E / ACTIE om te gaan zitten',
    hintFlushSeated: 'Op de wc: E / ACTIE trekt door · beweeg of OPSTAAN om op te staan',
    wcSit: 'Je zit op het boordtoilet. E / ACTIE trekt door, bewegen laat je opstaan.',
    wcOccupied: 'Bezet! Er zit een toerist op het boordtoilet.',
    flush: 'Doortrekken! Het badeendje danst …',
    loadError: 'Laadfout: ',
    tourError: 'Toeristenfout: '
  },
  pl: {
    loading: 'Ładowanie świata …',
    armOut: 'Chwytak wysunięty',
    armIn: 'Chwytak schowany',
    hintFlush: 'Toaleta pokładowa: E / AKCJA – usiądź',
    hintFlushSeated: 'Na toalecie: E / AKCJA spuszcza wodę · ruszaj się lub WSTAŃ, by wstać',
    wcSit: 'Siedzisz na toalecie pokładowej. E / AKCJA spuszcza wodę, ruch podnosi cię z powrotem.',
    wcOccupied: 'Zajęte! Na toalecie pokładowej siedzi turysta.',
    flush: 'Spłuczka! Gumowa kaczuszka tańczy …',
    loadError: 'Błąd ładowania: ',
    tourError: 'Błąd turystów: '
  }
};
const T = (key) => (TX[UI.settings.lang] && TX[UI.settings.lang][key]) || TX.en[key] || key;

/* ------------------------------------------------------------
   Konstanten
   ------------------------------------------------------------ */
const PHYS = {
  maxForward: 15,
  maxBack: 7,
  maxVertical: 7.5,
  speedRate: 1.7,
  brakeRate: 2.3,
  yawRate: 0.85,
  walkSpeed: 2.5,
  runSpeed: 4.2
};
const O2_SECONDS = 660;
const O2_RECHARGE = 0.22;
const LOOK_STICK = 2.2;
const LOOK_POINTER = 0.0045;

const TICKET_PER_SIGHT = 40;     // Fahrpreis je Sehenswürdigkeit
const STAR_BONUS = 50;           // € je Stern über 3.0
const PILLS_COOLDOWN = 24;       // Sekunden
const CHAMPAGNE_COOLDOWN = 8;
const FISH_MIN_SIZE = 2.3;       // ab dieser Länge reagieren Touristen auf Fische
const SHOCK_TIME = 1.8;          // Quallen-Schock (Sekunden)

/* Bord-Bar-Limit: jeder Passagier nur 1x bedient, max. 6 Verkäufe pro Tour */
const BAR_MAX_SALES = 6;
const BAR_PRICE_MIN = 25;
const BAR_PRICE_MAX = 50;
const BAR_STAR_BONUS = 5;        // € je Stern über 3.0 (max. +10 bei 5 Sternen)

/* Riesenfisch-/Anglerfisch-Bounce (Level 2 + 3) */
const GIANT_SIZE_MIN = 7;        // Fische/Tiere ab dieser Größe zählen als "Riese"
const GIANT_DEFAULT_RADIUS = 9;  // Körperradius, wenn das Level keinen angibt
const GIANT_BOUNCE = 9;          // Rückstoß-Geschwindigkeit weg vom Monster (m/s)
const GIANT_POPUP_CD = 2.5;      // Sekunden zwischen zwei Warn-Popups
const RUMBLE_TIME = 0.7;         // weiches Kamera-Rütteln nach dem Rückstoß

const MP_SEND_INTERVAL = 1 / 15; // Multiplayer: 15 Zustands-Pakete pro Sekunde
const MP_SPAWN_OFFSET = 8;       // Gast startet 8 m neben dem Host

/* CrazyGames: Belohnung für die Rewarded-Werbung */
const REWARD_AD_EUR = 500;
const AD_GUARD_MS = 120000;      // Sicherheits-Timeout, falls ein Ad-Callback nie kommt

/* Level-2/3-Sehenswürdigkeiten -> Reaktionen, die tourists.js schon kennt */
const TOUR_KIND = {
  arch: 'cathedral', treasure: 'wreck', shark: 'whale',        // Level 2
  lava: 'cathedral', subwreck: 'wreck', monster: 'whale'       // Level 3
};

/* Standard-Symbole/-Namen (Level 1) */
const DEFAULT_SIGHT_META = {
  icons: ['🚢', '💎', '🐋'],
  names: { de: ['Wrack', 'Kathedrale', 'Riesenwal'], en: ['Wreck', 'Cathedral', 'Giant whale'] }
};
const sightNamesFor = (lang) => (sightMeta.names[toDispLang(lang)] || sightMeta.names.en || sightMeta.names.de);

/* ------------------------------------------------------------
   Speicherstand: Geld + Upgrades (bleiben zwischen den Touren)
   ------------------------------------------------------------ */
const SAVE_KEY = 'beyond-mariana-save-v2';
let money = 0;
const owned = { golden: false, fog: false, flood: false };
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const o = JSON.parse(raw);
    if (typeof o.money === 'number') money = Math.max(0, o.money);
    ['golden', 'fog', 'flood'].forEach((k) => { if (o.owned && o.owned[k] === true) owned[k] = true; });
  }
} catch (e) { /* ignorieren */ }
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money, owned })); } catch (e) { /* ignorieren */ }
}

function spendMoney(amount) {
  if (money < amount) return false;
  money -= amount;
  saveGame();
  UI.updateMoney(money, -amount);
  return true;
}

function applyShopSkins() {
  if (!sub) return;
  try { Shop.applyEquipped({ sub, tourists }); } catch (err) { console.error('[Shop]', err); }
}

/* ------------------------------------------------------------
   Level-2/3-Freischaltung (dauerhaft in localStorage)
   ------------------------------------------------------------ */
const LEVEL2_KEY = 'beyondMariana_level2Unlocked';
const LEVEL3_KEY = 'beyondMariana_level3Unlocked';
let level2Unlocked = false;
let level3Unlocked = false;
try {
  level2Unlocked = localStorage.getItem(LEVEL2_KEY) === 'true';
  level3Unlocked = localStorage.getItem(LEVEL3_KEY) === 'true';
} catch (e) { /* ignorieren */ }
if (UI.isLevel2Unlocked()) level2Unlocked = true;   // z. B. alter Spielstand aus ui.js
if (UI.isLevel3Unlocked()) level3Unlocked = true;

function unlockLevel2() {
  if (level2Unlocked) return false;
  level2Unlocked = true;
  try { localStorage.setItem(LEVEL2_KEY, 'true'); } catch (e) { /* ignorieren */ }
  UI.setLevel2Unlocked(true);
  return true;
}

function unlockLevel3() {
  if (level3Unlocked) return false;
  level3Unlocked = true;
  try { localStorage.setItem(LEVEL3_KEY, 'true'); } catch (e) { /* ignorieren */ }
  UI.setLevel3Unlocked(true);
  return true;
}

/* ------------------------------------------------------------
   Audio (iPad): ein gemeinsamer AudioContext (window.__MARIANA_AC)
   Während einer Werbung (CrazyGames) wird der Ton stummgeschaltet.
   ------------------------------------------------------------ */
let audioPrimed = false;
let audioMuted = false;

function unlockAudio() {
  if (audioMuted) return;         // während einer Werbung bleibt der Ton aus
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!window.__MARIANA_AC && AC) window.__MARIANA_AC = new AC();
    const ctx = window.__MARIANA_AC;
    if (!ctx) return;
    if (ctx.state !== 'running') {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
    if (!audioPrimed) {
      audioPrimed = true;
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch (e) { /* egal */ }
}
['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach((n) => {
  window.addEventListener(n, unlockAudio, { capture: true, passive: true });
});

/* Spiel-Ton kurz aus-/einschalten (nur für Werbung) */
function setGameMuted(m) {
  audioMuted = !!m;
  try {
    const ctx = window.__MARIANA_AC;
    if (!ctx) return;
    let p = null;
    if (audioMuted) { if (ctx.state === 'running') p = ctx.suspend(); }
    else if (ctx.state !== 'running') p = ctx.resume();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* egal */ }
}

/* ------------------------------------------------------------
   CrazyGames SDK v3 – NUR aktiv, wenn das Spiel wirklich auf CrazyGames läuft.
   Auf beyondmarianaa.pages.dev / lokal: isCrazyGamesEnv bleibt false -> keine SDK-Events,
   keine Werbung, kein Ad-Button, keine Konsolenfehler.
   ------------------------------------------------------------ */
let isCrazyGamesEnv = false;
let cgSdk = null;
let cgLoading = false;
let cgPlaying = false;
let adBusy = false;

const OWN_HOST_RE = /(^|\.)beyondmarianaa\.pages\.dev$/i;

function hostHasCrazyGames(s) {
  return String(s || '').toLowerCase().indexOf('crazygames') !== -1;
}

/* Läuft die Seite auf crazygames.com bzw. in einem CrazyGames-Iframe? */
function cgLooksLikeCrazyGames() {
  try {
    const host = (location.hostname || '').toLowerCase();
    if (OWN_HOST_RE.test(host)) return false;            // eigene Website: nie
    if (hostHasCrazyGames(host)) return true;
    const ao = location.ancestorOrigins;
    if (ao) {
      for (let i = 0; i < ao.length; i++) { if (hostHasCrazyGames(ao[i])) return true; }
    }
    const ref = document.referrer || '';
    if (ref) {
      let rh = ref;
      try { rh = new URL(ref).hostname; } catch (e) { /* ref direkt prüfen */ }
      if (hostHasCrazyGames(rh)) return true;
    }
  } catch (e) { /* egal */ }
  return false;
}

/* SDK-Aufruf, der niemals eine Konsolen-Ausnahme wirft */
function cgSafe(fn) {
  if (!isCrazyGamesEnv || !cgSdk) return;
  try {
    const r = fn(cgSdk);
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch (e) { /* still */ }
}

function cgLoadingStart() {
  if (!isCrazyGamesEnv || cgLoading) return;
  cgLoading = true;
  cgSafe((s) => s.game.loadingStart());
}
function cgLoadingStop() {
  if (!isCrazyGamesEnv || !cgLoading) return;
  cgLoading = false;
  cgSafe((s) => s.game.loadingStop());
}
function cgGameplayStart() {
  if (!isCrazyGamesEnv || cgPlaying) return;
  cgPlaying = true;
  cgSafe((s) => s.game.gameplayStart());
}
function cgGameplayStop() {
  if (!isCrazyGamesEnv || !cgPlaying) return;
  cgPlaying = false;
  cgSafe((s) => s.game.gameplayStop());
}

/* Erkennung + Initialisierung (still: bei jedem Problem einfach "nicht CrazyGames") */
const cgReady = (async () => {
  try {
    if (!cgLooksLikeCrazyGames()) return false;
    const sdk = window.CrazyGames && window.CrazyGames.SDK;
    if (!sdk) return false;
    await sdk.init();
    if (!sdk.environment || sdk.environment === 'disabled') return false;
    cgSdk = sdk;
    isCrazyGamesEnv = true;
    return true;
  } catch (e) {
    cgSdk = null;
    isCrazyGamesEnv = false;
    return false;
  }
})().then((ok) => {
  if (ok) {
    cgLoadingStart();
    UI.setAdsEnabled(true);     // Rewarded-Button wird NUR hier sichtbar
  }
  return ok;
});

/* Midgame-Werbung (nur auf CrazyGames). done() wird immer genau einmal aufgerufen. */
function runMidgameAd(done) {
  if (adBusy) return;
  if (!isCrazyGamesEnv || !cgSdk) { done(); return; }
  adBusy = true;
  let over = false;
  let guard = 0;
  const finish = () => {
    if (over) return;
    over = true;
    clearTimeout(guard);
    adBusy = false;
    setGameMuted(false);
    done();
  };
  guard = setTimeout(finish, AD_GUARD_MS);
  try {
    cgSdk.ad.requestAd('midgame', {
      adStarted: () => { setGameMuted(true); },
      adFinished: finish,
      adError: finish
    });
  } catch (e) {
    finish();
  }
}

/* Rewarded-Werbung: +500 € bei Erfolg (nur auf CrazyGames) */
function watchRewardedAd() {
  if (!isCrazyGamesEnv || !cgSdk || adBusy) return;
  adBusy = true;
  UI.setRewardedBusy(true);
  let over = false;
  let guard = 0;
  const end = (granted) => {
    if (over) return;
    over = true;
    clearTimeout(guard);
    adBusy = false;
    setGameMuted(false);
    UI.setRewardedBusy(false);
    if (granted) {
      money += REWARD_AD_EUR;
      saveGame();
      UI.updateMoney(money, REWARD_AD_EUR);
      UI.refreshResult({ money, owned: Object.assign({}, owned), rewarded: true });
    } else {
      UI.showResultMessage('adNoAd');
    }
  };
  guard = setTimeout(() => end(false), AD_GUARD_MS);
  try {
    cgSdk.ad.requestAd('rewarded', {
      adStarted: () => { setGameMuted(true); },
      adFinished: () => end(true),
      adError: () => end(false)
    });
  } catch (e) {
    end(false);
  }
}

// Untertitel-Box der Touristen immer über dem HUD
(function injectSubtitleStyle() {
  const st = document.createElement('style');
  st.textContent = '#tourist-sub{z-index:9999 !important;bottom:18% !important}';
  document.head.appendChild(st);
})();

/* ------------------------------------------------------------
   Renderer, Kamera, Canvas (mit automatischem Tastatur-Fokus)
   ------------------------------------------------------------ */
const host = document.getElementById('game');
if (!host) throw new Error('Element #game fehlt in der index.html');
const btnMenu = document.getElementById('btn-menu');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, UI.isTouchDevice() ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x02101a, 1);

const canvas = renderer.domElement;
canvas.id = 'game-canvas';
canvas.tabIndex = 0;
canvas.setAttribute('aria-label', 'BEYOND MARIANA');
canvas.style.outline = 'none';
canvas.style.display = 'block';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.touchAction = 'none';
canvas.style.userSelect = 'none';
canvas.style.webkitUserSelect = 'none';
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
host.appendChild(canvas);
if (host.clientHeight < 50) {
  Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '0' });
}

const camera = new THREE.PerspectiveCamera(72, 1, 0.1, WORLD.cameraFar);
const idleScene = new THREE.Scene();
idleScene.background = new THREE.Color(0x02101a);

function focusCanvas() {
  try { canvas.focus({ preventScroll: true }); } catch (e) { canvas.focus(); }
}

function resize() {
  const w = host.clientWidth || window.innerWidth;
  const h = host.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

/* ------------------------------------------------------------
   Spielzustand
   ------------------------------------------------------------ */
let scene = null;
let level = null;
let sub = null;
let tourists = null;
let running = false;

let currentLevelId = 1;      // 1 = Arctic Trench (world.js), 2 = Coral Reef (level2.js), 3 = Mariana Trench (level3.js)
let worldCfg = WORLD;
let sightMeta = DEFAULT_SIGHT_META;
let shockT = 0;              // Quallen-Schock
let rumbleT = 0;             // weiches Kamera-Rütteln nach Riesen-Bounce

let mode = 'ext';            // 'ext' | 'cockpit' | 'walk'
let snapCam = true;
let lookYaw = 0;
let lookPitch = 0;
let lookIdle = 0;

const vel = new THREE.Vector3();
let yaw = 0, pitch = 0, yawVel = 0;
let thrS = 0, steerS = 0, vertS = 0;

const walkPos = new THREE.Vector3();
const eyeLocal = new THREE.Vector3();

let o2 = 1;
let o2LowShown = false;
let o2Charging = false;
let darkShown = false;

let bumpCd = 0;
let simTime = 0;
let lastT = performance.now();
const later = [];

let onToilet = false;
let fishWatchT = 0;
let fishInside = new WeakSet();
let lastNear = null;

let allSights = false;       // alle 3 Sehenswürdigkeiten besucht
let settled = false;         // Tour abgerechnet
let tourEarned = 0;          // in dieser Tour verdientes Geld
let lastRating = 4;
const barCd = { pills: 0, champagne: 0 };
let barSold = 0;             // Bar-Verkäufe in dieser Tour
let barCapacity = BAR_MAX_SALES;   // = Anzahl Passagiere (max. 6)
const pingsOut = [];

let controlsHintShown = false;     // 5-Sekunden-Steuerungs-Overlay nur beim ersten Level-Start

/* Riesenfisch-Bounce */
let giantRefs = [];
let giantCd = 0;
let giantWarned = false;

/* Multiplayer-Zustand */
let mpSeed = null;           // gemeinsamer Seed für den Level-Aufbau (null = Singleplayer)
let mpSendT = 0;
let mpBarT = 0;

/* wiederverwendete Objekte */
const _v = new THREE.Vector3();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _camTarget = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _zeroVel = new THREE.Vector3();
const _fv = new THREE.Vector3();
const _gp = new THREE.Vector3();
const _gn = new THREE.Vector3();
const colPts = [];
const _c0 = new THREE.Vector3();
const _d = new THREE.Vector3();
const lightOut = { pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), on: false, range: 120, cone: 0.42, fogPen: 0 };
const bubbleOut = new THREE.Vector3();
const worldCtx = { subPos: null, camPos: camera.position, light: lightOut, thrust: 0, bubblePos: bubbleOut };

function tEvent(type, data) {
  if (!tourists) return;
  try { tourists.event(type, data); } catch (err) { console.error('[Touristen] Ereignis', type, err); }
}

function addMoney(amount) {
  money = Math.max(0, money + amount);
  tourEarned += Math.max(0, amount);
  saveGame();
  UI.updateMoney(money, amount);
}

function applyUpgrades() {
  if (sub) sub.setUpgrades(owned);
  if (tourists) tourists.setUpgrades({ golden: owned.golden });
}

/* ------------------------------------------------------------
   Multiplayer (PeerJS / WebRTC)
   ------------------------------------------------------------ */
function mpErrStatus(err) {
  const c = err && (err.code || err.type);
  if (c === 'peer-unavailable') return ['mpErrNoRoom', null];
  if (c === 'no-lib') return ['mpErrLib', null];
  if (c === 'timeout') return ['mpErrTimeout', null];
  return ['mpErrGeneric', { err: c || (err && err.message) || '?' }];
}

const mp = createMultiplayer({
  // Host: der Mitspieler ist beigetreten -> Level + Seed festlegen, beide starten gleichzeitig
  onPeerJoined: (name) => {
    UI.setMpStatus('host', 'mpJoined', { name }, 'ok');
    let levelId = UI.getMpLevel();
    if (levelId === 2 && !level2Unlocked) levelId = 1;
    if (levelId === 3 && !level3Unlocked) levelId = level2Unlocked ? 2 : 1;
    const seed = ((Math.random() * 4294967295) >>> 0) || 1;
    mp.sendStart(levelId, seed);
    startMultiplayerGame(levelId, seed);
  },
  // Gast: Host hat sich gemeldet
  onConnected: () => {
    UI.setMpStatus('join', 'mpGuestWait', null, 'ok');
  },
  // Gast: Host hat das Spiel gestartet
  onStart: (levelId, seed) => {
    startMultiplayerGame(levelId, seed);
  },
  onPeerLeft: (name) => {
    UI.setMpBarActive(false);
    mpSeed = null;
    UI.setMpStatus('host', 'mpPeerLeft', { name }, 'err');
    UI.setMpStatus('join', 'mpPeerLeft', { name }, 'err');
    UI.showMessage('mpPeerLeft', { name }, 5000);
  },
  onError: (err) => { console.warn('[Multiplayer]', err); }
});

function startMultiplayerGame(levelId, seed) {
  mpSeed = (Number(seed) >>> 0) || 1;
  currentLevelId = normLevel(levelId);
  UI.enterGame();
  UI.setMpBarActive(true, mp.remoteName);
  mpSendT = 0;
  mpBarT = 0;
  startLevel();
}

/* Der Gast startet 8 m neben dem Host (rechts von der Fahrtrichtung) */
function placeAtSpawn() {
  sub.group.position.copy(level.spawn.position);
  if (mp.connected && mp.role === 'guest') {
    sub.group.position.x += Math.cos(yaw) * MP_SPAWN_OFFSET;
    sub.group.position.z -= Math.sin(yaw) * MP_SPAWN_OFFSET;
  }
}

function mpTick(dt) {
  if (!mp.connected) return;

  // eigenen Zustand an den Mitspieler schicken
  mpSendT -= dt;
  if (mpSendT <= 0) {
    mpSendT = MP_SEND_INTERVAL;
    const p = sub.group.position;
    const paused = UI.isMenuOpen();
    const r2 = (v) => Math.round(v * 100) / 100;
    const r3 = (v) => Math.round(v * 1000) / 1000;
    mp.sendState({
      lv: currentLevelId,
      x: r2(p.x), y: r2(p.y), z: r2(p.z),
      yaw: r3(yaw), pitch: r3(pitch),
      vx: paused ? 0 : r2(vel.x), vy: paused ? 0 : r2(vel.y), vz: paused ? 0 : r2(vel.z),
      light: sub.lightOn,
      thr: r2(thrS), steer: r2(steerS), vert: r2(vertS),
      money: Math.round(money)
    });
  }

  // fremdes U-Boot weich nachziehen
  mp.update(dt, camera);

  // Geld-Vergleich im HUD
  mpBarT -= dt;
  if (mpBarT <= 0) {
    mpBarT = 0.25;
    UI.updateMpBar({ me: money, friend: mp.remote.money, name: mp.remoteName });
  }
}

/* ------------------------------------------------------------
   Eingaben: Tastatur
   ------------------------------------------------------------ */
const keys = new Set();
const holds = { forward: false, back: false, left: false, right: false, up: false, down: false };
let lookDX = 0, lookDY = 0;

const GAME_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ', 'KeyF', 'KeyG', 'KeyC', 'KeyE',
  'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Enter', 'Tab', 'Escape', 'KeyP'
]);

function codeOf(e) {
  if (e.code) return e.code;
  const k = e.key;
  if (!k) return '';
  if (k.length === 1) {
    if (k === ' ') return 'Space';
    return /[a-z]/i.test(k) ? 'Key' + k.toUpperCase() : k;
  }
  if (k === 'Shift') return 'ShiftLeft';
  return k;
}

function isPlaying() {
  return !!(running && level && sub && !UI.isMenuOpen());
}

window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  const code = codeOf(e);

  if (!isPlaying()) return;
  if (GAME_CODES.has(code)) e.preventDefault();
  keys.add(code);
  if (e.repeat) return;

  switch (code) {
    case 'Escape':
    case 'KeyP': openMenu(); break;
    case 'KeyF': toggleLight(); break;
    case 'KeyG': toggleArm(); break;
    case 'KeyC': cycleCamera(); break;
    case 'KeyE':
      if (mode === 'walk') { if (!interact()) toggleStand(); } else toggleStand();
      break;
    case 'Enter': interact(); break;
    default: break;
  }
});

window.addEventListener('keyup', (e) => {
  const code = codeOf(e);
  keys.delete(code);
  if (running && GAME_CODES.has(code) && !UI.isMenuOpen()) e.preventDefault();
});

function releaseInputs() {
  keys.clear();
  for (const k in holds) holds[k] = false;
  lookDX = lookDY = 0;
  lookPointer = null;
}
window.addEventListener('blur', releaseInputs);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseInputs(); });
window.addEventListener('focus', () => { if (isPlaying()) focusCanvas(); });

/* ------------------------------------------------------------
   Eingaben: Maus / Finger ziehen = umschauen
   ------------------------------------------------------------ */
let lookPointer = null;
let lastPX = 0, lastPY = 0;

window.addEventListener('pointerdown', (e) => {
  if (!isPlaying()) return;
  const t = e.target;
  if (t && t.closest && t.closest('.tbtn, #btn-menu, #menu, #result, button')) return;
  focusCanvas();
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (lookPointer !== null) return;
  lookPointer = e.pointerId;
  lastPX = e.clientX; lastPY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== lookPointer) return;
  lookDX += e.clientX - lastPX;
  lookDY += e.clientY - lastPY;
  lastPX = e.clientX; lastPY = e.clientY;
});
const endLook = (e) => { if (e.pointerId === lookPointer) lookPointer = null; };
window.addEventListener('pointerup', endLook);
window.addEventListener('pointercancel', endLook);

document.addEventListener('touchmove', (e) => { if (isPlaying()) e.preventDefault(); }, { passive: false });
['gesturestart', 'gesturechange', 'gestureend'].forEach((n) => {
  document.addEventListener(n, (e) => { if (isPlaying()) e.preventDefault(); });
});
// Kein Text-Markieren im Spiel (außer in Eingabefeldern)
document.addEventListener('selectstart', (e) => {
  const t = e.target;
  if (t && t.closest && t.closest('input, textarea')) return;
  e.preventDefault();
});

/* ------------------------------------------------------------
   Eingaben: Touch-Buttons (kommen komplett aus der index.html)
   ------------------------------------------------------------ */
function doTouchAction(act) {
  if (!isPlaying()) return;
  switch (act) {
    case 'light': toggleLight(); break;
    case 'cam': cycleCamera(); break;
    case 'stand': toggleStand(); break;
    case 'arm': toggleArm(); break;
    case 'action': interact(); break;
    default: break;
  }
}

function bindTouchButtons() {
  document.querySelectorAll('.tbtn').forEach((btn) => {
    btn.tabIndex = -1;
    btn.style.touchAction = 'none';
    btn.style.userSelect = 'none';
    btn.style.webkitUserSelect = 'none';
    btn.style.webkitTouchCallout = 'none';
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    const hold = btn.dataset.hold;
    const act = btn.dataset.act;
    if (hold) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        holds[hold] = true;
      });
      const off = () => { holds[hold] = false; if (running) focusCanvas(); };
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('lostpointercapture', () => { holds[hold] = false; });
    } else if (act) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        doTouchAction(act);
        focusCanvas();
      });
    }
  });
}

/* ------------------------------------------------------------
   Eingaben: Gamepad
   ------------------------------------------------------------ */
const padPrev = {};
function padEdge(name, down) {
  const was = !!padPrev[name];
  padPrev[name] = down;
  return down && !was;
}

function activePad() {
  const pads = (navigator.getGamepads ? navigator.getGamepads() : null) || [];
  for (let i = 0; i < pads.length; i++) {
    if (pads[i] && pads[i].connected) return pads[i];
  }
  return null;
}

function readPad() {
  const gp = activePad();
  if (!gp) return null;
  const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const v = (i) => (gp.buttons[i] ? (gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0)) : 0);
  const ax = (i) => deadzone(gp.axes[i] || 0);
  return {
    lx: ax(0), ly: ax(1), rx: ax(2), ry: ax(3),
    up: Math.max(v(7), b(12) ? 1 : 0),
    down: Math.max(v(6), b(13) ? 1 : 0),
    light: padEdge('light', b(4)),
    cam: padEdge('cam', b(3)),
    stand: padEdge('stand', b(2)),
    action: padEdge('action', b(0)),
    arm: padEdge('arm', b(1)),
    menu: padEdge('menu', b(9))
  };
}

function syncPad() { readPad(); }

/* ------------------------------------------------------------
   Aktionen
   ------------------------------------------------------------ */
function toggleLight() {
  if (!sub) return;
  const on = sub.toggleLight();
  UI.setButtonState('light', on);
  UI.showMessage(on ? 'msgLightOn' : 'msgLightOff', null, 1400);
}

function toggleArm() {
  if (!sub) return;
  const on = sub.toggleArm();
  UI.setButtonState('arm', on);
  UI.showMessage(T(on ? 'armOut' : 'armIn'), null, 1800);
}

/* ---------- Bord-Bar (jeder Passagier nur 1x, max. 6 Verkäufe pro Tour) ---------- */
function barPrice() {
  const rating = tourists ? tourists.averageRating() : lastRating;
  const base = BAR_PRICE_MIN + Math.random() * (BAR_PRICE_MAX - BAR_PRICE_MIN);
  const bonus = Math.max(0, rating - 3) * BAR_STAR_BONUS;
  return Math.round(base + bonus);
}

function serveBar(kind) {
  if (barSold >= barCapacity) {
    UI.showMessage('msgBarSoldOut', null, 3000);
    return true;
  }
  if (barCd[kind] > 0) {
    UI.showMessage('msgBarCd', null, 1800);
    return true;
  }
  // Effekte der Touristen (Rausch, Jubel) auslösen – den Betrag bestimmen wir selbst
  if (tourists) {
    try {
      if (kind === 'pills') tourists.buyPills();
      else tourists.serveChampagne();
    } catch (err) { console.error('[Touristen] Bar', err); }
  }
  barCd[kind] = kind === 'pills' ? PILLS_COOLDOWN : CHAMPAGNE_COOLDOWN;
  barSold++;
  const eur = barPrice();
  sub.serve(kind);
  addMoney(eur);
  UI.showMessage(kind === 'pills' ? 'msgPills' : 'msgChampagne', { eur }, 3800);
  return true;
}

/* ---------- Bord-WC: Spieler setzt sich WIRKLICH hin ---------- */
function sitOnToilet() {
  if (tourists && !tourists.setPlayerOnToilet(true)) {
    UI.showMessage(T('wcOccupied'), null, 2600);
    return true;
  }
  onToilet = true;
  walkPos.copy(SUB.toiletSpot);       // beim Aufstehen steht man wieder vor dem Klo
  lookYaw = Math.PI / 2;              // Blick zum Gang (-X)
  lookPitch = 0;
  UI.showMessage(T('wcSit'), null, 4500);
  return true;
}

function leaveToilet() {
  if (!onToilet) return;
  onToilet = false;
  if (tourists) tourists.setPlayerOnToilet(false);
}

function setCameraMode(m, silent) {
  if (m === mode && !silent) return;
  if (m !== 'walk') leaveToilet();
  mode = m;
  lookYaw = 0; lookPitch = 0; lookIdle = 0;
  snapCam = true;
  if (m === 'walk') walkPos.copy(SUB.standSpot);
  if (sub) sub.setCaptainVisible(m === 'ext');
  UI.setStandButtonLabel(m === 'walk');
  if (!silent) UI.setMode(m === 'ext' ? 'modeExt' : (m === 'cockpit' ? 'modeCockpit' : 'modeWalk'));
}

function cycleCamera() {
  if (!sub) return;
  if (mode === 'ext') setCameraMode('cockpit');
  else if (mode === 'cockpit') setCameraMode('walk');
  else setCameraMode('ext');
}

function toggleStand() {
  if (!sub) return;
  if (onToilet) { leaveToilet(); return; }
  setCameraMode(mode === 'walk' ? 'cockpit' : 'walk');
}

// Kontext-Aktion: Bar, Bord-WC, Greifarm
function interact() {
  if (!sub || !level) return false;

  if (mode === 'walk') {
    if (onToilet) {
      if (sub.flushToilet()) {
        if (tourists) tourists.playFlush();
        UI.showMessage(T('flush'), null, 3000);
      } else {
        leaveToilet();
      }
      return true;
    }
    const id = sub.nearestInteractable(walkPos);
    if (id === 'pills') return serveBar('pills');
    if (id === 'champagne') return serveBar('champagne');
    if (id === 'toilet') return sitOnToilet();
    return false;
  }

  if (sub.armExtended) {
    sub.grab();
    return true;
  }
  return false;
}

function openMenu() {
  cgGameplayStop();                 // CrazyGames: Menü offen = kein Gameplay
  releaseInputs();
  document.body.style.touchAction = '';
  UI.showMenu({ inGame: true });
}

/* ------------------------------------------------------------
   Level starten / aufräumen
   ------------------------------------------------------------ */

/* Entsorgt ALLES, was noch in der Szene hängt (Geometrien, Materialien, Texturen) */
function purgeScene(sc) {
  if (!sc) return;
  sc.traverse((o) => {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((m) => {
      for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
      m.dispose();
    });
    if (o.isInstancedMesh && o.dispose) o.dispose();
  });
  sc.fog = null;
  sc.background = null;
  sc.clear();
}

function disposeLevel() {
  running = false;
  cgGameplayStop();
  onToilet = false;
  giantRefs = [];
  UI.setRatingActive(false);
  UI.showHigh(null);
  if (tourists) {
    try { tourists.dispose(); } catch (err) { console.error(err); }
    tourists = null;
  }
  mp.detachGhost();               // U-Boot + Namensschild des Mitspielers entfernen (Verbindung bleibt)
  Shop.detachFx();
  if (sub) { sub.dispose(); sub = null; }
  if (level) { try { level.dispose(); } catch (err) { console.error(err); } level = null; }
  purgeScene(scene);
  scene = null;
  renderer.renderLists.dispose();
}

function resetState() {
  vel.set(0, 0, 0);
  yaw = level.spawn.yaw || 0;
  pitch = 0; yawVel = 0;
  thrS = steerS = vertS = 0;
  o2 = 1; o2LowShown = false; o2Charging = false; darkShown = false;
  lastNear = null; bumpCd = 0; shockT = 0; rumbleT = 0; giantCd = 0;
  allSights = false; settled = false; tourEarned = 0; lastRating = 4;
  barCd.pills = 0; barCd.champagne = 0;
  barSold = 0; barCapacity = BAR_MAX_SALES;
  onToilet = false; fishWatchT = 0; fishInside = new WeakSet();
  later.length = 0;
  lookYaw = lookPitch = 0;
  walkPos.copy(SUB.standSpot);
  eyeLocal.copy(SUB.seatEye);
  placeAtSpawn();
  sub.group.rotation.set(0, yaw, 0, 'YXZ');
  sub.group.updateMatrixWorld(true);
  sub.updateDisplays({
    lang: toDispLang(), money, rating: lastRating,
    sightIcons: sightMeta.icons, sightNames: sightNamesFor()
  });
  applyUpgrades();
  mode = 'ext';
  sub.setCaptainVisible(true);
  snapCam = true;
  UI.setStandButtonLabel(false);
  ['light', 'arm'].forEach((a) => UI.setButtonState(a, false));
  UI.updateMoney(money, 0);
  UI.updateHUD({ depth: 0, o2: 1, sights: [false, false, false], objective: 'objSights', objVars: { n: 0 } });
}

/* ------------------------------------------------------------
   Riesenfisch / Anglerfisch: Bounce-Kollision (Level 2 + 3)
   Das Level wird nicht verändert. Wir suchen die Riesen automatisch:
     level.giants = [{ pos|position|group|mesh, radius }]   (empfohlen)
     level.shark / monster / anglerfish / angler / bigFish / giantFish
     Schwarm-Fische (level.schools) und Herden (level.fauna.pods) mit size >= GIANT_SIZE_MIN
   ------------------------------------------------------------ */
function giantPos(o, out) {
  if (!o) return null;
  if (o.isVector3) return out.copy(o);
  if (o.isObject3D) return o.getWorldPosition(out);
  if (o.pos && o.pos.isVector3) return out.copy(o.pos);
  if (o.position && o.position.isVector3) return out.copy(o.position);
  const obj = o.group || o.mesh || o.root || o.body;
  if (obj && obj.isObject3D) return obj.getWorldPosition(out);
  return null;
}

function giantRadius(o) {
  const r = Number(o && (o.bounceRadius || o.radius));
  if (r > 0) return r;
  const s = Number(o && o.size);
  if (s > 0) return s * 0.5;
  return GIANT_DEFAULT_RADIUS;
}

function collectGiants() {
  giantRefs = [];
  if (!level || currentLevelId < 2) return;
  const add = (ref) => {
    if (!ref || typeof ref !== 'object') return;
    for (let i = 0; i < giantRefs.length; i++) if (giantRefs[i].ref === ref) return;
    giantRefs.push({ ref, radius: giantRadius(ref) });
  };

  if (Array.isArray(level.giants)) level.giants.forEach(add);
  ['shark', 'monster', 'anglerfish', 'angler', 'bigFish', 'giantFish'].forEach((k) => { if (level[k]) add(level[k]); });

  if (Array.isArray(level.schools)) {
    level.schools.forEach((s) => {
      if (s && s.fish) s.fish.forEach((f) => { if (f && f.size >= GIANT_SIZE_MIN) add(f); });
    });
  }
  const fa = level.fauna;
  if (fa && Array.isArray(fa.pods)) {
    fa.pods.forEach((pod) => {
      if (pod && pod.members) pod.members.forEach((m) => { if (m && m.size >= GIANT_SIZE_MIN) add(m); });
    });
  }

  if (!giantRefs.length && !giantWarned) {
    giantWarned = true;
    console.warn('[Bounce] Kein Riesenfisch gefunden. Im Level z. B. "giants: [{ pos: monster.position, radius: 40 }]" zurückgeben.');
  }
}

function bounceGiants(dt) {
  if (!giantRefs.length) return;
  const g = sub.group;
  const sp = g.position;
  giantCd = Math.max(0, giantCd - dt);
  let moved = false;

  for (let i = 0; i < giantRefs.length; i++) {
    const gr = giantRefs[i];
    const p = giantPos(gr.ref, _gp);
    if (!p) continue;
    _gn.subVectors(sp, p);
    const dist = _gn.length();
    const minDist = gr.radius + (SUB.collisionRadius || 2.5);
    if (dist >= minDist) continue;

    if (dist < 0.001) _gn.set(0, 0.3, 1).normalize();
    else _gn.multiplyScalar(1 / dist);

    // Position sanft aus dem Körper herausschieben
    const pen = minDist - dist;
    sp.addScaledVector(_gn, pen * damp(9, dt));
    moved = true;

    // Bounce-Impuls: Geschwindigkeit weich in Richtung "weg vom Monster" ziehen
    const vn = vel.dot(_gn);
    if (vn < GIANT_BOUNCE) vel.addScaledVector(_gn, (GIANT_BOUNCE - vn) * damp(14, dt));

    if (giantCd <= 0) {
      giantCd = GIANT_POPUP_CD;
      rumbleT = RUMBLE_TIME;
      UI.showMessage('msgGiantBounce', null, 2600);
      tEvent('ice');
    }
  }
  if (moved) g.updateMatrixWorld(true);
}

function buildGame() {
  scene = new THREE.Scene();

  // Multiplayer: beide Spieler bauen das Level mit demselben Zufalls-Seed auf
  const realRandom = Math.random;
  if (mp.connected && mpSeed !== null) Math.random = mulberry32(mpSeed);
  try {
       if (currentLevelId === 4) {
      level = buildLevel4(scene, renderer);
      worldCfg = WORLD4;
    } else if (currentLevelId === 3) {
      level = buildLevel3(scene, renderer);
      worldCfg = WORLD3;
    } else if (currentLevelId === 2) {
      level = buildLevel2(scene, renderer);
      worldCfg = WORLD2;
    } else {
      level = buildLevel1(scene, renderer);
      worldCfg = WORLD;
    }

  } finally {
    Math.random = realRandom;
  }

  camera.far = worldCfg.cameraFar;
  camera.updateProjectionMatrix();
  sightMeta = level.meta || DEFAULT_SIGHT_META;
  UI.setSightIcons(sightMeta.icons);          // HUD-Symbole: Level 1, 2 oder 3

  level.setViewDistance(UI.settings.view);
  sub = createSub();
  scene.add(sub.group);
  worldCtx.subPos = sub.group.position;
  resetState();
  collectGiants();

  try {
    tourists = createTourists(THREE, sub.group, sub.cabin, {
      count: 4 + Math.floor(Math.random() * 3),
      volume: 0.5,
      lang: () => toDispLang(),
      onRating: (info) => { lastRating = info.avg; UI.updateRating(info); }
    });
    tourists.setUpgrades({ golden: owned.golden });
    // Bar-Limit: ein Verkauf pro Passagier, höchstens 6
    barCapacity = Math.max(1, Math.min(BAR_MAX_SALES, tourists.tourists.length || BAR_MAX_SALES));
    UI.setRatingActive(true);
    UI.updateMoney(money, 0);
    console.log('[Touristen] erstellt:', tourists.tourists.length);
    later.push({ t: simTime + 2.5, fn: () => tEvent('start') });
  } catch (err) {
    console.error('[Touristen] Fehler:', err);
    tourists = null;
    UI.setRatingActive(false);
    UI.showMessage(T('tourError') + (err && err.message ? err.message : err), null, 9000);
  }
  applyShopSkins();
  // Multiplayer: U-Boot des Mitspielers in die Szene setzen
  if (mp.connected) {
    try { mp.attachGhost(scene, currentLevelId); } catch (err) { console.error('[Multiplayer] Ghost:', err); }
  }

  running = true;
  document.body.style.touchAction = 'none';
  syncPad();
  focusCanvas();
  UI.setMode('modeExt');
  lastT = performance.now();

  // CrazyGames: 3D-Welt ist bereit -> Laden beendet, Gameplay beginnt
  cgLoadingStop();
  cgGameplayStart();

  // 5-Sekunden-Steuerungs-Overlay beim ersten Level-Start
  if (!controlsHintShown) {
    controlsHintShown = true;
    UI.showControlsOverlay(5000);
  }
}

function startLevel() {
  unlockAudio();
  cgGameplayStop();
  cgLoadingStart();
  UI.setHUDVisible(true);
  UI.setTouchVisible(UI.isTouchDevice());
  if (btnMenu) btnMenu.style.display = '';
  UI.showMessage(T('loading'), null, 5000);
  disposeLevel();                 // altes Level + Touristen + U-Boot + Szene komplett entsorgen
  releaseInputs();
  setTimeout(() => {
    try {
      buildGame();
    } catch (err) {
      console.error(err);
      cgLoadingStop();
      UI.showMessage(T('loadError') + (err && err.message ? err.message : err), null, 15000);
    }
  }, 60);
}

/* ------------------------------------------------------------
   Tour-Abrechnung (Andocken nach allen 3 Sehenswürdigkeiten)
   ------------------------------------------------------------ */
function settleTour() {
  settled = true;
  cgGameplayStop();               // CrazyGames: Ergebnis-Screen = kein Gameplay
  const rating = tourists ? tourists.averageRating() : lastRating;
  const fare = TICKET_PER_SIGHT * 3 + Math.round(Math.max(0, rating - 3) * STAR_BONUS);
  addMoney(fare);

  // Level 1 abgeschlossen -> Level 2 dauerhaft freischalten
  // Level 2 abgeschlossen -> Level 3 dauerhaft freischalten
  let newUnlock = 0;
  if (currentLevelId === 1) { if (unlockLevel2()) newUnlock = 2; }
  else if (currentLevelId === 2) { if (unlockLevel3()) newUnlock = 3; }
    else if (currentLevelId === 3) { if (markLevel3Complete()) { newUnlock = 4; if (UI.setLevel4Unlocked) UI.setLevel4Unlocked(true); } }

  sub.setLight(false);
  sub.setParty(false);
  UI.setButtonState('light', false);
  UI.showHigh(null);
  releaseInputs();
  if (mode !== 'ext') setCameraMode('ext', true);
  UI.showResult({ rating, earned: tourEarned, money, owned: Object.assign({}, owned), newUnlock });
}

function buyUpgrade(id) {
  const up = UI.UPGRADES.find((u) => u.id === id);
  if (!up || owned[id] || money < up.price) return;
  money -= up.price;
  owned[id] = true;
  saveGame();
  applyUpgrades();
  UI.updateMoney(money, -up.price);
  UI.refreshResult({ money, owned: Object.assign({}, owned), bought: true });
}

/* ------------------------------------------------------------
   Physik: U-Boot
   ------------------------------------------------------------ */
function stepSub(dt, thr, steer, vert) {
  const g = sub.group;

  thrS += (thr - thrS) * damp(4, dt);
  steerS += (steer - steerS) * damp(5, dt);
  vertS += (vert - vertS) * damp(4, dt);

  yawVel += (-steerS * PHYS.yawRate - yawVel) * damp(4, dt);
  yaw += yawVel * dt;
  pitch += (vertS * 0.26 - pitch) * damp(3, dt);
  g.rotation.set(pitch, yaw, 0, 'YXZ');

  const fwd = thr >= 0 ? thr * PHYS.maxForward : thr * PHYS.maxBack;
  const tx = -Math.sin(yaw) * fwd;
  const tz = -Math.cos(yaw) * fwd;
  const ty = vert * PHYS.maxVertical;
  const idle = Math.abs(thr) < 0.02 && Math.abs(vert) < 0.02;
  const k = damp(idle ? PHYS.brakeRate : PHYS.speedRate, dt);
  vel.x += (tx - vel.x) * k;
  vel.y += (ty - vel.y) * k;
  vel.z += (tz - vel.z) * k;

  g.position.addScaledVector(vel, dt);
  g.updateMatrixWorld(true);

  sub.getCollisionPoints(colPts);
  let maxImpact = 0;
  for (let i = 0; i < colPts.length; i++) {
    const p = colPts[i];
    _c0.copy(p);
    const impact = level.collideSub(p, vel, SUB.collisionRadius);
    if (impact > maxImpact) maxImpact = impact;
    _d.subVectors(p, _c0);
    if (_d.lengthSq() > 0) {
      g.position.add(_d);
      for (let j = i + 1; j < colPts.length; j++) colPts[j].add(_d);
    }
  }
  g.updateMatrixWorld(true);

  if (maxImpact > 3 && bumpCd <= 0) {
    UI.flash();
    tEvent('ice');
    bumpCd = 0.45;
  }
}

/* ------------------------------------------------------------
   Kameras
   ------------------------------------------------------------ */
function camCollide(p) {
  _zeroVel.set(0, 0, 0);
  level.collideSub(p, _zeroVel, 1.2);
}

/* Weiches, niederfrequentes Rütteln (Sinus statt Zufall – kein Geflacker) */
function applyShake() {
  const a = Math.max(
    0.22 * clamp(shockT / SHOCK_TIME, 0, 1),
    0.28 * clamp(rumbleT / RUMBLE_TIME, 0, 1)
  );
  if (a <= 0) return;
  const t = simTime;
  camera.position.x += Math.sin(t * 17.0) * a * 0.5;
  camera.position.y += Math.sin(t * 21.0 + 1.3) * a * 0.5;
  camera.position.z += Math.sin(t * 14.0 + 2.1) * a * 0.5;
}

function updateCamera(dt) {
  const g = sub.group;
  g.updateMatrixWorld(true);

  if (mode === 'ext') {
    const D = 26;
    _e.set(clamp(-0.22 + lookPitch, -1.25, 1.25), yaw + lookYaw, 0, 'YXZ');
    _v.set(0, 0, D).applyEuler(_e);
    _camTarget.copy(g.position).add(_v);
    _camTarget.y += 1.2;
    camCollide(_camTarget);
    if (snapCam) { camera.position.copy(_camTarget); snapCam = false; }
    else camera.position.lerp(_camTarget, damp(7, dt));
    _camLook.copy(g.position);
    _camLook.y += 1.0;
    camera.lookAt(_camLook);
    eyeLocal.copy(SUB.seatEye);
    applyShake();
    return;
  }

  // Cockpit oder Laufen: Kamera klebt am U-Boot (auf dem Klo: Augenhöhe an der Klobrille)
  const target = mode === 'walk' ? (onToilet ? SUB.toiletSeatEye : walkPos) : SUB.seatEye;
  const dist = eyeLocal.distanceTo(target);
  const rate = dist > 0.05 ? 6 : 30;
  eyeLocal.lerp(target, damp(rate, dt));

  _v.copy(eyeLocal);
  g.localToWorld(_v);
  camera.position.copy(_v);
  _q.setFromEuler(_e.set(lookPitch, lookYaw, 0, 'YXZ'));
  camera.quaternion.copy(g.quaternion).multiply(_q);
  applyShake();
}

/* ------------------------------------------------------------
   Tiere vor der Glaskuppel -> Touristen jubeln
   Prüft direkt die Listen aus dem Level: Schwarmfische, Belugas/Schildkröten/Haie,
   Rochen/Mantas und Quallen (lokal z -3.5 … -16 vor dem Cockpit).
   ------------------------------------------------------------ */
function testCreature(key, p, g, sp) {
  if (p.distanceToSquared(sp) > 900) { if (fishInside.has(key)) fishInside.delete(key); return; }
  _fv.copy(p);
  g.worldToLocal(_fv);
  const near = _fv.z < -3.5 && _fv.z > -16 && Math.abs(_fv.x) < 7 && Math.abs(_fv.y) < 6;
  if (near) {
    if (!fishInside.has(key)) { fishInside.add(key); tEvent('fish'); }
  } else if (fishInside.has(key)) {
    fishInside.delete(key);
  }
}

function watchFish() {
  if (!tourists || !level || !sub) return;
  const g = sub.group;
  g.updateMatrixWorld(true);
  const sp = g.position;
  for (const s of level.schools) {
    for (const f of s.fish) { if (f.size >= FISH_MIN_SIZE) testCreature(f, f.pos, g, sp); }
  }
  const fa = level.fauna;
  if (fa) {
    for (const pod of fa.pods) for (const m of pod.members) testCreature(m, m.pos, g, sp);
    for (const r of fa.rays) testCreature(r, r.w.pos, g, sp);
    for (const j of fa.jellies) testCreature(j, j.pos, g, sp);
  }
}

/* ------------------------------------------------------------
   Mission / HUD
   ------------------------------------------------------------ */
function currentObjective() {
  if (settled) return { key: 'objDone' };
  if (allSights) return { key: 'objDock' };
  return { key: 'objSights', vars: { n: level.sightCount } };
}

function handleEvents() {
  const events = level.drainEvents();
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    switch (ev.type) {
      case 'sight':
        UI.flash();
        sub.grab();
        UI.showMessage('msgSight_' + ev.kind, { n: ev.count }, 5000);
        later.push({ t: simTime + 0.8, fn: () => tEvent('sight', { kind: TOUR_KIND[ev.kind] || ev.kind }) });
        break;
      case 'all-sights':
        allSights = true;
        later.push({ t: simTime + 3.2, fn: () => UI.showMessage('msgAllSights', null, 6000) });
        break;
      case 'bonus':                       // Piraten-Schatz (Level 2)
        addMoney(ev.eur || 150);
        later.push({ t: simTime + 2.6, fn: () => UI.showMessage('msgTreasureBonus', { eur: ev.eur || 150 }, 4500) });
        break;
      case 'jelly-shock':                 // Qualle berührt: U-Boot kurz geschockt
        shockT = SHOCK_TIME;
        UI.flash();
        tEvent('ice');
        UI.showMessage('msgJelly', null, 2800);
        break;
      case 'shark-found': UI.showMessage('msgSharkFound', null, 5000); break;
      case 'lava-found': UI.showMessage('msgLavaFound', null, 5000); break;           // Level 3
      case 'wreck-found': UI.showMessage('msgSubFound', null, 5000); break;           // Level 3
      case 'monster-found': UI.showMessage('msgMonsterFound', null, 5500); break;     // Level 3
      case 'stalker-dazzled': UI.showMessage('msgStalkerScared'); break;
      case 'stalker-dark': UI.showMessage('msgStalkerDark', null, 5000); break;
      case 'whale-found': UI.showMessage('msgWhaleFound', null, 5000); break;
      default: break;
    }
  }
}

function updateNearHint() {
  if (mode !== 'walk') { lastNear = null; return; }
  const id = onToilet ? 'toilet' : sub.nearestInteractable(walkPos);
  if (id === lastNear) return;
  lastNear = id;
  if (id === 'pills' || id === 'champagne') {
    UI.showMessage(barSold >= barCapacity ? 'msgBarSoldOut' : 'msgBarHint', null, 3500);
  } else if (id === 'toilet') {
    UI.showMessage(T(onToilet ? 'hintFlushSeated' : 'hintFlush'), null, 3500);
  }
}

function updateOxygen(dt) {
  const pos = sub.group.position;
  const atPlatform = level.isAtPlatform(pos);
  const underwater = pos.y < -0.5;

  if (atPlatform) {
    if (o2 < 1) {
      o2 = Math.min(1, o2 + O2_RECHARGE * dt);
      o2Charging = true;
      if (o2 >= 1 && o2Charging) { UI.showMessage('msgO2Charged', null, 2200); o2Charging = false; }
    }
  } else if (underwater) {
    o2 -= dt / O2_SECONDS;
    o2Charging = false;
  }

  if (o2 < 0.25 && !o2LowShown) { o2LowShown = true; UI.showMessage('msgO2Low', null, 5000); }
  if (o2 > 0.45) o2LowShown = false;

  if (o2 <= 0) {
    o2 = 0.6;
    vel.set(0, 0, 0);
    yaw = level.spawn.yaw || 0; pitch = 0; yawVel = 0;
    placeAtSpawn();
    sub.group.rotation.set(0, yaw, 0, 'YXZ');
    sub.group.updateMatrixWorld(true);
    snapCam = true;
    UI.flash();
    UI.showMessage('msgOxygenOut', null, 5000);
  }
}

/* ------------------------------------------------------------
   Haupt-Simulation pro Frame
   ------------------------------------------------------------ */
function simulate(dt) {
  simTime += dt;
  bumpCd = Math.max(0, bumpCd - dt);
  rumbleT = Math.max(0, rumbleT - dt);
  barCd.pills = Math.max(0, barCd.pills - dt);
  barCd.champagne = Math.max(0, barCd.champagne - dt);

  for (let i = later.length - 1; i >= 0; i--) {
    if (simTime >= later[i].t) { const fn = later[i].fn; later.splice(i, 1); fn(); }
  }

  /* ---- Eingaben einsammeln ----
     Pfeile + WASD + ZQSD steuern (Z = vor, Q = links für AZERTY). Umschauen: Maus/Finger/Stick. */
  const k = (c) => keys.has(c);
  const pad = readPad();

  let thr = ((k('KeyW') || k('KeyZ') || k('ArrowUp')) ? 1 : 0)
          - ((k('KeyS') || k('ArrowDown')) ? 1 : 0)
          + (holds.forward ? 1 : 0) - (holds.back ? 1 : 0);
  let steer = ((k('KeyD') || k('ArrowRight')) ? 1 : 0)
            - ((k('KeyA') || k('KeyQ') || k('ArrowLeft')) ? 1 : 0)
            + (holds.right ? 1 : 0) - (holds.left ? 1 : 0);
  let vert = (k('Space') ? 1 : 0) - ((k('ShiftLeft') || k('ShiftRight')) ? 1 : 0)
           + (holds.up ? 1 : 0) - (holds.down ? 1 : 0);
  let lookX = 0;
  let lookY = 0;
  const run = k('ShiftLeft') || k('ShiftRight');

  let stickLook = false;
  if (pad) {
    if (pad.menu) { openMenu(); return; }
    if (pad.light) toggleLight();
    if (pad.cam) cycleCamera();
    if (pad.stand) toggleStand();
    if (pad.arm) toggleArm();
    if (pad.action) interact();
    thr += -pad.ly;
    steer += pad.lx;
    vert += pad.up - pad.down;
    lookX += pad.rx;
    lookY += -pad.ry;
    stickLook = pad.rx !== 0 || pad.ry !== 0;
  }
  thr = clamp(thr, -1, 1);
  steer = clamp(steer, -1, 1);
  vert = clamp(vert, -1, 1);
  lookX = clamp(lookX, -1, 1);
  lookY = clamp(lookY, -1, 1);

  /* ---- Umschauen ---- */
  lookYaw -= lookX * LOOK_STICK * dt;
  lookPitch += lookY * LOOK_STICK * dt;
  lookYaw -= lookDX * LOOK_POINTER;
  lookPitch -= lookDY * LOOK_POINTER;
  const looked = stickLook || lookDX !== 0 || lookDY !== 0;
  lookDX = 0; lookDY = 0;
  lookIdle = looked ? 0 : lookIdle + dt;

  if (mode === 'ext') {
    lookPitch = clamp(lookPitch, -1.2, 1.2);
    lookYaw = Math.atan2(Math.sin(lookYaw), Math.cos(lookYaw));
    if (lookIdle > 1.6 && Math.abs(thr) > 0.1) {
      lookYaw *= Math.exp(-1.3 * dt);
      lookPitch *= Math.exp(-1.3 * dt);
    }
  } else if (mode === 'cockpit') {
    lookYaw = clamp(lookYaw, -2.4, 2.4);
    lookPitch = clamp(lookPitch, -1.3, 1.3);
  } else {
    lookYaw = Math.atan2(Math.sin(lookYaw), Math.cos(lookYaw));
    lookPitch = clamp(lookPitch, -1.45, 1.45);
  }

  /* ---- Laufen im U-Boot / Fahren ---- */
  let driveThr = thr, driveSteer = steer, driveVert = vert;
  if (mode === 'walk') {
    driveThr = 0; driveSteer = 0; driveVert = 0;
    if (onToilet) {
      // Auf dem Klo sitzen bleiben, bis der Spieler sich bewegt
      if (Math.hypot(thr, steer) > 0.3) leaveToilet();
    } else {
      let f = thr, s = steer;
      const len = Math.hypot(f, s);
      if (len > 1) { f /= len; s /= len; }
      const sp = (run ? PHYS.runSpeed : PHYS.walkSpeed) * dt;
      const sy = Math.sin(lookYaw), cy = Math.cos(lookYaw);
      walkPos.x += (-sy * f + cy * s) * sp;
      walkPos.z += (-cy * f - sy * s) * sp;
      sub.walkConstrain(walkPos, 0.32);
      walkPos.y = SUB.standSpot.y;
    }
  }

  /* ---- Quallen-Schock: Antrieb fast tot, U-Boot taumelt ---- */
  if (shockT > 0) {
    shockT = Math.max(0, shockT - dt);
    driveThr *= 0.12; driveSteer *= 0.12; driveVert *= 0.12;
    vel.multiplyScalar(Math.exp(-2.5 * dt));
    yawVel += (Math.random() - 0.5) * 0.3 * (dt * 60);
  }

  stepSub(dt, driveThr, driveSteer, driveVert);

  /* ---- Riesenfisch / Anglerfisch: sanft zurückstoßen (Level 2 + 3) ---- */
  bounceGiants(dt);

  /* ---- U-Boot-Modell animieren ---- */
  const g = sub.group;
  sub.update(dt, { throttle: thrS, steerYaw: steerS, steerPitch: vertS, underwater: g.position.y < 0 });
  sub.setCaptainVisible(mode === 'ext');
  Shop.updateFx(dt, thrS);

  /* ---- Touristen ---- */
  if (tourists) {
    try {
      tourists.update(dt, { depth: Math.max(0, -g.position.y) });
      sub.setParty(tourists.isHigh);                       // Disco-Licht im Pillen-Rausch
      UI.showHigh(tourists.isHigh ? tourists.highLeft : null);
    } catch (err) {
      console.error('[Touristen] Update-Fehler:', err);
      tourists = null;
      UI.setRatingActive(false);
      UI.showHigh(null);
    }
  }

  /* ---- Tiere vor der Kuppel (alle 0,2 s) ---- */
  fishWatchT -= dt;
  if (fishWatchT <= 0) {
    fishWatchT = 0.2;
    try { watchFish(); } catch (err) { console.error('[Fische]', err); }
  }

  /* ---- Kamera ---- */
  updateCamera(dt);

  /* ---- Welt aktualisieren ---- */
  sub.getWorldLight(lightOut);
  sub.getBubblePos(bubbleOut);
  worldCtx.thrust = Math.abs(thrS);
  level.update(dt, worldCtx);

  handleEvents();
  updateNearHint();
  updateOxygen(dt);

  if (!darkShown && -g.position.y > worldCfg.darkDepth - 10 && !sub.lightOn) {
    darkShown = true;
    UI.showMessage('msgDeepDark', null, 4500);
  }

  // Alle 3 Sehenswürdigkeiten + an der Plattform angedockt -> Abrechnung
  if (allSights && !settled && level.isAtPlatform(g.position)) settleTour();

  /* ---- Anzeigen ---- */
  const depth = Math.max(0, -g.position.y);
  const depthShown = depth * (worldCfg.depthScale || 1);   // Level 3: bis ~11.000 m
  const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
  const sightsDone = level.sights.map((s) => s.visited);
  level.getPings(g.position, yaw, pingsOut);
  sub.updateDisplays({
    depth: depthShown, o2, speed: vel.length(), heading,
    sightsDone, pings: pingsOut,
    money, rating: tourists ? tourists.averageRating() : lastRating,
    lang: toDispLang(),
    sightIcons: sightMeta.icons,
    sightNames: sightNamesFor()
  });

  const obj = currentObjective();
  UI.updateHUD({ depth: depthShown, o2, sights: sightsDone, objective: obj.key, objVars: obj.vars });
}

/* ------------------------------------------------------------
   Render-Schleife
   ------------------------------------------------------------ */
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = clamp(dt, 0, 0.05);

  if (running && level && sub) {
    if (!UI.isMenuOpen()) {
      try {
        simulate(dt);
      } catch (err) {
        console.error(err);
        running = false;
        cgGameplayStop();
        UI.showMessage(T('loadError') + (err && err.message ? err.message : err), null, 15000);
      }
    }
    // Multiplayer läuft auch bei offenem Menü weiter (Zustand senden, Mitspieler zeichnen)
    try { mpTick(dt); } catch (err) { console.error('[Multiplayer]', err); }
    renderer.render(scene, camera);
  } else {
    renderer.render(idleScene, camera);
  }
}

/* ------------------------------------------------------------
   Start: UI verdrahten
   ------------------------------------------------------------ */
bindTouchButtons();
if (btnMenu) btnMenu.style.display = 'none';

UI.initUI({
  // Level-Auswahl (Singleplayer): 1 = world.js, 2 = level2.js, 3 = level3.js (2/3 nur wenn freigeschaltet)
  onStartLevel: (id) => {
    if (id === 2 && !level2Unlocked) return;
    if (id === 3 && !level3Unlocked) return;
        if (id === 4 && !isLevel4Unlocked()) return;
    // Singleplayer: eine evtl. offene Multiplayer-Verbindung sauber beenden
    mp.close();
    mpSeed = null;
    UI.setMpBarActive(false);
    currentLevelId = normLevel(id);
    startLevel();
  },
  onResume: () => {
    releaseInputs();
    document.body.style.touchAction = 'none';
    syncPad();
    lastT = performance.now();
    focusCanvas();
    if (running) cgGameplayStart();   // CrazyGames: Spiel läuft weiter
  },
  onOpenMenu: () => openMenu(),
  // Nächste Tour im selben Level (Geld + Upgrades bleiben) – auf CrazyGames vorher Midgame-Werbung
  onResultContinue: () => {
    runMidgameAd(() => {
      UI.hideResult();
      startLevel();
    });
  },
  // Zurück ins Menü – auf CrazyGames vorher Midgame-Werbung
  onResultMenu: () => {
    runMidgameAd(() => {
      UI.hideResult();
      mp.close();
      mpSeed = null;
      UI.setMpBarActive(false);
      disposeLevel();
      UI.setHUDVisible(false);
      UI.setTouchVisible(false);
      if (btnMenu) btnMenu.style.display = 'none';
      UI.showMenu({ inGame: false });
    });
  },
  // Rewarded-Werbung (+500 €) – der Button ist nur auf CrazyGames sichtbar
  onWatchRewarded: () => watchRewardedAd(),
  onBuyUpgrade: (id) => buyUpgrade(id),
  onSettingsChange: (s) => { if (level) level.setViewDistance(s.view); },
  onLanguageChange: (lang) => {
    if (sub) sub.updateDisplays({ lang: toDispLang(lang), sightNames: sightNamesFor(lang) });
    Shop.refreshShop();
  },

  // ----- Multiplayer -----
  onMpHost: (name) => {
    mpSeed = null;
    mp.host(name)
      .then((code) => { UI.setMpHostCode(code); })
      .catch((err) => {
        const r = mpErrStatus(err);
        UI.setMpStatus('host', r[0], r[1], 'err');
      });
  },
  onMpJoin: (name, code) => {
    mpSeed = null;
    UI.setMpStatus('join', 'mpConnecting', null, 'wait');
    mp.join(code, name)
      .then(() => { UI.setMpStatus('join', 'mpGuestWait', null, 'ok'); })
      .catch((err) => {
        const r = mpErrStatus(err);
        UI.setMpStatus('join', r[0], r[1], 'err');
      });
  },
  onMpCancel: () => {
    mp.close();
    mpSeed = null;
    UI.setMpBarActive(false);
  }
});
// Shop bekommt nur 'de' oder 'en' (andere Sprachen -> Englisch)
Shop.initShop({
  getLang: () => toDispLang(),
  getMoney: () => money,
  spend: (n) => spendMoney(n),
  onEquipChange: () => applyShopSkins()
});
// gespeicherten Stand an die Level-Auswahl geben: Level 2 und 3 bleiben nach dem Neuladen freigeschaltet
UI.setLevel2Unlocked(level2Unlocked);
UI.setLevel3Unlocked(level3Unlocked);

if (UI.setLevel4Unlocked) UI.setLevel4Unlocked(isLevel4Unlocked());
requestAnimationFrame(frame);
focusCanvas();

// CrazyGames: Spiel ist geladen (Renderer, UI, Menü stehen) -> loadingStop nach dem ersten Frame.
// Auf der eigenen Website passiert hier nichts (cgLoadingStop ist dort wirkungslos).
cgReady.then(() => { requestAnimationFrame(() => cgLoadingStop()); });

// Debug-Hilfe für die Konsole:
//   BEYOND.visitAll()                   → alle 3 Sehenswürdigkeiten sofort abhaken
//   BEYOND.addMoney(500)                → Geld für den Shop
//   BEYOND.unlockLevel2()               → Level 2 sofort freischalten (wird gespeichert)
//   BEYOND.unlockLevel3()               → Level 3 sofort freischalten (wird gespeichert)
//   BEYOND.giants                       → erkannte Riesenfische (Bounce-Kollision)
//   BEYOND.barSold / BEYOND.barCapacity → Bord-Bar-Verkäufe dieser Tour
//   BEYOND.tourists.buyPills()          → Rausch auslösen
//   BEYOND.tourists.tourists[0].startTrip() → ein Tourist geht sofort aufs Klo
//   BEYOND.resetSave()                  → Geld + Upgrades löschen
//   BEYOND.mp                           → Multiplayer-Objekt (connected, role, remote ...)
//   BEYOND.isCrazyGamesEnv              → true nur auf CrazyGames
window.BEYOND = {
  get level() { return level; },
  get sub() { return sub; },
  get tourists() { return tourists; },
  get onToilet() { return onToilet; },
  get levelId() { return currentLevelId; },
  get level2Unlocked() { return level2Unlocked; },
  get level3Unlocked() { return level3Unlocked; },
  get giants() { return giantRefs; },
  get barSold() { return barSold; },
  get barCapacity() { return barCapacity; },
  get mp() { return mp; },
  get isCrazyGamesEnv() { return isCrazyGamesEnv; },
  visitAll() { if (level) level.visitAll(); },
  addMoney(n) { addMoney(n || 100); },
  unlockLevel2() { return unlockLevel2(); },
  unlockLevel3() { return unlockLevel3(); },
  resetSave() {
    money = 0; owned.golden = owned.fog = owned.flood = false; saveGame(); applyUpgrades();
    UI.updateMoney(0, 0);
  }
};
