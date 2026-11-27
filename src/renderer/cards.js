// The completed-thread card stack, ported from the demo in design/pet-ui.html. Cards are built
// with createElement and textContent only, so thread text is never parsed as HTML. The main
// process owns the list; this draws it and reports clicks by run id.
(function () {
  'use strict';
  const V = window.T3CardView;
  const SVG = 'http://www.w3.org/2000/svg';
  const TICK_MS = 30 * 1000; // how often relative times refresh

  function mk(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(id, cls) {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('class', cls ? `icon ${cls}` : 'icon');
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(SVG, 'use');
    u.setAttribute('href', `#i-${id}`);
    s.appendChild(u);
    return s;
  }

  // host: { open(id), dismiss(id), changed() } — changed() after the stack's size may have moved.
  class CardStack {
    constructor(slot, host) {
      this.host = host;
      this.cards = []; // { id, el, data }
      this.cur = 0;

      this.root = mk('div', 'stack');
      this.root.setAttribute('role', 'list');
      this.root.setAttribute('aria-label', 'Completed threads');
      this.nav = mk('div', 'stack-nav');
      this.nav.setAttribute('role', 'group');
      this.nav.setAttribute('aria-label', 'Browse completed threads');
      this.prevBtn = this.keycap('prev', 'Previous card', 'arrow-up');
      this.count = mk('span', 'stack-nav__count');
      this.count.setAttribute('aria-live', 'polite');
      this.nextBtn = this.keycap('next', 'Next card', 'arrow-down');
      this.nav.append(this.prevBtn, this.count, this.nextBtn);
      slot.append(this.root, this.nav);

      this.nav.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (b) this.go(this.cur + (b.dataset.act === 'next' ? 1 : -1));
      });
      this.root.addEventListener('click', (e) => {
        const el = e.target.closest('.card');
        const i = this.cards.findIndex((c) => c.el === el);
        if (i < 0) return;
        if (e.target.closest('.card__dismiss')) this.dismiss(i);
        else if (i === this.cur) this.host.open(this.cards[i].id);
        else if (i > this.cur) this.go(i); // a card peeking out behind comes to the front
      });
      setInterval(() => this.tick(), TICK_MS);
    }

    keycap(act, label, iconId) {
      const b = mk('button', 'keycap');
      b.type = 'button';
      b.dataset.act = act;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.append(icon(iconId));
      return b;
    }

    get length() { return this.cards.length; }

    // list: [{ id, title, status, completedAt, snippet, read }], newest first.
    set(list) {
      const oldIds = this.cards.map((c) => c.id);
      const byId = new Map(this.cards.map((c) => [c.id, c]));
      const first = this.cards.length === 0;
      const next = list.map((data) => {
        const have = byId.get(data.id);
        if (have) { byId.delete(data.id); have.data = data; return have; }
        const el = this.make(data);
        if (!first) el.dataset.d = 'enter';
        return { id: data.id, el, data };
      });
      for (const gone of byId.values()) this.leave(gone.el);
      this.cur = V.keepFront(oldIds, next.map((c) => c.id), this.cur);
      this.cards = next;
      // A new card arriving goes to the front, so it is seen.
      if (next.length && !oldIds.includes(next[0].id) && !first) this.cur = 0;
      for (const c of next) if (!c.el.isConnected) this.root.appendChild(c.el);
      void this.root.offsetWidth; // commit the entering state before animating to the real one
      this.render();
    }

    make(t) {
      const li = mk('div', 'card');
      li.setAttribute('role', 'listitem');
      li.dataset.status = t.status === 'failed' ? 'failed' : 'done';
      const main = mk('button', 'card__main');
      main.type = 'button';
      const failed = t.status === 'failed';
      const st = icon(failed ? 'circle-x' : 'circle-check', 'card__status');
      st.removeAttribute('aria-hidden');
      st.setAttribute('role', 'img');
      st.setAttribute('aria-label', failed ? 'Failed' : 'Completed');
      const body = mk('span', 'card__body');
      const line = mk('span', 'card__line');
      // Title, then (failed runs) a red label, then the snippet, flowing over up to two lines.
      // Provider and project are not in the data yet, so there is no meta line.
      line.append(mk('span', 'card__title', t.title));
      if (failed) {
        const label = mk('span', 'is-failed', 'Failed');
        label.setAttribute('aria-hidden', 'true'); // the status icon already says it
        line.append(label);
      }
      if (t.snippet) line.append(mk('span', 'card__snippet', t.snippet));
      body.append(line);
      const end = mk('span', 'card__end');
      const open = mk('span', 'card__open', 'Open ');
      open.append(icon('arrow-up-right'));
      end.append(mk('span', 'card__time', V.relTime(t.completedAt, Date.now())), open);
      main.append(st, body, end);
      const dis = mk('button', 'card__dismiss');
      dis.type = 'button';
      dis.setAttribute('aria-label', `Dismiss ${t.title}`);
      dis.append(icon('x'));
      li.append(main, dis);
      return li;
    }

    render() {
      const n = this.cards.length;
      this.cards.forEach((c, i) => {
        c.el.dataset.d = V.depth(i, this.cur);
        const front = i === this.cur;
        c.el.setAttribute('aria-hidden', front ? 'false' : 'true');
        c.el.querySelector('.card__main').tabIndex = front ? 0 : -1;
        c.el.querySelector('.card__dismiss').tabIndex = front ? 0 : -1;
      });
      const front = this.cards[this.cur];
      this.count.textContent = n ? `${this.cur + 1} / ${n}` : '0 / 0';
      if (front) this.count.setAttribute('aria-label', `Card ${this.cur + 1} of ${n}: ${front.data.title}, ${front.data.status}`);
      this.nav.hidden = n < 2;
      this.prevBtn.disabled = this.cur <= 0;
      this.nextBtn.disabled = this.cur >= n - 1;
      this.host.changed();
    }

    go(i) {
      const n = this.cards.length;
      if (!n) return;
      const to = Math.max(0, Math.min(n - 1, i));
      if (to === this.cur) return;
      this.cur = to;
      this.render();
    }

    // Removed straight away here; the main process confirms with a new list.
    dismiss(i) {
      const [c] = this.cards.splice(i, 1);
      if (!c) return;
      if (i < this.cur) this.cur -= 1;
      this.cur = Math.max(0, Math.min(this.cur, this.cards.length - 1));
      this.leave(c.el);
      this.render();
      this.host.dismiss(c.id);
    }

    leave(el) {
      el.dataset.d = 'leaving';
      el.querySelector('.card__main').tabIndex = -1;
      setTimeout(() => el.remove(), 300);
    }

    tick() {
      const now = Date.now();
      for (const c of this.cards) c.el.querySelector('.card__time').textContent = V.relTime(c.data.completedAt, now);
    }
  }

  window.T3CardStack = CardStack;
})();
