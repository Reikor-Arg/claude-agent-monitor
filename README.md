# Claude Agent Monitor

A minimal, dependency-free VS Code extension that shows [Claude Code](https://claude.com/product/claude-code) background agents and tasks for the current workspace in a sidebar view.

![screenshot](docs/screenshot.png)

## What it does

Claude Code writes the output of background shell commands and sub-agents to per-session `.output` files under its temp folder. This extension reads those files (without ever loading large ones in full) and lists them in an Explorer sidebar view called **Claude Agents**, refreshing every 2 seconds:

- One entry per task/agent in the **most recent session** of the open workspace.
- Whether it's **active** (file modified in the last 30 seconds) or finished, and a relative timestamp.
- A short snippet of the latest activity — last output line for shell commands, or the last tool/text event for agent transcripts.
- Click an entry to open its raw `.output` file.
- Commands: **Claude Agents: Refresh** and **Claude Agents: Open Tasks Folder**.

## Install (unpackaged, for development/local use)

Copy this folder into your VS Code extensions directory so `package.json` sits at its root:

- Windows: `%USERPROFILE%\.vscode\extensions\teraserver.agent-monitor-0.0.1\`
- macOS/Linux: `~/.vscode/extensions/teraserver.agent-monitor-0.0.1/`

Then reload VS Code (`Ctrl+Shift+P` / `Cmd+Shift+P` → "Reload Window").

## Package as a .vsix (optional)

If you want a distributable package instead of a raw folder copy:

```
npx @vscode/vsce package
```

This produces a `.vsix` file you can install via "Install from VSIX..." in the Extensions view.

## Scope / Disclaimer

This is an unofficial, community project — **not affiliated with or endorsed by Anthropic**. It works by reading `.output` files that Claude Code happens to leave in its OS temp folder while running background tasks. That file layout is an internal implementation detail, not a documented or stable interface: if Anthropic changes it, this view may simply show nothing until the extension is updated.

## License

MIT — see [LICENSE](LICENSE).

---

## En castellano

Extensión mínima de VS Code, sin dependencias, que muestra en una vista lateral los agentes y tareas en segundo plano de Claude Code para el workspace abierto. Lee los archivos `.output` que Claude Code deja en su carpeta temporal (leyendo solo la cola de los archivos grandes, nunca el archivo entero) y los lista con estado (activo/terminado), tiempo relativo y un snippet de la última actividad. Instalación: copiar la carpeta a `~/.vscode/extensions/teraserver.agent-monitor-0.0.1/` (ver rutas exactas arriba) y recargar VS Code.

**Aviso**: proyecto no oficial, sin afiliación con Anthropic. Lee un formato de archivos interno y no documentado de Claude Code; si ese formato cambia, la vista puede dejar de mostrar datos hasta que se actualice la extensión.
