# Canplan

A planner for NUS students: their own tasks plus their Canvas course content. See `EXPERIMENT.md` for the decisions behind it.

## Layout

- `ts-native-canplan/`: the iPhone-first app (Expo SDK 58, React Native, Expo Router). Read its own `AGENTS.md` before working there.
- A server will live beside it as another subfolder.

## Conventions

- Code style lives in `STYLE.md`: read it before writing code, and add new style rules there.
- Commit, branch, and pull request rules live in `COMMIT.md`: read it before any commit, branch, or PR.
- Project skills live in `.agents/skills/`, so every agent can use them. `.claude/skills` and `.cursor/skills` are symlinks to it. Add new skills there, never in the symlinks. To prove a change in the app, use `verify-canplan`. For a change to launch-time loading or refresh in `ts-native-canplan/src/canvas/store.tsx` or `src/state/AppState.tsx`, use `verify-cold-launch`.
