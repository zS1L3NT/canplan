# Experiment: a school planner for NUS students

This file records the decisions from a grilling session on 21 November 2026, at the end of Semester 1 AY26/27. It covers how the current Canvas workflow is really used, what to drop, and what to build next. It is a plan, not code. Nothing here changes the running nus-canvas-sync server.

## How the current workflow is really used

The evidence comes from the server, the Notion Task Tracker, and the Codex and Claude chat history.

- **Canvas reports** ran about every 5 days: 14, 15, 20, 25 and 29 October, then 10 and 16 November. The gap before 10 November was 12 days. Each report took 4 to 10 minutes, because it also audited Notion and Google Calendar.
- **Course questions** were the most frequent use, often asked from a phone and answered from the saved course text. Examples: "is fx-991cw allowed", "Examplify practice password", "where is the exam", "can I bring in mouse", "What even is ES1103 CA3 about?".
- **Obsidian** was not used. All 835 vault files were generated, and no personal notes were ever written. WebDAV, the tunnel, Remotely Save and about 30% of the code existed only to serve it.
- **What Canvas is really for:** seeing the latest updates per module, and browsing Canvas faster.
- **Notion** is where every day is planned: what to focus on and what to study. The Task Tracker has 153 tasks:
  - 84 were made by hand in August, before this project existed.
  - Only 4 were made in October, after the pipeline went live.
  - 33 were made in November, nearly all personal exam practice ("Final Claude V3", "Final AY24/25 S1").
- **Problems in the Task Tracker:**
  - `Assignee` and `Place` are empty on all 153 tasks.
  - The Schedule calendar uses `Scheduled date`, which only 16 tasks have.
  - The Weekly view's filters have no values set, so they don't filter anything.
  - Priority mixes importance with a task type (Exam).
  - `Due date` is used as a range to fake study windows.
  - There is no Canvas link column, so Canvas items are matched by reading page bodies.
- **Pain points:**
  - The agent once edited `Scheduled date` instead of `Due date`.
  - Google Calendar kept asking to sign in again.
  - About 64% of recorded Canvas "changes" were only timestamp bumps.

## Decisions

### The product

- **New project:** a native SwiftUI app for macOS and iOS. It is not a web app, and not a rework of this repo.
- **For any NUS student**, CS or business, not just one person.
- **Dogfood first:** the author is user #1 in Semester 2. Friends come only after it has replaced the author's own Notion use.
- **Replaces Notion completely.** It has no ties to the author's personal conventions. Each student sets their own rules.

### This repo

- **No changes.** The server, hourly fetch and agent question-answering keep running as they are.
- Later it serves as a reference for the Canvas rules it learned the hard way:
  - finding files behind locked Files and Pages tabs;
  - merging quizzes with their backing assignments;
  - keeping valid downloads when Canvas withholds a link;
  - hiding timestamp-only noise.

### Canvas access

- **Each student's device fetches Canvas itself** through an in-app Canvas login (the normal NUS sign-in). The session stays in that device's Keychain. The author never holds anyone's login.
- **Backup for later:** a server that holds students' logins, so it can fetch hourly and send push alerts. Reconsider it only if on-device fetching proves insufficient.
- **Not pursued for now:** asking NUS for an approved OAuth key.

### Data model

- **Canvas inbox:** new Canvas items land in a per-module inbox. The student chooses which become tasks. Nothing becomes a task automatically.
- **Overrides:**
  - Every Canvas field can be overridden by hand.
  - It shows the Canvas value until changed.
  - If Canvas later changes a field the student overrode, the app flags it in the module feed, with a one-tap "use Canvas value". It never changes the student's value silently.
- **Links:**
  - Tasks link to Canvas items many-to-many.
  - At most one link per task is its **source**: the task takes its deadline and other fields from that item and gets its change flags.
  - Other links are references, such as past-paper files under "CS2030S Final".
- **Own tasks:** tasks with no Canvas link are allowed, for things like exam practice, case readings and group milestones.
- **Dates:** each task has one deadline, any number of planned "work on it" days, and optional sub-tasks.

## First step

Build a tiny iPhone prototype that:

1. opens the NUS Canvas login inside the app;
2. keeps the session in the Keychain;
3. lists the student's modules from the Canvas API.

This tests the riskiest assumption before anything else is built. If NUS's sign-in blocks it, the fallbacks are the Canvas calendar feed link (deadlines only) or asking NUS for an OAuth key.

## Deferred

- What version 1 must do on day one. Candidates:
  - a per-module "what's new" feed, including file replacements;
  - fast browsing and search across modules, cached offline;
  - the inbox-to-tasks flow;
  - own tasks.
- How AI fits in: course question-answering, day planning, which model, and who pays.
- A server for push alerts.
- Importing the NUSMods timetable and exam dates.
- Notion and calendar export for students who want it.
- Distribution through TestFlight or the App Store (the Apple Developer Program costs USD 99 a year).

## Risks

- **The in-app login is unproven at NUS.** It is the first thing to test.
- **Freshness depends on the student's device:** the app updates when opened, plus a few background refreshes a day that iOS schedules. A server cannot fetch for other students without holding their login.
- **Apple-only** leaves out Windows and Android students for now.
- **Instructure is tightening Canvas access:**
  - Since October 2025, student personal tokens expire within 120 days, and schools can block them.
  - Instructure plans to retire them, December 2027 at the earliest.
  - NUS's student guide lists access tokens as "not applicable to NUS users".
  - NUS tightened Canvas access after the May 2026 Canvas breach.

## Research notes

**Friends' workflows**

- **TechSupportz** ([nus-notion-workflow](https://github.com/TechSupportz/nus-notion-workflow)): an urgency dashboard in Notion (Overdue, Due Today, Closing In) with very few properties and no planned work times. Canvas is snapshotted four times a day with canvas-cli, and an AI updates Notion only when something changed.
- **PuttTim** ([canvas-mcp](https://github.com/PuttTim/canvas-mcp), [nusmods-mcp](https://github.com/PuttTim/nusmods-mcp), [skills](https://github.com/PuttTim/skills)): connectors that hand Canvas and NUSMods data to whatever AI the student uses, rather than a planner.

**Existing NUS tools**

- [semsync](https://github.com/gabriel-wan/semsync): Canvas deadlines and NUSMods classes in a calendar.
- N.ext: a Chrome extension with deadlines and bulk downloads.
- [lominus](https://github.com/Beebeeoii/lominus): a desktop file mirror.
- [nus-assistant-bot](https://github.com/lavanyagarg112/nus-assistant-bot): a Telegram bot.
- [canvas-sync.com](https://canvas-sync.com/): a paid Canvas-to-Notion sync.

**Student pain points (web research)**

- The biggest gaps for typical students:
  - a per-module "what changed" feed: Canvas doesn't even alert students when a file is replaced, and NUS students miss LumiNUS's emails that named each file;
  - search and browsing across modules, whatever each course's layout.
- AI day planners and Notion-style setups tend to be abandoned by about week 4.
- Turning Canvas items into tasks is already served by Tasks for Canvas, which has 1M users.

**Business students**

- Their load sits largely outside Canvas assignments: case readings, class participation (10 to 20% or more of the grade), group projects, and external platforms such as McGraw-Hill Connect.
- A Canvas-only task list misses most of it, so own tasks matter as much as Canvas items.
