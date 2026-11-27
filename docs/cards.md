# Thread cards

Each T3 thread with a finished turn gets one card in the stack beyond the pill, showing its latest turn. A thread that is working or waiting on you gets a live card at the front. The pill and cards replace the speech bubble the pet used to have.

## When the pill and cards show

- **At rest** (not hovering): the pill, while a thread is running or waiting, or a card is unread. Its bell shows the state: an amber alert while a thread waits on you, a spinner while one is working (still, with reduced motion), otherwise the bell. The unread count sits on it either way. With nothing running and nothing unread, the pet stands alone.
- **Hovering** the pet or the pill opens the stack beyond the pill. The pill sits next to the pet and does not move; the cards grow away from it (upwards when the stack is above the pet, downwards when it is below).
- With nothing running and nothing unread, hovering shows the pill only; the bell opens the stack.
- Nothing shows while the pet is being carried.

## The live card

- Working: a spinning icon (still, with reduced motion), the title, "Working…". Waiting: an amber icon, the title, "Needs your input".
- With more than one thread running or waiting, the card shows the latest (waiting first) and "+N more".
- Clicking it opens that thread. It has no dismiss button; it goes away by itself.
- While a thread is live, its older completed card is hidden, so it never shows twice.
- When the run finishes, the live card turns into the thread's completed or failed card in place. It waits up to 2.5 seconds for that card to arrive.
- A state forced from the tray State menu has no thread: the card shows the state with no title, and clicking it does nothing.

## One card per thread

- A newer turn on a thread replaces that thread's card and moves it to the front. It counts as unread again, even if you had opened or dismissed the older card.
- An older turn that arrives later (for example while the last 24 hours are replayed at start-up) is ignored.
- If you dismissed a thread's latest turn, its older turns stay away after a restart too.

## What a card shows

- A green tick (completed) or a red cross (failed).
- The thread title in bold, followed by the start of the latest answer, over up to two lines and then an ellipsis. Failed cards put a red "Failed" between the two.
- How long ago it finished: "now", "5m", "3h", "2d". Times refresh every 30 seconds.

Provider and project names from the mockups are not shown yet, because the data layer does not report them.

## Using the stack

- The newest card is at the front. Up to three more peek out behind it.
- Once the bell is pressed, up and down arrows and "n / total" join the right end of the pill, so they take no height of their own. They show only when there are two or more cards. Clicking a card's peeking edge brings that card to the front. Arrow keys come with #13.
- Scrolling over the open stack or pill also steps through the cards: down for older, up for newer. One mouse-wheel notch is one card; trackpad scrolling adds up to a step and is paced so a fling does not race through the deck.
- Clicking the front card opens its thread in T3 Code, brings T3 Code to the front, and marks the card read. (On Windows the overlay takes focus for a moment so T3 Code is allowed to come forward; see `lendForeground` in `src/main.js`.)
- The x on the front card dismisses it.
- A new run arriving while the stack is open goes to the front.

## Unread count

The bell's badge counts cards that have not been opened. Dismissing a card also removes it from the count. While the stack is open the badge is hidden; the "n / total" control shows where you are instead.

## How many cards, and for how long

- The stack holds the **20 most recent** threads. When a new one arrives and there are already 20, the oldest drops off. A run older than all 20 is not added.
- At start-up the pet asks for runs from the last 24 hours, so work finished while it was closed still shows up.
- Opened and dismissed marks are saved in `cards.json` in the app data folder (next to `settings.json`), so a restart does not bring dismissed cards back or reset the count. Marks older than 25 hours are dropped the next time the file is written, since those runs will never be reported again. Nothing is written under `~/.t3`.

## Where the code is

- `src/main/cards.js`: the list, the cap, read and dismissed marks, and saving them. Thread ids stay in the main process.
- `src/renderer/cards.js`: draws the stack. It sends back only the run id of a card that was clicked or dismissed.
- `src/shared/card-view.js`: relative times, each card's depth in the deck, and putting the live card in front.
- `src/shared/overlay-shell.js`: what shows (nothing, the pill, or the pill and stack) and where.
- `src/status/queries.js`: which thread is live (`live` in the status). The main process (`src/main.js`) gives the renderer a token per thread instead of its id, used only to match a live card to its completed card.
