# Changelog

## 0.1.0

- Nuevo: **plugin de Claude Code** para terminal y app de escritorio. Reporta el
  estado en cada acción vía `systemMessage` de un hook `PostToolUse` — se muestra
  al usuario y no entra al contexto del modelo, así que no consume tokens.
- Nuevo: comando `/agentes`, muestra la tabla completa a pedido.
- La lógica de lectura se movió a `core.js`, compartido por la extensión y el
  plugin.
- Las tareas que dejaron de escribir ya no se ocultan: se marcan 🔴 con el tiempo
  que llevan sin salida. Ocultarlas escondía justo la señal de un agente colgado.

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
