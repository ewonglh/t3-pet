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

  // host: { open(id), dismiss(id), changed() } — changed() after the front card, the count or the
  // stack's size may have moved. The arrows and "n / total" live in the pill (shell.js), which
  // reads `cur`, `length` and `front` and calls `go` or `step`.
  class CardStack {
    constructor(slot, host) {
      this.host = host;
      this.cards = []; // { id, el, data }
      this.cur = 0;

      this.root = mk('div', 'stack');
      this.root.setAttribute('role', 'list');
      this.root.setAttribute('aria-label', 'Threads');
      slot.append(this.root);

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

    get length() { return this.cards.length; }
    get front() { return this.cards[this.cur] ? this.cards[this.cur].data : null; }

    // list: [{ id, title, status, completedAt, snippet, read, thread }], newest first, with an
    // optional live card in front ({ id: 'live', live: true, state, title, more, thread }; see
    // T3CardView.withLive).
    set(list) {
      const oldIds = this.cards.map((c) => c.id);
      const byId = new Map(this.cards.map((c) => [c.id, c]));
      const first = this.cards.length === 0;
      // The live card turns into its thread's completed card in place: when it goes and a new card
      // for the same thread arrives, that card takes over the live card's element.
      const was = byId.get(V.LIVE_ID);
      if (was && was.data.thread && !list.some((d) => d.id === V.LIVE_ID && d.thread === was.data.thread)) {
        const done = list.find((d) => !d.live && d.thread === was.data.thread && !byId.has(d.id));
        if (done) { byId.delete(V.LIVE_ID); byId.set(done.id, was); was.id = done.id; }
      }
      const next = list.map((data) => {
        const have = byId.get(data.id);
        if (have) {
          byId.delete(data.id);
          if (JSON.stringify(have.data) !== JSON.stringify(data)) this.fill(have.el, data);
          have.data = data;
          return have;
        }
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
      this.fill(li, t);
      return li;
    }

    // (Re)builds a card's contents, so one element can change from live to completed in place.
    fill(li, t) {
      const live = !!t.live;
      const failed = !live && t.status === 'failed';
      const waiting = live && t.state === 'waiting';
      li.dataset.status = live ? (waiting ? 'waiting' : 'working') : failed ? 'failed' : 'done';
      li.toggleAttribute('data-live', live);
      // A forced state from the tray has no thread: nothing to open.
      if (live && !t.thread) li.setAttribute('aria-disabled', 'true'); else li.removeAttribute('aria-disabled');

      const main = mk('button', 'card__main');
      main.type = 'button';
      const label = live ? (waiting ? 'Needs your input' : 'Working') : failed ? 'Failed' : 'Completed';
      const st = icon(live ? (waiting ? 'circle-alert' : 'loader-circle') : failed ? 'circle-x' : 'circle-check', 'card__status');
      st.removeAttribute('aria-hidden');
      st.setAttribute('role', 'img');
      st.setAttribute('aria-label', label);
      const body = mk('span', 'card__body');
      const line = mk('span', 'card__line');
      // Title, then a status word (live) or red label (failed), then the snippet, flowing over up
      // to two lines. Provider and project are not in the data yet, so there is no meta line.
      if (t.title) line.append(mk('span', 'card__title', t.title));
      if (live) {
        const word = mk('span', 'is-live', waiting ? 'Needs your input' : 'Working…');
        word.setAttribute('aria-hidden', 'true'); // the status icon already says it
        line.append(word);
        if (t.more) line.append(mk('span', 'is-more', `+${t.more} more`));
      } else if (failed) {
        const tag = mk('span', 'is-failed', 'Failed');
        tag.setAttribute('aria-hidden', 'true');
        line.append(tag);
      }
      if (!live && t.snippet) line.append(mk('span', 'card__snippet', t.snippet));
      body.append(line);
      const end = mk('span', 'card__end');
      const open = mk('span', 'card__open', 'Open ');
      open.append(icon('arrow-up-right'));
      end.append(mk('span', 'card__time', live ? '' : V.relTime(t.completedAt, Date.now())), open);
      main.append(st, body, end);
      li.replaceChildren(main);
      if (!live) { // live cards go away by themselves
        const dis = mk('button', 'card__dismiss');
        dis.type = 'button';
        dis.setAttribute('aria-label', `Dismiss ${t.title}`);
        dis.append(icon('x'));
        li.append(dis);
      }
    }

    render() {
      this.cards.forEach((c, i) => {
        c.el.dataset.d = V.depth(i, this.cur);
        const front = i === this.cur;
        c.el.setAttribute('aria-hidden', front ? 'false' : 'true');
        for (const b of c.el.querySelectorAll('button')) b.tabIndex = front ? 0 : -1;
      });
      this.host.changed();
    }

    step(d) { this.go(this.cur + d); }

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
      for (const c of this.cards) {
        if (!c.data.live) c.el.querySelector('.card__time').textContent = V.relTime(c.data.completedAt, now);
      }
    }
  }

  window.T3CardStack = CardStack;
})();
