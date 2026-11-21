# Courses

The Courses tab lists the student's modules, with the latest term's academic modules first. A module opens to the tabs Canvas shows for it (Announcements, Assignments, Files, Modules, Pages, Quizzes, Discussions, Grades, Syllabus). The student can hide a module.

## Sub-features

- `courses-list` groups modules by term, with `Other non-academic courses` and `Hidden courses` folded away.
- `course-open` opens a module and its sections.
- `course-files` browses the Files tab as folders.
- `course-hide` hides and unhides a module.

## How to get to it (user POV)

- The `Courses` tab (accessibility label `Canvas courses`).
- A module's code in a task, update, or search result.

## Driving it with scripts/ad

Preconditions:

- Baseline state from `README.md`, in demo mode.

- **Open the tab.** Run `scripts/ad press "$(scripts/ref 'Canvas courses')" --settle`. Term headers with module counts show, and CS2030S is among the modules.
- **Open a module.** Press the `CS2030S` row by its ref. The module screen lists its Canvas sections.
- **Browse files.** Press `Files`. A folder list shows. Open a folder and check the breadcrumb.
- **Hide a module.** Hide CS2030S from the module screen, go back, and check that it is listed under `Hidden courses, N`. Unhide it afterwards. In `planner.json`, `hiddenCourses` holds its course id while it is hidden.

## Gotchas

- Not yet driven end to end. Labels come from `src/app/(tabs)/(courses)/courses.tsx` and `src/app/(tabs)/(tasks,updates,courses,search)/module/[courseID]/`.
- Some NUS modules lock their Files or Pages tab. A section that is missing for one module is not a bug by itself.
