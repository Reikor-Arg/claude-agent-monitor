// Núcleo compartido: lo usan la extensión de VS Code, el hook del plugin y /agentes.
// CommonJS a propósito: extension.js es CJS y no puede require() un .mjs.
const fs = require('fs');
const path = require('path');
const os = require('os');

const ACTIVE_MS = 30 * 1000;
// Pasado este tiempo sin escribir se deja de mostrar. Una tarea muerta sin
// cerrar no se distingue de una colgada, así que el corte es arbitrario: lo
// suficiente para ver el cuelgue, no tanto como para juntar basura.
const IGNORE_MS = 10 * 60 * 1000;
const TAIL_BYTES = 4096;
const INLINE_READ_LIMIT_BYTES = 8192;

function getSlug(workspacePath) {
  return workspacePath.replace(/[:\\/.]/g, '-');
}

function getCandidateBaseDirs() {
  const candidates = [path.join(os.tmpdir(), 'claude')];
  if (process.env.LOCALAPPDATA) {
    const alt = path.join(process.env.LOCALAPPDATA, 'Temp', 'claude');
    if (!candidates.includes(alt)) candidates.push(alt);
  }
  return candidates;
}

function relativeTime(mtimeMs) {
  const s = Math.floor((Date.now() - mtimeMs) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function readFileText(filePath, size) {
  if (size < INLINE_READ_LIMIT_BYTES) return fs.readFileSync(filePath, 'utf8');
  const fd = fs.openSync(filePath, 'r');
  try {
    const start = Math.max(0, size - TAIL_BYTES);
    const len = size - start;
    const buffer = Buffer.alloc(len);
    fs.readSync(fd, buffer, 0, len, start);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function truncate(text, len) {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}

// El runner de tareas cierra el .output con "[exited with code N]". Es la única
// marca en disco que separa "terminó" de "colgado": sin esto, los dos se ven
// igual (los dos dejan de escribir) y todo lo que termina queda como sospechoso.
const EXIT_MARKER = /\[exited with code (-?\d+)\]\s*$/;

function snippetForShellOutput(text) {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.length === 0 || EXIT_MARKER.test(line)) continue;
    return truncate(line, 100);
  }
  return null;
}

function extractSnippetFromEvent(event) {
  const content = event && event.message && event.message.content;
  if (!Array.isArray(content)) return null;
  for (let i = content.length - 1; i >= 0; i--) {
    const item = content[i];
    if (!item) continue;
    if (item.type === 'tool_use' && item.name) return item.name;
    if (item.type === 'text' && item.text) {
      const text = truncate(item.text, 100);
      if (text.length > 0) return text;
    }
  }
  return null;
}

function snippetForAgentTranscript(text) {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const snippet = extractSnippetFromEvent(JSON.parse(line));
      if (snippet) return snippet;
    } catch (e) {
      continue;
    }
  }
  return null;
}

// La fecha de la carpeta no cambia cuando un archivo crece (Windows): la
// actividad real es el mtime más nuevo de sus archivos .output.
function findTasksFolder(workspacePath) {
  const slug = getSlug(workspacePath);
  for (const baseDir of getCandidateBaseDirs()) {
    const projectDir = path.join(baseDir, slug);
    try {
      if (!fs.existsSync(projectDir)) continue;
      const subdirs = fs.readdirSync(projectDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      let bestMtime = -1;
      let bestPath = null;
      for (const d of subdirs) {
        const tasksPath = path.join(projectDir, d.name, 'tasks');
        try {
          let newest = fs.statSync(tasksPath).mtimeMs;
          for (const name of fs.readdirSync(tasksPath)) {
            if (!name.endsWith('.output')) continue;
            try {
              const m = fs.statSync(path.join(tasksPath, name)).mtimeMs;
              if (m > newest) newest = m;
            } catch (e) {}
          }
          if (newest > bestMtime) {
            bestMtime = newest;
            bestPath = tasksPath;
          }
        } catch (e) {}
      }
      if (bestPath) return bestPath;
    } catch (e) {}
  }
  return null;
}

// Estado = marcador de salida + mtime. Con el marcador ya no hace falta cruzar
// el transcript de sesión: el propio .output dice si el proceso terminó.
function scan(workspacePath) {
  const tasksFolder = findTasksFolder(workspacePath);
  if (!tasksFolder) return { tasksFolder: null, agents: [] };

  let files;
  try {
    files = fs.readdirSync(tasksFolder).filter((n) => n.endsWith('.output'));
  } catch (e) {
    return { tasksFolder: null, agents: [] };
  }

  const now = Date.now();
  const agents = [];
  for (const name of files) {
    const filePath = path.join(tasksFolder, name);
    let st;
    try {
      st = fs.statSync(filePath);
    } catch (e) {
      continue;
    }
    const idleMs = now - st.mtimeMs;
    if (idleMs > IGNORE_MS) continue;

    let text = '';
    try {
      text = readFileText(filePath, st.size);
    } catch (e) {}

    // Terminada = no interesa. Lo que importa es lo que corre y lo que quedó mudo.
    if (EXIT_MARKER.test(text.trimEnd())) continue;

    const snippet = name.startsWith('a')
      ? snippetForAgentTranscript(text)
      : snippetForShellOutput(text);

    agents.push({
      id: name.replace(/\.output$/, ''),
      filePath,
      idleMs,
      idle: relativeTime(st.mtimeMs),
      working: idleMs < ACTIVE_MS,
      snippet
    });
  }

  agents.sort((a, b) => a.idleMs - b.idleMs);
  return { tasksFolder, agents };
}

function formatLine(agents) {
  if (agents.length === 0) return null;
  const parts = agents.slice(0, 4).map((a) => {
    const what = a.snippet ? ` ${truncate(a.snippet, 24)}` : '';
    return a.working ? `${a.id} ${a.idle}${what}` : `${a.id} 🔴 ${a.idle} no output`;
  });
  const working = agents.filter((a) => a.working).length;
  return `⚡ ${working}/${agents.length} running · ${parts.join(' · ')}`;
}

function formatTable(agents) {
  if (agents.length === 0) return 'No agents.';
  const rows = agents.map((a) => {
    const estado = a.working ? '🟢 writing' : `🔴 ${a.idle} no output`;
    return `  ${a.id.padEnd(12)} ${a.idle.padStart(5)}  ${estado.padEnd(22)} ${a.snippet || ''}`.trimEnd();
  });
  return [`AGENTS (${agents.length})`, ...rows].join('\n');
}

module.exports = { scan, formatLine, formatTable, findTasksFolder, getSlug, relativeTime, truncate };

if (require.main === module) {
  const cwd = process.argv[3] || process.cwd();
  const { agents } = scan(cwd);
  if (process.argv[2] === '--line') {
    const line = formatLine(agents);
    if (line) process.stdout.write(line + '\n');
  } else {
    process.stdout.write(formatTable(agents) + '\n');
  }
}
