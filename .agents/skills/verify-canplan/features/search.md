# Search

Search finds the student's own tasks and Canvas content (announcements, assignments, files, pages, quizzes, discussions) across all modules, with title matches ranked above body matches. A query needs at least 2 characters.

## Sub-features

- `search-query` returns grouped results for a query.
- `search-short` shows `Keep typing…` for a 1-character query.
- `search-empty` shows `No matches for "<query>"`.
- `search-open` opens a result.

## How to get to it (user POV)

- The search tab, the round magnifying-glass button at the bottom right (accessibility label `Search my tasks and Canvas`).

## Driving it with scripts/ad

Preconditions:

- Baseline state from `README.md`, in demo mode.

- **Open search.** Run `scripts/ad press "$(scripts/ref 'Search my tasks and Canvas')" --settle`. A field with the placeholder `Search my tasks & Canvas…` shows.
- **Search.** Run `scripts/ad fill "$(scripts/ref 'Search my tasks & Canvas')" "final" --settle`. Result groups show, and CS2030S's `Final` assignment is among them.
- **Too short.** Fill `f`. The screen shows `Keep typing…`.
- **No match.** Fill `zzqqxx`. The screen shows `No matches for "zzqqxx"`.

## Gotchas

- Not yet driven end to end. Labels come from `src/app/(tabs)/(search)/search.tsx`.
- Question words are dropped: "where is the exam" searches for `exam`.
