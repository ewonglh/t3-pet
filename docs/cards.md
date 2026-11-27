# Completed-thread cards

Each T3 thread with a finished turn gets one card in the stack under (or above) the pet, showing its latest turn. Hover the pet, then click the bell to open the stack.

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
- Clicking the front card opens its thread in T3 Code and marks it read.
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
- `src/shared/card-view.js`: relative times and each card's depth in the deck.
