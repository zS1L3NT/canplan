# Canplan verification map

This is the maintained source for checking what a student can see and do in Canplan. Read this index first, then use the feature file as the recipe. Launch, doctor, evidence, and cleanup are in `../SKILL.md`.

## Baseline preconditions

- Metro runs from this checkout on port 8082, and the doctor in `../SKILL.md` passes.
- The app is installed on an iPhone simulator (`scripts/build-sim`) and opened with `scripts/ad open com.zectan.canplan --relaunch --metro-port 8082`. `scripts/` is `../scripts/` from this folder.
- The login screen shows. Press `Use demo data (dev only)`. The Tasks tab shows `Checked Canvas … ago`, and the Updates tab label reads `Canvas updates, N unread`.
- Demo mode is not remembered: every relaunch returns to the login screen, and you press `Use demo data (dev only)` again.

## Driving conventions

- Take refs from a fresh `scripts/ad snapshot -i` before every press or fill. Refs are renumbered after each change, so an old ref presses the wrong element without any error. `scripts/ref` takes a fresh snapshot and picks the first element whose line has the given text:
  ```sh
  scripts/ad press "$(scripts/ref '[button] "CS2030S"')" --settle
  ```
- Add `--settle` to presses and fills.
- While the keyboard is up, the first tap outside the text field can only close the keyboard. Check the result in a screenshot, and press again if it did not take.
- The round gear button at the top left of every screen is the Expo dev tools. It is not the app's Settings.

## Proof and skip reporting

- Save a screenshot before and after, plus the `snapshot -i` text of the end state, to the folder `scripts/evidence <feature>` prints.
- For anything that saves, also copy the planner: `scripts/planner <dir>/planner.json`.
- A path you could not reach is reported as not verified, with the step that failed. Never report it as verified through another path.

## Features

- [Own tasks](./own-task.md): add a task with a module and a deadline, and check that it is saved and survives a relaunch. **Proved end to end on 2026-11-21.**
- [Canvas updates](./canvas-updates.md): the Updates feed, unread count, opening an item, and marking all seen.
- [Courses](./courses.md): the module list, a module's tabs, and hiding a module.
- [Search](./search.md): search across tasks and Canvas content.
- [Settings and Notion import](./settings.md): the session source, the Notion task import, and clearing cached data.
