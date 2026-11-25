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
