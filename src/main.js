// T3 desktop pet: one transparent, click-through, always-on-top window over the work area of
// the display the cursor is on. The renderer draws and animates the pet; this process feeds it
// the cursor position and T3 Code's status, and owns the tray menu and the demo hotkeys.
'use strict';
const path = require('node:path');
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, globalShortcut, shell } = require('electron');
const { createStatusSource } = require('./status');
const { readEnvironmentId } = require('./status/environment');
const { trayImage } = require('./main/icon');
const { buildThreadLink } = require('./main/thread-link');
const { resolvePet, listPets } = require('./main/pets');
const { readSettings, writeSettings } = require('./main/settings');
const { createCardStore } = require('./main/cards');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const TEST_KEYS = process.env.T3PET_TEST_KEYS === '1';
const FORCED_FLASH_MS = 6000; // forced done/error behave like the real thing, then go idle
const STATES = ['idle', 'working', 'waiting', 'done', 'error'];
const LABELS = { idle: 'Idle', working: 'Working', waiting: 'Waiting on you', done: 'Done', error: 'Error' };

let win = null;
let tray = null;
let t3 = null;
let ready = false;
let displayId = null;
let workArea = null;
let lastCursor = { x: NaN, y: NaN };
let asleep = false;
let paused = false;
let live = null; // status from the DB, or null when there is none
let forced = null; // status forced by a hotkey / tray
let forcedTimer = null;
let lastSent = '';
let cursorTimer = null;

function send(channel, data) {
  if (win && !win.isDestroyed() && ready) win.webContents.send(channel, data);
}

// ---- window -------------------------------------------------------------------------------
function createWindow() {
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  displayId = d.id;
  workArea = { ...d.workArea };
  win = new BrowserWindow({
    ...workArea,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    show: false,
    title: 'T3 Pet',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  win.on('closed', () => { win = null; });
  win.webContents.on('render-process-gone', () => { ready = false; if (win) win.reload(); });
}

function sendDisplay(reason) {
  send('display', { width: workArea.width, height: workArea.height, reason });
}

// Keep the window on the display the cursor is on.
function syncDisplay(p, reason) {
  const d = screen.getDisplayNearestPoint(p);
  const wa = d.workArea;
  const changed = d.id !== displayId;
  const resized = !changed && (wa.x !== workArea.x || wa.y !== workArea.y || wa.width !== workArea.width || wa.height !== workArea.height);
  if (!changed && !resized) return;
  displayId = d.id;
  workArea = { ...wa };
  win.setBounds(workArea);
  sendDisplay(changed ? 'switch' : reason || 'resize');
}

// Poll the cursor: ~30 Hz while awake, 4 Hz while the pet sleeps. Only send when it moved.
function pollCursor() {
  cursorTimer = null;
  if (!win || win.isDestroyed()) return;
  const p = screen.getCursorScreenPoint();
  syncDisplay(p);
  const x = p.x - workArea.x, y = p.y - workArea.y;
  if (x !== lastCursor.x || y !== lastCursor.y) {
    lastCursor = { x, y };
    send('cursor', lastCursor);
  }
  cursorTimer = setTimeout(pollCursor, asleep ? 250 : 33);
}

// ---- status -------------------------------------------------------------------------------
function effectiveStatus() {
  return forced || live || { state: 'idle', title: '', key: 'idle' };
}

function pushStatus() {
  const s = effectiveStatus();
  const k = JSON.stringify(s);
  if (k !== lastSent) {
    lastSent = k;
    send('status', s);
    updateTray();
  }
}

function demoTitle() {
  return (t3 && t3.latestTitle) || 'Add a T3 Code Screen Pet';
}

function force(state) {
  clearTimeout(forcedTimer);
  if (state == null) {
    forced = null;
  } else {
    forced = { state, title: state === 'idle' ? '' : demoTitle(), key: `forced:${state}:${Date.now()}`, forced: true };
    if (state === 'done' || state === 'error') {
      forcedTimer = setTimeout(() => {
        forced = { state: 'idle', title: '', key: 'forced:idle', forced: true };
        pushStatus();
      }, FORCED_FLASH_MS);
    }
  }
  pushStatus();
}

// ---- tray + hotkeys -----------------------------------------------------------------------
function updateTray() {
  if (!tray) return;
  const s = effectiveStatus();
  const mode = t3 ? t3.mode : 'demo';
  const source = forced ? (TEST_KEYS ? 'Forced state (Ctrl+Alt+0 for live)' : 'Forced state (choose Live T3 status to undo)')
    : mode === 'live' ? 'Live: reading T3 Code state'
    : mode === 'error' ? 'T3 database unreadable, retrying'
    : 'Demo mode: no T3 database found';
  const head = `T3: ${LABELS[s.state] || s.state}${s.title ? ` — ${s.title}` : ''}`;
  tray.setToolTip(head.length > 120 ? head.slice(0, 117) + '…' : head);
  const radio = (label, state, key) => ({
    label: TEST_KEYS ? `${label}\tCtrl+Alt+${key}` : label, type: 'radio',
    checked: state === null ? !forced : !!forced && forced.state === state,
    click: () => force(state),
  });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: head.length > 60 ? head.slice(0, 59) + '…' : head, enabled: false },
    { label: source, enabled: false },
    { type: 'separator' },
    { label: 'Pause following', type: 'checkbox', checked: paused, click: (i) => { paused = i.checked; send('paused', paused); } },
    { label: 'Pet it', click: () => send('command', 'pet') },
    { label: 'Go to sleep', click: () => send('command', 'sleep') },
    {
      label: 'Pet',
      submenu: [
        { label: 'Built-in mascot', type: 'radio', checked: !chosenPet, click: () => choosePet(null) },
        { type: 'separator' },
        ...(installedPets.length
          ? installedPets.map((p) => ({ label: p.name, type: 'radio', checked: chosenKey === p.key, click: () => choosePet(p.key) }))
          : [{ label: 'No pets found in ~/.petdex/pets or ~/.codex/pets', enabled: false }]),
      ],
    },
    {
      label: 'State',
      submenu: [
        radio('Live T3 status', null, 0),
        { type: 'separator' },
        ...STATES.map((st, i) => radio(LABELS[st], st, i + 1)),
      ],
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

// Testing aid, off by default: global shortcuts clash with other tools. Opt in with
// T3PET_TEST_KEYS=1. The tray State submenu forces states without them. Rebinding and a toggle
// arrive with the settings window (#17, "Test commands" section of Keyboard).
function registerHotkeys() {
  if (!TEST_KEYS) return;
  const keys = { 0: null, 1: 'idle', 2: 'working', 3: 'waiting', 4: 'done', 5: 'error' };
  for (const [k, state] of Object.entries(keys)) {
    const ok = globalShortcut.register(`Control+Alt+${k}`, () => force(state));
    if (!ok) console.log(`[t3-pet] could not register Ctrl+Alt+${k} (in use by another app?)`);
  }
}

// ---- open thread --------------------------------------------------------------------------
// Opens a thread in the T3 Code desktop app. Thread ids come from our own status or card list,
// never from the renderer (it sends a run id, which is looked up here). Forced (hotkey) statuses
// have none.
const linkScheme = () => process.env.T3PET_SCHEME || 't3code'; // t3code-dev for a dev build of T3 Code

function openThreadId(threadId) {
  const link = buildThreadLink({ scheme: linkScheme(), environmentId: readEnvironmentId(), threadId });
  if (!link) {
    console.log('[t3-pet] nothing to open: no thread for this status, or no environment id');
    return false;
  }
  shell.openExternal(link).catch((err) => console.log(`[t3-pet] could not open the thread link: ${err.message}`));
  return true;
}

function openThread() { openThreadId(effectiveStatus().threadId); }

// ---- cards --------------------------------------------------------------------------------
// Completed runs shown as cards under the pet. See src/main/cards.js and docs/cards.md.
let cards = null;
let cardsQueued = false;
function sendCards() {
  if (cardsQueued || !cards) return;
  cardsQueued = true; // a burst of runs at start-up goes out as one update
  setImmediate(() => { cardsQueued = false; send('cards', cards.view()); });
}
function openCard(runId) {
  const card = cards && cards.get(runId);
  if (!card) return;
  if (openThreadId(card.threadId) && cards.markRead(runId)) sendCards();
}
function dismissCard(runId) {
  if (cards && cards.dismiss(runId)) sendCards();
}

// Brings up the T3 Code desktop app (the pill's "Open T3 Code" button) through its own scheme.
function openApp() {
  shell.openExternal(`${linkScheme()}://`).catch((err) => console.log(`[t3-pet] could not open T3 Code: ${err.message}`));
}

// Rescan for newly installed pets whenever the menu is about to be used.
function rescanPets() { installedPets = listPets(); updateTray(); }

// ---- pet ----------------------------------------------------------------------------------
// A Petdex/Codex pet: picked in the tray Pet menu (remembered in settings.json), or given with
// T3PET_PET (a folder name from ~/.petdex/pets or ~/.codex/pets, or a folder path), which wins at
// start-up. No pet, or an invalid one: the renderer shows the built-in mascot.
function loadPet(spec) {
  if (!spec) return null;
  const pet = resolvePet(spec);
  if (!pet.ok) {
    console.log(`[t3-pet] pet "${spec}" not used: ${pet.reason}`);
    return null;
  }
  console.log(`[t3-pet] pet: ${pet.name} (${pet.rows} rows)`);
  for (const w of pet.warnings) console.log(`[t3-pet] pet.json: ${w}`);
  return { name: pet.name, rows: pet.rows, fps: pet.fps, dataUrl: `data:${pet.mime};base64,${pet.bytes.toString('base64')}` };
}
let chosenPet = null;
let chosenKey = null; // folder name of the pet in use, or null for the built-in mascot
let installedPets = [];
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function choosePet(key) {
  const info = key ? loadPet(key) : null;
  chosenPet = info;
  chosenKey = info ? key : null;
  if (!writeSettings(settingsFile(), { pet: chosenKey })) console.log('[t3-pet] could not save the pet choice; it lasts until you quit');
  send('pet', chosenPet);
  updateTray();
}

// ---- ipc ----------------------------------------------------------------------------------
ipcMain.on('open-thread', (e) => {
  if (win && e.sender === win.webContents) openThread();
});
ipcMain.on('card-open', (e, runId) => {
  if (win && e.sender === win.webContents && typeof runId === 'string') openCard(runId);
});
ipcMain.on('card-dismiss', (e, runId) => {
  if (win && e.sender === win.webContents && typeof runId === 'string') dismissCard(runId);
});
ipcMain.on('open-app', (e) => {
  if (win && e.sender === win.webContents) openApp();
});
// The pill's gear opens the tray menu until the settings window exists (v0.4.0).
ipcMain.on('open-menu', (e) => {
  if (!win || e.sender !== win.webContents || !tray) return;
  rescanPets();
  tray.popUpContextMenu();
});
ipcMain.on('clickable', (e, on) => {
  if (win && e.sender === win.webContents) win.setIgnoreMouseEvents(!on, { forward: true });
});
ipcMain.on('asleep', (_e, v) => {
  asleep = !!v;
  if (!asleep && cursorTimer) { clearTimeout(cursorTimer); pollCursor(); }
});
ipcMain.on('ready', (e) => {
  if (!win || e.sender !== win.webContents) return;
  ready = true;
  lastSent = '';
  lastCursor = { x: NaN, y: NaN };
  sendDisplay('init');
  send('paused', paused);
  if (chosenPet) send('pet', chosenPet);
  pushStatus();
  sendCards();
});

// ---- app ----------------------------------------------------------------------------------
app.on('second-instance', () => send('command', 'pet'));

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('dev.t3.pet');
  if (process.platform === 'darwin' && app.dock) app.dock.hide();

  const spec = process.env.T3PET_PET || readSettings(settingsFile()).pet;
  chosenPet = loadPet(spec);
  chosenKey = chosenPet && /^[\w.-]+$/.test(spec) ? spec : null; // a folder path is not in the menu
  installedPets = listPets();
  cards = createCardStore({ file: path.join(app.getPath('userData'), 'cards.json') });
  createWindow();
  tray = new Tray(trayImage());
  tray.on('click', () => { rescanPets(); tray.popUpContextMenu(); });
  tray.on('right-click', rescanPets);
  registerHotkeys();

  t3 = createStatusSource({ log: (m) => console.log(m) });
  t3.onActivityChange((s) => { live = s && s.state !== 'idle' ? s : null; pushStatus(); });
  t3.onRunCompleted((run) => { if (cards.add(run)) sendCards(); });
  t3.onModeChange(() => updateTray());
  t3.start();
  updateTray();

  const resync = () => { if (win) syncDisplay(screen.getCursorScreenPoint(), 'resize'); };
  screen.on('display-metrics-changed', resync);
  screen.on('display-added', resync);
  screen.on('display-removed', resync);

  pollCursor();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (t3) t3.stop();
});
app.on('window-all-closed', () => app.quit());
