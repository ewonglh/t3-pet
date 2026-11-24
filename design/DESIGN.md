# T3 Pet overlay: design notes

Files: `tokens.css` (all colours, radii, blur, spacing, motion), `pet.css` (pet, pill, card, stack), `pet-ui.html` (states, card anatomy, live stack demo), `settings.html`. Plain HTML/CSS/vanilla JS, no build step, no network at runtime. Screenshots: `pet-ui-light.png`, `pet-ui-dark.png`, `settings-light.png`, `settings-dark.png`.

## Direction

One idea: the pet is the anchor and everything else hangs off it. The pet never moves when the pill or cards appear; the pill sits directly under it, the stack under the pill. The memorable part is the stack (depth by offset, scale and fade). Everything else is T3's own quiet look, so the pet feels like part of T3 rather than a skin.

## Token source

Read from `pingdotgg/t3code`, `apps/web/src/index.css` (default branch, 24/11/2026), via `gh api`, read-only. Copied from there: `--radius` 0.5rem and the sm/md/lg/xl steps, `--glass-blur` 12px (16px in dark), `--glass-saturation` 1.14 (1.08 dark), `--glass-opacity` 80%, the light and dark neutral, border, input, primary (`oklch(0.488 0.217 264)` light, `0.571` dark), success and error values, and the font stack (`Inter Variable`, system fallbacks). T3 itself also supports imported VS Code themes through `--app-theme-*` variables; this design uses only the built-in light and dark. `~/.t3/userdata/settings.json` has no theme keys, so the active theme is not read from it; the real pet should read it from T3 (open question below).

## Approximated or my own

- `--radius-card` 14px, `--glass-opacity-card` 88%, card shadows and highlights, pill colours, stack depth steps, durations: derived by eye from the reference screenshots.
- `--muted-foreground` is zinc-600 in light, not T3's zinc-500, for legibility on glass (see contrast).
- Pill is dark in both themes (matches the reference and stays readable on any wallpaper). Cards follow the theme.
- Wallpapers are CSS gradients, stand-ins for a desktop. Placeholder pet is the first idle frame of `~/.petdex/pets/boba/spritesheet.webp`, copied to `assets/boba-spritesheet.webp`. Sprout, Ember and Pebble in settings are Boba with CSS filters, for layout only.
- Bell becomes a chevron when expanded, so the badge is replaced by the "2 / 4" indicator. This is my reading of the reference; confirm.

## Behaviour

- Cards: completed (green tick) or failed (red). Front card shows the dismiss badge (top-left, as in the reference) and swaps the time for "Open" on hover or focus. The whole card opens the thread (`t3code://threads/<environmentId>/<threadId>`, ids URL-encoded).
- Stack: front card plus up to three behind. Down moves to older cards, Up back. A card already passed lifts away; clicking a peeking card brings it forward. The indicator is a pill with two keycaps (the arrow hints, also clickable) and "n / total". Keys work while hovering or when focus is inside the stack. Keybinds are read from one `KEYS` object, which settings overwrites.
- Settings: pet picker (radio group, arrow keys), failed-run toggle, stack size, auto-remove, "Open chats in" (read-only note), four rebindable keys with capture field (Esc cancels, conflicts are refused with a message, reset arrow), head-tracking toggle with hover radius slider and live preview, follow T3 theme, check interval (Live, 1 s, 5 s, 30 s), launch at login.

## Motion

Tokens: `--dur-move` 240ms, `--dur-fade` 160ms, `--dur-fast` 120ms, `--ease-out` `cubic-bezier(.2,.8,.2,1)`. Cards animate only `transform` and `opacity`. Enter: from 12px above at 96%. Exit: fade and lift 8px. Shuffle: the same transitions as depth changes. Reduced motion (OS setting, or `data-motion="reduce"` on the root): movement durations go to 0ms and only 120ms fades remain. The pill and badge have no entrance animation.

## Accessibility

Contrast, computed for the worst plausible case (88% card over a mid-tone wallpaper): light title 16:1, light snippet 7.1:1 (zinc-500 would be 4.5:1), dark title 15:1, dark snippet 6.6:1, pill icons 11:1 and pill muted text 4.8:1 over a pale wallpaper. Badge is dark on emerald-400, 7.9:1 (white on emerald-500 would be 2.5:1). Status icons use T3's `-foreground` green and red (the plain green is 2.3:1 on a light card). Not checked: very bright or very busy wallpapers; the glass is dense (88%) to cover this, but test with real desktops.

Focus: every control shows a two-tone ring (background gap, then primary), and white-on-black inside the pill. Never colour-only: status has an icon and an accessible name ("Completed", "Failed"). Keyboard: Tab reaches the pill, the front card and its dismiss button; Up/Down (rebindable) browse; Enter opens; Delete or Esc dismisses; back cards are `aria-hidden` and untabbable. The "n / total" count is a polite live region with the thread title and status. Pet picker and polling choice are radio groups with arrow keys; toggles are `role="switch"`. Because the overlay window is non-focusable in the current t3-pet, keyboard focus needs a decision (open question).

## Open questions

1. Overlay focus: the window is non-focusable and click-through, so Tab and focus rings only work if the stack makes the window focusable while open. Arrow keys while hovering likely need a global shortcut or a focusable window.
2. Compose state (input pill from the reference) is not designed here.
3. Should the pill be dark in light theme, as drawn, or follow the theme?
4. Reading the active T3 theme (light, dark or an imported theme) needs a source; tokens here cover the built-in two only.
