const vscode = require('vscode');
const { execFile } = require('child_process');
const core = require('./core.js');

const REFRESH_INTERVAL_MS = 2000;

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

  _buildItems() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.currentTasksFolder = null;
      return [this._messageItem(vscode.l10n.t('No active session'))];
    }

    let result;
    try {
      result = core.scan(folders[0].uri.fsPath);
    } catch (e) {
      result = { tasksFolder: null, agents: [] };
    }

    this.currentTasksFolder = result.tasksFolder;

    if (!result.tasksFolder) {
      return [this._messageItem(vscode.l10n.t('No active session'))];
    }
    if (result.agents.length === 0) {
      return [this._messageItem(vscode.l10n.t('No tasks in the active session'))];
    }

    // Los que dejaron de escribir siguen listados: un agente colgado deja de
    // escribir igual que uno que terminó, y ocultarlos era perder justo la señal
    // que se busca.
    return result.agents.slice(0, 30).map((a) => {
      // Lo que hace el agente va de label y el tiempo de descripción: al revés,
      // el panel es angosto y recortaba justo lo único que interesa, dejando a
      // la vista un id que no dice nada.
      const label = a.snippet ? core.truncate(a.snippet, 40) : a.id;
      const detail = a.working ? a.idle : `${a.level === 'stuck' ? '🔴 STUCK?' : '🟠'} ${a.idle} no output`;
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
      item.description = detail;
      item.iconPath = new vscode.ThemeIcon(
        a.working ? 'sync~spin' : 'warning',
        a.level === 'stuck' ? new vscode.ThemeColor('errorForeground') : undefined
      );
      item.tooltip = `${a.id}\n${detail}${a.snippet ? '\n' + a.snippet : ''}`;
      item.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [vscode.Uri.file(a.filePath)]
      };
      return item;
    });
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
