---
name: verify-canplan
description: Run the Canplan iPhone app (ts-native-canplan, Expo SDK 58 dev client) on an iOS Simulator and drive it the way a student does, to prove a change works. Use it to launch or screenshot the app, or to show that a change to tasks, Canvas updates, courses, search, or settings works in the real app and not only in typecheck and lint.
---

# Verify Canplan

Canplan is an Expo Router app in `ts-native-canplan/`. It is a development build (`expo-dev-client`), so the native app loads its JavaScript from Metro, and JS edits reload live.

All agent work happens on an **iPhone simulator**. The owner's physical iPhone is only for the owner to try the app. Do not build, install, launch, or test on it, and do not touch its data, unless the owner explicitly asks. Then use `scripts/build-phone`.

Every step below uses the scripts in this skill's `scripts/` folder. Run them from anywhere in the repo, for example `.agents/skills/verify-canplan/scripts/doctor`. `scripts/X` below means that folder. The scripts look up every machine-specific value when they run (the simulator, the paired iPhone, the signing team, the main checkout). To override one, set an environment variable: `CANPLAN_SIM_UDID`, `CANPLAN_PHONE_UDID`, `CANPLAN_TEAM_ID`, `CANPLAN_DEMO_SOURCE`, or `CANPLAN_METRO_PORT` (default 8082).

Needs macOS with Xcode, CocoaPods, and Node 22.

## Setup (once per checkout or worktree)

```sh
scripts/setup
```

It does three things:

1. `npm ci --legacy-peer-deps`. Plain `npm ci` fails with ERESOLVE. Never use `--force`, and never edit `package-lock.json` to work around it.
2. It copies the git-ignored `demo/canvas-cache.demo.json` (a real Canvas cache) and `demo/notion-tasks.json` (the owner's Notion Task Tracker export) from the main worktree. Metro cannot bundle without them. They hold the owner's real data, so never commit them, paste their contents into a report, or send them anywhere. If no copy exists, the script stops. Ask the owner for the files.
3. `expo prebuild -p ios` and `pod install` with a UTF-8 locale. `ios/` is generated and git-ignored, so never edit it by hand. Delete `ios/` and run setup again after any change to `app.json`, a config plugin, a native dependency, or `modules/canvas-cookies`.

## Launch

1. **Metro.** Start `scripts/metro` in the background and keep its PID. It uses port 8082, so it never collides with a Metro the owner runs on 8081. If the port is taken, run `scripts/doctor`. If that Metro serves this checkout, reuse it.
2. **The app.** `scripts/build-sim` boots the simulator, builds the Debug app (about 4 minutes from clean), and installs it. Rebuild only after a native change. A JS change reaches the app through Metro.
3. **Open it.** `scripts/ad open com.zectan.canplan --relaunch --metro-port 8082`

Ready means the app shows a Canplan screen: the login screen ("Sign in to Canvas") or the Tasks tab. A started process alone is not ready. When Metro builds the bundle, its log prints `iOS Bundled …ms node_modules/expo-router/entry.js`.

## Driving harness

`scripts/ad` runs [agent-device](https://github.com/callstack/agent-device) against the simulator. Use it for every launch, tap, text entry, alert, and screenshot. Do not drive the UI with `xcrun simctl` or `idb`. `simctl` stays fine for builds, installs, and reading the app's files.

- **In T3 Code:** load the device tools, call `device_open` for the simulator, and `export AGENT_DEVICE=<the command it returns>` before using `scripts/ad`. The owner then watches in the Device panel. That command changes between sessions, so take it from `device_open` every time.
- **Anywhere else:** `scripts/ad` runs the pinned `agent-device@0.21.41` from npm, bound to the simulator. The first command builds an XCTest runner, which takes a couple of minutes.

## Doctor

```sh
scripts/doctor
```

This is read-only. It checks dependencies, demo data, the generated native project, that Metro on 8082 serves this checkout, that the simulator is booted, and that the app is installed. Run it first, and whenever something looks wrong. Also check:

- The Metro log has no `Unable to resolve module` or red `ERROR` lines after the last `iOS Bundled`.
- `scripts/ad snapshot -i` shows Canplan's labels, not the home screen or a dev-launcher list.

## Signing in

- **Demo data** (the default for agents): on the login screen, press "Use demo data (dev only)". It loads `demo/canvas-cache.demo.json`, and Refresh does nothing. Settings → "Session source" then reads `Demo data`. Demo mode is not remembered, so every relaunch returns to the login screen. If the app opens with the "NUS Canvas" login sheet already up, press `Cancel` first.
- **Real Canvas**: "Sign in to Canvas" opens the NUS login (hCaptcha, then NUS SSO). Only the owner can do this. Ask them, and never type their credentials.

Tasks are saved to `planner.json` in the app's Documents folder, also in demo mode. `scripts/planner` prints it, and `scripts/planner <file>` copies it.

## Drive

`scripts/ad snapshot -i` lists the elements with `@eN` refs. Refs are renumbered after every change, so take a fresh one before each press. An old ref silently presses something else. `scripts/ref '<text>'` prints the ref of the first element whose line contains the text:

```sh
scripts/ad press "$(scripts/ref '[button] "Add my task"')" --settle
```

Add `--settle` to presses and fills. Use these labels from the code, never coordinates:

| Where | Label (accessibilityLabel or text) | Source |
|---|---|---|
| Tab bar | `My tasks`, `Canvas updates` (or `Canvas updates, N unread`), `Canvas courses`, `Search my tasks and Canvas` | `src/app/(tabs)/_layout.tsx` |
| Tasks tab | `Add my task`, `Refresh Canvas`, `Canvas, due soon, N assignments` | `src/app/(tabs)/(tasks)/index.tsx` |
| New task sheet | title field placeholder `e.g. Final AY24/25 S1 practice`, notes `Add notes…`, button `Add` | `src/app/new-task.tsx` |
| Updates tab | `Mark all updates as seen`, `Refresh Canvas` | `src/app/(tabs)/(updates)/updates.tsx` |
| Courses tab | `Settings`, `Refresh Canvas`, `Hidden courses, N` | `src/app/(tabs)/(courses)/courses.tsx` |
| Search tab | field placeholder `Search my tasks & Canvas…` | `src/app/(tabs)/(search)/search.tsx` |
| Settings | `Session source`, `Done`, `Import Notion tasks`, `Clear cached data`, `Sign out` | `src/app/settings.tsx` |

Each feature's full journey is in `features/`.

## Evidence

`scripts/evidence <feature>` makes and prints a folder: `ts-native-canplan/build-device/evidence/<YYYYMMDD-HHMMSS>-<feature>/`. It is git-ignored, and cleanup never deletes it. Put these in it:

- A screenshot before and after: `scripts/ad screenshot <dir>/01-before.png --pixel-density 3`. For a flow, record it: `scripts/ad record start --scope device <dir>/run.mp4`, then `scripts/ad record stop`.
- The snapshot text of the end state: `scripts/ad snapshot -i > <dir>/after.txt`.
- The side effect, when there is one: `scripts/planner <dir>/planner.json`.
- The Metro log lines from the run. They hold the app's `console.log` output (`[session] …`, `[login] …`).

Proof standards: drive the real UI the way a student does. Never call store functions, or edit `planner.json`, to fake a state. Capture both the action and the state it leads to. Check the saved file as well as the screen. Demo mode skips only Canvas network fetches, and it still writes `planner.json`. A journey that fails stays failed. Write the reason in that feature's `Gotchas`, and never weaken the journey. Evidence screenshots can show the owner's real courses and tasks, so keep them local.

## Cleanup

- Stop the Metro you started, by its PID. Never kill `node` or `expo` by name. If the owner's iPhone is using this Metro, leave it running and tell them.
- Remove test data you made: Settings → `Clear cached data` → `Clear` on the simulator, or delete the test tasks one by one.
- Leave the simulator booted unless you booted it. Never touch the owner's iPhone, and never sign the owner out.
- Never delete `build-device/evidence/` or `demo/`.

## Related

- `features/README.md`: the feature map.
- The `verify-cold-launch` skill: the formal model of loading from disk at launch and the first refresh.
- The pstack skill `maintain-verification-skill`: keeps this skill and its feature map in step with the app.
