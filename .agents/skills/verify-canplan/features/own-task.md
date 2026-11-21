# Own tasks

A student adds a task of their own, optionally tied to a module and a deadline. It shows on the Tasks tab under the right day, and it is still there after the app restarts.

## Sub-features

- `task-add` adds a task with only a title.
- `task-module-deadline` adds a task with a module chip and a deadline preset.
- `task-persist` keeps tasks across a relaunch.
- `task-done` marks a task done from its row.

## How to get to it (user POV)

- On the Tasks tab with no tasks yet, the `Add my task` button in the middle of the screen.
- The `+` button at the top right of the Tasks tab (accessibility label `Add my task`).
- Either one opens the `New task` sheet.

## Driving it with scripts/ad

Preconditions:

- Baseline state from `README.md`, in demo mode, on the Tasks tab.
- No task is titled `Verify run CS2030S`.

- **Open the sheet.** Press `Add my task`. Run `scripts/ad press "$(scripts/ref '[button] "Add my task"')" --settle`. A sheet titled `New task` shows, with the title field focused and `Add` disabled.
- **Enter a title.** Run `scripts/ad fill "$(scripts/ref 'e.g. Final')" "Verify run CS2030S" --settle`. `Add` becomes enabled.
- **Pick a module and a deadline.** Run `scripts/ad press "$(scripts/ref '[button] "CS2030S"')" --settle`, then `scripts/ad press "$(scripts/ref '[button] "Tomorrow"')" --settle`. Check in a screenshot that both chips are filled blue, and press again any that is not (see Gotchas).
- **Save.** Run `scripts/ad press "$(scripts/ref '[button] "Add"')" --settle`. The sheet closes. The snapshot has `My task, Verify run CS2030S, CS2030S, Due tomorrow, 11:59 PM`.
- **Check the saved file.** Run `scripts/planner`. It has a task with `"title":"Verify run CS2030S"`, `"courseCode":"CS2030S"`, and an `ownDeadline` of tomorrow at 23:59 Singapore time (15:59Z).
- **Relaunch.** Run `scripts/ad open com.zectan.canplan --relaunch --metro-port 8082`, then press `Use demo data (dev only)`. The task row shows again.
- **Mark done.** Run `scripts/ad press "$(scripts/ref 'mark Verify run CS2030S as done')" --settle`. The row moves out of its day section, and `planner.json` has `"done":true` for it.

## Gotchas

- With the keyboard up, the first press on a module chip only closed the keyboard. The module stayed `None`, and a task was saved without a module. Always check the chips in a screenshot before pressing `Add`.
- The module chips scroll sideways. `CS2030S` is half off screen, but pressing it by ref still works.
- Pressing the `Add my task` button in the navigation bar did nothing once, on an empty task list. It worked on a later run. If the sheet does not open, press the large `Add my task` button in the empty state.
- How a text field shows in a snapshot varies (`[placeholder:"e.g. …"]` or just `"e.g. …"`), so match on the placeholder text alone.
- Tasks made in demo mode are real: they are written to `planner.json` on the simulator, next to any tasks the owner imported. Delete only your test tasks: search `Verify run`, open the task, press `Delete my task` (scroll down if needed), then `Delete`. Use Settings → Clear cached data only when the simulator holds nothing but test data.
