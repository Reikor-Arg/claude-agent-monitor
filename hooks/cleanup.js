// Borra los .output de tareas que con certeza ya no corren.
//
// Dos momentos, los dos con certeza — nunca se borra por edad, porque una tarea
// callada hace rato puede seguir viva y ese es justo el caso que interesa:
//
//   TaskStop     -> la tarea que se acaba de matar. Muere de golpe, sin escribir
//                   su "[exited with code N]", y quedaba marcada como colgada
//                   para siempre.
//   SessionStart -> los sobrantes de OTRAS sesiones. Si la sesión no es la
//                   actual, sus procesos ya no existen.
const fs = require('fs');
const path = require('path');
const { findTasksFolder, getSlug } = require('../core.js');
const os = require('os');

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let payload = {};
  try {
    // Hay shells que anteponen BOM al pipe; JSON.parse lo rechaza.
    payload = JSON.parse(input.replace(/^﻿/, ''));
  } catch (e) {
    process.exit(0);
  }

  const cwd = payload.cwd || process.cwd();

  if (payload.hook_event_name === 'PostToolUse') {
    const id = payload.tool_input && (payload.tool_input.task_id || payload.tool_input.shell_id);
    if (!id) process.exit(0);
    try {
      const folder = findTasksFolder(cwd);
      if (folder) fs.unlinkSync(path.join(folder, `${id}.output`));
    } catch (e) {}
    process.exit(0);
  }

  // SessionStart: barrer las carpetas de sesiones que no son la actual.
  const actual = payload.session_id;
  if (!actual) process.exit(0);

  const bases = [path.join(os.tmpdir(), 'claude')];
  if (process.env.LOCALAPPDATA) bases.push(path.join(process.env.LOCALAPPDATA, 'Temp', 'claude'));

  for (const base of bases) {
    const projectDir = path.join(base, getSlug(cwd));
    let sesiones;
    try {
      sesiones = fs.readdirSync(projectDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch (e) {
      continue;
    }
    for (const s of sesiones) {
      if (s.name === actual) continue;
      const tasks = path.join(projectDir, s.name, 'tasks');
      let files;
      try {
        files = fs.readdirSync(tasks).filter((n) => n.endsWith('.output'));
      } catch (e) {
        continue;
      }
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(tasks, f));
        } catch (e) {}
      }
    }
  }
  process.exit(0);
});
