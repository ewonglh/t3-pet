# Completed-thread cards

Each finished T3 run becomes a card in the stack under (or above) the pet. Hover the pet, then click the bell to open the stack.

## What a card shows

- A green tick (completed) or a red cross with a "Failed" label (failed).
- The thread title in bold, then one line of the run's last answer, cut short with an ellipsis.
- How long ago it finished: "now", "5m", "3h", "2d". Times refresh every 30 seconds.

Provider and project names from the mockups are not shown yet, because the data layer does not report them.

## Using the stack

- The newest card is at the front. Up to three more peek out behind it.
- The arrows on the "n / total" control step through the cards. Clicking a card that peeks out behind brings it to the front. Arrow keys come with #13.
- Clicking the front card opens its thread in T3 Code and marks it read.
- The x on the front card dismisses it.
- A new run arriving while the stack is open goes to the front.

## Unread count

The bell's badge counts cards that have not been opened. Dismissing a card also removes it from the count. While the stack is open the badge is hidden; the "n / total" control shows where you are instead.

## How many cards, and for how long

- The stack holds the **20 newest** cards. When a new one arrives and there are already 20, the oldest drops off. A run older than all 20 is not added.
- At start-up the pet asks for runs from the last 24 hours, so work finished while it was closed still shows up.
- Opened and dismissed marks are saved in `cards.json` in the app data folder (next to `settings.json`), so a restart does not bring dismissed cards back or reset the count. Marks older than 25 hours are dropped the next time the file is written, since those runs will never be reported again. Nothing is written under `~/.t3`.

## Where the code is

- `src/main/cards.js`: the list, the cap, read and dismissed marks, and saving them. Thread ids stay in the main process.
- `src/renderer/cards.js`: draws the stack. It sends back only the run id of a card that was clicked or dismissed.
- `src/shared/card-view.js`: relative times and each card's depth in the deck.
