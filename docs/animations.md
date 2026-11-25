# Animations and sheet rows

A Petdex/Codex pet sheet has nine rows (frames 192x208, 8 columns). The mapping from what the pet is doing to a row is one table, `ROW_FOR` in `src/shared/pet-rows.js`. Change a line there to change what an animation looks like. `test/pet-rows.test.js` fails if a built-in animation has no entry.

The row meanings follow the Codex hatch-pet contract.

| Row | Name | Meant for |
|---|---|---|
| 0 | idle | Calm, subtle breathing or blink |
| 1 | running-right | Directional drag movement |
| 2 | running-left | Directional drag movement |
| 3 | waving | Greeting |
| 4 | jumping | Vertical motion |
| 5 | failed | Failure |
| 6 | waiting | Needs approval, help or input |
| 7 | running | Active task work, thinking (not literal running) |
| 8 | review | Focus pose: lean, blink, head tilt |

Sheets with 11 rows (v2) have two more that the contract does not describe. They are not used.

## What plays when

| Pet is... | Animation | Row |
|---|---|---|
| Idle, asleep, just landed | idle, sleep, land | idle |
| T3 is working | working | running |
| T3 needs you | waiting | waiting |
| T3 run failed | error | failed |
| T3 run done | done | waving |
| Petted, woken | petted, wake | waving |
| Following the cursor | walk, run | running-right or running-left, by direction |
| Dragged, falling | picked, fall | jumping |
| Hurt, dizzy, knocked out | hurt, dizzy, ouch | failed |

Decisions to revisit:
- **Done** uses `waving` because the contract has no "done" row. `review` is the alternative.
- **Hurt, dizzy, knocked out** use `failed` for now. A dedicated animation would need an optional extra row or a `pet.json` field; not built yet.
- **Gravity off** (free 2D floating, issue #37) will use the same table.

## Timing

For a sheet pet, nothing about timing is hard-coded per animation.

- **One-shot animations** (hurt, dizzy and ouch, petted, wake, land) play the pet's own row once, from the first frame to the last. They last `frames in the row / fps`, so two pets with different row lengths take different times. Hurt, dizzy and ouch all use `failed`, so a drop plays that row once in total.
- **Looping animations** (idle, working, waiting, walking) loop until the state changes. Dragging and falling last as long as the motion does.
- **Playback speed** is 8 frames per second unless the pet says otherwise. A pet can add an optional `fps` to `pet.json`. This is a t3-pet extension: Petdex does not define it, and other apps ignore it.

```json
{ "fps": 12 }
{ "fps": { "running": 12, "idle": 6 } }
```

A number applies to every row. An object names rows (`idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`); the others use 8. Values must be from 1 to 60. Anything else is ignored with a line in the log.

The built-in mascot keeps its own fixed timings. The rules live in `src/shared/sheet-timing.js`.
