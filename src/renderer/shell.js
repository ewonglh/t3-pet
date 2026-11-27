// The pill and card stack that hang off the pet (see src/shared/overlay-shell.js for the states
// and placement, and design/ for the look). Built with createElement only, never innerHTML.
// The stack slot holds the cards (cards.js), or a short note when there are none. The front card
// sits next to the pet; the peeking cards and the pill grow away from it. While a thread is
// running or a card is unread, the front card shows on its own without hovering (the "rest"
// view), in place of the speech bubble the pet used to draw.
(function () {
  'use strict';
  const L = window.T3OverlayShell;
  const V = window.T3CardView;
  const SVG = 'http://www.w3.org/2000/svg';

  function icon(id) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG, 'use');
    use.setAttribute('href', `#i-${id}`);
    svg.appendChild(use);
    return svg;
  }

  function button(label, iconId) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill__btn';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.appendChild(icon(iconId));
    return b;
  }

  const sep = () => {
    const s = document.createElement('span');
    s.className = 'pill__sep';
    s.setAttribute('aria-hidden', 'true');
    return s;
  };

  const HANDOFF_MS = 2500; // how long a finished live card waits for its completed card

  // host: { setClickable(on), openApp(), openMenu(), openCard(id), dismissCard(id), openLive() }.
  // pet: the PetController.
  class Shell {
    constructor(root, pet, host) {
      this.pet = pet;
      this.host = host;
      this.state = 'idle';
      this.overPet = false;
      this.overShell = false;
      this.leaveTimer = 0;
      this.unread = 0;
      this.view = 'none';
      this.list = []; // completed cards from the main process
      this.live = null; // the live card, or null
      this.ending = null; // { live, ids, timer }: a live card waiting to turn into its completed card

      this.el = document.createElement('div');
      this.el.className = 't3-shell';
      this.el.dataset.state = 'idle';
      this.el.dataset.view = 'none';

      this.pill = document.createElement('div');
      this.pill.className = 'pill';
      this.pill.setAttribute('role', 'toolbar');
      this.pill.setAttribute('aria-label', 'Pet actions');
      this.openBtn = button('Open T3 Code', 'external-link');
      this.bellBtn = button('Show completed threads', 'bell');
      this.bellBtn.setAttribute('aria-expanded', 'false');
      this.badge = document.createElement('span');
      this.badge.className = 'pill__badge';
      this.badge.setAttribute('aria-hidden', 'true');
      this.badge.hidden = true;
      this.bellBtn.appendChild(this.badge);
      this.gearBtn = button('Settings', 'settings');
      // Card arrows and "n / total": shown in the pill only while the stack is open (shell.css)
      // and there are two or more cards, so they cost no height of their own.
      this.nav = document.createElement('span');
      this.nav.className = 'pill__nav';
      this.nav.setAttribute('role', 'group');
      this.nav.setAttribute('aria-label', 'Browse completed threads');
      this.prevBtn = button('Previous card', 'arrow-up');
      this.count = document.createElement('span');
      this.count.className = 'pill__count';
      this.count.setAttribute('aria-live', 'polite');
      this.nextBtn = button('Next card', 'arrow-down');
      this.nav.append(sep(), this.prevBtn, this.count, this.nextBtn);
      this.nav.hidden = true;
      this.pill.append(this.openBtn, sep(), this.bellBtn, sep(), this.gearBtn, this.nav);

      this.stack = document.createElement('div');
      this.stack.className = 't3-shell__stack';
      this.empty = document.createElement('p');
      this.empty.className = 't3-shell__empty';
      this.empty.textContent = 'No completed threads yet';
      this.stack.appendChild(this.empty);
      this.stack.dataset.empty = '';
      this.cards = new window.T3CardStack(this.stack, {
        open: (id) => {
          if (id !== V.LIVE_ID) this.host.openCard(id);
          else if (this.cards.front && this.cards.front.thread) this.host.openLive();
        },
        dismiss: (id) => this.host.dismissCard(id),
        changed: () => {
          const empty = this.cards.length === 0;
          this.empty.hidden = !empty;
          this.stack.toggleAttribute('data-empty', empty);
          this.renderNav();
          this.place();
        },
      });

      this.el.append(this.stack, this.pill); // stack first: next to the pet (column-reverse above it)
      root.appendChild(this.el);

      this.openBtn.addEventListener('click', () => this.host.openApp());
      this.bellBtn.addEventListener('click', () => this.set('toggle'));
      this.gearBtn.addEventListener('click', () => this.host.openMenu());
      this.prevBtn.addEventListener('click', () => this.cards.step(-1));
      this.nextBtn.addEventListener('click', () => this.cards.step(1));
      // Scrolling anywhere over the open shell steps through the cards; down goes to older ones.
      const wheel = V.wheelStepper();
      this.el.addEventListener('wheel', (e) => {
        if (this.state !== 'expanded' || this.cards.length < 2) return;
        const d = wheel(e.deltaY, e.deltaMode, e.timeStamp);
        if (d) this.cards.step(d);
      }, { passive: true });
    }

    // ---- inputs ------------------------------------------------------------------------
    petHover(on) { this.overPet = !!on; this.update(); }

    pointer(x, y) {
      if (this.view === 'none') return;
      // At rest only the front card is there to hover; the hidden pill and peeking edges are not.
      const front = this.view === 'rest' && this.cards.cards[this.cards.cur];
      const rect = (front ? front.el : this.el).getBoundingClientRect();
      const over = L.contains(rect, x, y, 4);
      if (over !== this.overShell) { this.overShell = over; this.update(); }
    }

    hide() { this.set('hide'); }

    // list: cards from the main process, newest first. The badge counts the unread ones.
    setCards(list) {
      this.list = list;
      const e = this.ending;
      if (e && list.some((c) => c.thread === e.live.thread && !e.ids.has(c.id))) this.endHandoff(); // it arrived
      this.setUnread(list.filter((c) => !c.read).length);
      this.refresh();
    }

    // live: { state, title, more, thread } or null, from the status.
    setLive(live) {
      const prev = this.live;
      this.live = live || null;
      if (this.live) this.endHandoff();
      else if (prev && prev.thread && !this.ending) {
        // The run finished: keep its card up until the completed card arrives, so one turns into
        // the other in place (cards.js) rather than one leaving and another arriving.
        const ids = new Set(this.list.filter((c) => c.thread === prev.thread).map((c) => c.id));
        this.ending = { live: prev, ids, timer: setTimeout(() => { this.ending = null; this.refresh(); }, HANDOFF_MS) };
      }
      this.refresh();
    }

    endHandoff() {
      if (!this.ending) return;
      clearTimeout(this.ending.timer);
      this.ending = null;
    }

    refresh() {
      this.cards.set(V.withLive(this.list, this.live || (this.ending && this.ending.live)));
      this.updateView();
    }

    setUnread(n) {
      this.unread = Math.max(0, n | 0);
      this.badge.textContent = this.unread > 99 ? '99+' : String(this.unread);
      this.badge.hidden = this.unread === 0;
      this.labelBell();
    }

    // The pet calls this after each frame it draws, so the shell follows it while it settles.
    frame() { this.updateView(); if (this.view !== 'none') this.place(); }

    // ---- internals ---------------------------------------------------------------------
    update() {
      const over = this.overPet || this.overShell;
      if (this.pet.drag) {
        this.set('hide'); // being carried: no pill until the pointer comes back
      } else if (over) {
        clearTimeout(this.leaveTimer); this.leaveTimer = 0;
        this.set('enter');
      } else if (this.state !== 'idle' && !this.leaveTimer) {
        this.leaveTimer = setTimeout(() => { this.leaveTimer = 0; this.set('leave'); }, L.LEAVE_MS);
      }
      this.host.setClickable(this.overPet || (this.view !== 'none' && this.overShell));
    }

    peek() { return !!(this.live || this.ending) || this.unread > 0; }

    set(event) {
      const next = L.nextState(this.state, event, { peek: this.peek() });
      if (next === this.state) return;
      this.state = next;
      if (next === 'idle') {
        this.overShell = false;
        clearTimeout(this.leaveTimer); this.leaveTimer = 0;
      }
      this.el.dataset.state = next;
      this.bellBtn.setAttribute('aria-expanded', String(next === 'expanded'));
      this.labelBell();
      this.pet.setHold(next !== 'idle');
      this.updateView();
      this.place();
    }

    // What shows follows from the state, whether anything is running or unread, and dragging.
    updateView() {
      const view = L.view(this.state, { peek: this.peek(), drag: !!this.pet.drag });
      if (view === this.view) return;
      this.view = view;
      this.el.dataset.view = view;
      if (view === 'rest') this.cards.go(0); // at rest, the newest card is the one that shows
      if (view === 'none') this.overShell = false;
      this.host.setClickable(this.overPet || (view !== 'none' && this.overShell));
      this.place();
    }

    labelBell() {
      const open = this.state === 'expanded';
      const label = open ? 'Hide completed threads'
        : this.unread ? `Show ${this.unread} completed thread${this.unread === 1 ? '' : 's'}` : 'Show completed threads';
      this.bellBtn.setAttribute('aria-label', label);
      this.bellBtn.title = label;
      // The chevron points the way the stack folds: towards the pet, away from the pill.
      const id = !open ? 'bell' : this.el.dataset.side === 'above' ? 'chevron-down' : 'chevron-up';
      this.bellBtn.querySelector('use').setAttribute('href', `#i-${id}`);
    }

    renderNav() {
      const n = this.cards.length;
      const cur = this.cards.cur;
      const front = this.cards.front;
      this.nav.hidden = n < 2;
      this.count.textContent = `${cur + 1} / ${n}`;
      const what = front && (front.live ? (front.state === 'waiting' ? 'needs your input' : 'working') : front.status);
      if (front) this.count.setAttribute('aria-label', `Card ${cur + 1} of ${n}: ${front.title || 'untitled'}, ${what}`);
      this.prevBtn.disabled = cur <= 0;
      this.nextBtn.disabled = cur >= n - 1;
    }

    place() {
      if (this.view === 'none') return;
      const box = this.pet.petBox(true);
      const p = L.place({
        box, w: this.pet.w, h: this.pet.h,
        width: this.el.offsetWidth, height: this.el.offsetHeight, reserve: this.reserve(),
      });
      if (this.el.dataset.side !== p.side) { this.el.dataset.side = p.side; this.labelBell(); }
      this.el.style.transform = `translate3d(${Math.round(p.left)}px,${Math.round(p.top)}px,0)`;
    }

    // Height when expanded: pill, gap, and the deck (front card plus the peeking edges). The card
    // arrows are in the pill, so they add nothing. The rest view keeps this box (pill and edges
    // hidden), so the front card does not move when hovering adds them.
    reserve() {
      const css = getComputedStyle(this.el);
      const num = (name, fallback) => parseFloat(css.getPropertyValue(name)) || fallback;
      return num('--pill-height', 38) + (parseFloat(css.rowGap) || 4) + num('--card-height', 64) + 3 * num('--stack-step-y', 7);
    }
  }

  window.T3Shell = Shell;
})();
