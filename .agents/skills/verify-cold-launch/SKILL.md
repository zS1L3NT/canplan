---
name: verify-cold-launch
description: TLA+ model check of Canplan's cold launch, the race between loading canvas-cache.json and planner.json from disk and the first Canvas refresh, markSeen, and addTask. Use it whenever a change touches CanvasProvider's disk load, refresh, saveCache/savePlanner, markSeen/addTask/updatePlanner, diff(), or SignedInBootstrap's refreshRef and cold-launch timer in ts-native-canplan.
---

# Verify the cold launch

`model/ColdLaunch.tla` describes the first seconds after Canplan opens with a saved Canvas session. It covers every order in which these can happen: the disk load finishes, React commits a render, the first refresh starts and finishes, and the student marks an update seen or adds a task. TLC (the TLA+ model checker) tries every order and reports the shortest one that breaks a rule.

## The rules

| Rule | In plain words | Harm if broken |
|---|---|---|
| `TasksKept` | planner.json always holds every task, old and new. | The app is killed and the student's tasks are gone. |
| `SeenKept` | canvas-cache.json keeps every "seen" mark, unless a refresh brought a newer version of that item. | Updates the student already read come back as unread, or vanish. |
| `DueChangeShown` | When Canvas moved a due date since the last session, Updates shows "Due date changed" once the launch settles. | The student never hears that a deadline moved. |
| `ScreenMatchesDisk` | Once the launch settles, the screens show what is on disk. | The screens show stale data, and the next save writes that stale data back. |
| `TypeOK` | The variables hold the values they should. | It catches a modeling error, not a product bug. |

## Run it

From the repo root:

```sh
.agents/skills/verify-cold-launch/scripts/check --out "$TMPDIR/cold-launch"
```

It needs Java 11 or later. The first run downloads TLA+ tools v1.7.4 into `~/.cache/canplan-tla/` and checks the file's hash. A run takes about 15 seconds. The script runs TLC once for each rule in two modes:

- `current` (`GuardLoaded = FALSE`): the code as it is.
- `guarded` (`GuardLoaded = TRUE`): the fix target. No refresh, markSeen, or addTask runs until the disk load has committed. This mode does not describe code that exists. It shows that the rules can hold, and it gives the shape of a fix.

The script compares the results with `model/expected.txt`. It exits 0 when they match and prints a diff when they do not. Each run's TLC output is in `<out>/<mode>-<rule>/tlc.out`. A broken rule's output ends with the shortest path that breaks it, one state per action.

Read every result with the pstack `statechart` skill (`/statechart` where your agent has slash commands). It tells each broken rule's shortest path in plain words, and when a run passes it draws how the launch moves between states. Hand it `model/ColdLaunch.tla` with a config that names the rules you want to see.

## Known findings (current code, at the sync commit)

All four rules break in `current` mode. Each needs the disk load to be slower than something it races with. Today only the 150 ms timer delay keeps them from happening. The `loaded` ref in `store.tsx` is set when the load finishes, but nothing reads it.

1. **`DueChangeShown`**: the disk load finishes, but React has not yet committed the render that gives refreshRef a new `refresh`. The 150 ms timer fires and calls the old `refresh`, whose `cache.snapshots` is still `{}`. `firstFetch` is true, so `diff` runs as a baseline and writes no "Due date changed" item. The new due date is saved, so later launches never show the change either.
2. **`SeenKept`**: the timer fires and the refresh finishes before canvas-cache.json is read. `setCache` merges into the empty in-memory cache, and `saveCache` overwrites the file with no seen marks and no old feed.
3. **`TasksKept`**: the student adds a task before planner.json is read. `savePlanner` writes a planner that holds only the new task, then the load sets the old tasks in memory. If the app is killed before the next save, the old tasks are gone.
4. **`ScreenMatchesDisk`**: canvas-cache.json is read, then the refresh finishes and saves, then the load calls `setCache` with the older content it read. The screens show the stale cache, while the file holds the new one.

These are findings, not modeling errors. Do not weaken a rule or the model until they pass. Change product code only when the user asks you to.

## Does my change touch the verified code?

The model covers these, in `ts-native-canplan/`:

| Code | Model |
|---|---|
| `src/canvas/store.tsx`, `CanvasProvider`: the "Load from disk once" effect, including the `loaded` ref | `CacheFileRead`, `CacheStateSet`, `PlannerFileRead`, `PlannerStateSet` |
| `src/canvas/store.tsx`: `refresh` (`prev`, `firstFetch`, the `setCache` merge, `saveCache(next)`) | `RefreshStarts`, `RefreshFinishes` |
| `src/canvas/store.tsx`: `diff`, the baseline branch and "Due date changed" | `NewFeed` |
| `src/canvas/store.tsx`: `saveCache`, `savePlanner`, `updatePlanner`, `markSeen`, `addTask` | `StudentMarksSeen`, `StudentAddsTask` |
| `src/state/AppState.tsx`, `SignedInBootstrap`: refreshRef, its effect, the 150 ms cold-launch timer | `Commit`, `RefreshStarts` |
| `src/state/AppState.tsx`, `AppStateProvider`: mounts `CanvasProvider` only after sign-in | `Init` (empty memory, files on disk) |

**Sync commit: `5134051c772175364c8be6320b5ca19299a9cf27`**. At this commit the model was last confirmed to describe the code above.

To see whether the covered code changed since then:

```sh
git diff 5134051c772175364c8be6320b5ca19299a9cf27 -- ts-native-canplan/src/canvas/store.tsx ts-native-canplan/src/state/AppState.tsx
```

If the diff touches anything in the table, check the model against the new code before you trust a pass.

## Modeling rules

- One action is one stretch of JavaScript with no `await` in it. An `await` (a file read, a Canvas fetch) splits two actions, and anything else may run between them.
- A `setState(value)` replaces the whole value. A `setState((c) => ...)` merges into the current value. `saveCache` and `savePlanner` write the whole in-memory value. Keep these exact, because the findings depend on them.
- A closure sees state from the render it was made in. `view` is the `cache.snapshots` inside the `refresh` that refreshRef holds. It changes only on `Commit`.
- A refresh that has started cannot be started again (`refreshingRef`), and the model runs one cold-launch refresh. The foreground refresh, `markAllSeen`, `clearAll`, `importNotion`, and demo mode are left out.
- One course, one assignment `A`, one old seen item `X`, one old task `T0`, one new task `T1`. Canvas moved A's due date from `d0` to `d1`.

## Is a failure a real bug or a modeling error?

1. Read the shortest path in `tlc.out`, or through the `statechart` skill.
2. Replay it against the code, one action at a time. For each action, find the code it stands for in the table above, and check that the code can really run in that order: an `await` or a React commit must sit between any two actions you reorder.
3. If every step happens in the code, it is a real bug. Report it with the path in the code's words, as in "Known findings". If a step cannot happen, the model is wrong. Fix the action that allows the step, and name in your report the code that rules it out.
4. `TypeOK` breaking, or a result of `error`, is always a model or tooling problem. Read `tlc.out`.

## When the code changes on purpose

1. Update the actions in `model/ColdLaunch.tla` so that they describe the new code. Keep the comments that name the code.
2. Run `scripts/check`. If the results change for a reason you understand (for example, a fix makes a `current` rule hold), update `model/expected.txt` and the "Known findings" section.
3. If a fix lands, the fix's behavior belongs in the `current` actions. `guarded` mode may then be the same as `current`, or you can remove it.
4. Move the sync commit forward only after you have confirmed that the model describes the covered code at the new commit. Write the new commit's full hash in both places above.

For bigger drift, use the pstack `maintain-formal-verification-skill` skill.
