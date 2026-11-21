---------------------------- MODULE ColdLaunch ----------------------------
(***************************************************************************)
(* The first seconds after Canplan opens with a signed-in Canvas session.  *)
(*                                                                         *)
(* Code (ts-native-canplan/):                                              *)
(*   src/canvas/store.tsx  CanvasProvider: the "Load from disk once"       *)
(*                         effect, refresh, markSeen, addTask,             *)
(*                         updatePlanner, saveCache, savePlanner, diff     *)
(*   src/state/AppState.tsx SignedInBootstrap: refreshRef and the 150 ms   *)
(*                         cold-launch timer                               *)
(*                                                                         *)
(* One course, one assignment "A". On disk from the last session:          *)
(*   canvas-cache.json  snapshot with A due on d0, feed item "X" (seen)    *)
(*   planner.json       task "T0"                                          *)
(* Canvas now says A is due on d1, so this launch's refresh must put a     *)
(* "Due date changed" item for A in the Updates feed.                      *)
(*                                                                         *)
(* Every action is one stretch of JavaScript that runs without an await.   *)
(***************************************************************************)
EXTENDS FiniteSets

CONSTANT
    \* FALSE: the code as it is. TRUE: the fix target, where CanvasProvider
    \* lets no refresh and no save run until its disk load has committed.
    GuardLoaded

\* A snapshot is the assignment's due date as the cache last saw it.
NoSnap == "none"
Snaps == {NoSnap, "d0", "d1"}
CanvasNow == "d1"

\* Feed entries, written id:change. Two entries with the same id replace
\* each other (store.tsx, refresh: `replaced`).
X    == [id |-> "X", change |-> "New"]
ADue == [id |-> "A", change |-> "Due date changed"]
AUpd == [id |-> "A", change |-> "Updated"]
Entries == {X, ADue, AUpd}
Ids(F) == {e.id : e \in F}

Cache(s, f, n) == [snap |-> s, feed |-> f, seen |-> n]
EmptyCache == Cache(NoSnap, {}, {})
DiskAtLaunch == Cache("d0", {X}, {"X"})

VARIABLES
    mem,        \* CanvasProvider `cache` state
    disk,       \* canvas-cache.json
    memTasks,   \* CanvasProvider `planner.tasks` state
    diskTasks,  \* planner.json tasks
    view,       \* cache.snapshots inside the refresh that refreshRef holds
    loadPc,     \* where the "Load from disk once" effect is
    readCache,  \* what f.text() returned for canvas-cache.json
    readTasks,  \* what f.text() returned for planner.json
    refreshPc,  \* "waiting" for the 150 ms timer, "fetching", "done"
    prev,       \* `const prev = cache.snapshots` captured by refresh
    added,      \* tasks the student created this session
    marked      \* ids the student marked seen, not since replaced

vars == <<mem, disk, memTasks, diskTasks, view, loadPc, readCache, readTasks,
          refreshPc, prev, added, marked>>

Init ==
    /\ mem = EmptyCache
    /\ disk = DiskAtLaunch
    /\ memTasks = {}
    /\ diskTasks = {"T0"}
    /\ view = NoSnap
    /\ loadPc = "cacheReading"
    /\ readCache = EmptyCache
    /\ readTasks = {}
    /\ refreshPc = "waiting"
    /\ prev = NoSnap
    /\ added = {}
    /\ marked = {}

Loaded == loadPc = "done" /\ view = mem.snap

\* ---- "Load from disk once" (store.tsx) ----

\* The native read of canvas-cache.json finishes with the file as it is now.
CacheFileRead ==
    /\ loadPc = "cacheReading"
    /\ readCache' = disk
    /\ loadPc' = "cacheRead"
    /\ UNCHANGED <<mem, disk, memTasks, diskTasks, view, readTasks, refreshPc, prev, added, marked>>

\* `setCache(JSON.parse(...))` replaces the whole in-memory cache.
CacheStateSet ==
    /\ loadPc = "cacheRead"
    /\ mem' = readCache
    /\ loadPc' = "plannerReading"
    /\ UNCHANGED <<disk, memTasks, diskTasks, view, readCache, readTasks, refreshPc, prev, added, marked>>

PlannerFileRead ==
    /\ loadPc = "plannerReading"
    /\ readTasks' = diskTasks
    /\ loadPc' = "plannerRead"
    /\ UNCHANGED <<mem, disk, memTasks, diskTasks, view, readCache, refreshPc, prev, added, marked>>

\* `setPlanner(migratePlanner(...))` replaces the whole planner.
PlannerStateSet ==
    /\ loadPc = "plannerRead"
    /\ memTasks' = readTasks
    /\ loadPc' = "done"
    /\ UNCHANGED <<mem, disk, diskTasks, view, readCache, readTasks, refreshPc, prev, added, marked>>

\* ---- React ----

\* A render commits and SignedInBootstrap's effect points refreshRef at the
\* refresh built from the new cache.snapshots.
Commit ==
    /\ view /= mem.snap
    /\ view' = mem.snap
    /\ UNCHANGED <<mem, disk, memTasks, diskTasks, loadPc, readCache, readTasks, refreshPc, prev, added, marked>>

\* ---- refresh (store.tsx) started by the cold-launch timer (AppState.tsx) ----

RefreshStarts ==
    /\ refreshPc = "waiting"
    /\ GuardLoaded => Loaded
    /\ prev' = view
    /\ refreshPc' = "fetching"
    /\ UNCHANGED <<mem, disk, memTasks, diskTasks, view, loadPc, readCache, readTasks, added, marked>>

\* diff(old, snap, firstFetch || !old) for assignment A.
NewFeed(p) ==
    IF p = NoSnap THEN {AUpd}            \* baseline: recent items only, never a due change
    ELSE IF p /= CanvasNow THEN {ADue}
    ELSE {}

\* The Canvas fetch returns; setCache((c) => ...) merges into the current
\* cache and saveCache(next) writes the result.
RefreshFinishes ==
    LET nf == NewFeed(prev)
        replaced == Ids(nf)
        next == Cache(CanvasNow,
                      nf \cup {e \in mem.feed : e.id \notin replaced},
                      mem.seen \ replaced)
    IN /\ refreshPc = "fetching"
       /\ mem' = next
       /\ disk' = next
       /\ refreshPc' = "done"
       /\ marked' = marked \ replaced
       /\ UNCHANGED <<memTasks, diskTasks, view, loadPc, readCache, readTasks, prev, added>>

\* ---- The student ----

\* markSeen on an item the Updates tab shows; saveCache writes the whole cache.
StudentMarksSeen ==
    /\ GuardLoaded => Loaded
    /\ \E e \in mem.feed :
        /\ e.id \notin mem.seen
        /\ mem' = [mem EXCEPT !.seen = @ \cup {e.id}]
        /\ disk' = mem'
        /\ marked' = marked \cup {e.id}
    /\ UNCHANGED <<memTasks, diskTasks, view, loadPc, readCache, readTasks, refreshPc, prev, added>>

\* addTask through updatePlanner; savePlanner writes the whole planner.
StudentAddsTask ==
    /\ GuardLoaded => Loaded
    /\ "T1" \notin added
    /\ memTasks' = memTasks \cup {"T1"}
    /\ diskTasks' = memTasks'
    /\ added' = added \cup {"T1"}
    /\ UNCHANGED <<mem, disk, view, loadPc, readCache, readTasks, refreshPc, prev, marked>>

Settled == loadPc = "done" /\ refreshPc = "done" /\ view = mem.snap

\* Nothing left to happen. Keeps TLC from calling a finished launch a deadlock.
Idle == Settled /\ UNCHANGED vars

Next ==
    \/ CacheFileRead \/ CacheStateSet \/ PlannerFileRead \/ PlannerStateSet
    \/ Commit
    \/ RefreshStarts \/ RefreshFinishes
    \/ StudentMarksSeen \/ StudentAddsTask
    \/ Idle

Spec == Init /\ [][Next]_vars

\* ---- Rules ----

TypeOK ==
    /\ mem.snap \in Snaps /\ mem.feed \subseteq Entries /\ mem.seen \subseteq {"X", "A"}
    /\ disk.snap \in Snaps /\ disk.feed \subseteq Entries /\ disk.seen \subseteq {"X", "A"}
    /\ memTasks \subseteq {"T0", "T1"} /\ diskTasks \subseteq {"T0", "T1"}

\* The app can be killed at any moment, so planner.json must always hold
\* every task: the ones from before launch and the ones made since.
TasksKept == ({"T0"} \cup added) \subseteq diskTasks

\* canvas-cache.json keeps every seen mark, unless a refresh brought a newer
\* version of that item (which is then unread again on purpose).
SeenKept == ({"X"} \cup marked) \subseteq disk.seen

\* Once the launch settles, the Updates feed shows that A's due date changed.
DueChangeShown == Settled => ADue \in mem.feed

\* Once the launch settles, what the screens show is what is on disk.
ScreenMatchesDisk == Settled => (mem = disk /\ memTasks = diskTasks)
=============================================================================
