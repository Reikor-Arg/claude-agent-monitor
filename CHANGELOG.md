# Changelog

## 0.1.4

- El panel muestra **lo que hace el agente** como texto principal y el tiempo al
  costado. Antes el texto principal era el id (`b01x4494x`), que no dice nada, y
  lo único útil quedaba recortado por el ancho del panel.

## 0.1.3

- Arreglado: una tarea recién arrancada, todavía sin salida que mostrar, decía
  "No agents working right now" — exactamente lo contrario de lo que pasaba.
  Ahora muestra solo el tiempo.
- Screenshot real del panel en el README.

## 0.1.2

- El corte para dejar de mostrar una tarea muda baja de 30 a 10 minutos. Una
  tarea muerta sin cerrar no se distingue de una colgada, así que quedaba media
  hora ocupando el panel.

## 0.1.1

- Arreglado el falso positivo: una tarea que **terminó** se marcaba 🔴 igual que
  una colgada. El `.output` cierra con `[exited with code N]`, así que ahora las
  terminadas se descartan y 🔴 queda solo para las que dejaron de escribir sin
  cerrar. Es la señal que faltaba y estaba en el propio archivo.
- `test.js`: chequeo mínimo del marcador (`node test.js`).

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
