const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const REFRESH_INTERVAL_MS = 2000;
const ACTIVE_THRESHOLD_MS = 30000;
const TAIL_BYTES = 4096;
const INLINE_READ_LIMIT_BYTES = 8192;

function getSlug(workspacePath) {
  return workspacePath.replace(/[:\\/.]/g, '-');
}

function getCandidateBaseDirs() {
  const candidates = [path.join(os.tmpdir(), 'claude')];
  if (process.env.LOCALAPPDATA) {
    const alt = path.join(process.env.LOCALAPPDATA, 'Temp', 'claude');
    if (!candidates.includes(alt)) {
      candidates.push(alt);
    }
  }
  return candidates;
}

function relativeTime(mtimeMs) {
  const diffSec = Math.floor((Date.now() - mtimeMs) / 1000);
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}min ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function readFileTail(filePath, size) {
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

function readFileText(filePath, size) {
  if (size < INLINE_READ_LIMIT_BYTES) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return readFileTail(filePath, size);
}

function truncate(text, len) {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}

function snippetForShellOutput(filePath, size) {
  try {
    const text = readFileText(filePath, size);
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.length > 0) {
        return truncate(line, 100);
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function extractSnippetFromEvent(event) {
  const content = event && event.message && event.message.content;
  if (!Array.isArray(content)) {
    return null;
  }
  for (let i = content.length - 1; i >= 0; i--) {
    const item = content[i];
    if (!item) {
      continue;
    }
    if (item.type === 'tool_use' && item.name) {
      return `\u{1F527} ${item.name}`;
    }
    if (item.type === 'text' && item.text) {
      const text = truncate(item.text, 100);
      if (text.length > 0) {
        return text;
      }
    }
  }
  return null;
}

function snippetForAgentTranscript(filePath, size) {
  try {
    const text = readFileText(filePath, size);
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      try {
        const event = JSON.parse(line);
        const snippet = extractSnippetFromEvent(event);
        if (snippet) {
          return snippet;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

class AgentMonitorProvider {
  constructor() {
    this._emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._emitter.event;
    this.currentTasksFolder = null;
  }

  refresh() {
    this._emitter.fire();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren() {
    return this._buildItems();
  }

  _messageItem(text) {
    return new vscode.TreeItem(text, vscode.TreeItemCollapsibleState.None);
  }

  _findMostRecentTasksFolder() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }
    const workspacePath = folders[0].uri.fsPath;
    const slug = getSlug(workspacePath);

    for (const baseDir of getCandidateBaseDirs()) {
      const projectDir = path.join(baseDir, slug);
      try {
        if (!fs.existsSync(projectDir)) {
          continue;
        }
        const subdirs = fs.readdirSync(projectDir, { withFileTypes: true }).filter((d) => d.isDirectory());
        let bestMtime = -1;
        let bestPath = null;
        for (const d of subdirs) {
          const tasksPath = path.join(projectDir, d.name, 'tasks');
          try {
            // La fecha de la carpeta no cambia cuando un archivo crece
            // (Windows): la actividad real es el mtime más nuevo de sus
            // archivos .output.
            const st = fs.statSync(tasksPath);
            let newest = st.mtimeMs;
            for (const name of fs.readdirSync(tasksPath)) {
              if (!name.endsWith('.output')) {
                continue;
              }
              try {
                const fst = fs.statSync(path.join(tasksPath, name));
                if (fst.mtimeMs > newest) {
                  newest = fst.mtimeMs;
                }
              } catch (e) {
                continue;
              }
            }
            if (newest > bestMtime) {
              bestMtime = newest;
              bestPath = tasksPath;
            }
          } catch (e) {
            continue;
          }
        }
        if (bestPath) {
          return bestPath;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  _buildItems() {
    let tasksFolder;
    try {
      tasksFolder = this._findMostRecentTasksFolder();
    } catch (e) {
      tasksFolder = null;
    }

    this.currentTasksFolder = tasksFolder;

    if (!tasksFolder) {
      return [this._messageItem(vscode.l10n.t('No active session'))];
    }

    let files;
    try {
      files = fs.readdirSync(tasksFolder).filter((n) => n.endsWith('.output'));
    } catch (e) {
      this.currentTasksFolder = null;
      return [this._messageItem(vscode.l10n.t('No active session'))];
    }

    if (files.length === 0) {
      return [this._messageItem(vscode.l10n.t('No tasks in the active session'))];
    }

    const entries = [];
    for (const name of files) {
      const filePath = path.join(tasksFolder, name);
      try {
        entries.push({ name, filePath, st: fs.statSync(filePath) });
      } catch (e) {
        continue;
      }
    }
    // Solo lo que está trabajando AHORA (actividad en los últimos 30 s),
    // lo más reciente primero. Las tareas viejas no se muestran: para eso
    // está el comando de abrir la carpeta.
    entries.sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
    const activos = entries.filter((e) => Date.now() - e.st.mtimeMs < ACTIVE_THRESHOLD_MS);

    if (activos.length === 0) {
      return [this._messageItem(vscode.l10n.t('No agents working right now'))];
    }

    const items = [];
    for (const { name, filePath, st } of activos.slice(0, 30)) {
      const active = true;
      const relative = relativeTime(st.mtimeMs);

      let snippet = null;
      try {
        if (name.startsWith('a')) {
          snippet = snippetForAgentTranscript(filePath, st.size);
        } else if (name.startsWith('b')) {
          snippet = snippetForShellOutput(filePath, st.size);
        }
      } catch (e) {
        snippet = null;
      }
      if (!snippet) {
        snippet = `active ${relative}`;
      }

      const item = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.None);
      item.description = `${relative} — ${snippet}`;
      item.iconPath = new vscode.ThemeIcon(active ? 'sync~spin' : 'check');
      item.tooltip = `${name}\n${relative}\n${snippet}`;
      item.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [vscode.Uri.file(filePath)]
      };
      items.push(item);
    }

    return items;
  }
}

function activate(context) {
  const provider = new AgentMonitorProvider();
  context.subscriptions.push(vscode.window.createTreeView('agentMonitorView', { treeDataProvider: provider }));

  const timer = setInterval(() => provider.refresh(), REFRESH_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });

  context.subscriptions.push(
    vscode.commands.registerCommand('agentMonitor.refresh', () => provider.refresh())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('agentMonitor.openTasksFolder', () => {
      const folder = provider.currentTasksFolder;
      if (!folder) {
        vscode.window.showInformationMessage(vscode.l10n.t('No active session'));
        return;
      }
      execFile('explorer', [folder]);
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
