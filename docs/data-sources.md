# Data sources

What the pet reads from T3 Code, and where. All of it is private T3 storage that can change in any update, so every name below lives in `src/status/` only. Read-only access throughout.

## Files

| File | Used for |
|---|---|
| `~/.t3/userdata/statev2.sqlite` | Runs, threads, requests, messages (below). Opened with `readOnly: true`. |
| `~/.t3/userdata/environment-id` | One-line environment UUID, for `t3code://threads/<environmentId>/<threadId>` links. |

Nothing else in `~/.t3/userdata` is read. The `secrets` folder is never touched.

## Tables and columns used

Checked against a real database on 25/11/2026.

**`orchestration_v2_projection_runs`**: `run_id`, `thread_id`, `status`, `requested_at`, `completed_at`. Status values seen: `completed`, `failed`, `running`, `cancelled`, `interrupted`, `rolled_back`. Only `completed` and `failed` become cards. Times are ISO strings in UTC.

**`orchestration_v2_projection_threads`**: `thread_id`, `title`, `archived_at`, `deleted_at`. Threads with either of the last two set are skipped.

**`orchestration_v2_projection_runtime_requests`**: `thread_id`, `created_at`, `status`. A `pending` row on a thread with a running run means the agent is waiting on you.

**`orchestration_v2_projection_messages`**: `run_id`, `role` (`assistant` or `user`), `streaming` (0 or 1), `created_at`, `payload_json`. There is no plain text column. The text is `$.text` inside `payload_json`, so the query uses `json_extract`. An index on `run_id` exists, so a lookup takes well under a millisecond.

## Answer snippet

A run has many assistant messages (the agent narrates between tool calls). The snippet is the **last finished assistant message of the run** (`streaming = 0`, newest `created_at`), flattened to one line: code blocks removed, markdown marks removed, whitespace collapsed, cut at 160 characters with an ellipsis. A run with no assistant message gets an empty snippet. Snippets are cached per run, since a finished run's answer does not change.

## Completed-run events and look-back

`onRunCompleted` reports each run once, oldest first. On start-up it reports runs that finished in the **last 24 hours** (up to 20), so runs completed while the pet was closed still appear. After that it reports new runs as they finish. The window and cap are `LOOKBACK_MS` and `MAX_CARD_RUNS` in `src/status/queries.js`. Whether a card has been read or dismissed is not stored here; that comes with the card stack (v0.3.0).

## Known fragility

This is T3 Code's private storage, not a public API. T3 can rename a table or column, change the shape of `payload_json`, or move the files in any update, with no notice. The pet only reads; it never writes, so the worst case is a wrong or missing status, not damage to your T3 data.

What breaks, and how it shows:

| Change in T3 | What you see |
|---|---|
| Table or column renamed or removed | Tray says "T3 database unreadable, retrying"; the pet stays idle. The log shows `read failed: ...` with the SQL error. |
| `payload_json` shape changes | Cards appear with empty snippets (the answer query returns nothing). Status still works. |
| `statev2.sqlite` moved or renamed | Tray says "Demo mode: no T3 database found". |
| `environment-id` moved or its format changes | Clicking a status logs "nothing to open". |
| T3 changes the `t3code://threads/...` link format | The click opens T3 Code but not the thread. |

## When it breaks

1. Confirm the cause: the tray menu line, then the console output from `npm start` (`[t3] read failed: ...`).
2. Open the database read-only (for example `sqlite3 -readonly ~/.t3/userdata/statev2.sqlite`) and look at `.schema` for the table in the error. Do not open it with anything that writes, and do not copy it anywhere shared: it contains your conversations.
3. Fix the names in `src/status/queries.js` (tables, columns, `json_extract` paths) or `src/status/environment.js` (the file). Nothing outside `src/status/` should need to change.
4. Update the tables section above with what you found, and the date it was checked.
5. Run `npm test`. The tests build their own throwaway database, so update the table definitions in `test/` to match.

To override paths without editing code: `T3_STATE_DB` (database file), `T3_ENVIRONMENT_ID_FILE` (environment id), `T3PET_SCHEME=t3code-dev` (dev builds of T3 Code), `T3PET_SQLITE=child` (read through a system `node` process instead of Electron's).
