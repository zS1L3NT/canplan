# Canvas updates

The Updates tab lists what changed on Canvas since the last fetch (new announcements, new or replaced files, changed due dates, new pages), followed by older Canvas history. Unread changes count toward the badge on the tab.

## Sub-features

- `updates-list` shows changes and history, newest first, grouped by section.
- `updates-unread` shows the unread count on the tab label and badge.
- `updates-open` opens an item and marks it seen.
- `updates-mark-all` marks every change seen.
- `updates-refresh` fetches Canvas again (real session only, since demo mode never refreshes).

## How to get to it (user POV)

- The `Updates` tab (accessibility label `Canvas updates` or `Canvas updates, N unread`).

## Driving it with scripts/ad

Preconditions:

- Baseline state from `README.md`, in demo mode. The demo cache has unread changes (56 on 2026-11-21).

- **Open the tab.** Run `scripts/ad press "$(scripts/ref 'Canvas updates')" --settle`. The list shows section headers with counts.
- **Open one item.** Press the first item row by its title from the snapshot. Its detail screen opens. Go back. The unread count in the tab label drops by one.
- **Mark all seen.** Run `scripts/ad press "$(scripts/ref '[button] "Mark all updates as seen"')" --settle`. The tab label reads `Canvas updates`, with no count, and the badge is gone.
- **Check the side effect.** In demo mode, seen marks are not saved (`saveCache` skips demo mode). After a relaunch in demo mode the count comes back. With a real session, `Documents/canvas-cache.json` lists the ids under `seen`.

## Gotchas

- Not yet driven end to end. The labels come from `src/app/(tabs)/(updates)/updates.tsx` and `src/app/(tabs)/_layout.tsx`.
- `Refresh Canvas` does nothing in demo mode. Verifying a refresh needs the user's real Canvas session, and only the user can sign in.
