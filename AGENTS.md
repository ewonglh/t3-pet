# AGENTS.md

Conventions for anyone (human or agent) working in this repo. Read this and the issue you are picking up before changing code.

## What this is

A desktop pet for T3 Code on Windows, forked from [kausthubh-coder/t3-pet](https://github.com/kausthubh-coder/t3-pet) (MIT). Direction: show completed T3 threads as stacked frosted-glass cards under the pet, open a thread on click, load Petdex/Codex-format pets, and track the cursor with the pet's head. Plan: `docs/SPEC.md`. Visual design: `design/`.

## Run it

- Node 24 or later (uses the built-in `node:sqlite`).
- `npm install`, then `npm start`. There is no build step. Keep it that way unless an issue says otherwise.
- Force states without a live T3: tray menu State submenu. The global hotkeys `Control+Alt+0` to `5` (live, idle, working, waiting, done, error) are off by default because they clash with other tools; set `T3PET_TEST_KEYS=1` to turn them on. `preview.html` previews animations.
- Choose a pet: install one with the Petdex CLI, then pick it in the tray menu under Pet (the choice is remembered in `settings.json` in the app data folder). `T3PET_PET` (a folder name from `~/.petdex/pets` or `~/.codex/pets`, or a full folder path) overrides the saved choice at start-up, for example `$env:T3PET_PET='boba'; npm start`. With no pet, or an invalid one, the built-in mascot is used.

## Layout

- `src/main.js`: Electron main process (overlay window, tray, hotkeys, cursor polling).
- `src/renderer/`: overlay UI and pet behaviour (`pet.js`).
- `src/status/`: reads T3 state (polling). All knowledge of T3 internals stays here. Import only `src/status/index.js` (`createStatusSource`); the interface (`onActivityChange`, `onRunCompleted`, `onModeChange`) is documented in `status-source.js`.
- `src/shared/`: built-in sprite drawing and animations; Petdex sheet layout (`sheet-grid.js`) and which row an animation plays (`pet-rows.js`).
- `src/main/pets.js`: lists, loads and validates pet folders. `src/main/settings.js`: the remembered pet choice. `src/renderer/spritesheet.js`: draws its frames.
- `design/`: design tokens and mockups. `design/tokens.css` is the source of truth for colours, radii, blur and spacing.
- `docs/`: spec, decisions, data-source notes, animations, pets (where to get them, licensing).

## Tracker

GitHub Issues in this repo are the tracker. Do not keep a parallel TODO list.

Every issue has:
- one **type** label: `type:feature`, `type:bug`, `type:chore`, `type:docs`, `type:design`, `type:spike`;
- one **status** label (below);
- one **priority** label: `priority:p0` (do first), `p1`, `p2`;
- at least one **area** label: `area:data`, `area:main`, `area:renderer`, `area:sprites`, `area:settings`, `area:design`, `area:release`;
- one **milestone**.

Status flow: `status:backlog` -> `status:ready` -> `status:in-progress` -> `status:review` -> closed. Closed means done, so there is no `status:done`. Use `status:blocked` alongside a comment that says what it is waiting on. Change the status label when you start and when you hand over.

Spikes produce a decision or note (in `docs/` or the issue), not polished code. Time-box them and say what was decided.

Do not create new labels or milestones without asking the owner.

## Milestones and versions

Milestones are versions (semantic versioning, pre-1.0 until the first stable release):

| Milestone | Theme |
|---|---|
| v0.1.0 Foundations | Fork set-up, click to open, completed-run data |
| v0.2.0 Pets | Petdex/Codex pet format |
| v0.3.0 Cards | HTML/CSS overlay, card stack, keyboard navigation |
| v0.4.0 Settings and theme | Settings window, keybinds, T3 theme |
| v0.5.0 Gaze | Head and eye tracking |
| v0.6.0 Live data | Optional WebSocket source, stop and follow-up |
| v1.0.0 Release | Packaging, README, first stable release |

When a milestone closes, tag the release commit `vX.Y.Z` and create a GitHub release with notes. `upstream-base` tags the commit this fork started from. If scope moves between milestones, change the milestone and leave a comment saying why.

## Branches, commits, pull requests

- Branch from `main`: `<type>/<issue-number>-<short-slug>`, for example `feat/2-click-to-open`.
- One issue per pull request. The body says `Closes #<number>` and what you ran to check it.
- Commit messages follow Conventional Commits: `feat(main): open thread on click (#2)`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `design`. Scopes match the area labels.
- Squash merge. The owner merges.
- Do not add `Co-Authored-By` lines or any "generated with" attribution to commits, pull requests or comments.
- Repo bootstrap (this file, labels, milestones) was committed straight to `main`. Everything after goes through a branch and a pull request.

## Code rules

- Follow the existing style. Plain JavaScript, no framework, no bundler. Adding a dependency needs a comment on the issue that says why.
- **T3 data is read-only.** Open the database with `readOnly: true`. Never write to anything under `~/.t3`.
- Read only the specific T3 files an issue names: `~/.t3/userdata/statev2.sqlite` and `~/.t3/userdata/environment-id`. Never read, list or log anything else in `~/.t3/userdata`, especially the `secrets` folder.
- T3 storage is private and can change in any update. Keep every table, column and file name in `src/status/`, behind the `StatusSource` interface, so a break is a one-file fix. Do not scatter them through the renderer.
- Thread links use `t3code://threads/<environmentId>/<threadId>` (`t3code-dev://` for dev builds), URL-encoded, opened with `shell.openExternal`. Never use `https://` links; they open a browser page.
- Never commit third-party pet art. Petdex pets belong to their creators. `design/assets/` and screenshots that show a pet are git-ignored.
- Do not hard-code personal paths, IDs or account names. Resolve paths from the home directory.

## Design

- Use `design/tokens.css` for every colour, radius, blur and spacing value. Do not hard-code them in components.
- Light and dark must both work. Respect `prefers-reduced-motion`.
- Icons are Lucide (ISC licence), inline SVG. See `design/icons.md`.
- The mockups reference a local placeholder pet sprite that is not committed. Add your own pet at `design/assets/boba-spritesheet.webp` to see them with art.

## Checking your work

Run `npm test` (Node's built-in test runner, tests in `test/`). Logic that can run without Electron (queries, link building, mapping tables) should have a test there; the query tests use a throwaway in-memory database, never real T3 data. Then run the app on Windows 11, exercise the change (use the tray State submenu, or the test hotkeys), and say in the pull request what you tried and what you did not.

## Writing

British spelling. Dates as DD/MM/YYYY. Plain, direct wording in docs, UI copy and issues.

## Upstream

`upstream` is `kausthubh-coder/t3-pet`. Keep `LICENSE` and credit the original author in the README. To pull upstream changes, merge `upstream/main` on a `chore/` branch and open a pull request.
