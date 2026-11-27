// Wires the PetController to the Electron main process (see preload.js).
(function () {
  'use strict';
  const api = window.petAPI;
  const body = document.body;
  const root = document.getElementById('root');
  let clickable = false;
  let shell = null;

  // The window takes clicks while the pointer is over the pet or the open pill and cards.
  function setClickable(on) {
    if (on === clickable) return;
    clickable = on;
    api.setClickable(on);
  }

  const pet = new window.PetController(root, {
    setClickable(on) {
      body.classList.toggle('grab', on);
      if (shell) shell.petHover(on); else setClickable(on);
    },
    setAsleep(asleep) { api.setAsleep(asleep); },
    openThread() { api.openThread(); },
    frame() { if (shell) shell.frame(); },
  });

  shell = new window.T3Shell(root, pet, {
    setClickable,
    openApp() { api.openApp(); },
    openMenu() { api.openMenu(); },
    openCard(id) { api.openCard(id); },
    dismissCard(id) { api.dismissCard(id); },
    openLive() { api.openLive(); },
  });
  api.on('cards', (list) => shell.setCards(Array.isArray(list) ? list : []));

  api.on('display', (d) => pet.setBounds(d.width, d.height, d.reason));
  api.on('cursor', (c) => { pet.pointer(c.x, c.y); shell.pointer(c.x, c.y); });
  api.on('status', (s) => { pet.setStatus(s); shell.setLive(s && s.live); });
  api.on('paused', (p) => pet.setPaused(p));
  // A Petdex pet from the main process, or null for the built-in mascot. Anything wrong with a
  // pet leaves the built-in mascot. Only the latest choice counts if loads finish out of order.
  let petLoad = 0;
  api.on('pet', (info) => {
    const mine = ++petLoad;
    if (!info) { pet.setSheet(null); return; }
    window.T3Sheet.load(info).then((sheet) => {
      if (mine !== petLoad) return;
      if (sheet) pet.setSheet(sheet);
      else { console.log('[t3-pet] pet sheet could not be used; using the built-in mascot'); pet.setSheet(null); }
    });
  });
  api.on('command', (cmd) => {
    if (cmd === 'sleep') pet.sleepNow();
    else if (cmd === 'pet') pet.pet();
  });

  // While click-through, Electron still forwards mouse moves to us, which makes hover snappy.
  window.addEventListener('mousemove', (e) => { pet.pointer(e.clientX, e.clientY); shell.pointer(e.clientX, e.clientY); });
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || shell.el.contains(e.target)) return; // the pill's own buttons
    pet.pointer(e.clientX, e.clientY);
    if (pet.pointerDown()) { body.classList.add('grabbing'); shell.hide(); }
  });
  window.addEventListener('mouseup', () => { pet.pointerUp(); body.classList.remove('grabbing'); });
  window.addEventListener('blur', () => { pet.pointerUp(); body.classList.remove('grabbing'); });

  api.ready();
})();
