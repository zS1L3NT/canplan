# Settings and Notion import

Settings shows who is signed in and how (`Session source`), what is cached, and Canvas sections that are locked. In dev builds it imports the student's Notion Task Tracker from `demo/notion-tasks.json`. It can also clear cached data and sign out.

## Sub-features

- `settings-session` shows `Signed in as` and `Session source` (`Demo data`, `Fresh login`, or `Restored from secure store`).
- `settings-notion` imports Notion tasks, and running it again updates them.
- `settings-clear` clears cached Canvas data and planner tasks, after a confirmation.
- `settings-signout` signs out, after a confirmation.

## How to get to it (user POV)

- The `Settings` button at the top of the Courses tab.

## Driving it with scripts/ad

Preconditions:

- Baseline state from `README.md`, in demo mode.
- `ts-native-canplan/demo/notion-tasks.json` exists.

- **Open Settings.** On the Courses tab, run `scripts/ad press "$(scripts/ref '[button] "Settings"')" --settle`. The sheet shows `Session source` reading `Demo data`.
- **Import Notion tasks.** Press `Import Notion tasks`. An alert titled `Imported from Notion` reports `N added, 0 updated`. Accept it with `scripts/ad alert accept`. The button now reads `Re-import Notion tasks (N imported)`, and `planner.json` has N tasks with a `notionID`.
- **Re-import.** Press it again. The alert reports `0 added, N updated`, and no task is duplicated.
- **Clear.** Press `Clear cached data`, then `Clear` in the alert. The Tasks tab shows `No tasks yet`, and `planner.json` has `"tasks":[]`.

## Gotchas

- Not yet driven end to end. Labels come from `src/app/settings.tsx`.
- Never press `Sign out` on the user's iPhone. Only on the simulator, and only when the journey needs it.
- The Notion data is the user's real task list. Keep it on the device and in `demo/`, and never paste it into reports.
