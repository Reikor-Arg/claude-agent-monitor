# Changelog

## 0.2.0

- The age cutoff is gone. With dead tasks removed at the source, elapsed silence
  stopped being evidence of anything, and every cutoff tried so far buried a real
  hang. One accepted hole remains: if the app crashes and you resume that same
  session, its leftover `.output` has no hook to clean it.
## 0.1.9

- Dead tasks are cleaned up instead of lingering as false `STUCK?`: a `TaskStop`
  hook removes the `.output` of a task you kill, and a `SessionStart` hook sweeps
  leftovers from other sessions. Never by age — a quiet task may still be alive.
- Age cutoff back to 2 hours, now that zombies are removed at the source. Ten
  minutes was hiding real hangs.
- The alert to the main agent ends in `check tail, then kill or wait`. Without an
  instruction it was read and ignored.
## 0.1.6

- **Fixed a real miss:** a task silent for 30 minutes had already been dropped
  from the list at the 10 minute mark, so the hang went unnoticed. Unclosed
  tasks are no longer hidden by age — that is the case the monitor exists for.
- Silence now escalates: 🟠 at 2 minutes, 🔴 STUCK? at 5. Stuck ones sort first.
- The hook tells the main agent through `additionalContext` when something has
  been silent for 2+ minutes — just the ids, about 8 tokens,
  and only when there is something wrong.

## 0.1.5

- Everything user-facing is in English now: README, plugin description, `/agentes`
  output and the panel labels.

## 0.1.4

- The panel shows **what the agent is doing** as the main text, with the time on
  the side. It used to show the id (`b01x4494x`), which says nothing, and the
  only useful part got cut off by the panel width.

## 0.1.3

- Fixed: a task that had just started, with no output to show yet, said
  "No agents working right now" — the exact opposite of what was happening.
  Now it shows only the elapsed time.
- Real screenshot of the panel in the README.

## 0.1.2

- The cutoff for hiding a silent task drops from 30 to 10 minutes. A task that
  died without closing can't be told apart from a hung one, so it was sitting in
  the panel for half an hour.

## 0.1.1

- Fixed the false positive: a task that **finished** was flagged 🔴 just like a
  hung one. The `.output` file closes with `[exited with code N]`, so finished
  tasks are now dropped and 🔴 is left for the ones that stopped writing without
  closing. That was the missing signal, and it was inside the file all along.
- `test.js`: minimal check of the marker (`node test.js`).

## 0.1.0

- New: **Claude Code plugin** for the terminal and the desktop app. Reports state
  on every action through the `systemMessage` field of a `PostToolUse` hook — it
  is shown to the user and never enters the model's context, so it costs no
  tokens.
- New: `/agentes` command, shows the full table on demand.
- Reading logic moved to `core.js`, shared by the extension and the plugin.
- Tasks that stopped writing are no longer hidden: they're flagged 🔴 with how
  long they've been silent. Hiding them hid exactly the signal of a hung agent.

## 0.0.1

Initial release.

- Sidebar tree view ("Claude Agents") listing the `.output` files of the most
  recent Claude Code session for the open workspace.
- Auto-refreshes every 2 seconds.
- Distinguishes active tasks (file modified in the last 30 seconds) from
  finished ones, with a relative timestamp.
- Shows a short snippet of the latest activity: last non-empty line for shell
  command output (`b*.output`), or the last parseable tool/text event for
  agent transcripts (`a*.output`), read from the tail of the file only (never
  loads large files in full).
- Click an item to open its `.output` file.
- Commands: "Claude Agents: Refresh" and "Claude Agents: Open Tasks Folder".
- English UI by default, Spanish localization included.
