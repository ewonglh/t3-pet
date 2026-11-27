# T3 Pet overlay: design notes

Files: `tokens.css` (all colours, radii, blur, spacing, motion), `pet.css` (pet, pill, card, stack), `pet-ui.html` (states, card anatomy, live stack demo), `settings.html`. Plain HTML/CSS/vanilla JS, no build step, no network at runtime. Screenshots (`pet-ui-*.png`, `settings-*.png`, `context-menu.png`) are local only: they are git-ignored and not part of the committed design.

## Direction

One idea: the pet is the anchor and everything else hangs off it. The pet never moves when the pill or cards appear; the pill sits directly under it, the stack under the pill. The memorable part is the stack (depth by offset, scale and fade). Everything else is T3's own quiet look, so the pet feels like part of T3 rather than a skin.

## Token source

Light and dark only (plus Match system). Colours come from T3's built-in palettes, `packages/shared/src/themePalettes.ts` in `pingdotgg/t3code` (`T3_CODE_LIGHT_THEME_COLORS`, `T3_CODE_DARK_THEME_COLORS`), read-only via `gh api` on 24/11/2026. Imported and custom T3 themes are out of scope.

| Token | Source |
|---|---|
| `--background` | palette `canvas` (#fcfcfc light, #0a0a0a dark) |
| `--foreground` | palette `text` |
| `--card`, `--popover` | palette `surface`, `surfaceOverlay` (#ffffff light, #111111 dark) |
| `--primary`, `--ring` | palette `accent` (#1b4ed8 light, #346bf1 dark) |
| `--border`, `--input` | palette `border`, `input` |
| `--muted`, `--accent` | palette `muted`, `accentSurface` |
| `--error`, `--error-foreground` | palette `error`, `errorForeground` |
| `--success`, `--success-foreground` | `apps/web/src/index.css` (emerald; the palettes have no success role) |
| Glass blur, opacity, saturation, radius scale, font stack | `apps/web/src/index.css` |
| Card, chip and menu surfaces, shadows, stack and motion numbers | mine, derived from the tokens above |

Two deliberate departures, both for legibility on glass: `--muted-foreground` is zinc-600 (light) and #a3a3a3 (dark) instead of the palette's #71717b and #818181; and `--card-border` is a translucent white or black edge rather than the palette `border`, which is nearly invisible over a wallpaper. The old true-black dark canvas from `index.css` is replaced by the palette's #0a0a0a. `tokens.css` re-derives the glass tokens on any element with `data-theme`, so a light and a dark panel can sit on one page.

## Approximated or my own

- `--radius-card` 12px (T3 xl), `--glass-opacity-card` 88%, shadows and highlights, stack depth steps and durations were tuned by eye.
- Wallpapers are CSS gradients, stand-ins for a desktop. Placeholder pet is the first idle frame of `~/.petdex/pets/boba/spritesheet.webp`, copied to `assets/boba-spritesheet.webp`. Sprout, Ember and Pebble in settings are Boba with CSS filters, for layout only.
- The pill follows the theme. Bell becomes a chevron when expanded, so the badge is replaced by the "2 / 4" indicator.

## Behaviour

- Placement (decided in #10, revised in #48): the pill and stack sit under the pet when there is room and above it otherwise. The front card sits next to the pet and the rest grows away from it: above the pet the cards behind peek upwards and the pill is on top; below it they peek downwards and the pill is at the bottom. With gravity on the pet stands on the bottom edge, so in practice they sit above. The side is picked using the expanded height, so expanding never flips it. While they are open the pet stops following the cursor. The speech bubble is gone (#48): the front card shows at rest instead. They close 350 ms after the pointer leaves both the pet and the shell, and when the pet is picked up. The mockups show the "under" case.
- Until the settings window exists (v0.4.0), the gear opens the tray menu. With no completed threads, the expanded stack shows "No completed threads yet" in a pill (not in the mockups).
- Cards: completed (green tick) or failed (red). Front card shows the dismiss badge (top-left, as in the reference) and swaps the time for "Open" on hover or focus. The whole card opens the thread (`t3code://threads/<environmentId>/<threadId>`, ids URL-encoded).
- Stack: front card plus up to three behind, 7px apart (deck, not fan). Down moves to older cards, Up back. A card already passed lifts away; clicking a peeking card brings it forward. The indicator is a pill with two keycaps (the arrow hints, also clickable) and "n / total". Keys follow a focus-on-hover model: while the pointer is over the stack (or the n / total control), the overlay takes focus and Up and Down step through cards; on leave it releases focus. A "keys active" cue shows when this is live: the n / total control gets a primary-coloured outline and a small dot (`data-keys="on"`). Keybinds are read from one `KEYS` object, which settings overwrites.
- Settings is its own window with a title bar and window controls. Navigation is a left sidebar with a search field on top: General, Pets, Cards, Keyboard, Appearance, About (About at the bottom), each with a Lucide icon; a vertical tab list (Up, Down, Home, End). General: launch at login, check interval (1 s, 5 s or 30 s; default 1 s), open chats in (read-only note). Pets: picker (radio group, arrow keys), head tracking, hover radius with live preview. Cards: failed runs, provider and project, stack size, auto-remove. Keyboard: four rebindable keys with a capture field (Esc cancels, conflicts refused, reset arrow). Appearance: Match system, Light or Dark, motion. About: version, pet format, icon licence.

## Motion

Tokens: `--dur-move` 240ms, `--dur-fade` 160ms, `--dur-fast` 120ms, `--ease-out` `cubic-bezier(.2,.8,.2,1)`. Cards animate only `transform` and `opacity`. Enter: from 10px above at 98%. Exit: fade and lift 6px. Shuffle: the same transitions as depth changes. Reduced motion (OS setting, or `data-motion="reduce"` on the root): movement durations go to 0ms and only 120ms fades remain. The pill and badge have no entrance animation.

## Accessibility

Contrast, computed for the worst plausible case (88% card or pill over a mid-tone wallpaper): light title and pill icons 16:1, light snippet 7.1:1 (zinc-500 would be 4.5:1), dark title and pill icons 15:1, dark snippet 6.6:1. The pill uses the same foreground and glass as the cards, so it has the same numbers. Badge: a circle with no ring, sitting inside the pill's edge. Light: white on emerald-700, 5.5:1 for the number and for the circle against the white pill (emerald-400 would be 1.9:1 there). Dark: dark text on emerald-400, 7.9:1 for the number and 9.8:1 against the dark pill. Status icons use T3's `-foreground` green and red (the plain green is 2.3:1 on a light card). Settings: the sidebar section label under search results uses `--sidebar-muted-foreground` (4.6:1 on the light sidebar). Control edges that carry meaning (switch off track, key-capture border, selected sidebar row) use `--border-strong`, about 3.2:1 to 3.8:1 against their surroundings, instead of the faint palette borders (about 1.0 to 1.7:1). Not checked: very bright or very busy wallpapers; the glass is dense (88%) to cover this, but test with real desktops.

Focus: every control shows a two-tone ring (background gap, then primary), and the same ring inside the pill (it follows the theme). Never colour-only: status has an icon and an accessible name ("Completed", "Failed"). Keyboard: Tab reaches the pill, the front card and its dismiss button; Up/Down (rebindable) browse; Enter opens; Delete or Esc dismisses; back cards are `aria-hidden` and untabbable. The "n / total" count is a polite live region with the thread title and status. Pet picker and polling choice are radio groups with arrow keys; toggles are `role="switch"`. Because the overlay window is non-focusable in the current t3-pet, keyboard focus needs a decision (open question).

## Open questions

1. Overlay focus: the focus-on-hover model needs the overlay window to become focusable while the pointer is over the stack and to release focus on leave. Check this does not steal typing focus from T3 mid-sentence (consider only taking focus after a short hover delay).
2. Compose state (input pill from the reference) is not designed here.
3. How the pet learns T3's light or dark choice when set to Match T3 is open; "Match system" is drawn, since that needs no link to T3.
4. The "Switch pet" submenu is not drawn; it would reuse the menu styles.

## What changed in revision 2

Small tweaks only; structure, glass look and T3 tokens are unchanged.
- Tighter deck: 7px offset per layer, scale step 0.02, opacity step 0.22, shuffle travel 10px, three layers behind the front card (four in all). Tokens: `--stack-step-y`, `--stack-step-scale`, `--stack-step-fade`, `--stack-travel`.
- Voice button removed. The compose button is now "Open T3 Code" (Lucide external-link). Pill is now open + bell (expanded: open + chevron).
- Cards show a quiet second line: provider (Claude or Codex), then project name; failed cards lead it with "Failed" in red. Toggle in settings ("Show provider and project").
- Differences from the reference: 1.75px icon strokes, 12px card radius (T3 xl), 38px pill, 13px title with 12.5px snippet and 11px meta and time, 14px card padding.
- The pill was dark in both themes in this revision; part 2 below supersedes that, and it now follows the theme.

### Revision 2, part 2 (direction from the user)
- Settings is a real window (title bar, controls) with section navigation and six panes (the sidebar moved to the left in revision 3); the settings content was regrouped into them. A gear in the pill opens it.
- Right-click menu on the pet or pill, in light and dark, built from the card tokens. This was the revision 2 list (it also had Go to sleep / Wake); revision 3 below has the current 7 items. One row shows the keyboard-focus state (inset ring). The menu is keyboard operable (Up, Down, Enter).
- Pill now follows the theme (answers the earlier open question about a dark pill). Its tokens derive from the card tokens, and the badge ring and dismiss badge follow the theme too.
- Expand and collapse is kept as in the first version (scaled-back direction): the bell shows the unread count; clicking it swaps it for a chevron that collapses the stack, and the count moves to the n / total control. A gear sits beside it.
- Themes: light and dark plus Match system; custom and imported theme wording removed. Colours now come from T3's built-in palettes (table above).
- Focus-on-hover keyboard model with a "keys active" cue on the n / total control.

## What changed in revision 3

- Context menu: "Hide for 1 hour" and "Go to sleep" removed (7 items now: Open T3 Code, Mark all read, Pet it, Pause pet / Resume, Switch pet, Settings, Quit). The pet already falls asleep by itself after 30 seconds of inactivity, so Pause is the only switch.
- Check interval: the "Live" option and all wording about live or push updates are gone. The control offers 1 s, 5 s and 30 s, default 1 s. Helper text describes only how soon cards appear.
- Settings navigation moved to the left, matching T3's own settings sidebar (read from `apps/web/src/components/settings/SettingsSidebarNav.tsx` and `components/ui/sidebar.tsx` in `pingdotgg/t3code`, read-only, 24/11/2026).
  - Matched: 240px sidebar with a right border; 8px padding; 32px rows with 8px icon gap and 16px icons in the muted icon colour; selected row uses the `sidebarRowSelected` fill and medium weight with the icon turning to the foreground colour; hover uses `sidebarRowHover`; pressed uses `sidebarRowActive`; inset 2px focus ring; search field is a 32px row with a search icon, "Search" placeholder, a "/" key hint that becomes a clear (x) button while typing; results replace the section list as a listbox with icon, title and section name (40px minimum row); empty state is centred small muted text; `/` focuses the search, Up, Down, Enter and Esc work inside it.
  - Tokens: the eight `sidebar*` roles from T3's palettes (`sidebar`, `sidebarForeground`, `sidebarMutedForeground`, `sidebarRowHover`, `sidebarRowActive`, `sidebarRowSelected`, `sidebarBorder`, plus the icon colour, which T3 sets to the muted foreground).
  - Not matched: T3's collapsed icon rail below the `md` breakpoint (this window becomes a top strip when narrow); its section group headings; its account footer.
  - Mine: matched text is marked, and opening a result shows the section with the row outlined in the primary colour. Empty state reads "No settings match".
- Screenshots added: `settings-search-light.png` (query "card", second result opened, row highlighted) and `settings-search-empty-dark.png`. `context-menu.png` is re-captured for the 7-item menu.

### Revision 3 review fixes
- Card text is never parsed as HTML: cards are built with `createElement`, `textContent` and `setAttribute` (a title containing a quote cannot break the dismiss button's `aria-label`). Safe to lift into the Electron renderer.
- Focus follows the front card: when focus is inside the stack, Down, Up and Delete move it to the new front card, so Enter always acts on the visible card. With only the pointer over the stack, Enter opens the front card.
- Settings search highlighting uses one combined pattern over the raw text, with each piece escaped, so queries such as "show a", "pet a" and "ar" cannot break the markup.
- The check-interval and theme controls are radio groups with a single Tab stop and arrow-key selection, sharing one helper with the pet picker.
- Pet tiles use `span`s inside their buttons (valid HTML). Leftover unused icon, comments and a no-op loop removed.

## Keyboard: test commands

The bottom of the Keyboard section has a **Test commands** group: a switch (off by default) and one rebindable shortcut per command that forces a status (live, idle, working, waiting, done, error). The shortcut buttons are disabled while the switch is off. These are global shortcuts meant for trying the pet without a live T3 task, so they are opt-in and kept apart from the card keys. See issue #17.


## Badge (revised in #10)

The count badge is a circle (a capsule for two or more digits) with no ring, replacing the earlier rounded square with a ring in the pill colour. It sits just inside the pill's edge, so the pill is its only background, and its colour changes with the theme to keep contrast without an outline: white on emerald-700 in light, dark on emerald-400 in dark.

## Stack navigation (revised in #11)

The separate "n / total" pill under the deck is gone. Once the bell is pressed, the card arrows and "n / total" join the right end of the action pill, after a divider, and the pill stays centred over the cards. Arrows are pill buttons with 15px icons; a disabled arrow fades to 35%. The gap between the pill and the deck is 4px (it was 12px): the peeking edges already separate them. Together these take the open shell from 145px to 127px tall. Two alternatives were mocked and set aside: a vertical pill to the right of the deck (about 40px wider) and dismiss-style chips on the deck's right edge (small targets, crowded against "Open"). Scrolling over the open shell also steps through the cards.
