# Claude Agent Monitor

Shows [Claude Code](https://claude.com/product/claude-code) background agents and tasks: **how many are running, for how long, and what they are doing**. No dependencies, and **it costs no tokens**.

![Claude Agents panel in VS Code](docs/screenshot-vscode.png)

It exists for the case you can't see otherwise: a **hung** agent stops writing exactly like one that finished. The monitor flags those 🔴 with how long they've been silent.

## Two ways to install it, depending on where you use Claude

| Where you work | What you install | What you get |
|---|---|---|
| Terminal / desktop app | **Claude Code plugin** | one status line on every action |
| VS Code | **extension** | a sidebar panel that refreshes itself |

Both read the same files and can be used together.

### Claude Code plugin

```
/plugin marketplace add Reikor-Arg/claude-agent-monitor
/plugin install agent-monitor
```

On every action you get:

```
⚡ 2/3 running · a3f2 4m Grep · b8c1 🔴 12m no output
```

And on demand:

```
/agentes
```

**Heads up:** `/plugin` currently exists only in the terminal CLI. In the desktop app and the VS Code extension it answers `/plugin isn't available in this environment`. There, add it to `~/.claude/settings.json` by hand:

```json
{
  "extraKnownMarketplaces": {
    "agent-monitor": { "source": { "source": "github", "repo": "Reikor-Arg/claude-agent-monitor" } }
  },
  "enabledPlugins": {
    "agent-monitor@agent-monitor": true
  }
}
```

### VS Code extension

Download `agent-monitor-<version>.vsix` from [Releases](https://github.com/Reikor-Arg/claude-agent-monitor/releases), then `Ctrl+Shift+P` → *Extensions: Install from VSIX…* → Reload Window. The **Claude Agents** panel shows up in the Explorer.

Or build it yourself:

```
npx @vscode/vsce package
code --install-extension agent-monitor-0.1.6.vsix
```

## How it reads the state

Claude Code writes each task's output to `<temp>/claude/<project>/<session>/tasks/*.output`. The monitor watches those files:

- wrote less than 30 s ago → 🟢 working
- silent for 2 minutes → 🟠 worth a look
- silent for 5 minutes → 🔴 `STUCK?`, sorted to the top
- closed with `[exited with code N]` → finished, not shown

A task that stopped writing without closing is **never hidden by age**. That was a real bug: a 10-minute cutoff once buried an agent that had been frozen for half an hour, which is precisely the case this tool exists for.

Past 2 minutes of silence the hook also tells the main agent, through `additionalContext`, in the shortest form that carries the information:

```
STUCK? b8c1 4m a3f2 12m
```

Around 10 tokens, and only when something is actually silent. It's the one place the monitor spends anything at all, and it buys the main agent the chance to check on the task or kill it.

That marker at the end of the file is what separates "finished" from "hung": without it both look identical, because both stop writing.

## Why it costs no tokens

The plugin reports through the `systemMessage` field of a `PostToolUse` hook: that is shown **to the user** and never enters the model's context. The VS Code extension runs entirely inside the editor. Neither sends anything to the model.

Claude Code's *statusline* can't be used here — it's measured: neither the desktop app nor the VS Code extension ever executes it. That's why this is two pieces instead of one.

## Scope

Unofficial project, **not affiliated with or endorsed by Anthropic**. It reads an internal, undocumented file layout; if that changes, the monitor may stop showing data until it's updated.

## License

MIT — see [LICENSE](LICENSE).
