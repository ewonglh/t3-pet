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
