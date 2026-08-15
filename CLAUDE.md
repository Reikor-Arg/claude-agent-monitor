# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build / run / test

There is no build step, no dependencies, and no test suite. `extension.js` is plain CommonJS loaded directly by VS Code.

- Run it: copy (or symlink) the repo folder to `%USERPROFILE%\.vscode\extensions\teraserver.agent-monitor-<version>\`, then "Reload Window". The folder name must carry the version from `package.json`.
- Package: `npx @vscode/vsce package` → `agent-monitor-<version>.vsix` (gitignored; the built `.vsix` files in the repo root are untracked artifacts).
- Verify a change: reload the window and watch the **Claude Agents** view in the Explorer while a Claude Code background task is running in this workspace. The view self-refreshes every 2 s, so no manual step is needed after the reload.

## Architecture

The extension reads Claude Code's undocumented on-disk layout for background tasks. Everything lives in [extension.js](extension.js); the interesting part is how it locates and interprets those files.

**Discovery chain** (`_findMostRecentTasksFolder`): base dir → `<slug>` → session dir → `tasks/`.

- Base dirs are tried in order: `os.tmpdir()/claude`, then `%LOCALAPPDATA%\Temp\claude`. Both are checked because VS Code's `os.tmpdir()` does not always match the temp dir the Claude Code CLI process used.
- `<slug>` is the workspace path with `[:\\/.]` collapsed to `-` (`getSlug`) — must stay byte-identical to what Claude Code produces or nothing is found.
- The active session is picked by the **newest mtime among the `.output` files** inside each session's `tasks/`, not by the directory mtime: on Windows a directory's mtime does not change when a file inside it grows, so directory mtime picks a stale session.

**File-name convention** decides how a task is summarized: names starting with `a` are agent transcripts (JSONL — parse lines from the end, pull the last `tool_use` name or `text` from `message.content`); names starting with `b` are shell output (last non-empty line). Anything else gets no snippet and falls back to `active <relative time>`.

**Bounded reads**: these files can be huge and are re-read every 2 s. Files under `INLINE_READ_LIMIT_BYTES` (8 KB) are read whole; larger ones only get their last `TAIL_BYTES` (4 KB) via `fs.openSync`/`readSync`. Keep any new reader on this path — never `readFileSync` an `.output` unconditionally.

**Display policy**: only tasks whose mtime is within `ACTIVE_THRESHOLD_MS` (30 s) are listed, newest first, capped at 30 items. Finished tasks are deliberately not shown — `agentMonitor.openTasksFolder` is the escape hatch for those. The three "nothing to show" states are distinct strings (no session / no tasks in session / nothing active) and that distinction is the main debugging signal for where the discovery chain broke.

The whole `_buildItems` path is defensive by design: every `fs` call is wrapped, and a failure degrades to "no session" rather than throwing — a temp folder that vanishes mid-refresh is normal.

## Localization

Two separate mechanisms, both must be updated for a new user-facing string:

- `package.json` `%key%` placeholders resolve against `package.nls.json` / `package.nls.es.json`.
- Runtime `vscode.l10n.t('English string')` resolves against `l10n/bundle.l10n.json` / `l10n/bundle.l10n.es.json`, where the **English string itself is the key**. Changing the English text in code without changing the key in both bundles silently drops the Spanish translation.

## Conventions

- Code, identifiers and user-facing strings are English; in-code comments explaining non-obvious platform behavior are in Spanish (see the Windows mtime comments). Match the surrounding language when editing.
- No dependencies. Node stdlib + `vscode` only.
- `agentMonitor.openTasksFolder` shells out to `explorer` — Windows-only, intentionally.
- Release: bump `version` in [package.json](package.json), add a [CHANGELOG.md](CHANGELOG.md) entry, and remember the install-folder name in [README.md](README.md) embeds the version.

---

# Handoff — 2026-08-15 (leer antes de tocar nada)

## A dónde va el proyecto ahora

La extensión de VS Code (v0.0.2) **ya no es el entregable**. El objetivo pasó a ser un **plugin de Claude Code** que reporte agentes activos: cuántos, hace cuánto y qué están haciendo.

El objetivo real no es mirar los agentes, es **detectar los colgados o los procesos muy largos**. Por eso quedó descartado el hook `SubagentStop`: avisa cuando el subagente ya terminó, o sea tarde. Cualquier diseño tiene que mostrar el agente *mientras* está trabado.

## Lo que ya se averiguó (medido, no supuesto)

**1. `tasks/` sola no alcanza.** Se miró el `tasks/` real de una sesión: solo hay archivos `.output`, **no hay `.status` ni `.pid`**. Un `Bash` de primer plano también deja su `.output`. Por lo tanto un agente colgado y uno terminado se ven **idénticos** — los dos dejan de escribir. [extension.js:251](extension.js#L251) arrastra ese agujero: a los 30 s sin escribir saca la entrada sin saber qué pasó.

La señal que falta está en el transcript de sesión (`~/.claude/projects/<slug>/<session>.jsonl`): un `tool_use` sin su `tool_result` = sigue corriendo. La statusline recibe `transcript_path` por stdin, así que el cruce sale gratis.

| transcript | mtime `.output` | estado |
|---|---|---|
| sin `tool_result` | fresco | trabajando |
| sin `tool_result` | viejo | **colgado** ← lo que se busca |
| con `tool_result` | — | terminó, no mostrar |

**2. Costo de los canales.** Statusline = **0 tokens**, no entra al contexto. Hooks que inyectan ≈ **40 tok por inyección**, y quedan en el historial (se re-mandan cada turno): ~20 inyecciones ≈ 1.000 tok fijos, ~$0.0005/turno sobre el prefijo medido de 56.740 tok. Barato en plata, ruidoso en contexto.

**3. La statusline no corrió ni una vez.** Sonda instalada, 150 s de sesión quieta: `n=1`, y ese 1 fue un smoke test a mano desde la shell. No corrió ni en idle ni con actividad de UI.

## LO QUE QUEDÓ PENDIENTE — primer paso de la próxima sesión

Hay **dos causas posibles sin separar**, y la respuesta define el diseño entero:

1. `statusLine` se lee al arrancar la sesión y se agregó con la sesión ya corriendo → no la tomó. (Lo más probable.)
2. La statusline no existe en la extensión nativa de VS Code (es del CLI del terminal). Si es esto, **el canal está muerto** para el flujo real del usuario y hay que replantear: hooks (con su costo) o volver a una vista lateral.

**El test es reiniciar VS Code** — que es justo lo que el usuario iba a hacer. Al volver, leer el log:

```powershell
Get-Content "C:\Users\santi\AppData\Local\Temp\claude\d--Claude-vscode-agent-monitor\13e6b991-212d-4fdc-9eb6-0fa625a28d05\scratchpad\statusline-probe.log"
```

- Contador **subió** de 1 → era la causa (1), la statusline sirve, seguir con statusline + detector de stale.
- Sigue en **1** → era la causa (2), replantear canal antes de escribir nada.

## Estado de la máquina (esto quedó tocado, no es solo lectura)

- **`~/.claude/settings.json` tiene una clave `statusLine` agregada** apuntando a la sonda. No había ninguna antes, no se pisó nada. Para revertir: borrar ese bloque de 4 líneas.
- La sonda vive en el scratchpad de la sesión `13e6b991-…`, bajo `%LOCALAPPDATA%\Temp\claude\`. **Es carpeta temporal**: si Windows la limpia, la statusline apunta a un archivo que no existe. Si al reiniciar el script no está, hay que copiarlo a un lugar durable (por ejemplo dentro de este repo) y actualizar la ruta en `settings.json`.
- No se escribió nada de código del plugin todavía. `extension.js` está intacto.

## Decisión de diseño ya tomada

La lógica de datos se recicla de [extension.js](extension.js) tal cual: mismo `<tmp>/claude/<slug>/<sesión>/tasks/*.output`, misma convención `a*`/`b*`, mismo tail de 4 KB. Multiplataforma sale gratis salvo el `execFile('explorer')` de [extension.js:310](extension.js#L310).
