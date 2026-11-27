// The pill and card stack that hang off the pet (see src/shared/overlay-shell.js for the states
// and placement, and design/ for the look). Built with createElement only, never innerHTML.
// The stack slot holds the cards (cards.js), or a short note when there are none.
(function () {
  'use strict';
  const L = window.T3OverlayShell;
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

  // host: { setClickable(on), openApp(), openMenu(), openCard(id), dismissCard(id) }.
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

      this.el = document.createElement('div');
      this.el.className = 't3-shell';
      this.el.dataset.state = 'idle';

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
      this.pill.append(this.openBtn, sep(), this.bellBtn, sep(), this.gearBtn);

      this.stack = document.createElement('div');
      this.stack.className = 't3-shell__stack';
      this.empty = document.createElement('p');
      this.empty.className = 't3-shell__empty';
      this.empty.textContent = 'No completed threads yet';
      this.stack.appendChild(this.empty);
      this.stack.dataset.empty = '';
      this.cards = new window.T3CardStack(this.stack, {
        open: (id) => this.host.openCard(id),
        dismiss: (id) => this.host.dismissCard(id),
        changed: () => {
          const empty = this.cards.length === 0;
          this.empty.hidden = !empty;
          this.stack.toggleAttribute('data-empty', empty);
          this.place();
        },
      });

      this.el.append(this.pill, this.stack);
      root.appendChild(this.el);

      this.openBtn.addEventListener('click', () => this.host.openApp());
      this.bellBtn.addEventListener('click', () => this.set('toggle'));
      this.gearBtn.addEventListener('click', () => this.host.openMenu());
    }

    // ---- inputs ------------------------------------------------------------------------
    petHover(on) { this.overPet = !!on; this.update(); }

    pointer(x, y) {
      if (this.state === 'idle') return;
      const over = L.contains(this.el.getBoundingClientRect(), x, y, 4);
      if (over !== this.overShell) { this.overShell = over; this.update(); }
    }

    hide() { this.set('hide'); }

    // list: cards from the main process, newest first. The badge counts the unread ones.
    setCards(list) {
      this.cards.set(list);
      this.setUnread(list.filter((c) => !c.read).length);
    }

    setUnread(n) {
      this.unread = Math.max(0, n | 0);
      this.badge.textContent = this.unread > 99 ? '99+' : String(this.unread);
      this.badge.hidden = this.unread === 0;
      this.labelBell();
    }

    // The pet calls this after each frame it draws, so the shell follows it while it settles.
    frame() { if (this.state !== 'idle') this.place(); }

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
      this.host.setClickable(this.overPet || (this.state !== 'idle' && this.overShell));
    }

    set(event) {
      const next = L.nextState(this.state, event);
      if (next === this.state) return;
      this.state = next;
      if (next === 'idle') {
        this.overShell = false;
        clearTimeout(this.leaveTimer); this.leaveTimer = 0;
        this.host.setClickable(this.overPet);
      }
      this.el.dataset.state = next;
      this.bellBtn.setAttribute('aria-expanded', String(next === 'expanded'));
      this.labelBell();
      this.pet.setHold(next !== 'idle');
      this.place();
    }

    labelBell() {
      const open = this.state === 'expanded';
      const label = open ? 'Hide completed threads'
        : this.unread ? `Show ${this.unread} completed thread${this.unread === 1 ? '' : 's'}` : 'Show completed threads';
      this.bellBtn.setAttribute('aria-label', label);
      this.bellBtn.title = label;
      // The chevron points the way the stack folds: towards the pill.
      const id = !open ? 'bell' : this.el.dataset.side === 'above' ? 'chevron-down' : 'chevron-up';
      this.bellBtn.querySelector('use').setAttribute('href', `#i-${id}`);
    }

    place() {
      if (this.state === 'idle') return;
      const box = this.pet.petBox();
      const p = L.place({
        box, w: this.pet.w, h: this.pet.h,
        width: this.el.offsetWidth, height: this.el.offsetHeight, reserve: this.reserve(),
      });
      if (this.el.dataset.side !== p.side) { this.el.dataset.side = p.side; this.labelBell(); }
      this.el.style.transform = `translate3d(${Math.round(p.left)}px,${Math.round(p.top)}px,0)`;
    }

    // Height when expanded: pill, gap, a full deck of cards and the n / total control.
    reserve() {
      const css = getComputedStyle(this.el);
      const num = (name, fallback) => parseFloat(css.getPropertyValue(name)) || fallback;
      return num('--pill-height', 38) + 12 + num('--card-height', 64) + 3 * num('--stack-step-y', 7) + 8 + 30;
    }
  }

  window.T3Shell = Shell;
})();
