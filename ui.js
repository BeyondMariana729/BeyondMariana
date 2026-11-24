/* ============================================================
   BEYOND MARIANA – ui.js  (MARIANA TOURS)
   Menüs (PLAY / SETTINGS / Level-Auswahl: Level 1 Arctic Trench,
   Level 2 Coral Reef – freigeschaltet nach der ersten Level-1-Tour,
   Level 3 Mariana Trench – freigeschaltet nach der ersten Level-2-Tour),
   5 Sprachen (EN, DE, FR, NL, PL – Start immer Englisch, Fallback Englisch),
   Einstellungen (Sprache, Sichtweite), HUD-Helfer
   (inkl. setSightIcons), Meldungen, Gamepad-Menüsteuerung,
   permanente Leiste oben: Live-Sterne + Geld (€),
   Tour-Abrechnung mit Upgrade-Shop,
   MULTIPLAYER-Menü (Spielername, Spiel erstellen / beitreten),
   Multiplayer-Leiste "DU: x € | Freund: y €",
   5-Sekunden-Steuerungs-Overlay (CrazyGames)

   Menü-Screens (index.html):
     main · play · levels · multiplayer · mphost · mpjoin · settings

   Speicher:
     'beyond-mariana-settings-v1'        -> Sprache, Sichtweite
     'beyondMariana_level2Unlocked'      -> 'true' sobald Level 2 frei ist
     'beyondMariana_level3Unlocked'      -> 'true' sobald Level 3 frei ist
     'beyond-mariana-mp-name'            -> Multiplayer-Spielername
   ============================================================ */

const STORAGE_KEY = 'beyond-mariana-settings-v1';
const MP_NAME_KEY = 'beyond-mariana-mp-name';
export const LEVEL2_KEY = 'beyondMariana_level2Unlocked';
export const LEVEL3_KEY = 'beyondMariana_level3Unlocked';
export const LEVEL4_KEY = 'beyondMariana_level4Unlocked';

/* ---------- Sprachen ---------- */
export const LANGS = ['en', 'de', 'fr', 'nl', 'pl'];

/* ---------- Einstellungen ---------- */
/* Erster Start (nichts gespeichert) = IMMER Englisch */
export const settings = { lang: 'en', view: 1 };
let level2Unlocked = false;
let level3Unlocked = false;
let level4Unlocked = false;

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const o = JSON.parse(raw);
    if (LANGS.indexOf(o.lang) !== -1) settings.lang = o.lang;
    if (typeof o.view === 'number') settings.view = Math.min(1.6, Math.max(0.6, o.view));
    if (o.level2 === true) level2Unlocked = true;            // alter Spielstand
  }
} catch (e) { /* localStorage kann blockiert sein – kein Problem */ }

try {
  if (localStorage.getItem(LEVEL2_KEY) === 'true') level2Unlocked = true;
  if (localStorage.getItem(LEVEL3_KEY) === 'true') level3Unlocked = true;
  if (localStorage.getItem(LEVEL4_KEY) === 'true') level4Unlocked = true;
} catch (e) { /* ignorieren */ }

function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang: settings.lang, view: settings.view })); } catch (e) { /* ignorieren */ }
}

/* ---------- Upgrades (Shop nach der Tour) ---------- */
export const UPGRADES = [
  { id: 'golden', price: 120, icon: '🚽', nameKey: 'upGolden', descKey: 'upGoldenDesc' },
  { id: 'fog',    price: 150, icon: '🌫️', nameKey: 'upFog',    descKey: 'upFogDesc' },
  { id: 'flood',  price: 180, icon: '💡', nameKey: 'upFlood',  descKey: 'upFloodDesc' }
];

/* ---------- Texte ---------- */
export const I18N = {
  /* ================= ENGLISH (Basis + Fallback) ================= */
  en: {
    subtitle: 'MARIANA TOURS · Deep-sea tours with humor',
    play: 'PLAY',
    settings: 'SETTINGS',
    resume: 'RESUME',
    singleplayer: 'SINGLEPLAYER',
    multiplayer: 'MULTIPLAYER',
    story: 'STORY',
    comingSoon: 'Coming Soon',
    back: 'BACK',
    chooseLevel: 'CHOOSE LEVEL',
    settingsTitle: 'SETTINGS',
    language: 'Language',
    viewDistance: 'View distance',
    viewNear: 'short',
    viewFar: 'far',
    controls: 'CONTROLS',
    helpKb: 'PC: WASD / ZQSD / arrows steer · drag the mouse to look around · Space/Shift up/down · F light · G grabber arm · C camera · E stand up/sit down (at the onboard bar: buy pills/champagne, at the onboard toilet: sit & flush) · Enter action · Esc menu',
    helpPad: 'Gamepad: left stick move · right stick look · R2/L2 up/down · L1 light · Y camera · X stand up/sit down · A action (bar, toilet) · B grabber arm · Start menu',
    helpTouch: 'iPad: arrow buttons (left) move · UP/DOWN (right) · swipe to look · buttons for light, camera, standing up, grabber arm and ACTION (bar, onboard toilet)',
    depth: 'DEPTH',
    oxygen: 'OXYGEN',
    sights: 'SIGHTSEEING',
    ratingLabel: 'TOUR RATING',
    menu: 'MENU',
    btnUp: 'UP',
    btnDown: 'DOWN',
    btnLight: 'LIGHT',
    btnCam: 'CAMERA',
    btnStand: 'STAND UP',
    btnSit: 'SIT DOWN',
    btnArm: 'ARM',
    btnAction: 'ACTION',
    level: 'Level',
    locked: 'Locked',
    playable: 'Playable',
    lvl1Name: 'Arctic Trench',
    lvl1Desc: 'Ice hole, wreck, ice cathedral and a 150-meter whale – a tour for tourists',
    lvl2Name: 'Coral Reef',
    lvl2Desc: 'Colorful corals, rock arch, pirate treasure, reef shark – and jellyfish that sting!',
    lvl2LockedDesc: 'Locked – finish a tour in Level 1 first',
    lvl3Name: 'Mariana Trench',
    lvl3Desc: '11,000 m deep: glowing lava fields, black smokers, a research sub – and a monster!',
    lvl3LockedDesc: 'Locked – finish a tour in Level 2 first',
    lvlLockedDesc: 'Not available yet',
    lockedToast: 'This level is still locked.',
    lvl2LockedToast: 'Level 2 is locked – finish a tour in Level 1 first!',
    lvl3LockedToast: 'Level 3 is locked – finish a tour in Level 2 first!',
       lvl4Name: 'Sunken Maya Amazon River',
    lvl4Desc: 'Lush mangrove jungle river, sunken jade pyramid and the giant Quetzalcoatl serpent!',
    lvl4LockedDesc: 'Locked – finish a tour in Level 3 first',
    lvl4LockedToast: 'Level 4 is still locked – finish a tour in Level 3 first!',
     modeExt: 'EXTERIOR CAMERA',
    modeCockpit: 'COCKPIT CAMERA',
    modeWalk: 'INSIDE THE SUB',
    objSights: 'Visit the sights ({n}/3) – follow the pings on the radar',
    objDock: 'All 3 seen! Return to the platform to dock – or sell some more pills first …',
    objDone: 'Tour settled!',
    msgSight_wreck: 'Sight {n}/3: the sunken shipwreck!',
    msgSight_cathedral: 'Sight {n}/3: the glowing ice-crystal cathedral!',
    msgSight_whale: 'Sight {n}/3: the 150-meter polar whale!',
    msgAllSights: 'All 3 sights seen – return to the platform to dock!',
    msgStalkerDark: 'A Frost Stalker is watching you in the dark … switch on the headlight!',
    msgStalkerScared: 'The Frost Stalker is dazzled by the light and backs away.',
    msgWhaleFound: 'There it is – a gigantic polar whale! Get really close!',
    msgSight_arch: 'Sight {n}/3: dived through the giant rock arch!',
    msgSight_treasure: 'Sight {n}/3: the sunken pirate treasure chest!',
    msgSight_shark: 'Sight {n}/3: the great reef shark!',
    msgSharkFound: 'There it circles – a huge reef shark! Get really close!',
    msgJelly: 'Zzzzap! A jellyfish just shocked the sub!',
    msgTreasureBonus: 'Pirate treasure recovered: +€{eur} bonus!',
    msgLevel2Unlocked: 'Level 2 "Coral Reef" unlocked!',
    msgSight_lava: 'Sight {n}/3: the glowing lava field with the giant vents!',
    msgSight_subwreck: 'Sight {n}/3: the sunken research submarine!',
    msgSight_monster: 'Sight {n}/3: the deep-sea monster! Please do not feed …',
    msgLavaFound: 'The seabed glows ahead: a huge lava field with tower-high black smokers!',
    msgSubFound: 'Two headlights in a rock crevice … a sunken research submarine!',
    msgMonsterFound: 'What is THAT?! A giant anglerfish with a glowing lure – get closer!',
    msgLevel3Unlocked: 'Level 3 "Mariana Trench" unlocked!',
    msgO2Low: 'Oxygen is running low – return to the platform!',
    msgO2Charged: 'Oxygen recharged',
    msgOxygenOut: 'Emergency ascent! The sub was pulled back to the platform.',
    msgLightOn: 'Headlight on',
    msgLightOff: 'Headlight off',
    msgDeepDark: 'It gets pitch black from here – use the headlight!',
    msgPills: 'Deep-sea pills sold: +€{eur}! The tourists are … very relaxed.',
    msgChampagne: 'Arctic champagne served: +€{eur}! (It is tap water.)',
    msgBarCd: 'The bar reopens in a moment …',
    msgBarHint: 'Onboard bar: E / ACTION sells pills or champagne',
    msgBarSoldOut: 'SOLD OUT – every passenger has already been served!',
    msgGiantBounce: 'Too close! The giant creature knocked the sub back!',
    msgBought: 'Upgrade purchased!',
    msgNoMoney: 'Not enough money!',
    ctrlMove: 'WASD / ZQSD / Arrows = Steer',
    ctrlVert: 'Space / Shift = Up / Down',
    ctrlLight: 'F = Headlight',
    ctrlTouchMove: 'On-screen joysticks = Steer & Up / Down',
    ctrlTouchLight: 'Light button = Headlight',
    resTitle: 'TOUR SETTLEMENT',
    resRating: 'Rating',
    resEarned: 'Earned',
    resWallet: 'Cash',
    resLevelNew: '🔓 Level 2 unlocked: Coral Reef!',
    resLevelNew3: '🔓 Level 3 unlocked: Mariana Trench!',
    resLevelOk: '🏆 Top tour! The tourists are thrilled.',
    resLevelNo: 'A tour counts as a top tour from 3.5 ★ – not this time.',
    shopTitle: 'UPGRADE SHOP',
    buy: 'BUY',
    owned: 'OWNED',
    resContinue: 'NEXT TOUR',
    resMenu: 'TO MENU',
    upGolden: 'Golden Heated Toilet Seat',
    upGoldenDesc: '+0.3 ★ bonus on every toilet trip',
    upFog: 'Fog Lights',
    upFogDesc: 'Cuts through the dark deep-sea murk much better',
    upFlood: 'Mega Floodlight',
    upFloodDesc: 'Much brighter, farther-reaching headlight',
    mpTitle: 'MULTIPLAYER',
    mpName: 'Player name',
    mpNamePh: 'e.g. CaptainMax',
    mpHost: 'CREATE GAME',
    mpHostSub: 'You are the host – your friend joins with a code',
    mpJoin: 'JOIN GAME',
    mpJoinSub: 'Enter the code from the host',
    mpHostTitle: 'CREATE GAME',
    mpJoinTitle: 'JOIN GAME',
    mpRoomCode: 'ROOM CODE',
    mpCodeLabel: '4-digit room code',
    mpCreating: 'Creating room …',
    mpWaiting: 'Waiting for a second player …',
    mpChooseLevel: 'LEVEL FOR BOTH PLAYERS',
    mpL2Locked: 'Level 2 is still locked – finish a tour in Level 1 first.',
    mpL3Locked: 'Level 3 is still locked – finish a tour in Level 2 first.',
    mpCancel: 'CANCEL',
    mpGo: 'GO!',
    mpConnecting: 'Connecting …',
    mpGuestWait: 'Connected! Waiting for the host to start …',
    mpJoined: '{name} joined – here we go!',
    mpErrNoRoom: 'Room not found. Please check the code!',
    mpErrCode: 'Please enter a 4-digit code.',
    mpErrTimeout: 'Timed out – could not reach the host.',
    mpErrLib: 'PeerJS could not be loaded – please check your internet connection.',
    mpErrGeneric: 'Connection error: {err}',
    mpPeerLeft: '{name} left the game.',
    mpYou: 'YOU'
  },

  /* ================= DEUTSCH ================= */
  de: {
    subtitle: 'MARIANA TOURS · Tiefsee-Touren mit Humor',
    play: 'PLAY',
    settings: 'SETTINGS',
    resume: 'WEITER',
    singleplayer: 'SINGLEPLAYER',
    multiplayer: 'MULTIPLAYER',
    story: 'STORY',
    comingSoon: 'Coming Soon',
    back: 'ZURÜCK',
    chooseLevel: 'LEVEL WÄHLEN',
    settingsTitle: 'EINSTELLUNGEN',
    language: 'Sprache',
    viewDistance: 'Sichtweite',
    viewNear: 'kurz',
    viewFar: 'weit',
    controls: 'STEUERUNG',
    helpKb: 'PC: WASD / ZQSD / Pfeile steuern · Maus ziehen = umschauen · Leertaste/Shift hoch/runter · F Licht · G Greifarm · C Kamera · E aufstehen/hinsetzen (an der Bord-Bar: Pillen/Champagner kaufen, am Bord-WC: hinsetzen & spülen) · Enter Aktion · Esc Menü',
    helpPad: 'Gamepad: linker Stick bewegen · rechter Stick umschauen · R2/L2 hoch/runter · L1 Licht · Y Kamera · X aufstehen/hinsetzen · A Aktion (Bar, WC) · B Greifarm · Start Menü',
    helpTouch: 'iPad: Pfeil-Buttons links bewegen · AUF/AB rechts · Wischen zum Umschauen · Buttons für Licht, Kamera, Aufstehen, Greifarm und AKTION (Bar, Bord-WC)',
    depth: 'TIEFE',
    oxygen: 'SAUERSTOFF',
    sights: 'SEHENSWÜRDIGKEITEN',
    ratingLabel: 'TOUR-BEWERTUNG',
    menu: 'MENÜ',
    btnUp: 'AUF',
    btnDown: 'AB',
    btnLight: 'LICHT',
    btnCam: 'KAMERA',
    btnStand: 'AUFSTEHEN',
    btnSit: 'HINSETZEN',
    btnArm: 'ARM',
    btnAction: 'AKTION',
    level: 'Level',
    locked: 'Gesperrt',
    playable: 'Spielbar',
    lvl1Name: 'Arctic Trench',
    lvl1Desc: 'Eisloch, Wrack, Eis-Kathedrale und ein 150-Meter-Wal – Tour für Touristen',
    lvl2Name: 'Coral Reef',
    lvl2Desc: 'Bunte Korallen, Felsbogen, Piraten-Schatz, Riffhai – und Quallen, die zwicken!',
    lvl2LockedDesc: 'Gesperrt – schließe zuerst eine Tour in Level 1 ab',
    lvl3Name: 'Mariana Trench',
    lvl3Desc: '11.000 m tief: glühende Lava-Felder, Black Smokers, ein Forschungs-U-Boot – und ein Monster!',
    lvl3LockedDesc: 'Gesperrt – schließe zuerst eine Tour in Level 2 ab',
    lvlLockedDesc: 'Noch nicht verfügbar',
    lockedToast: 'Dieses Level ist noch gesperrt.',
    lvl2LockedToast: 'Level 2 ist gesperrt – beende zuerst eine Tour in Level 1!',
    lvl3LockedToast: 'Level 3 ist gesperrt – beende zuerst eine Tour in Level 2!',
    modeExt: 'AUSSEN-KAMERA',
    modeCockpit: 'COCKPIT-KAMERA',
    modeWalk: 'IM U-BOOT',
    objSights: 'Besuche die Sehenswürdigkeiten ({n}/3) – folge den Pings im Radar',
    objDock: 'Alle 3 gesehen! Zurück zur Plattform zum Andocken – oder erst noch Pillen verkaufen …',
    objDone: 'Tour abgerechnet!',
    msgSight_wreck: 'Sehenswürdigkeit {n}/3: das gesunkene Schiffswrack!',
    msgSight_cathedral: 'Sehenswürdigkeit {n}/3: die leuchtende Eiskristall-Kathedrale!',
    msgSight_whale: 'Sehenswürdigkeit {n}/3: der 150-Meter-Polarwal!',
    msgAllSights: 'Alle 3 Sehenswürdigkeiten gesehen – zurück zur Plattform zum Andocken!',
    msgStalkerDark: 'Ein Frost-Stalker beobachtet dich im Dunkeln … schalte den Scheinwerfer ein!',
    msgStalkerScared: 'Der Frost-Stalker ist vom Licht geblendet und weicht zurück.',
    msgWhaleFound: 'Da ist er – ein gewaltiger Polarwal! Fahr ganz nah ran!',
    msgSight_arch: 'Sehenswürdigkeit {n}/3: durch den riesigen Felsbogen getaucht!',
    msgSight_treasure: 'Sehenswürdigkeit {n}/3: die versunkene Piraten-Schatztruhe!',
    msgSight_shark: 'Sehenswürdigkeit {n}/3: der große Riffhai!',
    msgSharkFound: 'Da kreist er – ein riesiger Riffhai! Fahr ganz nah ran!',
    msgJelly: 'Zzzzap! Eine Qualle hat das U-Boot geschockt!',
    msgTreasureBonus: 'Piratenschatz geborgen: +{eur} € Bonus!',
    msgLevel2Unlocked: 'Level 2 „Coral Reef“ freigeschaltet!',
    msgSight_lava: 'Sehenswürdigkeit {n}/3: das glühende Lava-Feld mit den Riesen-Schloten!',
    msgSight_subwreck: 'Sehenswürdigkeit {n}/3: das versunkene Forschungs-U-Boot!',
    msgSight_monster: 'Sehenswürdigkeit {n}/3: das Tiefsee-Monster! Bitte nicht füttern …',
    msgLavaFound: 'Voraus glüht der Grund: ein gewaltiges Lava-Feld mit turmhohen Black Smokers!',
    msgSubFound: 'Zwei Scheinwerfer in einer Felsspalte … ein gesunkenes Forschungs-U-Boot!',
    msgMonsterFound: 'Was ist DAS?! Ein riesiger Anglerfisch mit leuchtender Lock-Angel – fahr näher ran!',
    msgLevel3Unlocked: 'Level 3 „Mariana Trench“ freigeschaltet!',
    msgO2Low: 'Sauerstoff wird knapp – zurück zur Plattform!',
    msgO2Charged: 'Sauerstoff aufgeladen',
    msgOxygenOut: 'Notaufstieg! Das U-Boot wurde zur Plattform gezogen.',
    msgLightOn: 'Scheinwerfer an',
    msgLightOff: 'Scheinwerfer aus',
    msgDeepDark: 'Ab hier wird es stockdunkel – nutze den Scheinwerfer!',
    msgPills: 'Tiefsee-Pillen verkauft: +{eur} €! Die Touristen sind … sehr entspannt.',
    msgChampagne: 'Arktis-Champagner serviert: +{eur} €! (Es ist Leitungswasser.)',
    msgBarCd: 'Die Theke macht gleich wieder auf …',
    msgBarHint: 'Bord-Bar: E / AKTION verkauft Pillen bzw. Champagner',
    msgBarSoldOut: 'AUSVERKAUFT – jeder Passagier wurde schon bedient!',
    msgGiantBounce: 'Zu nah! Das Riesenwesen hat das U-Boot weggestoßen!',
    msgBought: 'Upgrade gekauft!',
    msgNoMoney: 'Nicht genug Geld!',
    ctrlMove: 'WASD / ZQSD / Pfeile = Steuern',
    ctrlVert: 'Leertaste / Shift = Hoch / Runter',
    ctrlLight: 'F = Scheinwerfer',
    ctrlTouchMove: 'On-Screen-Joysticks = Steuern & Hoch / Runter',
    ctrlTouchLight: 'Licht-Button = Scheinwerfer',
    resTitle: 'TOUR-ABRECHNUNG',
    resRating: 'Bewertung',
    resEarned: 'Verdient',
    resWallet: 'Kasse',
    resLevelNew: '🔓 Level 2 freigeschaltet: Coral Reef!',
    resLevelNew3: '🔓 Level 3 freigeschaltet: Mariana Trench!',
    resLevelOk: '🏆 Top-Tour! Die Touristen sind begeistert.',
    resLevelNo: 'Ab 3.5 ★ gilt eine Tour als Top-Tour – diesmal leider nicht.',
    shopTitle: 'UPGRADE-SHOP',
    buy: 'KAUFEN',
    owned: 'GEKAUFT',
    resContinue: 'NÄCHSTE TOUR',
    resMenu: 'ZUM MENÜ',
    upGolden: 'Goldene Beheizte Klobrille',
    upGoldenDesc: '+0,3 ★ Bonus bei jedem WC-Gang',
    upFog: 'Nebelscheinwerfer',
    upFogDesc: 'Durchdringt den dunklen Tiefsee-Nebel viel besser',
    upFlood: 'Mega-Flutlicht',
    upFloodDesc: 'Deutlich hellerer, weiterer Frontscheinwerfer',
    mpTitle: 'MULTIPLAYER',
    mpName: 'Spielername',
    mpNamePh: 'z. B. CaptainMax',
    mpHost: 'SPIEL ERSTELLEN',
    mpHostSub: 'Du bist der Host – dein Freund tritt per Code bei',
    mpJoin: 'SPIEL BEITRETEN',
    mpJoinSub: 'Code vom Host eingeben',
    mpHostTitle: 'SPIEL ERSTELLEN',
    mpJoinTitle: 'SPIEL BEITRETEN',
    mpRoomCode: 'RAUM-CODE',
    mpCodeLabel: '4-stelliger Raum-Code',
    mpCreating: 'Raum wird erstellt …',
    mpWaiting: 'Warte auf Mitspieler …',
    mpChooseLevel: 'LEVEL FÜR BEIDE SPIELER',
    mpL2Locked: 'Level 2 ist noch gesperrt – schließe zuerst eine Tour in Level 1 ab.',
    mpL3Locked: 'Level 3 ist noch gesperrt – schließe zuerst eine Tour in Level 2 ab.',
    mpCancel: 'ABBRECHEN',
    mpGo: 'LOS!',
    mpConnecting: 'Verbinde …',
    mpGuestWait: 'Verbunden! Warte auf den Start durch den Host …',
    mpJoined: '{name} ist beigetreten – es geht los!',
    mpErrNoRoom: 'Raum nicht gefunden. Bitte den Code prüfen!',
    mpErrCode: 'Bitte einen 4-stelligen Code eingeben.',
    mpErrTimeout: 'Zeitüberschreitung – keine Verbindung zum Host möglich.',
    mpErrLib: 'PeerJS konnte nicht geladen werden – bitte Internetverbindung prüfen.',
    mpErrGeneric: 'Verbindungsfehler: {err}',
    mpPeerLeft: '{name} hat das Spiel verlassen.',
    mpYou: 'DU'
  },

  /* ================= FRANÇAIS ================= */
  fr: {
    subtitle: 'MARIANA TOURS · Excursions en eaux profondes, avec humour',
    play: 'JOUER',
    settings: 'PARAMÈTRES',
    resume: 'REPRENDRE',
    singleplayer: 'SOLO',
    multiplayer: 'MULTIJOUEUR',
    story: 'HISTOIRE',
    comingSoon: 'Bientôt disponible',
    back: 'RETOUR',
    chooseLevel: 'CHOISIR UN NIVEAU',
    settingsTitle: 'PARAMÈTRES',
    language: 'Langue',
    viewDistance: 'Distance de vue',
    viewNear: 'courte',
    viewFar: 'longue',
    controls: 'COMMANDES',
    helpKb: 'PC : WASD / ZQSD / flèches pour piloter · glisser la souris pour regarder autour · Espace/Maj monter/descendre · F phare · G bras de préhension · C caméra · E se lever/s’asseoir (au bar de bord : acheter pilules/champagne, aux toilettes de bord : s’asseoir et tirer la chasse) · Entrée action · Échap menu',
    helpPad: 'Manette : stick gauche piloter · stick droit regarder · R2/L2 monter/descendre · L1 phare · Y caméra · X se lever/s’asseoir · A action (bar, toilettes) · B bras de préhension · Start menu',
    helpTouch: 'iPad : boutons fléchés à gauche pour piloter · HAUT/BAS à droite · glisser pour regarder · boutons pour phare, caméra, se lever, bras et ACTION (bar, toilettes de bord)',
    depth: 'PROFONDEUR',
    oxygen: 'OXYGÈNE',
    sights: 'SITES À VISITER',
    ratingLabel: 'NOTE DE L’EXCURSION',
    menu: 'MENU',
    btnUp: 'HAUT',
    btnDown: 'BAS',
    btnLight: 'PHARE',
    btnCam: 'CAMÉRA',
    btnStand: 'SE LEVER',
    btnSit: 'S’ASSEOIR',
    btnArm: 'BRAS',
    btnAction: 'ACTION',
    level: 'Niveau',
    locked: 'Verrouillé',
    playable: 'Jouable',
    lvl1Name: 'Arctic Trench',
    lvl1Desc: 'Trou dans la glace, épave, cathédrale de glace et baleine de 150 mètres – une excursion pour touristes',
    lvl2Name: 'Coral Reef',
    lvl2Desc: 'Coraux colorés, arche rocheuse, trésor de pirates, requin de récif – et des méduses qui piquent !',
    lvl2LockedDesc: 'Verrouillé – terminez d’abord une excursion au niveau 1',
    lvl3Name: 'Mariana Trench',
    lvl3Desc: '11 000 m de profondeur : champs de lave incandescents, fumeurs noirs, un sous-marin de recherche – et un monstre !',
    lvl3LockedDesc: 'Verrouillé – terminez d’abord une excursion au niveau 2',
    lvlLockedDesc: 'Pas encore disponible',
    lockedToast: 'Ce niveau est encore verrouillé.',
    lvl2LockedToast: 'Le niveau 2 est verrouillé – terminez d’abord une excursion au niveau 1 !',
    lvl3LockedToast: 'Le niveau 3 est verrouillé – terminez d’abord une excursion au niveau 2 !',
    modeExt: 'CAMÉRA EXTÉRIEURE',
    modeCockpit: 'CAMÉRA COCKPIT',
    modeWalk: 'DANS LE SOUS-MARIN',
    objSights: 'Visitez les sites ({n}/3) – suivez les pings sur le radar',
    objDock: 'Les 3 sites sont vus ! Retournez à la plateforme pour accoster – ou vendez encore quelques pilules …',
    objDone: 'Excursion réglée !',
    msgSight_wreck: 'Site {n}/3 : l’épave du navire englouti !',
    msgSight_cathedral: 'Site {n}/3 : la cathédrale de cristaux de glace lumineuse !',
    msgSight_whale: 'Site {n}/3 : la baleine polaire de 150 mètres !',
    msgAllSights: 'Les 3 sites sont vus – retournez à la plateforme pour accoster !',
    msgStalkerDark: 'Un Traqueur de givre vous observe dans le noir … allumez le phare !',
    msgStalkerScared: 'Le Traqueur de givre est ébloui par la lumière et recule.',
    msgWhaleFound: 'La voilà – une gigantesque baleine polaire ! Approchez-vous !',
    msgSight_arch: 'Site {n}/3 : traversée de l’immense arche rocheuse !',
    msgSight_treasure: 'Site {n}/3 : le coffre au trésor des pirates englouti !',
    msgSight_shark: 'Site {n}/3 : le grand requin de récif !',
    msgSharkFound: 'Il tourne là – un énorme requin de récif ! Approchez-vous !',
    msgJelly: 'Zzzzap ! Une méduse a électrisé le sous-marin !',
    msgTreasureBonus: 'Trésor de pirates récupéré : +{eur} € de bonus !',
    msgLevel2Unlocked: 'Niveau 2 « Coral Reef » débloqué !',
    msgSight_lava: 'Site {n}/3 : le champ de lave incandescent avec ses cheminées géantes !',
    msgSight_subwreck: 'Site {n}/3 : le sous-marin de recherche englouti !',
    msgSight_monster: 'Site {n}/3 : le monstre des abysses ! Merci de ne pas le nourrir …',
    msgLavaFound: 'Le fond rougeoie devant vous : un énorme champ de lave avec des fumeurs noirs hauts comme des tours !',
    msgSubFound: 'Deux phares dans une crevasse … un sous-marin de recherche coulé !',
    msgMonsterFound: 'C’est QUOI, ça ?! Une baudroie géante avec un leurre lumineux – approchez-vous !',
    msgLevel3Unlocked: 'Niveau 3 « Mariana Trench » débloqué !',
    msgO2Low: 'L’oxygène baisse – retournez à la plateforme !',
    msgO2Charged: 'Oxygène rechargé',
    msgOxygenOut: 'Remontée d’urgence ! Le sous-marin a été ramené à la plateforme.',
    msgLightOn: 'Phare allumé',
    msgLightOff: 'Phare éteint',
    msgDeepDark: 'À partir d’ici, c’est le noir complet – utilisez le phare !',
    msgPills: 'Pilules des abysses vendues : +{eur} € ! Les touristes sont … très détendus.',
    msgChampagne: 'Champagne arctique servi : +{eur} € ! (C’est de l’eau du robinet.)',
    msgBarCd: 'Le comptoir rouvre dans un instant …',
    msgBarHint: 'Bar de bord : E / ACTION vend des pilules ou du champagne',
    msgBarSoldOut: 'ÉPUISÉ – chaque passager a déjà été servi !',
    msgGiantBounce: 'Trop près ! La créature géante a repoussé le sous-marin !',
    msgBought: 'Amélioration achetée !',
    msgNoMoney: 'Pas assez d’argent !',
    ctrlMove: 'WASD / ZQSD / Flèches = Piloter',
    ctrlVert: 'Espace / Maj = Monter / Descendre',
    ctrlLight: 'F = Phare',
    ctrlTouchMove: 'Joysticks à l’écran = Piloter et Monter / Descendre',
    ctrlTouchLight: 'Bouton Phare = Allumer le phare',
    resTitle: 'DÉCOMPTE DE L’EXCURSION',
    resRating: 'Note',
    resEarned: 'Gagné',
    resWallet: 'Caisse',
    resLevelNew: '🔓 Niveau 2 débloqué : Coral Reef !',
    resLevelNew3: '🔓 Niveau 3 débloqué : Mariana Trench !',
    resLevelOk: '🏆 Excursion au top ! Les touristes sont ravis.',
    resLevelNo: 'À partir de 3,5 ★, une excursion est un succès – pas cette fois.',
    shopTitle: 'BOUTIQUE D’AMÉLIORATIONS',
    buy: 'ACHETER',
    owned: 'ACHETÉ',
    resContinue: 'EXCURSION SUIVANTE',
    resMenu: 'AU MENU',
    upGolden: 'Siège de toilettes doré chauffant',
    upGoldenDesc: '+0,3 ★ de bonus à chaque passage aux toilettes',
    upFog: 'Phares antibrouillard',
    upFogDesc: 'Percent bien mieux la brume sombre des abysses',
    upFlood: 'Méga projecteur',
    upFloodDesc: 'Phare avant bien plus lumineux et de plus longue portée',
    mpTitle: 'MULTIJOUEUR',
    mpName: 'Nom du joueur',
    mpNamePh: 'ex. CaptainMax',
    mpHost: 'CRÉER UNE PARTIE',
    mpHostSub: 'Vous êtes l’hôte – votre ami rejoint avec un code',
    mpJoin: 'REJOINDRE UNE PARTIE',
    mpJoinSub: 'Saisissez le code de l’hôte',
    mpHostTitle: 'CRÉER UNE PARTIE',
    mpJoinTitle: 'REJOINDRE UNE PARTIE',
    mpRoomCode: 'CODE DU SALON',
    mpCodeLabel: 'Code du salon à 4 chiffres',
    mpCreating: 'Création du salon …',
    mpWaiting: 'En attente d’un deuxième joueur …',
    mpChooseLevel: 'NIVEAU POUR LES DEUX JOUEURS',
    mpL2Locked: 'Le niveau 2 est encore verrouillé – terminez d’abord une excursion au niveau 1.',
    mpL3Locked: 'Le niveau 3 est encore verrouillé – terminez d’abord une excursion au niveau 2.',
    mpCancel: 'ANNULER',
    mpGo: 'C’EST PARTI !',
    mpConnecting: 'Connexion …',
    mpGuestWait: 'Connecté ! En attente du lancement par l’hôte …',
    mpJoined: '{name} a rejoint la partie – c’est parti !',
    mpErrNoRoom: 'Salon introuvable. Vérifiez le code !',
    mpErrCode: 'Veuillez saisir un code à 4 chiffres.',
    mpErrTimeout: 'Délai dépassé – impossible de joindre l’hôte.',
    mpErrLib: 'Impossible de charger PeerJS – vérifiez votre connexion Internet.',
    mpErrGeneric: 'Erreur de connexion : {err}',
    mpPeerLeft: '{name} a quitté la partie.',
    mpYou: 'VOUS'
  },

  /* ================= NEDERLANDS ================= */
  nl: {
    subtitle: 'MARIANA TOURS · Diepzeetours met humor',
    play: 'SPELEN',
    settings: 'INSTELLINGEN',
    resume: 'DOORGAAN',
    singleplayer: 'ENKELSPELER',
    multiplayer: 'MEERSPELER',
    story: 'VERHAAL',
    comingSoon: 'Binnenkort beschikbaar',
    back: 'TERUG',
    chooseLevel: 'KIES EEN LEVEL',
    settingsTitle: 'INSTELLINGEN',
    language: 'Taal',
    viewDistance: 'Zichtafstand',
    viewNear: 'kort',
    viewFar: 'ver',
    controls: 'BESTURING',
    helpKb: 'PC: WASD / ZQSD / pijltjes sturen · muis slepen om rond te kijken · Spatie/Shift omhoog/omlaag · F koplamp · G grijparm · C camera · E opstaan/gaan zitten (bij de boordbar: pillen/champagne kopen, bij het boordtoilet: gaan zitten en doortrekken) · Enter actie · Esc menu',
    helpPad: 'Gamepad: linkerstick sturen · rechterstick rondkijken · R2/L2 omhoog/omlaag · L1 licht · Y camera · X opstaan/gaan zitten · A actie (bar, toilet) · B grijparm · Start menu',
    helpTouch: 'iPad: pijlknoppen links om te sturen · OMHOOG/OMLAAG rechts · vegen om rond te kijken · knoppen voor licht, camera, opstaan, grijparm en ACTIE (bar, boordtoilet)',
    depth: 'DIEPTE',
    oxygen: 'ZUURSTOF',
    sights: 'BEZIENSWAARDIGHEDEN',
    ratingLabel: 'TOURBEOORDELING',
    menu: 'MENU',
    btnUp: 'OMHOOG',
    btnDown: 'OMLAAG',
    btnLight: 'LICHT',
    btnCam: 'CAMERA',
    btnStand: 'OPSTAAN',
    btnSit: 'GAAN ZITTEN',
    btnArm: 'ARM',
    btnAction: 'ACTIE',
    level: 'Level',
    locked: 'Vergrendeld',
    playable: 'Speelbaar',
    lvl1Name: 'Arctic Trench',
    lvl1Desc: 'IJsgat, wrak, ijskathedraal en een walvis van 150 meter – een tour voor toeristen',
    lvl2Name: 'Coral Reef',
    lvl2Desc: 'Kleurrijke koralen, rotsboog, piratenschat, rifhaai – en kwallen die steken!',
    lvl2LockedDesc: 'Vergrendeld – voltooi eerst een tour in level 1',
    lvl3Name: 'Mariana Trench',
    lvl3Desc: '11.000 m diep: gloeiende lavavelden, black smokers, een onderzoeksduikboot – en een monster!',
    lvl3LockedDesc: 'Vergrendeld – voltooi eerst een tour in level 2',
    lvlLockedDesc: 'Nog niet beschikbaar',
    lockedToast: 'Dit level is nog vergrendeld.',
    lvl2LockedToast: 'Level 2 is vergrendeld – voltooi eerst een tour in level 1!',
    lvl3LockedToast: 'Level 3 is vergrendeld – voltooi eerst een tour in level 2!',
    modeExt: 'BUITENCAMERA',
    modeCockpit: 'COCKPITCAMERA',
    modeWalk: 'IN DE DUIKBOOT',
    objSights: 'Bezoek de bezienswaardigheden ({n}/3) – volg de pings op de radar',
    objDock: 'Alle 3 gezien! Terug naar het platform om aan te meren – of verkoop eerst nog wat pillen …',
    objDone: 'Tour afgerekend!',
    msgSight_wreck: 'Bezienswaardigheid {n}/3: het gezonken scheepswrak!',
    msgSight_cathedral: 'Bezienswaardigheid {n}/3: de gloeiende ijskristalkathedraal!',
    msgSight_whale: 'Bezienswaardigheid {n}/3: de poolwalvis van 150 meter!',
    msgAllSights: 'Alle 3 bezienswaardigheden gezien – terug naar het platform om aan te meren!',
    msgStalkerDark: 'Een Vorststalker kijkt toe in het donker … zet de koplamp aan!',
    msgStalkerScared: 'De Vorststalker is verblind door het licht en deinst terug.',
    msgWhaleFound: 'Daar is hij – een gigantische poolwalvis! Vaar er heel dichtbij!',
    msgSight_arch: 'Bezienswaardigheid {n}/3: door de enorme rotsboog gedoken!',
    msgSight_treasure: 'Bezienswaardigheid {n}/3: de gezonken piratenschatkist!',
    msgSight_shark: 'Bezienswaardigheid {n}/3: de grote rifhaai!',
    msgSharkFound: 'Daar zwemt hij rond – een reusachtige rifhaai! Vaar er heel dichtbij!',
    msgJelly: 'Zzzzap! Een kwal heeft de duikboot een schok gegeven!',
    msgTreasureBonus: 'Piratenschat geborgen: +{eur} € bonus!',
    msgLevel2Unlocked: 'Level 2 "Coral Reef" ontgrendeld!',
    msgSight_lava: 'Bezienswaardigheid {n}/3: het gloeiende lavaveld met de reuzenschoorstenen!',
    msgSight_subwreck: 'Bezienswaardigheid {n}/3: de gezonken onderzoeksduikboot!',
    msgSight_monster: 'Bezienswaardigheid {n}/3: het diepzeemonster! Niet voeren, alsjeblieft …',
    msgLavaFound: 'Voor je gloeit de zeebodem: een enorm lavaveld met torenhoge black smokers!',
    msgSubFound: 'Twee koplampen in een rotsspleet … een gezonken onderzoeksduikboot!',
    msgMonsterFound: 'Wat is DAT?! Een gigantische hengelaarvis met gloeiend lokaas – ga dichterbij!',
    msgLevel3Unlocked: 'Level 3 "Mariana Trench" ontgrendeld!',
    msgO2Low: 'De zuurstof raakt op – terug naar het platform!',
    msgO2Charged: 'Zuurstof bijgevuld',
    msgOxygenOut: 'Noodopstijging! De duikboot is naar het platform getrokken.',
    msgLightOn: 'Koplamp aan',
    msgLightOff: 'Koplamp uit',
    msgDeepDark: 'Vanaf hier wordt het pikdonker – gebruik de koplamp!',
    msgPills: 'Diepzeepillen verkocht: +{eur} €! De toeristen zijn … erg ontspannen.',
    msgChampagne: 'Poolchampagne geserveerd: +{eur} €! (Het is kraanwater.)',
    msgBarCd: 'De bar gaat zo weer open …',
    msgBarHint: 'Boordbar: E / ACTIE verkoopt pillen of champagne',
    msgBarSoldOut: 'UITVERKOCHT – elke passagier is al bediend!',
    msgGiantBounce: 'Te dichtbij! Het reusachtige monster duwde de duikboot weg!',
    msgBought: 'Upgrade gekocht!',
    msgNoMoney: 'Niet genoeg geld!',
    ctrlMove: 'WASD / ZQSD / Pijltjes = Sturen',
    ctrlVert: 'Spatie / Shift = Omhoog / Omlaag',
    ctrlLight: 'F = Koplamp',
    ctrlTouchMove: 'Joysticks op het scherm = Sturen en Omhoog / Omlaag',
    ctrlTouchLight: 'Lichtknop = Koplamp',
    resTitle: 'TOURAFREKENING',
    resRating: 'Beoordeling',
    resEarned: 'Verdiend',
    resWallet: 'Kas',
    resLevelNew: '🔓 Level 2 ontgrendeld: Coral Reef!',
    resLevelNew3: '🔓 Level 3 ontgrendeld: Mariana Trench!',
    resLevelOk: '🏆 Toptour! De toeristen zijn laaiend enthousiast.',
    resLevelNo: 'Vanaf 3,5 ★ telt een tour als toptour – dit keer helaas niet.',
    shopTitle: 'UPGRADEWINKEL',
    buy: 'KOPEN',
    owned: 'GEKOCHT',
    resContinue: 'VOLGENDE TOUR',
    resMenu: 'NAAR MENU',
    upGolden: 'Gouden verwarmde toiletbril',
    upGoldenDesc: '+0,3 ★ bonus bij elk toiletbezoek',
    upFog: 'Mistlampen',
    upFogDesc: 'Dringt veel beter door de donkere diepzeemist',
    upFlood: 'Mega-schijnwerper',
    upFloodDesc: 'Veel helderder, verder reikende koplamp',
    mpTitle: 'MEERSPELER',
    mpName: 'Spelersnaam',
    mpNamePh: 'bijv. CaptainMax',
    mpHost: 'SPEL MAKEN',
    mpHostSub: 'Jij bent de host – je vriend doet mee met een code',
    mpJoin: 'SPEL JOINEN',
    mpJoinSub: 'Voer de code van de host in',
    mpHostTitle: 'SPEL MAKEN',
    mpJoinTitle: 'SPEL JOINEN',
    mpRoomCode: 'KAMERCODE',
    mpCodeLabel: 'Kamercode van 4 cijfers',
    mpCreating: 'Kamer wordt gemaakt …',
    mpWaiting: 'Wachten op een tweede speler …',
    mpChooseLevel: 'LEVEL VOOR BEIDE SPELERS',
    mpL2Locked: 'Level 2 is nog vergrendeld – voltooi eerst een tour in level 1.',
    mpL3Locked: 'Level 3 is nog vergrendeld – voltooi eerst een tour in level 2.',
    mpCancel: 'ANNULEREN',
    mpGo: 'START!',
    mpConnecting: 'Verbinden …',
    mpGuestWait: 'Verbonden! Wachten tot de host start …',
    mpJoined: '{name} is erbij gekomen – daar gaan we!',
    mpErrNoRoom: 'Kamer niet gevonden. Controleer de code!',
    mpErrCode: 'Voer een code van 4 cijfers in.',
    mpErrTimeout: 'Time-out – de host is niet bereikbaar.',
    mpErrLib: 'PeerJS kon niet worden geladen – controleer je internetverbinding.',
    mpErrGeneric: 'Verbindingsfout: {err}',
    mpPeerLeft: '{name} heeft het spel verlaten.',
    mpYou: 'JIJ'
  },

  /* ================= POLSKI ================= */
  pl: {
    subtitle: 'MARIANA TOURS · Wycieczki w głębinach z humorem',
    play: 'GRAJ',
    settings: 'USTAWIENIA',
    resume: 'WZNÓW',
    singleplayer: 'JEDEN GRACZ',
    multiplayer: 'MULTIPLAYER',
    story: 'FABUŁA',
    comingSoon: 'Wkrótce',
    back: 'WSTECZ',
    chooseLevel: 'WYBIERZ POZIOM',
    settingsTitle: 'USTAWIENIA',
    language: 'Język',
    viewDistance: 'Zasięg widzenia',
    viewNear: 'krótki',
    viewFar: 'daleki',
    controls: 'STEROWANIE',
    helpKb: 'PC: WASD / ZQSD / strzałki – sterowanie · przeciągnij myszą, by się rozejrzeć · Spacja/Shift w górę/w dół · F reflektor · G chwytak · C kamera · E wstań/usiądź (przy barze pokładowym: kup pigułki/szampana, przy toalecie pokładowej: usiądź i spuść wodę) · Enter akcja · Esc menu',
    helpPad: 'Pad: lewy drążek – sterowanie · prawy drążek – rozglądanie · R2/L2 w górę/w dół · L1 światło · Y kamera · X wstań/usiądź · A akcja (bar, toaleta) · B chwytak · Start menu',
    helpTouch: 'iPad: strzałki po lewej – sterowanie · GÓRA/DÓŁ po prawej · przesuń palcem, by się rozejrzeć · przyciski: światło, kamera, wstawanie, chwytak i AKCJA (bar, toaleta pokładowa)',
    depth: 'GŁĘBOKOŚĆ',
    oxygen: 'TLEN',
    sights: 'ATRAKCJE',
    ratingLabel: 'OCENA WYCIECZKI',
    menu: 'MENU',
    btnUp: 'GÓRA',
    btnDown: 'DÓŁ',
    btnLight: 'ŚWIATŁO',
    btnCam: 'KAMERA',
    btnStand: 'WSTAŃ',
    btnSit: 'USIĄDŹ',
    btnArm: 'CHWYTAK',
    btnAction: 'AKCJA',
    level: 'Poziom',
    locked: 'Zablokowany',
    playable: 'Dostępny',
    lvl1Name: 'Arctic Trench',
    lvl1Desc: 'Przerębel, wrak, lodowa katedra i 150-metrowy wieloryb – wycieczka dla turystów',
    lvl2Name: 'Coral Reef',
    lvl2Desc: 'Kolorowe koralowce, skalny łuk, skarb piratów, rekin rafowy – i meduzy, które parzą!',
    lvl2LockedDesc: 'Zablokowany – najpierw ukończ wycieczkę na poziomie 1',
    lvl3Name: 'Mariana Trench',
    lvl3Desc: '11 000 m w głąb: żarzące się pola lawy, czarne kominy, łódź badawcza – i potwór!',
    lvl3LockedDesc: 'Zablokowany – najpierw ukończ wycieczkę na poziomie 2',
    lvlLockedDesc: 'Jeszcze niedostępny',
    lockedToast: 'Ten poziom jest jeszcze zablokowany.',
    lvl2LockedToast: 'Poziom 2 jest zablokowany – najpierw ukończ wycieczkę na poziomie 1!',
    lvl3LockedToast: 'Poziom 3 jest zablokowany – najpierw ukończ wycieczkę na poziomie 2!',
    modeExt: 'KAMERA ZEWNĘTRZNA',
    modeCockpit: 'KAMERA W KOKPICIE',
    modeWalk: 'WEWNĄTRZ ŁODZI',
    objSights: 'Odwiedź atrakcje ({n}/3) – podążaj za sygnałami na radarze',
    objDock: 'Wszystkie 3 zaliczone! Wróć na platformę, by zacumować – albo najpierw sprzedaj jeszcze trochę pigułek …',
    objDone: 'Wycieczka rozliczona!',
    msgSight_wreck: 'Atrakcja {n}/3: zatopiony wrak statku!',
    msgSight_cathedral: 'Atrakcja {n}/3: świecąca katedra z kryształów lodu!',
    msgSight_whale: 'Atrakcja {n}/3: 150-metrowy wieloryb polarny!',
    msgAllSights: 'Wszystkie 3 atrakcje zaliczone – wróć na platformę, by zacumować!',
    msgStalkerDark: 'Mroźny Prześladowca obserwuje cię w ciemności … włącz reflektor!',
    msgStalkerScared: 'Mroźny Prześladowca jest oślepiony światłem i się cofa.',
    msgWhaleFound: 'Jest – gigantyczny wieloryb polarny! Podpłyń całkiem blisko!',
    msgSight_arch: 'Atrakcja {n}/3: przepłynięcie przez ogromny skalny łuk!',
    msgSight_treasure: 'Atrakcja {n}/3: zatopiona skrzynia ze skarbem piratów!',
    msgSight_shark: 'Atrakcja {n}/3: wielki rekin rafowy!',
    msgSharkFound: 'Krąży tam – ogromny rekin rafowy! Podpłyń całkiem blisko!',
    msgJelly: 'Bzzzt! Meduza poraziła łódź podwodną!',
    msgTreasureBonus: 'Skarb piratów wydobyty: +{eur} € premii!',
    msgLevel2Unlocked: 'Poziom 2 „Coral Reef” odblokowany!',
    msgSight_lava: 'Atrakcja {n}/3: żarzące się pole lawy z gigantycznymi kominami!',
    msgSight_subwreck: 'Atrakcja {n}/3: zatopiona łódź badawcza!',
    msgSight_monster: 'Atrakcja {n}/3: głębinowy potwór! Prosimy nie karmić …',
    msgLavaFound: 'Przed nami żarzy się dno: ogromne pole lawy z wysokimi jak wieże czarnymi kominami!',
    msgSubFound: 'Dwa reflektory w szczelinie skalnej … zatopiona łódź badawcza!',
    msgMonsterFound: 'Co to jest?! Gigantyczna żabnica ze świecącą przynętą – podpłyń bliżej!',
    msgLevel3Unlocked: 'Poziom 3 „Mariana Trench” odblokowany!',
    msgO2Low: 'Kończy się tlen – wracaj na platformę!',
    msgO2Charged: 'Tlen uzupełniony',
    msgOxygenOut: 'Awaryjne wynurzenie! Łódź została odholowana na platformę.',
    msgLightOn: 'Reflektor włączony',
    msgLightOff: 'Reflektor wyłączony',
    msgDeepDark: 'Od tego miejsca robi się całkiem ciemno – użyj reflektora!',
    msgPills: 'Sprzedano głębinowe pigułki: +{eur} €! Turyści są … bardzo zrelaksowani.',
    msgChampagne: 'Podano arktycznego szampana: +{eur} €! (To woda z kranu.)',
    msgBarCd: 'Bar zaraz znów się otworzy …',
    msgBarHint: 'Bar pokładowy: E / AKCJA sprzedaje pigułki lub szampana',
    msgBarSoldOut: 'WYPRZEDANE – każdy pasażer został już obsłużony!',
    msgGiantBounce: 'Za blisko! Gigantyczny stwór odepchnął łódź!',
    msgBought: 'Ulepszenie kupione!',
    msgNoMoney: 'Za mało pieniędzy!',
    ctrlMove: 'WASD / ZQSD / Strzałki = Sterowanie',
    ctrlVert: 'Spacja / Shift = W górę / W dół',
    ctrlLight: 'F = Reflektor',
    ctrlTouchMove: 'Joysticki na ekranie = Sterowanie i W górę / W dół',
    ctrlTouchLight: 'Przycisk światła = Reflektor',
    resTitle: 'ROZLICZENIE WYCIECZKI',
    resRating: 'Ocena',
    resEarned: 'Zarobiono',
    resWallet: 'Kasa',
    resLevelNew: '🔓 Poziom 2 odblokowany: Coral Reef!',
    resLevelNew3: '🔓 Poziom 3 odblokowany: Mariana Trench!',
    resLevelOk: '🏆 Świetna wycieczka! Turyści są zachwyceni.',
    resLevelNo: 'Od 3,5 ★ wycieczka uchodzi za świetną – tym razem niestety nie.',
    shopTitle: 'SKLEP Z ULEPSZENIAMI',
    buy: 'KUP',
    owned: 'KUPIONE',
    resContinue: 'NASTĘPNA WYCIECZKA',
    resMenu: 'DO MENU',
    upGolden: 'Złota podgrzewana deska klozetowa',
    upGoldenDesc: '+0,3 ★ premii za każdą wizytę w toalecie',
    upFog: 'Światła przeciwmgielne',
    upFogDesc: 'Znacznie lepiej przebijają ciemną głębinową mgłę',
    upFlood: 'Mega reflektor',
    upFloodDesc: 'Znacznie jaśniejszy reflektor o większym zasięgu',
    mpTitle: 'MULTIPLAYER',
    mpName: 'Nazwa gracza',
    mpNamePh: 'np. CaptainMax',
    mpHost: 'STWÓRZ GRĘ',
    mpHostSub: 'Jesteś hostem – znajomy dołącza za pomocą kodu',
    mpJoin: 'DOŁĄCZ DO GRY',
    mpJoinSub: 'Wpisz kod od hosta',
    mpHostTitle: 'STWÓRZ GRĘ',
    mpJoinTitle: 'DOŁĄCZ DO GRY',
    mpRoomCode: 'KOD POKOJU',
    mpCodeLabel: '4-cyfrowy kod pokoju',
    mpCreating: 'Tworzenie pokoju …',
    mpWaiting: 'Czekanie na drugiego gracza …',
    mpChooseLevel: 'POZIOM DLA OBU GRACZY',
    mpL2Locked: 'Poziom 2 jest jeszcze zablokowany – najpierw ukończ wycieczkę na poziomie 1.',
    mpL3Locked: 'Poziom 3 jest jeszcze zablokowany – najpierw ukończ wycieczkę na poziomie 2.',
    mpCancel: 'ANULUJ',
    mpGo: 'START!',
    mpConnecting: 'Łączenie …',
    mpGuestWait: 'Połączono! Czekanie na start od hosta …',
    mpJoined: '{name} dołączył(a) – zaczynamy!',
    mpErrNoRoom: 'Nie znaleziono pokoju. Sprawdź kod!',
    mpErrCode: 'Wpisz 4-cyfrowy kod.',
    mpErrTimeout: 'Przekroczono czas – nie można połączyć się z hostem.',
    mpErrLib: 'Nie udało się załadować PeerJS – sprawdź połączenie z internetem.',
    mpErrGeneric: 'Błąd połączenia: {err}',
    mpPeerLeft: '{name} opuścił(a) grę.',
    mpYou: 'TY'
  }
};

/* Level 1 immer spielbar · Level 2 nach der ersten Level-1-Tour ·
   Level 3 nach der ersten Level-2-Tour · 4–5 folgen
   unlock = Nummer des Levels, dessen Freischaltung nötig ist (2 oder 3) */
export const LEVELS = [
  { id: 1, nameKey: 'lvl1Name', descKey: 'lvl1Desc', playable: true },
  { id: 2, nameKey: 'lvl2Name', descKey: 'lvl2Desc', lockedDescKey: 'lvl2LockedDesc', lockedToastKey: 'lvl2LockedToast', playable: true, unlock: 2 },
  { id: 3, nameKey: 'lvl3Name', descKey: 'lvl3Desc', lockedDescKey: 'lvl3LockedDesc', lockedToastKey: 'lvl3LockedToast', playable: true, unlock: 3 },
  { id: 4, nameKey: null, descKey: 'lvlLockedDesc', playable: false },
  { id: 5, nameKey: null, descKey: 'lvlLockedDesc', playable: false }
];

/* Text holen: aktuelle Sprache -> Englisch -> Key selbst */
export function t(key, vars) {
  let s = (I18N[settings.lang] && I18N[settings.lang][key]);
  if (s === undefined) s = I18N.en[key];
  if (s === undefined) s = key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}

/* Ist das ein bekannter Text-Key? (Englisch ist die vollständige Basis) */
function isKey(k) { return I18N.en[k] !== undefined; }

/* ---------- Interner Zustand ---------- */
const $ = (id) => document.getElementById(id);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const clamp01 = (v) => Math.min(1, Math.max(0, v));

let cb = {};
let stack = ['main'];
let menuOpen = true;
let resultOpen = false;
let inGame = false;
let msgTimer = 0;
let modeTimer = 0;
let flashTimer = 0;
const last = {};
let el = {};
let lastResult = null;

let mpLevel = 1;          // vom Host gewähltes Level
let mpBarOn = false;      // Multiplayer-Leiste aktiv?
let mpHintTimer = 0;

export function isMenuOpen() { return menuOpen || resultOpen; }
export function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
}

/* ---------- Level-Freischaltung ---------- */
export function isLevel2Unlocked() { return level2Unlocked; }
export function isLevel3Unlocked() { return level3Unlocked; }

/* v = true: freischalten und dauerhaft speichern; v = false: nur Anzeige (löscht nichts) */
export function setLevel2Unlocked(v) {
  level2Unlocked = !!v;
  if (level2Unlocked) {
    try { localStorage.setItem(LEVEL2_KEY, 'true'); } catch (e) { /* ignorieren */ }
  }
  renderLevels();
}

export function setLevel3Unlocked(v) {
  level3Unlocked = !!v;
  if (level3Unlocked) {
    try { localStorage.setItem(LEVEL3_KEY, 'true'); } catch (e) { /* ignorieren */ }
  }
  renderLevels();
}

function levelUnlocked(id) {
  if (id === 2) return level2Unlocked;
  if (id === 3) return level3Unlocked;
  return true;
}

function levelOpen(lv) {
  return !!lv.playable && (!lv.unlock || levelUnlocked(lv.unlock));
}

/* ---------- Steuerungs-Overlay (5 Sekunden, CrazyGames) ---------- */
let ctrlTimer = 0;
let ctrlHideTimer = 0;
let ctrlOn = false;

function renderControlsOverlay() {
  const box = $('ctrl-overlay');
  if (!box) return;
  const rows = isTouchDevice() ? ['ctrlTouchMove', 'ctrlTouchLight'] : ['ctrlMove', 'ctrlVert', 'ctrlLight'];
  box.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'ctrl-title';
  title.textContent = t('controls');
  box.appendChild(title);
  rows.forEach((k) => {
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    row.textContent = t(k);
    box.appendChild(row);
  });
}

/* ms: Anzeigedauer (Standard 5000) – blendet danach weich aus */
export function showControlsOverlay(ms) {
  const box = $('ctrl-overlay');
  if (!box) return;
  clearTimeout(ctrlTimer);
  clearTimeout(ctrlHideTimer);
  ctrlOn = true;
  renderControlsOverlay();
  box.classList.remove('hidden');
  void box.offsetWidth;
  box.classList.add('show');
  ctrlTimer = setTimeout(hideControlsOverlay, ms || 5000);
}

export function hideControlsOverlay() {
  const box = $('ctrl-overlay');
  clearTimeout(ctrlTimer);
  clearTimeout(ctrlHideTimer);
  ctrlOn = false;
  if (!box) return;
  box.classList.remove('show');
  ctrlHideTimer = setTimeout(() => box.classList.add('hidden'), 1000);
}

/* ---------- Leiste oben: Live-Sterne + Geld ---------- */
let ratingEl = null;
let ratingActive = false;
let hudShown = false;
let ratingPopTimer = 0;

function initRatingBar() {
  if (ratingEl) return;
  const css = document.createElement('style');
  css.textContent = `
#rating-bar{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);
 z-index:45;display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;
 background:rgba(8,18,32,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
 border:1px solid rgba(255,255,255,.22);color:#fff;font:700 14px/1 system-ui,sans-serif;
 pointer-events:none;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.35)}
#rating-bar.rb-off{display:none}
#rating-bar .rb-label{font-size:11px;letter-spacing:.08em;opacity:.7;font-weight:600}
#rating-bar .rb-stars{font-size:18px;letter-spacing:2px;
 background:linear-gradient(90deg,#ffcf3a var(--p,70%),rgba(255,255,255,.28) var(--p,70%));
 -webkit-background-clip:text;background-clip:text;color:transparent}
#rating-bar .rb-num{font-size:16px;font-weight:800;color:#ffcf3a;min-width:2.2em}
#rating-bar .rb-sep{width:1px;height:18px;background:rgba(255,255,255,.28)}
#rating-bar .rb-money{font-size:16px;font-weight:800;color:#7dffc4;min-width:3.4em;text-align:right}
#rating-bar .rb-delta,#rating-bar .rb-mdelta{position:absolute;top:100%;margin-top:6px;opacity:0;
 font-weight:800;font-size:14px;padding:3px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2)}
#rating-bar .rb-delta{left:34%;transform:translate(-50%,0)}
#rating-bar .rb-mdelta{left:80%;transform:translate(-50%,0)}
#rating-bar .pos{color:#7dffc4;background:rgba(10,60,40,.85)}
#rating-bar .neg{color:#ff8a9c;background:rgba(70,10,20,.85)}
#rating-bar .show{animation:rb-chip 2.2s ease forwards}
#rating-bar.pop{animation:rb-pop .45s ease}
@keyframes rb-pop{0%{transform:translateX(-50%) scale(1)}40%{transform:translateX(-50%) scale(1.05)}100%{transform:translateX(-50%) scale(1)}}
@keyframes rb-chip{0%{opacity:0;margin-top:0}15%{opacity:1;margin-top:6px}75%{opacity:1;margin-top:6px}100%{opacity:0;margin-top:12px}}
@media (prefers-reduced-motion:reduce){#rating-bar.pop,#rating-bar .show{animation:none}#rating-bar .show{opacity:1}}`;
  document.head.appendChild(css);

  const bar = document.createElement('div');
  bar.id = 'rating-bar';
  bar.className = 'rb-off';
  bar.innerHTML =
    '<span class="rb-label" data-i18n="ratingLabel"></span>' +
    '<span class="rb-stars">★★★★★</span>' +
    '<span class="rb-num">–</span>' +
    '<span class="rb-sep"></span>' +
    '<span class="rb-money">0 €</span>' +
    '<span class="rb-delta"></span>' +
    '<span class="rb-mdelta"></span>';
  document.body.appendChild(bar);
  ratingEl = bar;
}

function syncMpBar() {
  const bar = $('mp-bar');
  if (!bar) return;
  bar.classList.toggle('hidden', !(mpBarOn && hudShown && !menuOpen && !resultOpen));
}

function syncRatingBar() {
  syncMpBar();
  if (!ratingEl) return;
  const show = ratingActive && hudShown && !menuOpen && !resultOpen;
  ratingEl.classList.toggle('rb-off', !show);
}

/* Spiel ruft das auf, sobald Touristen da sind (true) bzw. beim Aufräumen (false) */
export function setRatingActive(v) {
  ratingActive = !!v;
  if (!ratingActive && ratingEl) {
    ratingEl.querySelector('.rb-num').textContent = '–';
    ratingEl.querySelector('.rb-money').textContent = '0 €';
    ratingEl.querySelector('.rb-delta').classList.remove('show');
    ratingEl.querySelector('.rb-mdelta').classList.remove('show');
  }
  syncRatingBar();
}

function chip(node, text, positive, timerRef) {
  node.textContent = text;
  node.classList.remove('pos', 'neg', 'show');
  node.classList.add(positive ? 'pos' : 'neg');
  void node.offsetWidth;
  node.classList.add('show');
  clearTimeout(timerRef.id);
  timerRef.id = setTimeout(() => node.classList.remove('show'), 2300);
}
const starTimer = { id: 0 }, moneyTimer = { id: 0 };

function popBar() {
  ratingEl.classList.remove('pop');
  void ratingEl.offsetWidth;
  ratingEl.classList.add('pop');
  clearTimeout(ratingPopTimer);
  ratingPopTimer = setTimeout(() => ratingEl.classList.remove('pop'), 500);
}

/* info: { avg (1..5), delta (Änderung dieses Spruchs) } */
export function updateRating(info) {
  if (!ratingEl || !info) return;
  const avg = Math.min(5, Math.max(1, Number(info.avg) || 0));
  ratingEl.querySelector('.rb-stars').style.setProperty('--p', (avg / 5 * 100) + '%');
  ratingEl.querySelector('.rb-num').textContent = avg.toFixed(1);
  const d = Number(info.delta) || 0;
  if (Math.abs(d) < 0.005) return;
  const abs = Math.abs(d);
  chip(ratingEl.querySelector('.rb-delta'), (d > 0 ? '+' : '-') + (abs < 0.05 ? abs.toFixed(2) : abs.toFixed(1)) + ' ★', d > 0, starTimer);
  popBar();
}

/* amount: aktuelles Geld, delta: Änderung (optional) */
export function updateMoney(amount, delta) {
  if (!ratingEl) return;
  ratingEl.querySelector('.rb-money').textContent = Math.round(amount) + ' €';
  const d = Number(delta) || 0;
  if (d === 0) return;
  chip(ratingEl.querySelector('.rb-mdelta'), (d > 0 ? '+' : '-') + Math.abs(Math.round(d)) + ' €', d > 0, moneyTimer);
  popBar();
}

/* ---------- Multiplayer: Name ---------- */
function cleanName(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/[<>&"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14);
}

function loadMpName() {
  try { return cleanName(localStorage.getItem(MP_NAME_KEY) || ''); } catch (e) { return ''; }
}

/* Liest den Namen aus dem Eingabefeld, merkt ihn sich und gibt ihn zurück */
export function getMpName() {
  const inp = $('mp-name');
  let n = cleanName(inp ? inp.value : '');
  if (!n) n = loadMpName();
  if (!n) n = 'Captain' + (10 + Math.floor(Math.random() * 90));
  try { localStorage.setItem(MP_NAME_KEY, n); } catch (e) { /* ignorieren */ }
  if (inp) inp.value = n;
  return n;
}

/* ---------- Multiplayer: Level-Wahl des Hosts ---------- */
export function getMpLevel() {
  let id = mpLevel;
  while (id > 1 && !levelUnlocked(id)) id--;
  return id;
}

function renderMpLevels() {
  $$('[data-mplevel]').forEach((b) => {
    const id = Number(b.getAttribute('data-mplevel'));
    const locked = !levelUnlocked(id);
    b.classList.toggle('on', getMpLevel() === id);
    b.textContent = (locked ? '🔒 ' : '') + t('level').toUpperCase() + ' ' + id;
    b.style.opacity = locked ? '.5' : '1';
  });
  const hint = $('mp-level-hint');
  if (hint) hint.textContent = t('lvl' + getMpLevel() + 'Name');
}

/* ---------- Multiplayer: Status-Anzeigen ---------- */
/* screen: 'host' | 'join' · kind: 'wait' | 'ok' | 'err' | undefined */
export function setMpStatus(screen, keyOrText, vars, kind) {
  const n = $(screen === 'join' ? 'mp-join-status' : 'mp-host-status');
  if (!n) return;
  n.textContent = (keyOrText && isKey(keyOrText)) ? t(keyOrText, vars) : (keyOrText || '');
  n.className = 'mp-status' + (kind ? ' ' + kind : '');
}

export function setMpHostCode(code) {
  const c = $('mp-code');
  if (c) c.textContent = code;
  setMpStatus('host', 'mpWaiting', null, 'wait');
}

function resetMpHostScreen() {
  const c = $('mp-code');
  if (c) c.textContent = '····';
  setMpStatus('host', 'mpCreating', null, 'wait');
  renderMpLevels();
}

/* ---------- Multiplayer: Leiste "DU: x € | Freund: y €" ---------- */
export function setMpBarActive(v, friendName) {
  mpBarOn = !!v;
  last.mp = null;
  if (mpBarOn) updateMpBar({ me: 0, friend: 0, name: friendName || 'Mitspieler' });
  syncMpBar();
}

/* info: { me, friend, name } */
export function updateMpBar(info) {
  if (!info) return;
  const me = Math.round(Number(info.me) || 0);
  const fr = Math.round(Number(info.friend) || 0);
  const name = cleanName(info.name) || 'Mitspieler';
  const key = settings.lang + '|' + me + '|' + fr + '|' + name;
  if (last.mp === key) return;
  last.mp = key;
  const meEl = $('mp-me'), frEl = $('mp-friend');
  if (!meEl || !frEl) return;
  meEl.textContent = t('mpYou') + ': ' + me + ' €';
  frEl.textContent = name + ': ' + fr + ' €';
  meEl.classList.toggle('lead', me > fr);
  frEl.classList.toggle('lead', fr > me);
}

/* ---------- Sprache anwenden ---------- */
export function applyLanguage() {
  document.documentElement.lang = settings.lang;
  $$('[data-i18n]').forEach((node) => { node.textContent = t(node.getAttribute('data-i18n')); });
  $$('[data-i18n-ph]').forEach((node) => { node.setAttribute('placeholder', t(node.getAttribute('data-i18n-ph'))); });
  $$('[data-lang]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-lang') === settings.lang));
  renderLevels();
  last.objKey = null;
  last.mp = null;
  if (ctrlOn) renderControlsOverlay();
  if (resultOpen && lastResult) renderResult(lastResult);
  if (cb.onLanguageChange) cb.onLanguageChange(settings.lang);
}

export function setLanguage(lang) {
  if (LANGS.indexOf(lang) === -1) return;
  settings.lang = lang;
  saveSettings();
  applyLanguage();
}
export function setLevel4Unlocked(v) {
  level4Unlocked = !!v;
  try { localStorage.setItem(LEVEL4_KEY, level4Unlocked ? 'true' : 'false'); } catch (e) {}
  renderLevels();
}
/* ---------- Level-Karten ---------- */
function renderLevels() {
  renderMpLevels();
  const list = $('level-list');
  if (!list) return;
  list.innerHTML = '';
  LEVELS.forEach((lv) => {
        if (lv.id === 4) { lv.playable = true; lv.nameKey = 'lvl4Name'; lv.descKey = 'lvl4Desc'; lv.lockedDescKey = 'lvl4LockedDesc'; lv.lockedToastKey = 'lvl4LockedToast'; }
    const open = lv.id === 4 ? level4Unlocked : levelOpen(lv);
    const btn = document.createElement('button');
    btn.className = 'level-card cut ' + (open ? 'playable' : 'locked');
    btn.type = 'button';
    btn.dataset.level = String(lv.id);

    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = open ? String(lv.id) : '🔒';

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = (lv.nameKey && lv.playable) ? (t('level') + ' ' + lv.id + ': ' + t(lv.nameKey)) : (t('level') + ' ' + lv.id);
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = open ? t(lv.descKey) : t(lv.lockedDescKey || lv.descKey);
    info.appendChild(name);
    info.appendChild(desc);

    const state = document.createElement('div');
    state.className = 'state';
    state.textContent = open ? t('playable') : t('locked');

    btn.appendChild(num);
    btn.appendChild(info);
    btn.appendChild(state);
    btn.addEventListener('click', () => {
      if (!levelOpen(lv)) {
        toast(lv.lockedToastKey ? t(lv.lockedToastKey) : t('lockedToast'));
        btn.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
          { duration: 260 }
        );
        return;
      }
      startLevel(lv.id);
    });
    list.appendChild(btn);
  });
}

/* ---------- Screens ---------- */
function showScreen(name) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  const active = $('screen-' + name);
  if (active) {
    const first = focusables()[0];
    if (first && lastInputWasPad) first.focus();
  }
}

function goTo(name) { stack.push(name); showScreen(name); }
function goBack() {
  const leaving = stack[stack.length - 1];
  if (stack.length > 1) stack.pop();
  showScreen(stack[stack.length - 1]);
  // Host-/Beitritts-Bildschirm verlassen -> Verbindung abbrechen
  if ((leaving === 'mphost' || leaving === 'mpjoin') && cb.onMpCancel) cb.onMpCancel();
}

export function showMenu(opts) {
  opts = opts || {};
  inGame = !!opts.inGame;
  menuOpen = true;
  stack = ['main'];
  hideControlsOverlay();
  $('menu').classList.remove('hidden');
  $('btn-resume').classList.toggle('hidden', !inGame);
  renderLevels();
  showScreen('main');
  syncRatingBar();
  startPadLoop();
}

export function hideMenu() {
  menuOpen = false;
  $('menu').classList.add('hidden');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  syncRatingBar();
}

/* Multiplayer-Start (von script.js): Menü zu, Spiel läuft */
export function enterGame() {
  hideMenu();
  inGame = true;
}

function startLevel(id) {
  const lv = LEVELS.find((l) => l.id === id);
    if (!lv || !(id === 4 ? level4Unlocked : levelOpen(lv))) return;
  hideMenu();
  inGame = true;
  if (cb.onStartLevel) cb.onStartLevel(id);
}

function toast(text) { showMessage(text, null, 1800); }

/* ---------- HUD ---------- */
export function setHUDVisible(v) {
  hudShown = !!v;
  $('hud').classList.toggle('hidden', !v);
  syncRatingBar();
}

export function setTouchVisible(v) { $('touch').classList.toggle('hidden', !v); }

/* Symbole der 3 Sehenswürdigkeiten im HUD
   (Level 1: ['🚢','💎','🐋'] · Level 2: ['🌉','💰','🦈'] · Level 3: ['🌋','🔬','👹']) */
export function setSightIcons(icons) {
  if (!icons) return;
  const nodes = (el && el.sights) ? el.sights : [$('sight-0'), $('sight-1'), $('sight-2')];
  nodes.forEach((c, i) => { if (c && icons[i]) c.textContent = icons[i]; });
}

export function showMessage(keyOrText, vars, ms) {
  const text = isKey(keyOrText) ? t(keyOrText, vars) : keyOrText;
  el.message.textContent = text;
  el.message.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => el.message.classList.remove('show'), ms || 3800);
}

export function setMode(key) {
  el.mode.textContent = t(key);
  el.mode.classList.add('show');
  clearTimeout(modeTimer);
  modeTimer = setTimeout(() => el.mode.classList.remove('show'), 2600);
}

/* Sanfter Treffer-Schimmer (kein hartes Blitzen) */
export function flash() {
  el.flash.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.flash.classList.remove('show'), 220);
}

/* Rausch-Timer (Tiefsee-Pillen): sekunden = Restzeit, null = ausblenden */
export function showHigh(seconds) {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    if (last.high !== null) { el.high.classList.add('hidden'); last.high = null; }
    return;
  }
  const s = Math.ceil(seconds);
  if (last.high === s) return;
  last.high = s;
  el.high.classList.remove('hidden');
  el.high.textContent = '😵‍💫 ' + s + ' s';
}

export function setButtonState(action, on) {
  const b = document.querySelector('.tbtn[data-act="' + action + '"]');
  if (b) b.classList.toggle('on', !!on);
}

export function setStandButtonLabel(standing) {
  const b = document.querySelector('.tbtn[data-act="stand"] em');
  if (b) b.textContent = t(standing ? 'btnSit' : 'btnStand');
}

/* state: { depth, o2 (0..1), sights ([b,b,b]), objective (key), objVars } */
export function updateHUD(s) {
  if (s.depth !== undefined) {
    const d = Math.max(0, Math.round(s.depth));
    if (last.depth !== d) { last.depth = d; el.depth.textContent = d; }
  }
  if (s.o2 !== undefined) {
    const p = Math.round(clamp01(s.o2) * 100);
    if (last.o2 !== p) {
      last.o2 = p;
      el.o2.style.width = p + '%';
      el.o2.classList.toggle('low', p < 25);
      el.o2t.textContent = p + '%';
    }
  }
  if (s.sights !== undefined) {
    const k = s.sights.map((b) => (b ? 1 : 0)).join('');
    if (last.sights !== k) {
      last.sights = k;
      el.sights.forEach((c, i) => c.classList.toggle('got', !!s.sights[i]));
      el.sightCount.textContent = s.sights.filter(Boolean).length + '/3';
    }
  }
  if (s.objective !== undefined) {
    const k = settings.lang + '|' + s.objective + '|' + JSON.stringify(s.objVars || {});
    if (last.objKey !== k) {
      last.objKey = k;
      el.objective.textContent = s.objective ? t(s.objective, s.objVars) : '';
    }
  }
}

/* ---------- Tour-Abrechnung mit Shop ---------- */
/* state: { rating, earned, money, owned: {golden, fog, flood}, newUnlock (0 | 2 | 3) } */
function renderResult(s) {
  const r = Math.min(5, Math.max(1, Number(s.rating) || 1));
  $('res-stars').style.setProperty('--p', (r / 5 * 100) + '%');
  $('res-num').textContent = r.toFixed(1);
  $('res-earned').textContent = '+' + Math.round(s.earned || 0) + ' €';
  $('res-wallet').textContent = Math.round(s.money || 0) + ' €';
  const lv = $('res-level');
  const ok = r >= 3.5;
  if (s.newUnlock) {
    lv.textContent = t(s.newUnlock === 3 ? 'resLevelNew3' : 'resLevelNew');
    lv.className = 'res-level ok';
  } else {
    lv.textContent = ok ? t('resLevelOk') : t('resLevelNo');
    lv.className = 'res-level ' + (ok ? 'ok' : 'no');
  }

  const list = $('shop-list');
  list.innerHTML = '';
  const owned = s.owned || {};
  UPGRADES.forEach((u) => {
    const has = !!owned[u.id];
    const can = !has && (s.money || 0) >= u.price;
    const row = document.createElement('div');
    row.className = 'shop-item' + (has ? ' owned' : '');
    const ic = document.createElement('div'); ic.className = 'ic'; ic.textContent = u.icon;
    const info = document.createElement('div'); info.className = 'info';
    const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = t(u.nameKey);
    const ds = document.createElement('div'); ds.className = 'desc'; ds.textContent = t(u.descKey);
    info.appendChild(nm); info.appendChild(ds);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'buy' + (can ? '' : (has ? ' got' : ' poor'));
    btn.textContent = has ? t('owned') : (t('buy') + ' · ' + u.price + ' €');
    btn.addEventListener('click', () => {
      if (has) return;
      if ((lastResult.money || 0) < u.price) {
        showResultToast(t('msgNoMoney'));
        btn.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 240 });
        return;
      }
      if (cb.onBuyUpgrade) cb.onBuyUpgrade(u.id);
    });
    row.appendChild(ic); row.appendChild(info); row.appendChild(btn);
    list.appendChild(row);
  });
}

let resToastTimer = 0;
function showResultToast(text) {
  const n = $('res-toast');
  n.textContent = text;
  n.classList.add('show');
  clearTimeout(resToastTimer);
  resToastTimer = setTimeout(() => n.classList.remove('show'), 1800);
}

export function showResult(state) {
  lastResult = Object.assign({}, state);
  resultOpen = true;
  hideControlsOverlay();
  renderResult(lastResult);
  $('result').classList.remove('hidden');
  syncRatingBar();
  startPadLoop();
}

/* Nach einem Kauf: neuen Stand anzeigen */
export function refreshResult(state) {
  if (!resultOpen) return;
  lastResult = Object.assign(lastResult || {}, state);
  renderResult(lastResult);
  if (state && state.bought) showResultToast(t('msgBought'));
}

export function hideResult() {
  resultOpen = false;
  $('result').classList.add('hidden');
  syncRatingBar();
}

/* ---------- Gamepad-Menüsteuerung ---------- */
let padRAF = 0;
let lastInputWasPad = false;
let padPrev = {};

function focusables() {
  const root = resultOpen ? $('result') : document.querySelector('.screen.active');
  if (!root) return [];
  return $$('button, input[type="range"], input[type="text"]', root).filter(
    (n) => !n.disabled && !n.classList.contains('disabled') && n.offsetParent !== null
  );
}

function padEdge(name, down) {
  const was = !!padPrev[name];
  padPrev[name] = down;
  return down && !was;
}

function padLoop() {
  padRAF = 0;
  if (!menuOpen && !resultOpen) return;
  padRAF = requestAnimationFrame(padLoop);

  const pads = (navigator.getGamepads ? navigator.getGamepads() : []) || [];
  let gp = null;
  for (let i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { gp = pads[i]; break; } }
  if (!gp) return;

  const ax0 = gp.axes[0] || 0;
  const ax1 = gp.axes[1] || 0;
  const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);

  const up = padEdge('up', ax1 < -0.6 || b(12));
  const down = padEdge('down', ax1 > 0.6 || b(13));
  const left = padEdge('left', ax0 < -0.6 || b(14));
  const right = padEdge('right', ax0 > 0.6 || b(15));
  const a = padEdge('a', b(0));
  const bb = padEdge('b', b(1));

  if (!(up || down || left || right || a || bb)) return;
  lastInputWasPad = true;

  const list = focusables();
  if (!list.length) return;
  let idx = list.indexOf(document.activeElement);

  if (up || down) {
    idx = idx < 0 ? 0 : (idx + (down ? 1 : -1) + list.length) % list.length;
    list[idx].focus();
  } else if (left || right) {
    const cur = document.activeElement;
    if (cur && cur.type === 'range') {
      const step = parseFloat(cur.step) || 0.1;
      const v = parseFloat(cur.value) + (right ? step : -step);
      cur.value = String(Math.min(parseFloat(cur.max), Math.max(parseFloat(cur.min), v)));
      cur.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (cur && cur.hasAttribute && cur.hasAttribute('data-lang')) {
      const sibs = $$('[data-lang]');
      const si = sibs.indexOf(cur);
      const next = sibs[(si + (right ? 1 : -1) + sibs.length) % sibs.length];
      next.focus();
    } else if (cur && cur.hasAttribute && cur.hasAttribute('data-mplevel')) {
      const sibs = $$('[data-mplevel]');
      const si = sibs.indexOf(cur);
      const next = sibs[(si + (right ? 1 : -1) + sibs.length) % sibs.length];
      next.focus();
    }
  } else if (a) {
    if (idx < 0) list[0].focus(); else list[idx].click();
  } else if (bb) {
    if (resultOpen) { if (cb.onResultMenu) cb.onResultMenu(); }
    else if (stack.length > 1) goBack();
    else if (inGame && cb.onResume) cb.onResume();
  }
}

function startPadLoop() {
  if (!padRAF) padRAF = requestAnimationFrame(padLoop);
}

/* ---------- Initialisierung ---------- */
export function initUI(callbacks) {
  cb = callbacks || {};

  el = {
    depth: $('hud-depth'),
    o2: $('hud-o2'),
    o2t: $('hud-o2-text'),
    sights: [$('sight-0'), $('sight-1'), $('sight-2')],
    sightCount: $('hud-sight-count'),
    objective: $('hud-objective'),
    mode: $('hud-mode'),
    message: $('hud-message'),
    flash: $('hud-flash'),
    high: $('hud-high')
  };
  last.high = null;

  initRatingBar();

  const nameInput = $('mp-name');
  const joinInput = $('mp-join-code');
  if (nameInput) nameInput.value = loadMpName();

  $('menu').addEventListener('click', (e) => {
    const mpl = e.target.closest('[data-mplevel]');
    if (mpl) {
      const id = Number(mpl.getAttribute('data-mplevel'));
      if (!levelUnlocked(id)) {
        const hint = $('mp-level-hint');
        if (hint) hint.textContent = t(id === 4 ? 'lvl4LockedToast' : (id === 3 ? 'mpl3Locked' : 'mpl2Locked'));
        clearTimeout(mpHintTimer);
        mpHintTimer = setTimeout(renderMpLevels, 2600);
        mpl.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
          { duration: 260 }
        );
        return;
      }
      mpLevel = id;
      renderMpLevels();
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go) { goTo(go.getAttribute('data-go')); return; }
    if (e.target.closest('[data-back]')) { goBack(); return; }
    const lang = e.target.closest('[data-lang]');
    if (lang) { setLanguage(lang.getAttribute('data-lang')); }
  });

  /* ----- Multiplayer-Buttons ----- */
  $('btn-mp-host').addEventListener('click', () => {
    const name = getMpName();
    goTo('mphost');
    resetMpHostScreen();
    if (cb.onMpHost) cb.onMpHost(name);
  });

  $('btn-mp-join').addEventListener('click', () => {
    getMpName();
    goTo('mpjoin');
    setMpStatus('join', '', null, '');
    joinInput.value = '';
    setTimeout(() => { try { joinInput.focus(); } catch (e) { /* ignorieren */ } }, 60);
  });

  joinInput.addEventListener('input', () => {
    joinInput.value = joinInput.value.replace(/\D/g, '').slice(0, 4);
  });
  joinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('btn-mp-go').click(); }
  });

  $('btn-mp-go').addEventListener('click', () => {
    const code = joinInput.value.replace(/\D/g, '');
    if (code.length !== 4) {
      setMpStatus('join', 'mpErrCode', null, 'err');
      joinInput.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
        { duration: 260 }
      );
      return;
    }
    const name = getMpName();
    try { joinInput.blur(); } catch (e) { /* ignorieren */ }
    if (cb.onMpJoin) cb.onMpJoin(name, code);
  });

  $('btn-resume').addEventListener('click', () => {
    hideMenu();
    if (cb.onResume) cb.onResume();
  });

  $('btn-menu').addEventListener('click', () => {
    if (cb.onOpenMenu) cb.onOpenMenu();
  });

  $('result-continue').addEventListener('click', () => {
    hideResult();
    if (cb.onResultContinue) cb.onResultContinue();
  });
  $('result-menu').addEventListener('click', () => {
    hideResult();
    if (cb.onResultMenu) cb.onResultMenu();
  });

  const slider = $('set-view');
  const sliderVal = $('set-view-val');
  slider.value = String(settings.view);
  sliderVal.textContent = Math.round(settings.view * 100) + '%';
  slider.addEventListener('input', () => {
    settings.view = parseFloat(slider.value);
    sliderVal.textContent = Math.round(settings.view * 100) + '%';
    saveSettings();
    if (cb.onSettingsChange) cb.onSettingsChange(settings);
  });

  window.addEventListener('keydown', (e) => {
    lastInputWasPad = false;
    if (e.code === 'Escape' && menuOpen) {
      if (stack.length > 1) goBack();
      else if (inGame && cb.onResume) { hideMenu(); cb.onResume(); }
      e.preventDefault();
    }
  });
  window.addEventListener('pointerdown', () => { lastInputWasPad = false; }, { passive: true });

  applyLanguage();
  showMenu({ inGame: false });
}
