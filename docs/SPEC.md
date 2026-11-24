# T3 desktop pet: future implementation notes

Written 24/11/2026. Goal: a desktop pet for T3 Code that matches the polish of the Codex / ChatGPT desktop pet.

## Decision so far

- Fork `kausthubh-coder/t3-pet` (MIT, plain Electron JS, no build step, tested on Windows 11). It already follows T3 itself, so it knows which thread each task belongs to.
- Do not fork Petdex. Its status comes from agent hooks, which cannot say which T3 thread a task belongs to. Its desktop app is also Zig.
- Reuse the Petdex / Codex pet format so the whole gallery works: folder with `pet.json` + `spritesheet.webp|png`, 8x9 grid of 192x208 px frames, nine state rows (`idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`). A v2 8x11 grid adds two rows.
- Test pet already installed: `~/.petdex/pets/boba`.

## Reference UI (Codex / ChatGPT desktop pet, screenshots from the user)

Mascot floats on the desktop with no window chrome. A dark rounded bar sits under it, and the bar changes with state.

1. **Idle:** mascot only, plus a small pill with two icons: compose (new chat) and voice.
2. **Compose open:** the pill expands into an input ("Start new chat") with a `+` button on the left and a send arrow on the right. The mascot's pose and facing change while you type.
3. **Working:** the mascot holds a laptop. The pill has three icons: compose, voice and a chevron. A status card below shows the thread title in bold with "Thinking" underneath.
4. **Working, card hovered:** a close (x) badge appears on the card's corner. The card gains a "send follow-up" arrow and a stop button.
5. **Done:** the mascot looks happy (eyes closed in a smile) and the laptop is gone. The card shows a green tick, the title, then a one-line snippet of the answer, truncated with an ellipsis.

## Behaviours the user wants

- Different animations for different activity: idle, generating, and distinct tool-call types.
- Eyes or head follow the cursor across the screen.
- Status card with thread title, state, and a short result snippet.
- Click the card to open that chat in T3 (needs a way to open a given thread; not yet found).
- Quick actions on the pill: new chat, voice, expand/collapse.
- Stop a running task and send a follow-up from the card.

## Design decisions and ideas added 24/11/2026 (from the user)

- **Cards for completed threads only.** Report a thread only when its run completes (also failed, probably). No live "Thinking" card per running thread. The pet's own animation shows that something is running.
- **Floating cards under the pet, stacked.** Several completed threads stack. When hovering over the cards, arrow keys (default) rifle through the stack. The keybinds must be customisable in settings.
- **Pill states (screenshots):**
  - Idle, not hovered: the pet alone, no pill.
  - Hovered: a dark pill with compose, voice and a bell with a green count badge when there are unread completions.
  - Expanded: the pill shows a chevron, and the card sits under it with a green tick, bold title, a dot, then a truncated snippet of the answer.
- **Look:** frosted-glass cards styled like T3 Code's own themes. The settings screen gets the same style. Read T3's theme tokens (colours, blur, radius) so the pet follows the active theme. Draw the cards and pill as HTML/CSS and use an icon library (candidates to check for licence and bundle size: Lucide, Phosphor, Tabler).
- **Head and gaze tracking.** Inside a hover radius around the pet, the head turns and the eyes follow the cursor. The method the user described: many still frames (head angles), compute the angle from the sprite's centre to the cursor, and show the matching frame. Outside the radius, the pet returns to its normal idle. Needs a pet with gaze frames, so the Petdex 9-row format alone is not enough. A reference video is attached to the thread (not viewed by me).
- **No fixed one-second polling.** See the data-source options below.

### Data source options (for the card events)

1. **T3 server WebSocket** (`orchestration.subscribeShell` / `subscribeThread`): events are pushed when runs change, and it's a public API instead of private tables. Costs: pairing, and an Effect RPC client (not yet checked how hard that is without the Effect libraries).
2. **Watch the database file** with `fs.watch` and query only when it changes. No pairing, no fixed tick, but still private tables. Unverified: whether T3's database uses a write-ahead log, which decides where to watch.
3. **Poll every second** (current). The cost is tiny (one small read-only query), so the real objection is coupling to private tables, not speed.

Plan: put the source behind one small interface (`onRunCompleted(handler)`), start with option 2 or 3, move to option 1 when ready.

Card data needed per completed run: `run_id`, `thread_id`, thread title, completion time, status, and a snippet of the last assistant message (from `orchestration_v2_projection_messages`; columns not yet checked).

## Open questions

- Does T3's server expose a stable local API for thread status and events? This is better than polling `~/.t3/userdata/statev2.sqlite`, which is T3's private storage and may change layout in any update.
- Is there a URL or route that opens a specific thread in the T3 desktop app?
- Can the pet send a message or stop a run through the API, or is it status-only?
- Cursor tracking: Electron has `screen.getCursorScreenPoint()`, which works without a visible window under the cursor. Eye direction would need extra sprite frames, since the Petdex format has no gaze rows.
- Per-tool-call animations need more states than the nine Petdex rows. Options: reuse `running` with a small icon overlay, or define extra rows (like v2).

## T3 server API findings (24/11/2026, from a read-only pass over the default branch; partly unverified)

- **Transport:** Effect RPC over WebSocket, not REST. Default port 3773 (`apps/server/src/config.ts:30`), socket at `ws://<host>:3773/ws?...`.
- **Auth:** bearer or DPoP access token, session cookie, plus a `wsTicket` minted over authenticated HTTP (`apps/server/src/auth/http.ts`). Pairing uses a one-time link or code from `t3 pair` (`docs/user/remote-access.md:112-133`). No local no-auth mode found, so the pet needs a pairing step.
- **Live status:** RPC methods `orchestration.subscribeThread` and `orchestration.subscribeShell` (`packages/contracts/src/orchestrationV2.ts:4112-4113`). Titles via `orchestration.getThreadTitles`. Events include `run.created`, `run.updated`, `message.updated`. The exact status enum values are not confirmed.
- **Send and stop:** one method, `orchestration.dispatchCommand` (`orchestrationV2.ts:4093`), with command types `message.dispatch`, `run.interrupt`, `thread.stop`. Force stop: `orchestration.forceStopThread`. The input wrapper schema is not confirmed.
- **Deep links (updated 24/11/2026):** `t3code://threads/<environmentId>/<threadId>` is parsed by `promptLinks.ts:209-223` (`THREAD_PATH`) and forwarded to the thread via `openAppLink` and `webLinks.receive` in the desktop app. Dev builds use `t3code-dev://`. Web routes: `/$environmentId/$threadId` and `/threads/$environmentId/$threadId`. **Confirmed by the user on 24/11/2026:** typing a `t3code://threads/<environmentId>/<threadId>` link in Win+R opens that thread directly in the desktop app, with no browser. (An `https://` link opens the hosted landing page in the browser instead; the pet must not use that form.) **Environment ID:** the local one is a plain-text UUID in `~/.t3/userdata/environment-id` (found 24/11/2026; the `userdata` folder also holds secrets, so read only that one file). **Thread ID:** `thread_id` in the `projection_threads` table of `statev2.sqlite` (columns include `title`, `archived_at`, `deleted_at`, `pending_approval_count`, `pending_user_input_count`; status is in `projection_thread_sessions`). Unverified: whether ids with unusual characters break the `[^/]+` match (UUIDs should be fine). Mobile builds the same path with `encodeURIComponent`, so URL-encode both ids.
- **Bind address:** default host is not pinned to 127.0.0.1 (falls back to a private-network listener, `config.ts:91`). Check what the desktop app actually listens on before relying on it.

Net effect: stop and follow-up look possible through the API. Click-to-open still depends on a thread route that may not exist. The API is sturdier than the SQLite file but needs pairing and a WebSocket client.

## t3-pet code map (read 24/11/2026 via GitHub raw files; repo not cloned because shell access was timing out)

- **Polling:** `src/status/t3-status.js` opens `~/.t3/userdata/statev2.sqlite` read-only with `node:sqlite` every 1 s, with a child-process fallback. `src/status/queries.js` queries the v2 tables `orchestration_v2_projection_runs`, `..._runtime_requests` and `..._threads`. (My earlier note naming `projection_threads` was the older v1 table.)
- **Status shape:** one global object `{ state, title, count, key }`, chosen by priority waiting > error > done > working > idle. The thread ID is only inside `key` for working and waiting, and the queries do select `thread_id`, so exposing it per thread is a small change.
- **Window:** `src/main.js` makes one frameless, transparent, always-on-top, non-focusable overlay covering the cursor's display. Click-through is on, and the renderer turns it off over the pet via the `clickable` IPC channel. Main already sends cursor position to the renderer at about 30 Hz (`cursor` channel), so cursor-following eyes need no new plumbing. `shell` is not imported anywhere.
- **Renderer:** `src/renderer/pet.js` draws on canvases (pet 64x80, shadow, bubble) using code-drawn sprites from `src/shared/sprite.js` and animations from `src/shared/anims.js`. It handles hover, drag, throw and physics itself. Click handling goes in `pointerUp()` (quick-click branch); the bubble is canvas-drawn by `S.renderBubble`.
- **Implication:** keep the physics and window code. Replace `S.drawPet` with a spritesheet draw (Petdex format). Rebuild the bubble as an HTML/CSS card in `src/renderer/index.html` and `overlay.js` for the ChatGPT look. Add `shell.openExternal` plus an IPC channel for click-to-open.

## Rough build order

1. Check T3's API for status events and thread links (decides whether click-to-open and stop/send are possible).
2. Sprite loader for the Petdex format.
3. Map T3 states onto the nine rows.
4. Status card and pill UI, styled after the reference above.
5. Click-to-open, stop and follow-up.
6. Cursor tracking and tool-specific animations.
