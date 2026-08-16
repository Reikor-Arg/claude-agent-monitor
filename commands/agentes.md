---
description: Show the background agents and tasks running right now
allowed-tools: Bash(node:*)
---

Current agent state:

!`node "${CLAUDE_PLUGIN_ROOT}/core.js" --table "$PWD"`

Show that table as is. If any is flagged 🔴 with no output for several minutes,
point it out: it's a candidate for being hung.
